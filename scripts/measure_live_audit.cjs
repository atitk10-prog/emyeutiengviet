// Script to test live Vercel endpoints and measure T0 - T5 timings
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

async function runAudit() {
  console.log('=== STARTING PERFORMANCE AUDIT ON VERCEL PRODUCTION ===');
  const BASE_URL = 'https://emyeutiengviet-zeta.vercel.app';
  const teacherUser = getSecret('TEACHER_USERNAME', 'giaovien01');
  const teacherPass = getSecret('TEACHER_PASSWORD', 'GV123456');

  console.log(`Using teacher user: ${teacherUser}`);

  // Step 1: Login
  console.log('\n[T0 -> T1] Testing /api/auth accountLogin...');
  const t0 = performance.now();
  const loginRes = await postApi(`${BASE_URL}/api/auth`, {
    action: 'accountLogin',
    data: { username: teacherUser, password: teacherPass }
  });
  const t1 = performance.now();
  console.log(`Login status: ${loginRes.status}, duration: ${loginRes.duration}ms`);
  
  if (!loginRes.data || !loginRes.data.success || !loginRes.data.data?.token) {
    console.error('Login failed:', loginRes);
    return;
  }
  
  const customToken = loginRes.data.data.token;
  const teacherUid = loginRes.data.data.user?.uid;
  console.log(`Received custom token for UID: ${teacherUid}`);

  // Exchange custom token for ID token using Firebase Auth REST API
  console.log('\n[T1 -> T2] Exchanging Custom Token for ID Token via Firebase Auth REST API...');
  const tAuthStart = performance.now();
  const apiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';
  const exchangeRes = await new Promise((resolve, reject) => {
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
        resolve({ status: res.statusCode, data: JSON.parse(resData), duration: Math.round(performance.now() - tAuthStart) });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  console.log(`Custom Token exchange status: ${exchangeRes.status}, duration: ${exchangeRes.duration}ms`);
  const idToken = exchangeRes.data.idToken;

  // Now measure the exact 4 calls made in loadDashboardData() of TeacherDashboard.tsx
  console.log('\n[T3 -> T5] Testing loadDashboardData calls (as currently executed in TeacherDashboard.tsx):');

  console.log('--- Call 1: getAIStatus (/api/lessons)...');
  const aiRes = await postApi(`${BASE_URL}/api/lessons`, { action: 'getAIStatus' }, idToken);
  console.log(`getAIStatus status: ${aiRes.status}, duration: ${aiRes.duration}ms`);

  console.log('--- Call 2: getTeacherAnalytics (/api/analytics)...');
  const analyticsRes = await postApi(`${BASE_URL}/api/analytics`, { action: 'getTeacherAnalytics', data: {} }, idToken);
  console.log(`getTeacherAnalytics status: ${analyticsRes.status}, duration: ${analyticsRes.duration}ms`);
  if (analyticsRes.data?.data) {
    const d = analyticsRes.data.data;
    console.log(`Analytics summary: classes=${d.totalClasses}, students=${d.totalStudents}, assignments=${d.totalAssignments}, attempts=${d.totalAttempts}, totalRecordedAttempts=${d.totalRecordedAttempts}`);
  }

  console.log('--- Call 3: getTeacherClasses (/api/classrooms)...');
  const classRes = await postApi(`${BASE_URL}/api/classrooms`, { action: 'getTeacherClasses', data: {} }, idToken);
  console.log(`getTeacherClasses status: ${classRes.status}, duration: ${classRes.duration}ms`);
  if (classRes.data?.data?.classes) {
    console.log(`Total classes loaded: ${classRes.data.data.classes.length}`);
  }

  console.log('--- Call 4: getTeacherLessons (/api/lessons)...');
  const lessonRes = await postApi(`${BASE_URL}/api/lessons`, { action: 'getTeacherLessons', data: { status: 'all' } }, idToken);
  console.log(`getTeacherLessons status: ${lessonRes.status}, duration: ${lessonRes.duration}ms`);
  if (lessonRes.data?.data?.lessons) {
    console.log(`Total lessons loaded: ${lessonRes.data.data.lessons.length}`);
  }

  const totalSequentialDuration = aiRes.duration + analyticsRes.duration + classRes.duration + lessonRes.duration;
  console.log(`\n======================================================`);
  console.log(`T0 -> T1 (Login): ${loginRes.duration}ms`);
  console.log(`T1 -> T2 (Token Exchange & Role): ${exchangeRes.duration}ms`);
  console.log(`T3 -> T4 (Sequential Dashboard Loading): ${totalSequentialDuration}ms (${(totalSequentialDuration / 1000).toFixed(2)}s)`);
  console.log(`TOTAL TIME FROM LOGIN TO READY: ${(loginRes.duration + exchangeRes.duration + totalSequentialDuration)}ms (${((loginRes.duration + exchangeRes.duration + totalSequentialDuration)/1000).toFixed(2)}s)`);
  console.log(`======================================================`);

  // Now measure if executed in parallel
  console.log('\n[OPTIMIZATION PREVIEW] Testing PARALLEL execution of all 4 calls...');
  const tParallelStart = performance.now();
  const [pAi, pAnalytics, pClasses, pLessons] = await Promise.all([
    postApi(`${BASE_URL}/api/lessons`, { action: 'getAIStatus' }, idToken),
    postApi(`${BASE_URL}/api/analytics`, { action: 'getTeacherAnalytics', data: {} }, idToken),
    postApi(`${BASE_URL}/api/classrooms`, { action: 'getTeacherClasses', data: {} }, idToken),
    postApi(`${BASE_URL}/api/lessons`, { action: 'getTeacherLessons', data: { status: 'all' } }, idToken),
  ]);
  const totalParallelDuration = Math.round(performance.now() - tParallelStart);
  console.log(`Parallel getAIStatus: ${pAi.duration}ms`);
  console.log(`Parallel getTeacherAnalytics: ${pAnalytics.duration}ms`);
  console.log(`Parallel getTeacherClasses: ${pClasses.duration}ms`);
  console.log(`Parallel getTeacherLessons: ${pLessons.duration}ms`);
  console.log(`>>> TOTAL PARALLEL EXECUTION TIME: ${totalParallelDuration}ms (${(totalParallelDuration / 1000).toFixed(2)}s)`);
}

runAudit().catch(console.error);
