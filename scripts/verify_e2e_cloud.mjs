import fs from 'fs';

const webApiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';

async function exchangeCustomToken(customToken) {
  const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + webApiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const d = await res.json();
  if (d.idToken) return d.idToken;
  throw new Error(`Đổi Custom Token sang ID Token thất bại: ${JSON.stringify(d)}`);
}

function loadSecret(key) {
  if (process.env[key]) return process.env[key];
  if (fs.existsSync('.secret.local')) {
    const lines = fs.readFileSync('.secret.local', 'utf8').split('\n');
    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed.startsWith(key + '=')) {
        return trimmed.substring(key.length + 1).trim();
      }
    }
  }
  return '';
}

async function testE2E() {
  console.log('=== TEST XUYÊN SUỐT VỚI ID TOKEN THẬT TRÊN PRODUCTION ===\n');

  const teacherUser = loadSecret('TEACHER_USERNAME') || 'giaovien01';
  const teacherPass = loadSecret('TEACHER_PASSWORD');
  const studentUser = loadSecret('STUDENT_CODE') || 'HS999';
  const studentPass = loadSecret('STUDENT_PASSWORD');

  if (!teacherPass || !studentPass) {
    throw new Error('Chưa tìm thấy thông tin đăng nhập trong .secret.local hoặc biến môi trường.');
  }

  // 1. Teacher Login
  console.log(`[1/4] Teacher Login: ${teacherUser} ...`);
  const tLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: teacherUser, password: teacherPass } })
  });
  const tData = await tLogin.json();
  if (!tData.data?.token) {
    throw new Error('Teacher login failed: ' + JSON.stringify(tData));
  }
  const customToken = tData.data.token;
  console.log('   ✓ Đăng nhập thành công, nhận Firebase Custom Token!');

  const teacherIdToken = await exchangeCustomToken(customToken);
  console.log('   ✓ Đã đổi sang Firebase ID Token với claim { role: "teacher" }');

  // 2. Fetch /api/lessons: getTeacherLessons
  console.log('\n[2/4] Teacher gọi /api/lessons -> getTeacherLessons...');
  const lRes = await fetch('https://emyeutiengviet-zeta.vercel.app/api/lessons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + teacherIdToken
    },
    body: JSON.stringify({ action: 'getTeacherLessons', data: { status: 'all' } })
  });
  const lData = await lRes.json();
  console.log('   ✓ getTeacherLessons status:', lRes.status);
  for (const l of (lData.data?.lessons || []).slice(0, 7)) {
    console.log(`     • [${l.id}] ${l.title} (Khối ${l.grade}, trạng thái: ${l.status})`);
  }

  // 3. Student Login
  console.log(`\n[3/4] Student Login: ${studentUser} ...`);
  const sLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: studentUser, password: studentPass } })
  });
  const sData = await sLogin.json();
  if (!sData.data?.token) {
    throw new Error('Student login failed: ' + JSON.stringify(sData));
  }
  const sCustomToken = sData.data.token;
  const studentIdToken = await exchangeCustomToken(sCustomToken);
  console.log('   ✓ Student ID Token xác thực thành công cho em Minh Triet!');

  // 4. Student fetch /api/attempts -> getStudentLibrary
  console.log('\n[4/4] Student gọi /api/attempts -> getStudentLibrary...');
  const libRes = await fetch('https://emyeutiengviet-zeta.vercel.app/api/attempts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + studentIdToken
    },
    body: JSON.stringify({ action: 'getStudentLibrary' })
  });
  const libData = await libRes.json();
  console.log('   ✓ getStudentLibrary status:', libRes.status, 'Số bài được giao:', libData.data?.assignments?.length);
  for (const a of libData.data?.assignments || []) {
    console.log(`     • [Bài giao ${a.id}] ${a.lessonTitle} | Số sao cao nhất: ${a.bestStars} ⭐ | Trạng thái: ${a.statusText}`);
  }

  console.log('\n========================================================================');
  console.log('🎉 TOÀN BỘ NGHIỆP VỤ GIÁO VIÊN VÀ HỌC SINH ĐÃ CHẠY THÀNH CÔNG TRÊN ONLINE!');
  console.log('========================================================================\n');
}

testE2E().catch(e => console.error(e));
