import fs from 'fs';
import path from 'path';

const PRODUCTION_URL = 'https://emyeutiengviet-zeta.vercel.app';
const FIREBASE_WEB_API_KEY = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';

interface ProdStepResult {
  step: string;
  endpoint: string;
  status: 'PASS' | 'FAIL';
  latencyMs: number;
  details: string;
}

const prodResults: ProdStepResult[] = [];

async function exchangeCustomTokenForIdToken(customToken: string): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(data.error?.message || 'Failed to exchange custom token for ID token');
  }
  return data.idToken;
}

async function callProdApi(endpoint: string, action: string, data?: any, idToken?: string) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, data })
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || `HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function verifyLiveProduction() {
  console.log('================================================================');
  console.log(`KIỂM CHỨNG TRỰC TIẾP TRÊN WEBSITE PRODUCTION: ${PRODUCTION_URL}`);
  console.log('================================================================\n');

  // 1. TEACHER LOGIN ON PRODUCTION
  console.log('1. Đăng nhập Giáo viên trên Production (giaovien01)...');
  const t0 = Date.now();
  let teacherIdToken = '';
  let teacherUid = '';
  try {
    const teacherData = await callProdApi('/api/auth', 'accountLogin', {
      username: 'giaovien01',
      password: 'Gv_6D53d912!64'
    });
    teacherUid = teacherData.user?.uid;
    teacherIdToken = await exchangeCustomTokenForIdToken(teacherData.token);

    prodResults.push({
      step: '1. Đăng nhập Giáo viên (giaovien01)',
      endpoint: '/api/auth (accountLogin)',
      status: teacherData.role === 'teacher' && Boolean(teacherIdToken) ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t0,
      details: `Role: ${teacherData.role}, UID: ${teacherUid}, ID Token: Hợp lệ 100%`
    });
  } catch (err: any) {
    prodResults.push({
      step: '1. Đăng nhập Giáo viên (giaovien01)',
      endpoint: '/api/auth (accountLogin)',
      status: 'FAIL',
      latencyMs: Date.now() - t0,
      details: err.message
    });
  }

  // 2. STUDENT LOGIN ON PRODUCTION
  console.log('2. Đăng nhập Học sinh trên Production (HS002)...');
  const t1 = Date.now();
  let studentIdToken = '';
  let studentProfile: any = null;
  try {
    const studentData = await callProdApi('/api/auth', 'accountLogin', {
      username: 'HS002',
      password: 'HS123456'
    });
    studentProfile = studentData.student || studentData.studentProfile;
    studentIdToken = await exchangeCustomTokenForIdToken(studentData.token);

    prodResults.push({
      step: '2. Đăng nhập Học sinh (HS002)',
      endpoint: '/api/auth (accountLogin)',
      status: studentData.role === 'student' && Boolean(studentIdToken) ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t1,
      details: `Học sinh: ${studentProfile?.displayAlias} (Mã: ${studentProfile?.studentCode}), Lớp: ${studentProfile?.classId}`
    });
  } catch (err: any) {
    prodResults.push({
      step: '2. Đăng nhập Học sinh (HS002)',
      endpoint: '/api/auth (accountLogin)',
      status: 'FAIL',
      latencyMs: Date.now() - t1,
      details: err.message
    });
  }

  // 3. GET STUDENT LIBRARY
  console.log('3. Truy xuất thư viện bài tập của học sinh trên Production...');
  const t2 = Date.now();
  let targetAssignment: any = null;
  try {
    const libraryData = await callProdApi(
      '/api/attempts',
      'getStudentLibrary',
      {
        classId: studentProfile?.classId || 'class_2a',
        studentId: studentProfile?.id || 'student_demo_hs002'
      },
      studentIdToken
    );
    const assignments = libraryData?.assignments || libraryData || [];
    targetAssignment = assignments.find((a: any) =>
      a.lessonTitle?.includes('Cây bàng') || a.lessonId === 'Kzpw4eVXHPLMfsYQY7m2'
    ) || assignments[0];

    prodResults.push({
      step: '3. Truy vấn Thư viện bài tập được giao',
      endpoint: '/api/attempts (getStudentLibrary)',
      status: assignments.length > 0 ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t2,
      details: `Tìm thấy ${assignments.length} bài giao. Chọn bài kiểm chứng: "${targetAssignment?.lessonTitle}" (ID: ${targetAssignment?.id})`
    });
  } catch (err: any) {
    prodResults.push({
      step: '3. Truy vấn Thư viện bài tập được giao',
      endpoint: '/api/attempts (getStudentLibrary)',
      status: 'FAIL',
      latencyMs: Date.now() - t2,
      details: err.message
    });
  }

  // 4. START ATTEMPT & VERIFY 3 QUESTION TYPES
  console.log('4. Bắt đầu lượt làm bài trên Production (startAttempt)...');
  const t3 = Date.now();
  let attemptId = '';
  let publicQuestions: any[] = [];
  try {
    const attemptData = await callProdApi(
      '/api/attempts',
      'startAttempt',
      {
        assignmentId: targetAssignment?.id,
        studentId: studentProfile?.id || 'student_demo_hs002'
      },
      studentIdToken
    );
    attemptId = attemptData?.attemptId || attemptData?.id;
    const lessonVersion = attemptData?.lessonVersion || {};
    publicQuestions = lessonVersion?.publicQuestions || [];

    // Verify 3 question types are present
    const hasMcq = publicQuestions.some((q) => q.type === 'multiple_choice');
    const hasTf = publicQuestions.some((q) => q.type === 'true_false');
    const hasSeq = publicQuestions.some((q) => q.type === 'sequence');

    // BUG 2 CHECK: Sequence question items must NOT be empty!
    const seqQ = publicQuestions.find((q) => q.type === 'sequence');
    const seqItemsValid = seqQ && Array.isArray(seqQ.items) && seqQ.items.length >= 3;

    prodResults.push({
      step: '4. Bắt đầu lượt làm bài & Kiểm tra 3 dạng câu hỏi',
      endpoint: '/api/attempts (startAttempt)',
      status: attemptId && hasMcq && hasTf && seqItemsValid ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t3,
      details: `AttemptId: ${attemptId}, Có đủ 3 dạng: MCQ (${hasMcq}), T/F (${hasTf}), Sắp xếp (${hasSeq}). Số sự việc sắp xếp: ${seqQ?.items?.length || 0} sự việc.`
    });
  } catch (err: any) {
    prodResults.push({
      step: '4. Bắt đầu lượt làm bài & Kiểm tra 3 dạng câu hỏi',
      endpoint: '/api/attempts (startAttempt)',
      status: 'FAIL',
      latencyMs: Date.now() - t3,
      details: err.message
    });
  }

  // 5. TEST BUG 1 FIX: SUBMIT B FOR Q1
  console.log('5. Kiểm tra sửa LỖI 1 trên Production: Chọn đáp án B cho câu 1...');
  const t4 = Date.now();
  try {
    const q1 = publicQuestions.find((q) => q.id === 'q1') || publicQuestions[0];
    const q1Res = await callProdApi(
      '/api/attempts',
      'submitAnswer',
      {
        attemptId,
        questionId: q1.id,
        answer: 'B',
        phase: 'first_try',
        requestId: `req_${attemptId}_q1_${Date.now()}`
      },
      studentIdToken
    );

    prodResults.push({
      step: '5. SỬA LỖI 1: Chọn đáp án B được chấm ĐÚNG',
      endpoint: '/api/attempts (submitAnswer - Q1)',
      status: q1Res.correct === true ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t4,
      details: `Chọn B -> Kết quả chấm: ${q1Res.correct ? 'ĐÚNG (PASS)' : 'SAI (FAIL)'}. Giải thích: "${q1Res.explanation || ''}"`
    });
  } catch (err: any) {
    prodResults.push({
      step: '5. SỬA LỖI 1: Chọn đáp án B được chấm ĐÚNG',
      endpoint: '/api/attempts (submitAnswer - Q1)',
      status: 'FAIL',
      latencyMs: Date.now() - t4,
      details: err.message
    });
  }

  // 6. TEST 2-PHASE HINT & RETRY ON TRUE/FALSE (q3)
  console.log('6. Kiểm tra cơ chế gợi ý sư phạm và thử lại 2 pha trên Production (q3)...');
  const t5 = Date.now();
  try {
    // q3 correct answer is true (Từ 'mơn mởn' chỉ sức sống tươi non)
    // Phase 1: Submit false (wrong answer)
    const try1Res = await callProdApi(
      '/api/attempts',
      'submitAnswer',
      {
        attemptId,
        questionId: 'q3',
        answer: false, // Intentionally wrong (correct is true)
        phase: 'first_try',
        requestId: `req_${attemptId}_q3_try1_${Date.now()}`
      },
      studentIdToken
    );

    const hintReceived = Boolean(try1Res.hint);
    const retryAllowed = try1Res.canRetry === true;
    const isFirstTryWrong = try1Res.correct === false;

    // Phase 2: Retry with correct answer (true)
    const try2Res = await callProdApi(
      '/api/attempts',
      'submitAnswer',
      {
        attemptId,
        questionId: 'q3',
        answer: true, // Correct
        phase: 'retry',
        requestId: `req_${attemptId}_q3_try2_${Date.now()}`
      },
      studentIdToken
    );

    const retrySuccess = try2Res.correct === true;
    const pass = isFirstTryWrong && hintReceived && retryAllowed && retrySuccess;

    prodResults.push({
      step: '6. Quy trình sư phạm 2 pha: Gợi ý khi sai -> Thử lại thành công',
      endpoint: '/api/attempts (submitAnswer 2-Phase - q3)',
      status: pass ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t5,
      details: `Lần 1: Sai -> Nhận gợi ý: "${try1Res.hint || ''}", canRetry=${retryAllowed} -> Lần 2: Sửa đúng (${retrySuccess})`
    });
  } catch (err: any) {
    prodResults.push({
      step: '6. Quy trình sư phạm 2 pha: Gợi ý khi sai -> Thử lại thành công',
      endpoint: '/api/attempts (submitAnswer 2-Phase - q3)',
      status: 'FAIL',
      latencyMs: Date.now() - t5,
      details: err.message
    });
  }

  // 7. TEST BUG 2 FIX: SUBMIT SEQUENCE (q5)
  console.log('7. Kiểm tra sửa LỖI 2 trên Production: Sắp xếp sự việc đầy đủ (q5)...');
  const t6 = Date.now();
  try {
    const seqQ = publicQuestions.find((q) => q.type === 'sequence') || publicQuestions[4];
    const itemsCount = seqQ?.items?.length || 0;
    const sortedAnswer = seqQ.items;

    const seqRes = await callProdApi(
      '/api/attempts',
      'submitAnswer',
      {
        attemptId,
        questionId: seqQ.id,
        answer: sortedAnswer,
        phase: 'first_try',
        requestId: `req_${attemptId}_seq_${Date.now()}`
      },
      studentIdToken
    );

    prodResults.push({
      step: '7. SỬA LỖI 2: Câu sắp xếp có đủ sự việc & Chấm điểm chính xác',
      endpoint: '/api/attempts (submitAnswer - Sequence)',
      status: itemsCount >= 3 && seqRes.correct === true ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t6,
      details: `Hiển thị đủ ${itemsCount} sự việc. Nộp trình tự -> Kết quả chấm: ${seqRes.correct ? 'ĐÚNG (PASS)' : 'SAI'}`
    });
  } catch (err: any) {
    prodResults.push({
      step: '7. SỬA LỖI 2: Câu sắp xếp có đủ sự việc & Chấm điểm chính xác',
      endpoint: '/api/attempts (submitAnswer - Sequence)',
      status: 'FAIL',
      latencyMs: Date.now() - t6,
      details: err.message
    });
  }

  // 8. FINISH ATTEMPT ON PRODUCTION
  console.log('8. Chốt nộp bài trên Production (finishAttempt)...');
  const t7 = Date.now();
  let finishSummary: any = null;
  try {
    const finishRes = await callProdApi(
      '/api/attempts',
      'finishAttempt',
      {
        attemptId,
        idempotencyKey: `finish_${attemptId}`
      },
      studentIdToken
    );
    finishSummary = finishRes?.attempt;

    prodResults.push({
      step: '8. Nộp bài hoàn thành & Lưu kết quả vào Firestore',
      endpoint: '/api/attempts (finishAttempt)',
      status: finishRes?.success && finishSummary?.status === 'completed' ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t7,
      details: `Trạng thái: ${finishSummary?.status}, Số câu đúng: ${finishSummary?.finalCorrectCount}/${finishSummary?.totalQuestions || 5}, Tỷ lệ: ${finishSummary?.scorePercentage}%, Số sao: ${finishSummary?.starsEarned} ⭐`
    });
  } catch (err: any) {
    prodResults.push({
      step: '8. Nộp bài hoàn thành & Lưu kết quả vào Firestore',
      endpoint: '/api/attempts (finishAttempt)',
      status: 'FAIL',
      latencyMs: Date.now() - t7,
      details: err.message
    });
  }

  // 9. TEACHER REVIEWS COMPLETED RESULT ON DASHBOARD
  console.log('9. Giáo viên truy xuất kết quả bài làm trên Production (Teacher Analytics)...');
  const t8 = Date.now();
  try {
    const analytics = await callProdApi(
      '/api/analytics',
      'getTeacherAnalytics',
      {
        classId: studentProfile?.classId || 'class_2a'
      },
      teacherIdToken
    );

    const hasData = typeof analytics.totalClasses === 'number' && typeof analytics.totalStudents === 'number';

    prodResults.push({
      step: '9. Giáo viên xem kết quả bài làm trên Dashboard Production',
      endpoint: '/api/analytics (getTeacherAnalytics)',
      status: hasData ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - t8,
      details: `Tổng ${analytics.totalClasses} lớp, ${analytics.totalStudents} học sinh, Đúng lần đầu: ${analytics.avgFirstTryAccuracy}%, Sau gợi ý: ${analytics.avgFinalAccuracy}%, Mức tiến bộ: +${analytics.progressPercentagePoints}%`
    });
  } catch (err: any) {
    prodResults.push({
      step: '9. Giáo viên xem kết quả bài làm trên Dashboard Production',
      endpoint: '/api/analytics (getTeacherAnalytics)',
      status: 'FAIL',
      latencyMs: Date.now() - t8,
      details: err.message
    });
  }

  console.log('\n================================================================');
  console.log('BẢNG TỔNG HỢP KIỂM CHỨNG PRODUCTION (LIVE VERIFICATION)');
  console.log('================================================================');
  for (const r of prodResults) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.step} [${r.latencyMs}ms]\n   → ${r.details}`);
  }

  const allPassed = prodResults.every((r) => r.status === 'PASS');
  console.log('\n================================================================');
  console.log(`KẾT QUẢ CUỐI CÙNG TRÊN PRODUCTION: ${allPassed ? '100% PASS' : 'FAIL'}`);
  console.log('================================================================');

  fs.writeFileSync(
    path.resolve(__dirname, 'live_production_results.json'),
    JSON.stringify(prodResults, null, 2),
    'utf8'
  );
}

verifyLiveProduction().catch(console.error);
