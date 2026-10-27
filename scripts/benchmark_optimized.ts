import fs from 'fs';
import path from 'path';

// Setup service account key for direct Firestore staging access
const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import lessonsHandler from '../api/lessons';
import analyticsHandler from '../api/analytics';
import classroomsHandler from '../api/classrooms';
import attemptsHandler from '../api/attempts';
import adminHandler from '../api/admin';
import { getAuth } from '../api/_helpers/firebaseAdmin';

function mockReqRes(action: string, data: any, idToken: string) {
  const req: any = {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${idToken}`,
      'content-type': 'application/json'
    },
    body: { action, data }
  };

  let resolvePromise: any;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const res: any = {
    statusCode: 200,
    headers: {},
    setHeader: (k: string, v: string) => { res.headers[k] = v; },
    status: (code: number) => {
      res.statusCode = code;
      return res;
    },
    json: (body: any) => {
      resolvePromise({ statusCode: res.statusCode, body });
    },
    send: (body: any) => {
      resolvePromise({ statusCode: res.statusCode, body });
    }
  };

  return { req, res, result: promise };
}

async function runBenchmark() {
  console.log('=== BENCHMARKING OPTIMIZED HANDLERS DIRECTLY WITH STAGING FIRESTORE ===');
  const auth = getAuth();

  // Create custom tokens and exchange for ID tokens for Teacher and Student
  const teacherCustomToken = await auth.createCustomToken('B5H9PeMrZowS3ewPm4BQ8aM4fkU1', { role: 'teacher' });
  const adminCustomToken = await auth.createCustomToken('admin_demo_uid', { role: 'admin' });
  const studentCustomToken = await auth.createCustomToken('student_student_demo_hs001', {
    role: 'student',
    studentId: 'student_demo_hs001',
    classId: 'class_2b'
  });

  // Exchange with Identity Toolkit
  const apiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';
  async function getIdToken(customToken: string): Promise<string> {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const data = await res.json() as any;
    return data.idToken;
  }

  const [teacherToken, adminToken, studentToken] = await Promise.all([
    getIdToken(teacherCustomToken),
    getIdToken(adminCustomToken),
    getIdToken(studentCustomToken)
  ]);

  console.log('Successfully minted and exchanged ID tokens.');

  // Test 1: getAIStatus
  console.log('\n[1] Testing getAIStatus (Optimized with model & cache)...');
  const t0 = performance.now();
  const { req: r1, res: s1, result: p1 } = mockReqRes('getAIStatus', {}, teacherToken);
  await lessonsHandler(r1, s1);
  const aiRes: any = await p1;
  const aiDuration = Math.round(performance.now() - t0);
  console.log(`getAIStatus 1st run: ${aiDuration}ms, result:`, aiRes.body?.data?.status);

  // Test 1 (cached):
  const t0c = performance.now();
  const { req: r1c, res: s1c, result: p1c } = mockReqRes('getAIStatus', {}, teacherToken);
  await lessonsHandler(r1c, s1c);
  const aiResC: any = await p1c;
  const aiDurationC = Math.round(performance.now() - t0c);
  console.log(`getAIStatus 2nd run (Cached): ${aiDurationC}ms, result:`, aiResC.body?.data?.status);

  // Test 2: getTeacherClasses
  console.log('\n[2] Testing getTeacherClasses...');
  const t2 = performance.now();
  const { req: r2, res: s2, result: p2 } = mockReqRes('getTeacherClasses', {}, teacherToken);
  await classroomsHandler(r2, s2);
  const cRes: any = await p2;
  const cDuration = Math.round(performance.now() - t2);
  console.log(`getTeacherClasses: ${cDuration}ms, classes count:`, cRes.body?.data?.classes?.length);

  // Test 3: getTeacherLessons (Optimized - eliminates 21 loop queries)
  console.log('\n[3] Testing getTeacherLessons (Optimized without N+1 query)...');
  const t3 = performance.now();
  const { req: r3, res: s3, result: p3 } = mockReqRes('getTeacherLessons', { status: 'all' }, teacherToken);
  await lessonsHandler(r3, s3);
  const lRes: any = await p3;
  const lDuration = Math.round(performance.now() - t3);
  console.log(`getTeacherLessons: ${lDuration}ms, lessons count:`, lRes.body?.data?.lessons?.length);

  // Test 4: getTeacherAnalytics (Optimized - eliminates full collection scan & 376 subcollection queries)
  console.log('\n[4] Testing getTeacherAnalytics (Optimized without 376 subcollection queries)...');
  const t4 = performance.now();
  const { req: r4, res: s4, result: p4 } = mockReqRes('getTeacherAnalytics', {}, teacherToken);
  await analyticsHandler(r4, s4);
  const aRes: any = await p4;
  const aDuration = Math.round(performance.now() - t4);
  console.log(`getTeacherAnalytics 1st run: ${aDuration}ms, attempts:`, aRes.body?.data?.totalAttempts, 'firstTryAcc:', aRes.body?.data?.avgFirstTryAccuracy);

  // Test 4 (cached):
  const t4c = performance.now();
  const { req: r4c, res: s4c, result: p4c } = mockReqRes('getTeacherAnalytics', {}, teacherToken);
  await analyticsHandler(r4c, s4c);
  const aResC: any = await p4c;
  const aDurationC = Math.round(performance.now() - t4c);
  console.log(`getTeacherAnalytics 2nd run (Cached): ${aDurationC}ms`);

  // Test 5: Parallel Dashboard Loading (Essential: Classes + Lessons)
  console.log('\n[5] SIMULATING OPTIMIZED DASHBOARD PARALLEL ESSENTIAL DATA LOAD:');
  const tParallel = performance.now();
  const { req: reqC, res: resC, result: resPC } = mockReqRes('getTeacherClasses', {}, teacherToken);
  const { req: reqL, res: resL, result: resPL } = mockReqRes('getTeacherLessons', { status: 'all' }, teacherToken);
  await Promise.all([classroomsHandler(reqC, resC), lessonsHandler(reqL, resL)]);
  await Promise.all([resPC, resPL]);
  const parallelEssentialDuration = Math.round(performance.now() - tParallel);
  console.log(`>>> ESSENTIAL DATA READY TIME (Classes + Lessons in Parallel): ${parallelEssentialDuration}ms`);

  // Test 6: Student Library (Optimized)
  console.log('\n[6] Testing getStudentLibrary (Optimized without N+1 query)...');
  const t6 = performance.now();
  const { req: r6, res: s6, result: p6 } = mockReqRes('getStudentLibrary', {}, studentToken);
  await attemptsHandler(r6, s6);
  const stRes: any = await p6;
  const stDuration = Math.round(performance.now() - t6);
  console.log(`getStudentLibrary: ${stDuration}ms, assignments count:`, stRes.body?.data?.assignments?.length);

  // Test 7: Admin Overview (Optimized with count aggregation)
  console.log('\n[7] Testing getAdminOverview (Optimized with count aggregation)...');
  const t7 = performance.now();
  const { req: r7, res: s7, result: p7 } = mockReqRes('getAdminOverview', {}, adminToken);
  await adminHandler(r7, s7);
  const admRes: any = await p7;
  const admDuration = Math.round(performance.now() - t7);
  console.log(`getAdminOverview: ${admDuration}ms, totalAttempts:`, admRes.body?.data?.totalAttempts, 'totalStudents:', admRes.body?.data?.totalStudents);
}

runBenchmark().catch(console.error);
