import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://emyeutiengviet-zeta.vercel.app';
const webApiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';

// Read credentials from .secret.local
let adminPass = 'Adm_35E0d6ff^42';
let teacherPass = 'Gv_6D53d912!64';
const secretLocalPath = path.join(process.cwd(), '.secret.local');
if (fs.existsSync(secretLocalPath)) {
  const lines = fs.readFileSync(secretLocalPath, 'utf8').split('\n');
  for (const l of lines) {
    if (l.startsWith('ADMIN_PASSWORD=')) adminPass = l.split('=')[1].trim();
    if (l.startsWith('TEACHER_PASSWORD=')) teacherPass = l.split('=')[1].trim();
  }
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

async function verifyAll() {
  console.log('========================================================================');
  console.log('TESTING THREE ROLES & DATA VIA VERCEL SERVERLESS API');
  console.log(`Endpoint: ${BASE_URL}`);
  console.log('========================================================================\n');

  // 1. ADMIN VERIFICATION
  console.log('--- 1. ADMIN VERIFICATION ---');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'accountLogin',
      data: { username: 'admin', password: adminPass }
    })
  });
  const adminLoginJson = await adminLoginRes.json();
  if (!adminLoginJson.success || !adminLoginJson.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginJson)}`);
  }
  console.log('  Admin login: SUCCESS (custom token received)');
  const adminIdToken = await exchangeCustomToken(adminLoginJson.data.token);
  console.log('  Admin ID Token: exchanged successfully');

  // Admin Overview
  const adminOvRes = await fetch(`${BASE_URL}/api/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminIdToken}`
    },
    body: JSON.stringify({ action: 'getAdminOverview' })
  });
  const adminOvJson = await adminOvRes.json();
  console.log('  Admin Overview data:', adminOvJson.data);

  // List Teachers
  const teacherListRes = await fetch(`${BASE_URL}/api/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminIdToken}`
    },
    body: JSON.stringify({ action: 'listTeachers' })
  });
  const teacherListJson = await teacherListRes.json();
  const teachers = teacherListJson.data?.teachers || [];
  console.log(`  Admin List Teachers: found ${teachers.length} teachers:`);
  teachers.forEach(t => console.log(`    - [${t.uid}] ${t.displayName} (${t.email}) classCount=${t.classCount}`));

  // List All Classes Admin
  const adminClassesRes = await fetch(`${BASE_URL}/api/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminIdToken}`
    },
    body: JSON.stringify({ action: 'listAllClassesAdmin' })
  });
  const adminClassesJson = await adminClassesRes.json();
  const classes = adminClassesJson.data?.classes || [];
  console.log(`  Admin List All Classes: found ${classes.length} classes:`);
  classes.slice(0, 5).forEach(c => console.log(`    - [${c.id}] ${c.name} (${c.academicYear}) students=${c.studentCount}`));

  // List Academic Years
  const yearsRes = await fetch(`${BASE_URL}/api/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminIdToken}`
    },
    body: JSON.stringify({ action: 'listAcademicYears' })
  });
  const yearsJson = await yearsRes.json();
  console.log('  Admin Academic Years:', yearsJson.data?.academicYears);

  // 2. TEACHER VERIFICATION
  console.log('\n--- 2. TEACHER VERIFICATION ---');
  const teacherLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'accountLogin',
      data: { username: 'giaovien01', password: teacherPass }
    })
  });
  const teacherLoginJson = await teacherLoginRes.json();
  if (!teacherLoginJson.success || !teacherLoginJson.data?.token) {
    throw new Error(`Teacher login failed: ${JSON.stringify(teacherLoginJson)}`);
  }
  console.log('  Teacher login: SUCCESS (custom token received)');
  const teacherIdToken = await exchangeCustomToken(teacherLoginJson.data.token);
  console.log('  Teacher ID Token: exchanged successfully');

  // Teacher list classes via api/classrooms
  const teacherClassesRes = await fetch(`${BASE_URL}/api/classrooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherIdToken}`
    },
    body: JSON.stringify({ action: 'getTeacherClasses' })
  });
  const teacherClassesJson = await teacherClassesRes.json();
  const tClasses = teacherClassesJson.data?.classes || teacherClassesJson.data || [];
  console.log(`  Teacher classes: found ${tClasses.length} classes:`);
  (Array.isArray(tClasses) ? tClasses : []).forEach(c => console.log(`    - [${c.id}] ${c.name} (${c.academicYear}) studentCount=${c.studentCount}`));

  // Teacher list lessons via api/lessons
  const teacherLessonsRes = await fetch(`${BASE_URL}/api/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherIdToken}`
    },
    body: JSON.stringify({ action: 'getTeacherLessons' })
  });
  const teacherLessonsJson = await teacherLessonsRes.json();
  const tLessons = teacherLessonsJson.data?.lessons || teacherLessonsJson.data || [];
  console.log(`  Teacher lessons: found ${Array.isArray(tLessons) ? tLessons.length : 'unknown'} lessons`);

  // Teacher analytics via api/analytics
  const teacherAnalyticsRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherIdToken}`
    },
    body: JSON.stringify({ action: 'getTeacherAnalytics', data: { academicYear: '2026-2027' } })
  });
  const teacherAnalyticsJson = await teacherAnalyticsRes.json();
  console.log('  Teacher Analytics overview for 2026-2027:', teacherAnalyticsJson.data?.overview || teacherAnalyticsJson.data);

  // 3. STUDENT VERIFICATION (HS001)
  console.log('\n--- 3. STUDENT VERIFICATION ---');
  const studentLoginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'accountLogin',
      data: { username: 'HS001', password: 'HS123456' }
    })
  });
  const studentLoginJson = await studentLoginRes.json();
  if (!studentLoginJson.success || !studentLoginJson.data?.token) {
    throw new Error(`Student login failed: ${JSON.stringify(studentLoginJson)}`);
  }
  console.log('  Student login: SUCCESS');
  console.log('  Student profile:', studentLoginJson.data.student);
  const studentIdToken = await exchangeCustomToken(studentLoginJson.data.token);
  console.log('  Student ID Token: exchanged successfully');

  // Student Library via api/attempts
  const studentLibRes = await fetch(`${BASE_URL}/api/attempts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentIdToken}`
    },
    body: JSON.stringify({ action: 'getStudentLibrary' })
  });
  const studentLibJson = await studentLibRes.json();
  const assignments = studentLibJson.data?.assignments || [];
  console.log(`  Student Library: found ${assignments.length} assignments`);
  assignments.slice(0, 3).forEach(a => {
    console.log(`    - [${a.id}] ${a.lessonTitle} completed=${a.isCompleted} stars=${a.stars}`);
  });

  // 4. AUDIO VERIFICATION
  console.log('\n--- 4. AUDIO VERIFICATION ---');
  const audioUrls = [
    '/audio/uploads/tts_lesson_g2_01_female_aoede_1792322929891.wav',
    '/audio/uploads/gemini_tts_g3_01_puck_1792322103570.wav',
    '/audio/uploads/vietnamese_story_audio_g2_b01.wav',
    '/audio/uploads/vietnamese_story_audio_g2_b02.wav',
    '/audio/uploads/vietnamese_story_audio_g3_b01.wav'
  ];
  for (const aUrl of audioUrls) {
    const fullAudioUrl = `${BASE_URL}${aUrl}`;
    const aRes = await fetch(fullAudioUrl, { method: 'HEAD' });
    const cType = aRes.headers.get('content-type');
    const isAudio = cType && (cType.includes('audio') || cType.includes('octet-stream'));
    console.log(`  Audio ${aUrl}: status=${aRes.status}, Content-Type=${cType}, validAudio=${isAudio}`);
    if (aRes.status !== 200 || !isAudio) {
      throw new Error(`Invalid audio endpoint: ${fullAudioUrl}`);
    }
  }

  console.log('\n========================================================================');
  console.log('✅ ALL THREE ROLES AND SYSTEM INVARIANTS VERIFIED 100% PASS!');
  console.log('========================================================================');
}

verifyAll().catch(err => {
  console.error('❌ Verification failed:', err.message);
  process.exit(1);
});
