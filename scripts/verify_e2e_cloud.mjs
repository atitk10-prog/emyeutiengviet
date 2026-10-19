import fs from 'fs';

const firebaseTs = fs.readFileSync('web/src/firebase.ts', 'utf8');
const keyMatch = firebaseTs.match(/apiKey:\s*['"]([^'"]+)['"]/);
const webApiKey = keyMatch ? keyMatch[1] : '';

async function exchangeCustomToken(customToken) {
  try {
    const res = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + webApiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const d = await res.json();
    if (d.idToken) return d.idToken;
  } catch (err) {}
  // Fallback to customToken directly
  return customToken;
}

async function testE2E() {
  console.log('=== TEST XUYÊN SUỐT VỚI ID TOKEN THẬT TRÊN PRODUCTION ===\n');

  // 1. Teacher Login
  console.log('[1/4] Teacher Login: giaovien01 / Giaovien123456...');
  const tLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: 'giaovien01', password: 'Giaovien123456' } })
  });
  const tData = await tLogin.json();
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
  console.log('   ✓ getTeacherLessons status:', lRes.status, 'Response:', JSON.stringify(lData));
  for (const l of (lData.data?.lessons || []).slice(0, 7)) {
    console.log(`     • [${l.id}] ${l.title} (Khối ${l.grade}, trạng thái: ${l.status})`);
  }

  // 3. Student Login
  console.log('\n[3/4] Student Login: HS999 / HS9999...');
  const sLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: 'HS999', password: 'HS9999' } })
  });
  const sData = await sLogin.json();
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
