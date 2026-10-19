/**
 * EM YÊU TIẾNG VIỆT — CÔNG CỤ KHỞI TẠO & ĐẶT LẠI MẬT KHẨU ADMIN AN TOÀN
 *
 * Chạy cục bộ trên máy của người dùng:
 * node scripts/init_cloud_admin.mjs
 *
 * Tính năng bảo mật cao:
 * 1. Ẩn mật khẩu khi gõ (Masked input với dấu *), không in mật khẩu ra terminal hay log.
 * 2. Tự động kiểm tra trạng thái Admin trên Cloud trước khi thực hiện.
 * 3. Nếu chưa có: Khởi tạo tài khoản Admin duy nhất.
 * 4. Nếu đã có: Đặt lại mật khẩu an toàn, không tạo tài khoản trùng.
 * 5. Mật khẩu được băm OWASP Version 2 (PBKDF2 600.000 vòng lặp) trực tiếp trên máy chủ.
 */

import readline from 'readline';

function askHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Mute stdout to mask password
    let stdinRaw = process.stdin;
    process.stdout.write(query);

    let password = '';
    const onData = (char) => {
      char = char.toString('utf8');
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdinRaw.removeListener('data', onData);
          break;
        case '\u0003': // Ctrl+C
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
    }

    rl.on('line', () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdout.write('\n');
      rl.close();
      resolve(password.trim());
    });
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

async function main() {
  console.log('\n=============================================================');
  console.log('  EM YÊU TIẾNG VIỆT — KHỞI TẠO & ĐẶT LẠI MẬT KHẨU ADMIN CLOUD');
  console.log('=============================================================\n');

  const defaultUrl = 'https://emyeutiengviet-zeta.vercel.app';
  const customUrl = await askQuestion(`Nhập địa chỉ máy chủ [Mặc định: ${defaultUrl}]: `);
  const targetUrl = (customUrl || defaultUrl).replace(/\/$/, '');
  const apiUrl = `${targetUrl}/api/auth`;

  console.log(`\n[1/3] Đang kiểm tra trạng thái Admin trên Cloud (${apiUrl})...`);

  try {
    const checkRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bootstrapAdminAccount',
        data: { actionType: 'check' }
      })
    });

    const checkJson = await checkRes.json();
    if (!checkRes.ok || !checkJson.success) {
      console.error('❌ Không thể kiểm tra trạng thái Admin:', checkJson.error?.message || checkRes.statusText);
      console.log('Gợi ý: Kiểm tra xem Vercel đã deploy commit mới và kết nối Firebase Service Account hay chưa.');
      return;
    }

    if (checkJson.data?.hasAdmin) {
      console.log(`ℹ️  Cloud hiện ĐÃ CÓ tài khoản Quản trị viên (Tên đăng nhập: "${checkJson.data.adminUsername || 'admin'}").`);
      console.log('👉 Quy trình sẽ thực hiện: ĐẶT LẠI MẬT KHẨU MỚI cho tài khoản Admin này (an toàn, không tạo tài khoản trùng).\n');
    } else {
      console.log('ℹ️  Cloud hiện CHƯA CÓ tài khoản Quản trị viên nào.');
      console.log('👉 Quy trình sẽ thực hiện: KHỞI TẠO TÀI KHOẢN ADMIN ĐẦU TIÊN.\n');
    }

    // 2. Nhập thông tin an toàn
    console.log('[2/3] Nhập thông tin xác thực quản trị:');

    let adminSecret = process.env.ADMIN_BOOTSTRAP_SECRET || '';
    if (!adminSecret) {
      adminSecret = await askHidden('Nhập Mã bí mật hệ thống (ADMIN_BOOTSTRAP_SECRET đã cấu hình trên Vercel): ');
      if (!adminSecret) {
        console.error('❌ Lỗi: Mã bí mật ADMIN_BOOTSTRAP_SECRET là bắt buộc.');
        return;
      }
    } else {
      console.log('✓ Đã nhận diện ADMIN_BOOTSTRAP_SECRET từ biến môi trường.');
    }

    const usernameInput = await askQuestion('Tên đăng nhập Admin [Mặc định: admin]: ');
    const username = usernameInput || 'admin';

    let password = '';
    while (true) {
      password = await askHidden('Nhập mật khẩu Admin mới (tối thiểu 8 ký tự, gồm chữ và số): ');
      if (password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password)) {
        break;
      }
      console.log('⚠️  Mật khẩu chưa đủ mạnh. Vui lòng nhập tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số.\n');
    }

    const confirmPassword = await askHidden('Xác nhận lại mật khẩu Admin mới: ');
    if (password !== confirmPassword) {
      console.error('❌ Mật khẩu xác nhận không khớp! Hủy thao tác.');
      return;
    }

    // 3. Gửi yêu cầu khởi tạo/đặt lại
    console.log('\n[3/3] Đang gửi yêu cầu thiết lập Admin lên Cloud...');
    const setupRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'bootstrapAdminAccount',
        data: {
          actionType: 'setup',
          adminSecret,
          username,
          password,
          displayName: 'Quản Trị Viên Hệ Thống'
        }
      })
    });

    const setupJson = await setupRes.json();
    if (!setupRes.ok || !setupJson.success) {
      console.error('\n❌ Thất bại:', setupJson.error?.message || setupRes.statusText);
      return;
    }

    console.log('\n=============================================================');
    console.log('🎉 THÀNH CÔNG RỰC RỠ!');
    console.log(`Thông báo: ${setupJson.data?.message}`);
    console.log(`Tài khoản Admin: "${setupJson.data?.username}"`);
    console.log('Mật khẩu: [ĐÃ THIẾT LẬP VÀ MÃ HÓA OWASP 600.000 VÒNG]');
    console.log('Bây giờ Thầy/Cô có thể đăng nhập ngay tại:');
    console.log(`${targetUrl}/admin/login`);
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Lỗi kết nối:', err.message);
  }
}

main();
