import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';
import { verifyPassword, verifyAccessCode } from '../api/_helpers/crypto';

async function verifyProvidedCredentials() {
  const db = getDb();
  console.log('=== KIỂM TRA THÔNG TIN ĐĂNG NHẬP VỚI ĐÚNG HÀM CRYPTO DỰ ÁN ===\n');

  // 1. ADMIN
  console.log('1. Kiểm tra Admin (username: admin):');
  const adminUsernameDoc = await db.collection('usernames').doc('admin').get();
  if (adminUsernameDoc.exists) {
    const uData = adminUsernameDoc.data()!;
    const secretDoc = await db.collection('accountSecrets').doc(uData.uid).get();
    if (secretDoc.exists) {
      const s = secretDoc.data()!;
      const iters = Number(s.iterations) || 600000;
      const matchProvided = verifyPassword('Adm_35E0d6ff^42', s.salt, s.passwordHash, iters);
      const matchDefault = verifyPassword('admin', s.salt, s.passwordHash, iters);
      console.log(`  Mật khẩu được cung cấp 'Adm_35E0d6ff^42': ${matchProvided ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`  Mật khẩu mặc định 'admin': ${matchDefault ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
  }

  // 2. TEACHER
  console.log('\n2. Kiểm tra Teacher (username: giaovien01):');
  const gvDoc = await db.collection('usernames').doc('giaovien01').get();
  if (gvDoc.exists) {
    const uData = gvDoc.data()!;
    const secretDoc = await db.collection('accountSecrets').doc(uData.uid).get();
    if (secretDoc.exists) {
      const s = secretDoc.data()!;
      const iters = Number(s.iterations) || 600000;
      const matchProvided = verifyPassword('Gv_6D53d912!64', s.salt, s.passwordHash, iters);
      const matchDefault = verifyPassword('GV123456', s.salt, s.passwordHash, iters);
      console.log(`  Mật khẩu được cung cấp 'Gv_6D53d912!64': ${matchProvided ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`  Mật khẩu mặc định 'GV123456': ${matchDefault ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
  }

  // 3. STUDENT
  console.log('\n3. Kiểm tra Student (studentCode: HS002):');
  const studentSnap = await db.collection('students').where('studentCode', '==', 'HS002').get();
  if (!studentSnap.empty) {
    const sDoc = studentSnap.docs[0];
    const secretDoc = await db.collection('studentSecrets').doc(sDoc.id).get();
    if (secretDoc.exists) {
      const s = secretDoc.data()!;
      const iters = Number(s.iterations) || 600000;
      const matchProvidedPass = verifyPassword('HS123456', s.salt, s.accessCodeHash, iters);
      const matchProvidedCode = verifyAccessCode('HS123456', s.salt, s.accessCodeHash, iters);
      console.log(`  Mật khẩu 'HS123456' (verifyPassword): ${matchProvidedPass ? '✅ MATCH' : '❌ MISMATCH'}`);
      console.log(`  Mã truy cập 'HS123456' (verifyAccessCode): ${matchProvidedCode ? '✅ MATCH' : '❌ MISMATCH'}`);
    }
  }
}

verifyProvidedCredentials().catch(console.error);
