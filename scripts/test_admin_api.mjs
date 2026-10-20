import fs from 'fs';
import path from 'path';

const webApiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';

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

async function testAdmin() {
  console.log('=== TEST ADMIN API TRÊN PRODUCTION VỚI TOKEN THẬT ===\n');

  const adminUser = loadSecret('ADMIN_USERNAME') || 'admin';
  const adminPass = loadSecret('ADMIN_PASSWORD');

  if (!adminPass) {
    throw new Error('Chưa tìm thấy ADMIN_PASSWORD trong .secret.local');
  }

  // 1. Admin Login
  console.log(`[1/5] Admin Login: ${adminUser} ...`);
  const aLogin = await fetch('https://emyeutiengviet-zeta.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: adminUser, password: adminPass } })
  });
  const aData = await aLogin.json();
  if (!aData.data?.token) {
    throw new Error('Admin login failed: ' + JSON.stringify(aData));
  }
  const customToken = aData.data.token;
  console.log('   ✓ Đăng nhập admin thành công, nhận Firebase Custom Token!');

  const adminIdToken = await exchangeCustomToken(customToken);
  console.log('   ✓ Đã đổi sang Firebase ID Token với claim { role: "admin" }');

  // Test admin actions
  const actions = ['getAdminOverview', 'listTeachers', 'listAllClassesAdmin', 'listAcademicYears', 'getCurriculumFramework'];

  for (const action of actions) {
    console.log(`\nTesting /api/admin action: ${action} ...`);
    const res = await fetch('https://emyeutiengviet-zeta.vercel.app/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + adminIdToken
      },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    console.log(`   ✓ Status: ${res.status}`);
    if (action === 'getAdminOverview') {
      console.log('   Data:', data.data);
    } else if (action === 'listAcademicYears') {
      console.log('   AcademicYears count:', data.data?.academicYears?.length);
      console.log('   Sample:', data.data?.academicYears?.[0]);
    } else if (action === 'listTeachers') {
      console.log('   Teachers count:', data.data?.teachers?.length);
    } else if (action === 'listAllClassesAdmin') {
      console.log('   Classes count:', data.data?.classes?.length);
    }
  }

  console.log('\n=== TEST HOÀN TẤT ===');
}

testAdmin().catch(e => console.error(e));
