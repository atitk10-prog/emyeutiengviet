import fs from 'fs';
import path from 'path';

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

function calculateStats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { min, median, p95, max, avg };
}

async function run10Benchmark() {
  console.log('=== RUNNING 10-ITERATION BENCHMARK AUDIT ===');
  const auth = getAuth();

  const teacherCustomToken = await auth.createCustomToken('B5H9PeMrZowS3ewPm4BQ8aM4fkU1', { role: 'teacher' });
  const apiKey = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';
  
  const tokenRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: teacherCustomToken, returnSecureToken: true })
  });
  const tokenData = await tokenRes.json() as any;
  const teacherToken = tokenData.idToken;

  const essentialTimes: number[] = [];
  const analyticsTimes: number[] = [];
  const lessonsTimes: number[] = [];
  const classesTimes: number[] = [];

  for (let i = 1; i <= 10; i++) {
    const tStart = performance.now();
    const { req: reqC, res: resC, result: resPC } = mockReqRes('getTeacherClasses', {}, teacherToken);
    const { req: reqL, res: resL, result: resPL } = mockReqRes('getTeacherLessons', { status: 'all' }, teacherToken);
    
    const tLStart = performance.now();
    await classroomsHandler(reqC, resC);
    const cDur = Math.round(performance.now() - tLStart);
    classesTimes.push(cDur);

    const tL2Start = performance.now();
    await lessonsHandler(reqL, resL);
    const lDur = Math.round(performance.now() - tL2Start);
    lessonsTimes.push(lDur);

    await Promise.all([resPC, resPL]);
    const essentialDur = Math.round(performance.now() - tStart);
    essentialTimes.push(essentialDur);

    // Non-blocking background analytics
    const tAStart = performance.now();
    const { req: reqA, res: resA, result: resPA } = mockReqRes('getTeacherAnalytics', {}, teacherToken);
    await analyticsHandler(reqA, resA);
    await resPA;
    const aDur = Math.round(performance.now() - tAStart);
    analyticsTimes.push(aDur);

    console.log(`Run #${i}: Essential (Classes+Lessons)=${essentialDur}ms, Classes=${cDur}ms, Lessons=${lDur}ms, Analytics=${aDur}ms`);
  }

  console.log('\n================ FINAL STATISTICAL BENCHMARK (10 RUNS) ================');
  console.log('1. DỮ LIỆU THIẾT YẾU (Classes + Lessons in Parallel):', calculateStats(essentialTimes));
  console.log('2. DANH SÁCH LỚP (getTeacherClasses):', calculateStats(classesTimes));
  console.log('3. THƯ VIỆN BÀI ĐỌC (getTeacherLessons):', calculateStats(lessonsTimes));
  console.log('4. PHÂN TÍCH & BIỂU ĐỒ (getTeacherAnalytics):', calculateStats(analyticsTimes));
  console.log('=======================================================================');
}

run10Benchmark().catch(console.error);
