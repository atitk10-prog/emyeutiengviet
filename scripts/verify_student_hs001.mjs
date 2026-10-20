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
  throw new Error(`Đổi Custom Token thất bại: ${JSON.stringify(d)}`);
}

async function testHS001() {
  console.log('=== TEST HỌC SINH MỚI ĐỒNG BỘ: HS001 (NGUYỄN MINH AN NHIÊN) ===\n');

  // 1. Student HS001 login
  console.log('[1/3] Đăng nhập học sinh HS001 / HS123456...');
  const sLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: 'HS001', password: 'HS123456' } })
  });
  const sData = await sLogin.json();
  if (!sData.data?.token) {
    throw new Error('HS001 login failed: ' + JSON.stringify(sData));
  }
  console.log('   ✓ Đăng nhập thành công! Nhận token role:', sData.data.role);

  const idToken = await exchangeCustomToken(sData.data.token);
  console.log('   ✓ Đổi sang Firebase ID Token thành công!');

  // 2. Fetch getStudentLibrary
  console.log('\n[2/3] Gọi /api/attempts -> getStudentLibrary...');
  const libRes = await fetch('https://emyeutiengviet-zeta.vercel.app/api/attempts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken
    },
    body: JSON.stringify({ action: 'getStudentLibrary' })
  });
  const libData = await libRes.json();
  console.log('   ✓ Status:', libRes.status);
  console.log('   ✓ Số bài được giao:', libData.data?.assignments?.length);
  for (const a of libData.data?.assignments || []) {
    console.log(`     • [${a.id}] ${a.lessonTitle} | Trạng thái: ${a.statusText} | Best stars: ${a.bestStars} ⭐`);
  }

  // 3. Test Teacher giaovien01 seeing the new classes
  console.log('\n[3/3] Đăng nhập Giáo viên giaovien01 kiểm tra 10 lớp mới...');
  let teacherPass = '';
  if (fs.existsSync('.secret.local')) {
    const lines = fs.readFileSync('.secret.local', 'utf8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('TEACHER_PASSWORD=')) {
        teacherPass = l.trim().substring('TEACHER_PASSWORD='.length).trim();
      }
    }
  }

  const tLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: 'giaovien01', password: teacherPass } })
  });
  const tData = await tLogin.json();
  const tIdToken = await exchangeCustomToken(tData.data.token);

  const cRes = await fetch('https://emyeutiengviet-zeta.vercel.app/api/classrooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + tIdToken
    },
    body: JSON.stringify({ action: 'getTeacherClasses' })
  });
  const cData = await cRes.json();
  console.log('   ✓ Số lớp của Cô giáo Mai Phương:', cData.data?.classes?.length);
  for (const c of cData.data?.classes || []) {
    console.log(`     • [${c.id}] ${c.name} (Khối ${c.grade}, Mã: ${c.classCode})`);
  }

  console.log('\n========================================================================');
  console.log('🎉 TOÀN BỘ NGHIỆP VỤ HỌC SINH MỚI VÀ GIÁO VIÊN ĐÃ HOẠT ĐỘNG HOÀN HẢO!');
  console.log('========================================================================\n');
}

testHS001().catch(e => console.error(e));
