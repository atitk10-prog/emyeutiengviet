import fs from 'fs';

const PRODUCTION_URL = 'https://emyeutiengviet-zeta.vercel.app';
const FIREBASE_WEB_API_KEY = 'AIzaSyB8T4cebLbZCX2Je--ndjaeHl_l8wo6spw';

async function exchangeCustomTokenForIdToken(customToken) {
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

async function callProdApi(endpoint, action, data, idToken) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

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

async function verify5TypesStudentFlow() {
  console.log('================================================================');
  console.log('KIỂM CHỨNG TOÀN DIỆN 5 DẠNG CÂU HỎI TRÊN PRODUCTION CHO HỌC SINH');
  console.log('================================================================\n');

  // 1. Teacher login
  console.log('1. Đăng nhập Giáo viên...');
  const teacherLogin = await callProdApi('/api/auth', 'accountLogin', {
    username: 'giaovien01',
    password: 'Gv_6D53d912!64'
  });
  const teacherToken = await exchangeCustomTokenForIdToken(teacherLogin.token);
  console.log('   ✅ Đăng nhập giáo viên thành công.');

  // 2. Teacher publishes a verified lesson with all 5 types
  console.log('2. Tạo và xuất bản bài đọc kiểm chứng có đủ 5 dạng câu hỏi...');
  const testLessonData = {
    title: 'Hương cốm mùa thu Hà Nội (Kiểm chứng 5 dạng câu hỏi)',
    passage: 'Mùa thu về mang theo những làn gió heo may mát rượi. Dọc con phố nhỏ, thoang thoảng hương cốm non bọc trong lá sen xanh ngắt. Hạt cốm dẻo thơm, ngọt lành như kết tinh tình yêu thương của đất trời quê hương.',
    grade: 2,
    semester: 1,
    week: 10,
    topic: 'Mùa thu quê hương',
    genre: 'narrative',
    source: 'teacher_created',
    verificationStatus: 'teacher_created',
    vocabulary: [
      { word: 'heo may', meaning: 'Gió nhẹ, hơi khô và lạnh của mùa thu.', example: 'Gió heo may thổi nhẹ.' }
    ],
    questions: [
      {
        id: 'q1_mcq',
        type: 'multiple_choice',
        prompt: 'Cốm non được bọc trong thứ lá gì?',
        options: ['Lá sen xanh ngắt', 'Lá chuối non', 'Lá bàng khô'],
        answer: 'A',
        hint: 'Đọc kỹ câu thứ hai của bài văn.',
        explanation: 'Cốm non được bọc trong lá sen xanh ngắt.',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      },
      {
        id: 'q2_tf',
        type: 'true_false',
        prompt: 'Nhận định sau Đúng hay Sai:',
        statement: 'Mùa xuân mang theo những làn gió heo may mát rượi.',
        answer: false,
        hint: 'Xem gió heo may thổi vào mùa nào trong bài đọc nhé.',
        explanation: 'Gió heo may thổi vào mùa thu, không phải mùa xuân.',
        skillTag: 'noi_dung_chinh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q3_seq',
        type: 'sequence',
        prompt: 'Sắp xếp đúng thứ tự 3 sự việc diễn ra trong bài:',
        items: [
          'Mùa thu về mang theo gió heo may mát rượi',
          'Dọc phố nhỏ thoang thoảng hương cốm bọc lá sen',
          'Hạt cốm dẻo thơm kết tinh tình yêu quê hương'
        ],
        answer: [
          'Mùa thu về mang theo gió heo may mát rượi',
          'Dọc phố nhỏ thoang thoảng hương cốm bọc lá sen',
          'Hạt cốm dẻo thơm kết tinh tình yêu quê hương'
        ],
        hint: 'Đọc theo thứ tự từ đầu đến cuối đoạn văn.',
        explanation: 'Trình tự miêu tả từ mùa thu, đến hương cốm và tình cảm quê hương.',
        skillTag: 'sap_xep_trinh_tu',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q4_matching',
        type: 'matching',
        prompt: 'Em hãy ghép từ ở Cột A với lời giải nghĩa phù hợp ở Cột B:',
        leftItems: ['Gió heo may', 'Hạt cốm', 'Lá sen'],
        rightItems: ['Mát rượi mang mùa thu về', 'Dẻo thơm ngọt lành', 'Xanh ngắt bọc lấy hạt cốm'],
        matchingPairs: {
          'Gió heo may': 'Mát rượi mang mùa thu về',
          'Hạt cốm': 'Dẻo thơm ngọt lành',
          'Lá sen': 'Xanh ngắt bọc lấy hạt cốm'
        },
        answer: {
          'Gió heo may': 'Mát rượi mang mùa thu về',
          'Hạt cốm': 'Dẻo thơm ngọt lành',
          'Lá sen': 'Xanh ngắt bọc lấy hạt cốm'
        },
        hint: 'Đọc kỹ các chi tiết gắn với từng từ ngữ trong bài.',
        explanation: 'Các cặp ghép chính xác theo từng chi tiết miêu tả.',
        skillTag: 'tu_trong_ngu_canh',
        difficulty: 'thong_hieu'
      },
      {
        id: 'q5_blank',
        type: 'fill_blank',
        prompt: 'Điền 1 từ thích hợp vào chỗ trống trong câu sau:',
        blankContext: 'Dọc con phố nhỏ, thoang thoảng [ ... ] cốm non bọc trong lá sen xanh ngắt.',
        answer: 'hương',
        acceptedAnswers: ['hương', 'mùi hương'],
        hint: 'Tìm từ miêu tả mùi thơm của cốm non lan tỏa trong gió.',
        explanation: 'Từ thích hợp là "hương".',
        skillTag: 'thong_tin_truc_tiep',
        difficulty: 'nhan_biet'
      }
    ]
  };

  const publishRes = await callProdApi('/api/lessons', 'publishLesson', {
    draft: testLessonData
  }, teacherToken);
  const lessonId = publishRes.lessonId;
  const versionId = publishRes.versionId;
  console.log(`   ✅ Đã xuất bản bài đọc: lessonId=${lessonId}, versionId=${versionId}`);

  // 3. Assign lesson to class_2a
  console.log('3. Giao bài đọc cho lớp 2A...');
  const assignRes = await callProdApi('/api/lessons', 'assignLesson', {
    lessonId,
    versionId,
    classIds: ['class_2a'],
    roundName: `Kiểm thử 5 dạng ${Date.now()}`
  }, teacherToken);
  const assignmentId = assignRes.createdAssignments?.[0]?.id || assignRes.assignments?.[0]?.id;
  console.log(`   ✅ Đã giao bài: assignmentId=${assignmentId}`);

  // 4. Student login
  console.log('4. Đăng nhập Học sinh (HS002)...');
  const studentLogin = await callProdApi('/api/auth', 'accountLogin', {
    username: 'HS002',
    password: 'HS123456'
  });
  const studentToken = await exchangeCustomTokenForIdToken(studentLogin.token);
  console.log(`   ✅ Đăng nhập học sinh thành công (UID: ${studentLogin.user?.uid}).`);

  // 5. Start attempt
  console.log('5. Học sinh bắt đầu lượt làm bài (startAttempt)...');
  const startRes = await callProdApi('/api/attempts', 'startAttempt', {
    assignmentId
  }, studentToken);
  const attemptId = startRes.attemptId;
  console.log(`   ✅ Khởi tạo lượt làm bài thành công: attemptId=${attemptId}`);

  // 6. Test answering all 5 types
  console.log('6. Kiểm tra nộp bài và chấm điểm cho cả 5 dạng câu hỏi:');

  // Question 1: MCQ (Chọn A)
  const ansQ1 = await callProdApi('/api/attempts', 'submitAnswer', {
    attemptId,
    questionId: 'q1_mcq',
    answer: 'A',
    phase: 'first_try',
    requestId: `req_q1_${Date.now()}`
  }, studentToken);
  console.log(`   - Dạng 1 (MCQ A/B/C): ${ansQ1.correct ? '✅ ĐÚNG (PASS)' : '❌ SAI'}`);

  // Question 2: True/False (Chọn false)
  const ansQ2 = await callProdApi('/api/attempts', 'submitAnswer', {
    attemptId,
    questionId: 'q2_tf',
    answer: false,
    phase: 'first_try',
    requestId: `req_q2_${Date.now()}`
  }, studentToken);
  console.log(`   - Dạng 2 (Đúng/Sai): ${ansQ2.correct ? '✅ ĐÚNG (PASS)' : '❌ SAI'}`);

  // Question 3: Sequence (Sắp xếp 3 sự việc)
  const ansQ3 = await callProdApi('/api/attempts', 'submitAnswer', {
    attemptId,
    questionId: 'q3_seq',
    answer: testLessonData.questions[2].items,
    phase: 'first_try',
    requestId: `req_q3_${Date.now()}`
  }, studentToken);
  console.log(`   - Dạng 3 (Sắp xếp sự việc): ${ansQ3.correct ? '✅ ĐÚNG (PASS)' : '❌ SAI'}`);

  // Question 4: Matching (Ghép đôi kéo thả)
  const ansQ4 = await callProdApi('/api/attempts', 'submitAnswer', {
    attemptId,
    questionId: 'q4_matching',
    answer: {
      'Gió heo may': 'Mát rượi mang mùa thu về',
      'Hạt cốm': 'Dẻo thơm ngọt lành',
      'Lá sen': 'Xanh ngắt bọc lấy hạt cốm'
    },
    phase: 'first_try',
    requestId: `req_q4_${Date.now()}`
  }, studentToken);
  console.log(`   - Dạng 4 (Ghép đôi kéo thả): ${ansQ4.correct ? '✅ ĐÚNG (PASS)' : '❌ SAI'}`);

  // Question 5: Fill blank (Điền từ "hương")
  const ansQ5 = await callProdApi('/api/attempts', 'submitAnswer', {
    attemptId,
    questionId: 'q5_blank',
    answer: 'HƯƠNG   ', // Tests uppercase and trimming with Vietnamese diacritics
    phase: 'first_try',
    requestId: `req_q5_${Date.now()}`
  }, studentToken);
  console.log(`   - Dạng 5 (Điền khuyết ngắn): ${ansQ5.correct ? '✅ ĐÚNG (PASS)' : '❌ SAI'}`);

  // 7. Finish Attempt
  console.log('7. Chốt nộp bài hoàn thành (finishAttempt)...');
  const finishRes = await callProdApi('/api/attempts', 'finishAttempt', {
    attemptId,
    idempotencyKey: `finish_${attemptId}`
  }, studentToken);
  console.log(`   ✅ Hoàn tất bài thi: Số câu đúng=${finishRes.attempt?.finalCorrectCount}/${testLessonData.questions.length} (${finishRes.attempt?.scorePercentage}%, ${finishRes.attempt?.starsEarned} ⭐)`);

  const allCorrect = ansQ1.correct && ansQ2.correct && ansQ3.correct && ansQ4.correct && ansQ5.correct;
  console.log('\n================================================================');
  if (allCorrect && finishRes.attempt?.finalCorrectCount === 5) {
    console.log('🎉 TOÀN BỘ 5 DẠNG CÂU HỎI ĐÃ ĐƯỢC CHẤM CHÍNH XÁC 100% TRÊN PRODUCTION!');
  } else {
    console.log('❌ Có lỗi trong quá trình chấm điểm 5 dạng câu hỏi.');
    process.exit(1);
  }
  console.log('================================================================');
}

verify5TypesStudentFlow().catch((err) => {
  console.error('Lỗi kiểm chứng:', err);
  process.exit(1);
});
