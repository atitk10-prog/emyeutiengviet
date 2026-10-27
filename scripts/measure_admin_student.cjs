// Measure Admin and Student flows on Vercel production
const https = require('https');
const fs = require('fs');
const path = require('path');

function getSecret(key, defaultVal = '') {
  try {
    const p = path.resolve(__dirname, '../.secret.local');
    if (fs.existsSync(p)) {
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
          return trimmed.substring(`${key}=`.length);
        }
      }
    }
  } catch (e) {}
  return defaultVal;
}

async function postApi(url, body, token) {
  const tStart = performance.now();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        const duration = Math.round(performance.now() - tStart);
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resData), duration });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resData, duration });
        }
      });
    });
    req.on('error', (err) => reject({ err, duration: Math.round(performance.now() - tStart) }));
    req.write(data);
    req.end();
  });
}

async function exchangeToken(customToken) {
  const tStart = performance.now();
  const apiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ token: customToken, returnSecureToken: true });
    const req = https.request({
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: JSON.parse(resData), duration: Math.round(performance.now() - tStart) });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runAdminStudentAudit() {
  const BASE_URL = 'https://emyeutiengviet-zeta.vercel.app';

  console.log('=== AUDITING ADMIN FLOW ===');
  const adminUser = getSecret('ADMIN_USERNAME', 'admin');
  const adminPass = getSecret('ADMIN_PASSWORD', 'admin');
  
  const adminLogin = await postApi(`${BASE_URL}/api/auth`, {
    action: 'accountLogin',
    data: { username: adminUser, password: adminPass }
  });
  console.log(`Admin Login: status=${adminLogin.status}, duration=${adminLogin.duration}ms`);

  if (adminLogin.data?.data?.token) {
    const adminToken = (await exchangeToken(adminLogin.data.data.token)).data.idToken;
    const overview = await postApi(`${BASE_URL}/api/admin`, { action: 'getAdminOverview' }, adminToken);
    console.log(`getAdminOverview: status=${overview.status}, duration=${overview.duration}ms`);
    const teachers = await postApi(`${BASE_URL}/api/admin`, { action: 'listTeachers' }, adminToken);
    console.log(`listTeachers: status=${teachers.status}, duration=${teachers.duration}ms`);
    const classes = await postApi(`${BASE_URL}/api/admin`, { action: 'listAllClassesAdmin' }, adminToken);
    console.log(`listAllClassesAdmin: status=${classes.status}, duration=${classes.duration}ms`);
  }

  console.log('\n=== AUDITING STUDENT FLOW ===');
  const studentUser = getSecret('STUDENT_CODE', 'HS001');
  const studentPass = getSecret('STUDENT_PASSWORD', 'HS123456');

  const studentLogin = await postApi(`${BASE_URL}/api/auth`, {
    action: 'accountLogin',
    data: { username: studentUser, password: studentPass }
  });
  console.log(`Student Login: status=${studentLogin.status}, duration=${studentLogin.duration}ms`);

  if (studentLogin.data?.data?.token) {
    const studentToken = (await exchangeToken(studentLogin.data.data.token)).data.idToken;
    const lib = await postApi(`${BASE_URL}/api/attempts`, { action: 'getStudentLibrary' }, studentToken);
    console.log(`getStudentLibrary: status=${lib.status}, duration=${lib.duration}ms`);
    if (lib.data?.data?.assignments) {
      console.log(`Student assignments loaded: ${lib.data.data.assignments.length}`);
    }
  }
}

runAdminStudentAudit().catch(console.error);
