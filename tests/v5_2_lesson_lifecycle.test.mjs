import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUser,
  exchangeCustomToken,
  callCallable,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

describe('EM YÊU TIẾNG VIỆT V5.2 — LESSON LIFECYCLE, IMMUTABLE VERSIONING & ASSIGNMENT AUDIT', () => {
  let teacher;
  let classId;
  let classCode;
  let studentAccessCode;
  let studentAuthToken;
  let studentId;
  let lessonId;
  let version1Id;
  let version2Id;
  let assignment1Id;

  test('SETUP: Initialize Teacher, Classroom, and Student', async () => {
    // 1. Teacher Setup
    teacher = await createUser('teacher.v52');
    await callCallable('bootstrapTeacherRole', {
      displayName: 'Cô Giáo V5.2',
      adminSecret: 'EMYTV_ADMIN_SECRET_2026'
    }, teacher.token);

    // 2. Classroom Setup
    const cRes = await callCallable('createClassroom', {
      name: 'Lớp 2A Khảo Sát V5.2',
      grade: 2,
      academicYear: '2025-2026'
    }, teacher.token);
    assert.ok(cRes.classroom, 'Classroom must be created');
    classId = cRes.classroom.id;
    classCode = cRes.classroom.classCode;

    // 3. Student Setup
    const sRes = await callCallable('createStudentAccess', {
      classId,
      displayAlias: 'Sóc Nhỏ V5.2',
      studentCode: 'HS-SOC-01'
    }, teacher.token);
    assert.ok(sRes.student, 'Student access created');
    studentId = sRes.student.id;
    studentAccessCode = sRes.student.accessCode;

    // 4. Student Login
    const joinRes = await callCallable('joinClass', {
      classCode,
      accessCode: studentAccessCode
    });
    assert.ok(joinRes.token, 'Must receive custom token on join');
    studentAuthToken = await exchangeCustomToken(joinRes.token);
  });

  // =========================================================================
  // PHASE 1: DRAFT PERSISTENCE & EDITING (P0)
  // =========================================================================
  test('P0-1. Save Lesson Draft: Must persist draftData to Firestore with status "draft"', async () => {
    const draftPayload = {
      title: 'Bác Nông Dân Và Chú Chim Sâu',
      passage: 'Sáng sớm mùa xuân, bác nông dân ra đồng thăm luống cải xanh mơn mởn. Một chú chim sâu nhỏ bé chuyền cành ríu rít bắt sâu cho lá cây. Bác nông dân mỉm cười cảm ơn chú chim chăm chỉ giúp ích cho mùa màng.',
      grade: 2,
      topic: 'Lao động và tình yêu thiên nhiên',
      genre: 'narrative',
      vocabulary: [
        { word: 'mơn mởn', meaning: 'Tươi tốt, mềm mại của lá cây non.', example: 'Lá cải mơn mởn.' }
      ],
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          prompt: 'Bác nông dân ra đồng vào buổi nào trong ngày?',
          options: ['Sáng sớm mùa xuân', 'Buổi trưa hè', 'Chiều tà mùa đông'],
          answer: 'A',
          hint: 'Xem câu đầu tiên của bài đọc nhé.',
          explanation: 'Ngay đầu bài nêu rõ: Sáng sớm mùa xuân bác nông dân ra đồng.',
          skillTag: 'thong_tin_truc_tiep',
          difficulty: 'nhan_biet'
        },
        {
          id: 'q2',
          type: 'true_false',
          prompt: 'Chú chim sâu ríu rít bắt sâu giúp luống cải.',
          answer: true,
          hint: 'Đọc kỹ câu thứ hai về hành động của chú chim sâu.',
          explanation: 'Chú chim sâu chăm chỉ bắt sâu giúp ích cho mùa màng.',
          skillTag: 'noi_dung_chinh',
          difficulty: 'nhan_biet'
        }
      ]
    };

    const res = await callCallable('saveLessonDraft', { draft: draftPayload }, teacher.token);
    assert.ok(res.success, 'Draft must be saved successfully');
    assert.ok(res.lessonId, 'Must return lessonId');
    lessonId = res.lessonId;

    // Verify detail fetch retrieves draftData
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    assert.equal(detail.lesson.status, 'draft', 'Status must be draft');
    assert.equal(detail.lesson.draftData.title, 'Bác Nông Dân Và Chú Chim Sâu');
    assert.equal(detail.lesson.draftData.questions.length, 2, 'Must have 2 questions in draft');
  });

  // =========================================================================
  // PHASE 2: QUESTION CRUD & DYNAMIC QUESTION COUNT (1..20) (P0)
  // =========================================================================
  test('P0-2. Dynamic Questions: Add, clone, reorder questions (including sequence type)', async () => {
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    const questions = [...detail.lesson.draftData.questions];

    // Add a 3rd question: Sequence type
    questions.push({
      id: 'q3',
      type: 'sequence',
      prompt: 'Sắp xếp đúng trình tự các sự việc trong bài:',
      items: [
        'Bác nông dân ra đồng thăm luống cải.',
        'Chú chim sâu chuyền cành bắt sâu cho lá.',
        'Bác nông dân mỉm cười cảm ơn chú chim.'
      ],
      answer: [
        'Bác nông dân ra đồng thăm luống cải.',
        'Chú chim sâu chuyền cành bắt sâu cho lá.',
        'Bác nông dân mỉm cười cảm ơn chú chim.'
      ],
      hint: 'Theo dõi diễn biến từ đầu bài đến cuối bài.',
      explanation: 'Trình tự diễn ra theo đúng dòng thời gian bài đọc.',
      skillTag: 'sap_xep_trinh_tu',
      difficulty: 'thong_hieu'
    });

    assert.equal(questions.length, 3, 'Questions count should now be 3');

    // Save updated draft
    const updatedDraft = {
      ...detail.lesson.draftData,
      questions
    };

    const res = await callCallable('saveLessonDraft', {
      lessonId,
      draft: updatedDraft
    }, teacher.token);
    assert.ok(res.success, 'Updated draft with 3 questions must be saved');
  });

  // =========================================================================
  // PHASE 3: PUBLISH V1 & IMMUTABLE VERSION SNAPSHOT (P0)
  // =========================================================================
  test('P0-3. Publish v1: Creates immutable version v1 and isolates private answer keys', async () => {
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    const draft = detail.lesson.draftData;

    const pubRes = await callCallable('publishLesson', {
      draft: {
        ...draft,
        lessonId
      }
    }, teacher.token);

    assert.ok(pubRes.success, 'Lesson must publish successfully');
    assert.equal(pubRes.versionNumber, 1, 'First publication must be v1');
    assert.ok(pubRes.versionId, 'Must return versionId');
    version1Id = pubRes.versionId;

    // Check detail
    const pubDetail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    assert.equal(pubDetail.lesson.status, 'published');
    assert.equal(pubDetail.lesson.currentVersionNumber, 1);
    assert.equal(pubDetail.version.versionNumber, 1);
    assert.equal(pubDetail.version.publicQuestions.length, 3);

    // Ensure public questions DO NOT leak correct answers
    pubDetail.version.publicQuestions.forEach((pq) => {
      assert.equal(pq.answer, undefined, `Public question ${pq.id} must not leak answer`);
    });

    // Ensure private answer keys contain all 3 answers
    assert.equal(Object.keys(pubDetail.privateAnswers || {}).length, 3, 'Private answer keys must store 3 answers');
  });

  // =========================================================================
  // PHASE 4: DUPLICATE ASSIGNMENT PREVENTION (P0)
  // =========================================================================
  test('P0-4. Assign Lesson: Prevents duplicate assignment for same class, version and round', async () => {
    // 1. Initial assignment for "Đợt 1"
    const aRes1 = await callCallable('assignLesson', {
      classId,
      lessonId,
      lessonVersionId: version1Id,
      roundName: 'Đợt 1',
      maxAttempts: 3
    }, teacher.token);

    assert.ok(aRes1.success, 'First assignment must succeed');
    assert.equal(aRes1.isDuplicatePrevented, false);
    assignment1Id = aRes1.assignment.id;

    // 2. Duplicate assignment attempt for same class, version and round
    const aRes2 = await callCallable('assignLesson', {
      classId,
      lessonId,
      lessonVersionId: version1Id,
      roundName: 'Đợt 1',
      maxAttempts: 3
    }, teacher.token);

    assert.ok(aRes2.success, 'Call succeeds with idempotent duplicate prevention');
    assert.equal(aRes2.isDuplicatePrevented, true, 'Must detect duplicate assignment');
    assert.equal(aRes2.assignment.id, assignment1Id, 'Must return existing assignment');

    // 3. Allowing new round when explicit forceNewRound is passed
    const aRes3 = await callCallable('assignLesson', {
      classId,
      lessonId,
      lessonVersionId: version1Id,
      roundName: 'Đợt 2',
      maxAttempts: 3,
      forceNewRound: true
    }, teacher.token);

    assert.ok(aRes3.success, 'New round assignment must succeed');
    assert.equal(aRes3.isDuplicatePrevented, false);
    assert.notEqual(aRes3.assignment.id, assignment1Id, 'Must generate different assignment ID for new round');
  });

  // =========================================================================
  // PHASE 5: STUDENT ATTEMPT & VERSION IMMUTABILITY (P0)
  // =========================================================================
  test('P0-5. Student Attempt on v1: Scores correctly and binds to version1Id', async () => {
    // Student starts attempt on assignment1 (v1)
    const startRes = await callCallable('startAttempt', {
      assignmentId: assignment1Id
    }, studentAuthToken);

    assert.ok(startRes.attemptId, 'Student must receive attemptId');
    assert.equal(startRes.lessonVersion.versionNumber, 1, 'Attempt must bind to v1');
    assert.equal(startRes.lessonVersion.publicQuestions.length, 3, 'v1 has 3 questions');
    const attemptId = startRes.attemptId;

    // Student submits answer for q1 (correct: 'A')
    const subRes1 = await callCallable('submitAnswer', {
      attemptId,
      questionId: 'q1',
      answer: 'A',
      phase: 'first_try',
      requestId: `req_${Date.now()}_1`
    }, studentAuthToken);
    assert.equal(subRes1.correct, true, 'Answer A must be correct on server');

    // Finish attempt
    const finRes = await callCallable('finishAttempt', {
      attemptId,
      idempotencyKey: `finish_${attemptId}`
    }, studentAuthToken);
    assert.ok(finRes.success, 'Attempt must finish');
    assert.equal(finRes.attempt.lessonVersionId, version1Id, 'Attempt history must be permanently bound to v1');
  });

  test('P0-6. Edit & Publish v2: Creates new version v2 while keeping v1 and student history intact', async () => {
    // Teacher loads lesson to edit
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    assert.equal(detail.version.versionNumber, 1);

    // Teacher adds 1 more question and updates title
    const newQuestions = [
      ...detail.version.publicQuestions.map((q) => {
        const pAns = detail.privateAnswers?.[q.id];
        return {
          ...q,
          answer: pAns ? pAns.correctAnswer : (q.options ? 'A' : true),
          hint: pAns?.hint || 'Gợi ý đọc lại bài.',
          explanation: pAns?.explanation || 'Giải thích chi tiết.'
        };
      }),
      {
        id: 'q4',
        type: 'multiple_choice',
        prompt: 'Bài đọc khuyên chúng ta điều gì?',
        options: ['Yêu quý và bảo vệ các loài chim có ích', 'Đi săn bắt chim', 'Chặt phá rặng cây'],
        answer: 'A',
        hint: 'Nghĩ về bài học rút ra từ lòng biết ơn của bác nông dân.',
        explanation: 'Chim sâu là loài chim bắt sâu bảo vệ mùa màng, cần được yêu quý.',
        skillTag: 'lien_he_van_dung',
        difficulty: 'van_dung'
      }
    ];

    const v2Draft = {
      title: 'Bác Nông Dân Và Chú Chim Sâu (Bản mở rộng)',
      passage: detail.version.passage,
      grade: detail.version.grade,
      topic: detail.version.topic,
      genre: detail.version.genre,
      vocabulary: detail.version.vocabulary,
      questions: newQuestions,
      lessonId
    };

    // Publish v2
    const pubRes2 = await callCallable('publishLesson', { draft: v2Draft }, teacher.token);
    assert.ok(pubRes2.success);
    assert.equal(pubRes2.versionNumber, 2, 'Second publication must automatically increment to v2');
    version2Id = pubRes2.versionId;
    assert.notEqual(version2Id, version1Id, 'v2 must have distinct versionId from v1');

    // Verify v1 STILL EXISTS in Firestore and is untouched
    const v1Detail = await callCallable('getLessonDetail', { lessonId, versionId: version1Id }, teacher.token);
    assert.ok(v1Detail.version, 'v1 version document must still exist');
    assert.equal(v1Detail.version.versionNumber, 1, 'v1 must still be version 1');
    assert.equal(v1Detail.version.publicQuestions.length, 3, 'v1 must still have 3 questions');

    // Verify v2 exists and has 4 questions
    const v2Detail = await callCallable('getLessonDetail', { lessonId, versionId: version2Id }, teacher.token);
    assert.equal(v2Detail.version.versionNumber, 2);
    assert.equal(v2Detail.version.publicQuestions.length, 4, 'v2 has 4 questions');
    assert.equal(Object.keys(v2Detail.privateAnswers || {}).length, 4, 'v2 private keys has 4 answers');
  });

  // =========================================================================
  // PHASE 6: SAFE DATA RETENTION (ARCHIVE VS DELETE) (P0)
  // =========================================================================
  test('P0-7. Data Protection: Published lesson cannot be hard deleted; can only be archived', async () => {
    // Attempting to hard delete a published/assigned lesson must be rejected
    await assert.rejects(
      async () => {
        await callCallable('deleteDraftLesson', { lessonId }, teacher.token);
      },
      (err) => {
        assert.ok(err.message.includes('Lưu trữ') || err.message.includes('chế độ Lưu trữ'));
        return true;
      },
      'Must reject hard deletion of published/assigned lesson'
    );

    // Archiving lesson must succeed
    const archRes = await callCallable('archiveLesson', { lessonId }, teacher.token);
    assert.ok(archRes.success);

    // Verify status is archived
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    assert.equal(detail.lesson.status, 'archived');
  });

  // =========================================================================
  // PHASE 7: AI ADDITIONAL QUESTIONS GENERATION (P1)
  // =========================================================================
  test('P1-1. AI Additional Questions: Generates valid questions appended to current draft', async () => {
    const aiRes = await callCallable('generateAdditionalQuestions', {
      passage: 'Mùa xuân đến mang theo những cơn mưa phùn lất phất làm cho cây cối đâm chồi nảy lộc. Hoa đào phai nở rộ trước sân nhà bé Mai, từng cánh hoa mỏng manh khoe sắc thắm.',
      currentQuestions: [
        { id: 'q1', prompt: 'Mùa xuân mang theo hiện tượng gì?' }
      ],
      count: 2,
      grade: 2
    }, teacher.token);

    assert.ok(aiRes.success, 'AI question generation must succeed');
    assert.ok(Array.isArray(aiRes.questions), 'Must return array of questions');
    assert.equal(aiRes.questions.length, 2, 'Must generate exactly 2 questions');

    // Verify schema of generated questions
    aiRes.questions.forEach((q, idx) => {
      assert.ok(q.id, `Question ${idx + 1} must have id`);
      assert.ok(q.prompt && q.prompt.length > 5, `Question ${idx + 1} must have meaningful prompt`);
      assert.ok(q.hint && q.hint.length >= 5, `Question ${idx + 1} must have pedagogical hint`);
      assert.ok(q.explanation && q.explanation.length >= 5, `Question ${idx + 1} must have explanation`);
      assert.ok(['multiple_choice', 'true_false', 'sequence'].includes(q.type), 'Must be one of 3 valid types');
    });
  });

  // =========================================================================
  // PHASE 8: REGRESSION TEST FOR PRIVATE ANSWERS EXTRACTION (V5.2.1 P0)
  // =========================================================================
  test('P0-8. Regression Test: getLessonDetail returns robust privateAnswers (Record and Array) without .find crash', async () => {
    const detail = await callCallable('getLessonDetail', { lessonId }, teacher.token);
    assert.ok(detail.success, 'getLessonDetail must succeed');
    assert.ok(detail.privateAnswers, 'privateAnswers dictionary must be returned for teacher owner');
    assert.ok(detail.privateAnswersList, 'privateAnswersList array must be returned for backward compatibility');

    // 1. Verify Dictionary format
    assert.equal(typeof detail.privateAnswers, 'object', 'privateAnswers must be an object');
    assert.ok(!Array.isArray(detail.privateAnswers), 'privateAnswers must not be an array');
    const firstQId = Object.keys(detail.privateAnswers)[0];
    assert.ok(firstQId, 'At least one question key in privateAnswers');
    assert.ok(detail.privateAnswers[firstQId].correctAnswer !== undefined, 'Must contain correctAnswer');

    // 2. Verify Array format
    assert.ok(Array.isArray(detail.privateAnswersList), 'privateAnswersList must be an array');
    assert.ok(detail.privateAnswersList.length > 0, 'Array must contain items');

    // 3. Test client-side helper simulation on Dictionary, Array, and null
    const extractHelper = (answers, qId) => {
      if (!answers) return null;
      if (typeof answers === 'object' && !Array.isArray(answers)) {
        const direct = answers[qId];
        if (direct) return { answer: direct.correctAnswer !== undefined ? direct.correctAnswer : direct.answer };
      }
      if (Array.isArray(answers)) {
        const found = answers.find((pa) => pa && (pa.questionId === qId || pa.id === qId));
        if (found) return { answer: found.correctAnswer !== undefined ? found.correctAnswer : found.answer };
      }
      return null;
    };

    // Dictionary test
    const fromDict = extractHelper(detail.privateAnswers, firstQId);
    assert.ok(fromDict, 'Helper must extract from dictionary');

    // Array test
    const fromArr = extractHelper(detail.privateAnswersList, firstQId);
    assert.ok(fromArr, 'Helper must extract from array');

    // Null test
    const fromNull = extractHelper(null, firstQId);
    assert.equal(fromNull, null, 'Helper must return null on null input without throwing');
  });

  // =========================================================================
  // PHASE 9: STUDENT MANAGEMENT & SECURITY (V5.2.1 P0)
  // =========================================================================
  test('P0-9. Student Management: updateStudentInfo, toggleStudentStatus, and login rejection when suspended', async () => {
    // 1. Update Student Info
    const updRes = await callCallable('updateStudentInfo', {
      studentId,
      displayAlias: 'Sóc Nâu Nhanh Nhẹn',
      studentCode: 'HS-SOC-01-NEW'
    }, teacher.token);
    assert.ok(updRes.success, 'Update student info must succeed');

    // 2. Suspend Student
    const suspendRes = await callCallable('toggleStudentStatus', {
      studentId,
      status: 'suspended'
    }, teacher.token);
    assert.ok(suspendRes.success, 'Suspend student must succeed');
    assert.equal(suspendRes.status, 'suspended');

    // 3. Suspended student attempting to login must be rejected
    await assert.rejects(
      async () => {
        await callCallable('joinClass', {
          classCode,
          accessCode: studentAccessCode
        });
      },
      (err) => {
        assert.ok(err.message.includes('tạm khóa'), 'Must reject login for suspended student');
        return true;
      },
      'Must reject suspended student login'
    );

    // 4. Reactivate Student
    const reactivateRes = await callCallable('toggleStudentStatus', {
      studentId,
      status: 'active'
    }, teacher.token);
    assert.ok(reactivateRes.success, 'Reactivate student must succeed');
    assert.equal(reactivateRes.status, 'active');

    // 5. Active student can login again
    const reJoinRes = await callCallable('joinClass', {
      classCode,
      accessCode: studentAccessCode
    });
    assert.ok(reJoinRes.success, 'Active student must be able to join class');
    assert.equal(reJoinRes.student.displayAlias, 'Sóc Nâu Nhanh Nhẹn', 'Updated alias must be reflected');
  });

  test('P0-10. Student Transfer: Safely transfer student to another class while preserving identity', async () => {
    // 1. Create a second class
    const c2Res = await callCallable('createClassroom', {
      name: 'Lớp 2B Chuyển Đến V5.2.1',
      grade: 2,
      academicYear: '2025-2026'
    }, teacher.token);
    assert.ok(c2Res.classroom, 'Classroom 2 must be created');
    const class2Id = c2Res.classroom.id;
    const class2Code = c2Res.classroom.classCode;

    // 2. Transfer student
    const transRes = await callCallable('transferStudentClass', {
      studentId,
      targetClassId: class2Id
    }, teacher.token);
    assert.ok(transRes.success, 'Transfer student must succeed');

    // 3. Student can now login using Class 2 code + same PIN
    const joinC2Res = await callCallable('joinClass', {
      classCode: class2Code,
      accessCode: studentAccessCode
    });
    assert.ok(joinC2Res.success, 'Student must be able to join Class 2');
    assert.equal(joinC2Res.student.classId, class2Id, 'Student must now belong to Class 2');
    assert.equal(joinC2Res.student.displayAlias, 'Sóc Nâu Nhanh Nhẹn', 'Student alias preserved');
  });
});
