/**
 * EM YÊU TIẾNG VIỆT — KHỞI TẠO & ĐẶT LẠI MẬT KHẨU ADMIN TRỰC TIẾP QUA FIREBASE ADMIN SDK
 *
 * Chạy cục bộ trên máy của bạn:
 *   node scripts/bootstrap_admin_direct.mjs
 *
 * ĐẶC TÍNH BẢO MẬT:
 * 1. Sử dụng tệp Service Account cục bộ (được .gitignore bảo vệ tuyệt đối).
 * 2. Ẩn mật khẩu khi nhập bằng dấu '*' (masked input).
 * 3. Không ghi mật khẩu vào terminal log, file lưu trữ hay Git.
 * 4. Băm mật khẩu theo chuẩn OWASP v2: PBKDF2-HMAC-SHA256 với 600.000 vòng lặp + salt ngẫu nhiên 16 bytes.
 * 5. Tự động liên kết đồng bộ: Firebase Auth Custom Claims (role: 'admin'),
 *    hồ sơ users/{uid}, bí mật accountSecrets/{uid}, ánh xạ usernames/{username}.
 * 6. Nếu Admin đã tồn tại: Cung cấp tính năng đặt lại mật khẩu an toàn, không tạo tài khoản trùng.
 */

import readline from 'readline';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// Masked input for password entry
function askHidden(query) {
  return new Promise((resolve) => {
    let password = '';
    process.stdout.write(query);

    const onData = (char) => {
      char = char.toString('utf8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write('\n');
          resolve(password.trim());
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// OWASP Version 2: PBKDF2 600k iterations
function hashPasswordV2(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex');
  return {
    version: 2,
    algorithm: 'PBKDF2-HMAC-SHA256',
    iterations: 600000,
    salt,
    passwordHash: hash
  };
}

async function main() {
  console.log('\n=============================================================');
  console.log('  EM YÊU TIẾNG VIỆT — KHỞI TẠO ADMIN TRỰC TIẾP CLOUD');
  console.log('  (Sử dụng Firebase Admin SDK cục bộ — Không gửi mật khẩu ra ngoài)');
  console.log('=============================================================\n');

  // 1. Tìm tệp Service Account
  const cwd = process.cwd();
  const files = fs.readdirSync(cwd).filter(f => f.includes('adminsdk') && f.endsWith('.json'));

  if (files.length === 0) {
    console.error('❌ Không tìm thấy tệp Service Account (*adminsdk*.json) trong thư mục dự án.');
    console.error('   Vui lòng đặt tệp Service Account tải từ Firebase Console vào thư mục gốc dự án.');
    process.exit(1);
  }

  const saPath = path.join(cwd, files[0]);
  const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  console.log(`✓ Đã nhận diện tệp xác thực: ${files[0]}`);
  console.log(`✓ Firebase Project: ${sa.project_id}`);
  console.log(`✓ Service Account: ${sa.client_email}\n`);

  // 2. Khởi tạo Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(sa)
  });

  const db = admin.firestore();
  const auth = admin.auth();

  console.log('[1/4] Đang kiểm tra trạng thái Admin trên Cloud Firestore...');
  const usersSnap = await db.collection('users').where('role', '==', 'admin').get();
  const usernameDoc = await db.collection('usernames').doc('admin').get();

  let existingAdminUid = null;
  let existingUsername = 'admin';

  if (!usersSnap.empty) {
    const doc = usersSnap.docs[0];
    existingAdminUid = doc.id;
    existingUsername = doc.data().username || 'admin';
  } else if (usernameDoc.exists) {
    existingAdminUid = usernameDoc.data().uid;
    existingUsername = 'admin';
  }

  if (existingAdminUid) {
    console.log(`⚠️  Phát hiện tài khoản Admin ĐÃ TỒN TẠI trên hệ thống Cloud:`);
    console.log(`   - UID: ${existingAdminUid}`);
    console.log(`   - Tên đăng nhập: ${existingUsername}`);
    const confirm = await askQuestion('\nBạn có muốn ĐẶT LẠI MẬT KHẨU cho tài khoản Admin này không? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('Đã hủy thao tác. Dữ liệu tài khoản được giữ nguyên.');
      process.exit(0);
    }
  } else {
    console.log('✓ Xác minh: Chưa có tài khoản Admin nào tồn tại trên Firebase Cloud.');
    console.log('  Bắt đầu quy trình khởi tạo tài khoản Quản trị viên đầu tiên.');
  }

  // 3. Nhập thông tin tài khoản
  console.log('\n[2/4] Nhập thông tin tài khoản:');
  let username = existingUsername || 'admin';
  if (!existingAdminUid) {
    const inputUsername = await askQuestion(`Nhập tên đăng nhập Admin [Mặc định: admin]: `);
    if (inputUsername) username = inputUsername.trim().toLowerCase();
  }

  let password = '';
  let confirmPass = '';

  while (true) {
    password = await askHidden('Nhập mật khẩu Admin mới (tối thiểu 8 ký tự, gồm chữ và số): ');
    if (password.length < 8) {
      console.log('❌ Mật khẩu phải có ít nhất 8 ký tự. Vui lòng nhập lại.\n');
      continue;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      console.log('❌ Mật khẩu phải chứa cả chữ cái và chữ số để đảm bảo an toàn. Vui lòng nhập lại.\n');
      continue;
    }
    if (password.toLowerCase() === 'admin' || password.toLowerCase() === 'admin123') {
      console.log('❌ Không được sử dụng mật khẩu mặc định/dễ đoán. Vui lòng nhập lại.\n');
      continue;
    }

    confirmPass = await askHidden('Xác nhận lại mật khẩu: ');
    if (password !== confirmPass) {
      console.log('❌ Mật khẩu xác nhận không khớp. Vui lòng nhập lại từ đầu.\n');
      continue;
    }

    break;
  }

  // 4. Băm mật khẩu OWASP v2
  console.log('\n[3/4] Đang mã hóa mật khẩu theo chuẩn OWASP PBKDF2 (600.000 vòng lặp)...');
  const hashRecord = hashPasswordV2(password);

  // 5. Cập nhật hoặc tạo tài khoản đồng bộ trên Firebase Auth & Firestore
  console.log('[4/4] Đang đồng bộ Firebase Auth và Firestore Cloud...');

  let adminUid = existingAdminUid;
  const adminEmail = `${username}@emytv.admin`;

  try {
    if (adminUid) {
      // Đã có UID -> cập nhật Auth user
      try {
        await auth.updateUser(adminUid, {
          displayName: 'Quản trị viên Hệ thống'
        });
        await auth.setCustomUserClaims(adminUid, { role: 'admin' });
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found') {
          // Tạo lại user trên Auth với UID tương ứng
          await auth.createUser({
            uid: adminUid,
            email: adminEmail,
            displayName: 'Quản trị viên Hệ thống'
          });
          await auth.setCustomUserClaims(adminUid, { role: 'admin' });
        } else {
          throw authErr;
        }
      }
    } else {
      // Tạo mới Auth user
      const newAuthUser = await auth.createUser({
        email: adminEmail,
        displayName: 'Quản trị viên Hệ thống'
      });
      adminUid = newAuthUser.uid;
      await auth.setCustomUserClaims(adminUid, { role: 'admin' });
    }

    // Ghi đồng bộ Firestore
    const batch = db.batch();

    const userRef = db.collection('users').doc(adminUid);
    batch.set(userRef, {
      role: 'admin',
      username: username,
      displayName: 'Quản trị viên Hệ thống',
      status: 'active',
      email: adminEmail,
      updatedAt: Date.now()
    }, { merge: true });

    const usernameRef = db.collection('usernames').doc(username.toLowerCase());
    batch.set(usernameRef, {
      uid: adminUid,
      role: 'admin',
      updatedAt: Date.now()
    }, { merge: true });

    const secretRef = db.collection('accountSecrets').doc(adminUid);
    batch.set(secretRef, {
      version: hashRecord.version,
      algorithm: hashRecord.algorithm,
      iterations: hashRecord.iterations,
      salt: hashRecord.salt,
      passwordHash: hashRecord.passwordHash,
      updatedAt: Date.now()
    }, { merge: true });

    await batch.commit();

    console.log('\n=============================================================');
    console.log('🎉 THÀNH CÔNG! TÀI KHOẢN ADMIN ĐÃ ĐƯỢC THIẾT LẬP HOÀN CHỈNH!');
    console.log('=============================================================');
    console.log(`✓ UID:             ${adminUid}`);
    console.log(`✓ Tên đăng nhập:   ${username}`);
    console.log(`✓ Quyền hạn:       Quản trị viên (role: 'admin')`);
    console.log(`✓ Chuẩn băm:       ${hashRecord.algorithm} (OWASP v2 - 600.000 vòng)`);
    console.log(`✓ Firebase Auth:   Đã gán Custom User Claim { role: 'admin' }`);
    console.log(`✓ Cloud Firestore: Đã đồng bộ users, usernames, accountSecrets`);
    console.log('\nBây giờ bạn có thể đăng nhập ngay trên Production tại:');
    console.log('👉 https://emyeutiengviet-zeta.vercel.app/admin/login\n');

  } catch (err) {
    console.error('\n❌ Lỗi trong quá trình thiết lập Admin:', err.message);
    process.exit(1);
  } finally {
    // Xóa bộ nhớ mật khẩu
    password = '';
    confirmPass = '';
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
