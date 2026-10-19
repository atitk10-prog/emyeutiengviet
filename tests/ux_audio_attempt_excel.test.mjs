import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUser,
  exchangeCustomToken,
  callCallable,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

describe('EM YÊU TIẾNG VIỆT - V5.0 FINAL UX, DATA FIX & RELIABILITY TEST SUITE', () => {

  let teacher;
  let admin;
  let classId;
  let classCode;
  let student1;
  let student1AccessCode;
  let studentToken;
  let assignmentId;
  let lessonId;
  let lessonVersionId;

  test('SETUP: Seed database, create teacher, class, and published assignment', async () => {
    // 1. Create Teacher
    teacher = await createUser('teacher.v5');
    await callCallable('bootstrapTeacherRole', { displayName: 'Cô Mai Phương V5', adminSecret: 'EMYTV_ADMIN_SECRET_2026' }, teacher.token);

    // 2. Seed lessons if not yet present
    await callCallable('seedDatabase', {}, teacher.token);

    // 3. Create Class
    const classRes = await callCallable('createClassroom', {
      name: 'Lớp 2B Thử Nghiệm V5',
      grade: 2,
      academicYear: '2025-2026'
    }, teacher.token);
    assert.ok(classRes.classroom, 'Class must be created');
    classId = classRes.classroom.id;
    classCode = classRes.classroom.classCode;

    // 4. Create student
    const stRes = await callCallable('createStudentAccess', {
      classId,
      displayAlias: 'Bé Họa Mi V5',
      studentCode: 'HS2B-01'
    }, teacher.token);
    student1 = stRes.student;
    student1AccessCode = stRes.student.accessCode;

    // 5. Get available lessons to assign
    const lessonsRes = await callCallable('getTeacherAnalytics', {}, teacher.token);
    assert.ok(lessonsRes, 'Analytics fetched');

    // Find a published lesson version
    const lessonsListRes = await callCallable('exportTeacherData', { format: 'json' }, teacher.token);
    // Alternatively assign first sample lesson
    // We can publish and assign a lesson
    let draft;
    try {
      const createDraftRes = await callCallable('generateLessonDraft', {
        grade: 2,
        topic: 'Tình bạn và lòng nhân ái',
        genre: 'narrative',
        targetWordCount: 140,
        readingGoal: 'Hiểu nội dung chính và tìm thông tin'
      }, teacher.token);
      draft = createDraftRes.draft;
    } catch {
      draft = {
        title: 'Bác Nông Dân Và Chú Chim Sâu',
        passage: 'Sáng sớm mùa xuân, bác nông dân ra đồng thăm luống cải xanh mơn mởn. Một chú chim sâu nhỏ bé chuyền cành ríu rít bắt sâu cho lá cây. Bác nông dân mỉm cười cảm ơn chú chim chăm chỉ giúp ích cho mùa màng.',
        grade: 2,
        topic: 'Tình bạn và lòng nhân ái',
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
    }

    const publishRes = await callCallable('publishLesson', {
      draft
    }, teacher.token);

    lessonId = publishRes.lessonId;
    lessonVersionId = publishRes.versionId;

    // 6. Assign lesson with maxAttempts = 2 for quick testing
    const assignRes = await callCallable('assignLesson', {
      classId,
      lessonId,
      lessonVersionId,
      maxAttempts: 2
    }, teacher.token);

    assert.ok(assignRes.assignment, 'Assignment must be created');
    assignmentId = assignRes.assignment.id;
  });

  test('1. Student join class & verify student library states', async () => {
    // Join class with classCode & student1AccessCode
    const joinRes = await callCallable('joinClass', {
      classCode,
      accessCode: student1AccessCode
    });
    assert.ok(joinRes.success, 'Student joins class successfully');
    assert.ok(joinRes.token, 'Student custom token returned');
    studentToken = await exchangeCustomToken(joinRes.token);
    assert.ok(studentToken, 'Exchanged for student auth token');

    // Get Student Library
    const libRes = await callCallable('getStudentLibrary', {}, studentToken);
    assert.ok(libRes.assignments.length >= 1, 'Assignments must be in library');

    const targetAssign = libRes.assignments.find((a) => a.id === assignmentId);
    assert.ok(targetAssign, 'Assigned lesson must appear in student library');
    assert.equal(targetAssign.statusText, 'not_started', 'Initial statusText must be not_started');
    assert.equal(targetAssign.attemptsCount, 0, 'No attempts initially');
    assert.equal(targetAssign.canAttempt, true, 'Student can attempt');
  });

  test('2. Attempt Resume (No duplicate attempt created on page reload / F5)', async () => {
    // Student starts attempt #1
    const start1 = await callCallable('startAttempt', { assignmentId }, studentToken);
    assert.ok(start1.attemptId, 'Attempt started');
    assert.equal(start1.isResumed, false, 'First start is not resumed');
    const firstAttemptId = start1.attemptId;

    // Student reloads page (calls startAttempt again while in_progress)
    const start2 = await callCallable('startAttempt', { assignmentId }, studentToken);
    assert.equal(start2.attemptId, firstAttemptId, 'Same attemptId must be returned on reload');
    assert.equal(start2.isResumed, true, 'Flag isResumed must be true');

    // Check student library reflects in_progress
    const libRes = await callCallable('getStudentLibrary', {}, studentToken);
    const targetAssign = libRes.assignments.find((a) => a.id === assignmentId);
    assert.equal(targetAssign.statusText, 'in_progress', 'statusText must be in_progress');
    assert.equal(targetAssign.inProgressAttemptId, firstAttemptId, 'inProgressAttemptId matches');
  });

  test('3. Single-question answer workflow: pedagogical hints on fail 1, explanation on retry', async () => {
    const start = await callCallable('startAttempt', { assignmentId }, studentToken);
    const questions = start.lessonVersion.publicQuestions;
    assert.ok(questions.length >= 1, 'Questions available');
    const q1 = questions[0];

    // Submit intentionally wrong answer
    const wrongAns = q1.type === 'multiple_choice' ? 'Z' : (q1.type === 'true_false' ? false : ['wrong']);
    const submit1 = await callCallable('submitAnswer', {
      attemptId: start.attemptId,
      questionId: q1.id,
      answer: wrongAns,
      phase: 'first_try'
    }, studentToken);

    // On wrong first try: hints sent, correctAnswer withheld
    if (!submit1.correct) {
      assert.equal(submit1.canRetry, true, 'Student is permitted exactly 1 retry');
      assert.ok(submit1.hint, 'Pedagogical hint must be provided on first failure');
      assert.equal(submit1.correctAnswer, undefined, 'Correct answer must NOT be revealed yet');
    }

    // Submit retry
    const submit2 = await callCallable('submitAnswer', {
      attemptId: start.attemptId,
      questionId: q1.id,
      answer: wrongAns,
      phase: 'retry'
    }, studentToken);

    assert.equal(submit2.canRetry, false, 'No further retries permitted');
    assert.ok(submit2.explanation, 'Explanation revealed after retry');
    assert.ok(submit2.correctAnswer !== undefined, 'Correct answer revealed after retry');

    // Finish attempt #1
    const finishRes = await callCallable('finishAttempt', { attemptId: start.attemptId }, studentToken);
    assert.ok(finishRes.attempt, 'Attempt finished');
    assert.equal(finishRes.attempt.status, 'completed', 'Attempt status marked completed');
  });

  test('4. Dedicated Read-Only Review Mode (getAttemptReview)', async () => {
    const libRes = await callCallable('getStudentLibrary', {}, studentToken);
    const targetAssign = libRes.assignments.find((a) => a.id === assignmentId);
    assert.equal(targetAssign.statusText, 'completed', 'statusText must now be completed');
    assert.ok(targetAssign.latestCompletedAttemptId, 'latestCompletedAttemptId must exist');

    // Fetch review using getAttemptReview
    const reviewRes = await callCallable('getAttemptReview', {
      attemptId: targetAssign.latestCompletedAttemptId
    }, studentToken);

    assert.ok(reviewRes.success, 'Review fetch succeeds');
    assert.ok(reviewRes.attempt, 'Attempt info returned');
    assert.ok(reviewRes.lessonVersion, 'Lesson version returned');
    assert.ok(reviewRes.responses, 'Responses returned');
    assert.ok(reviewRes.answerKey, 'Answer key with pedagogical explanations revealed for review');
  });

  test('5. Max attempts lockout & persistent review access (3/3 attempts exhausted)', async () => {
    // Start and immediately finish attempt #2 (since maxAttempts was set to 2)
    const start2 = await callCallable('startAttempt', { assignmentId }, studentToken);
    await callCallable('finishAttempt', { attemptId: start2.attemptId }, studentToken);

    // Check student library: should be max_reached
    const libRes = await callCallable('getStudentLibrary', {}, studentToken);
    const targetAssign = libRes.assignments.find((a) => a.id === assignmentId);
    assert.equal(targetAssign.statusText, 'max_reached', 'statusText must be max_reached');
    assert.equal(targetAssign.canAttempt, false, 'canAttempt must be false when max reached');
    assert.equal(targetAssign.attemptsCount, 2, 'Total attempts count is 2/2');

    // Attempting startAttempt #3 must be politely rejected with resource-exhausted
    await assert.rejects(
      async () => {
        await callCallable('startAttempt', { assignmentId }, studentToken);
      },
      (err) => {
        assert.ok(
          err.message.includes('số lượt làm bài tối đa') || err.message.includes('Xem lại bài đã làm'),
          `Error message should advise reviewing past attempts: ${err.message}`
        );
        return true;
      }
    );

    // CRITICAL REQUIREMENT: Student must still be able to review past attempts freely!
    const reviewPast = await callCallable('getAttemptReview', {
      attemptId: targetAssign.latestCompletedAttemptId
    }, studentToken);
    assert.ok(reviewPast.success, 'Review must still be accessible even when max attempts are reached');
  });

  test('6. Batch Student Creation from Excel data & duplicate prevention', async () => {
    const newStudents = [
      { displayAlias: 'Sơn Ca V5', studentCode: 'HS2B-10', accessCode: 'PIN123' },
      { displayAlias: 'Vành Khuyên V5', studentCode: 'HS2B-11' }, // auto PIN
      { displayAlias: 'Bảo Long V5', studentCode: 'HS2B-12' }
    ];

    const batchRes = await callCallable('batchCreateStudents', {
      classId,
      students: newStudents
    }, teacher.token);

    assert.ok(batchRes.success, 'Batch creation succeeded');
    assert.equal(batchRes.totalCreated || batchRes.createdCount, 3, 'Created exactly 3 students');
    assert.ok(batchRes.students.every((s) => s.accessCode), 'All students must have generated/assigned cleartext PINs');

    // Attempting to batch create a student with duplicate code in same class
    await assert.rejects(
      async () => {
        await callCallable('batchCreateStudents', {
          classId,
          students: [{ displayAlias: 'Trùng Mã', studentCode: 'HS2B-10' }]
        }, teacher.token);
      },
      (err) => {
        assert.ok(err.message.includes('tồn tại') || err.message.includes('hợp lệ'), 'Duplicate code should be caught');
        return true;
      }
    );
  });

  test('7. Batch Teacher Creation from Excel data (Admin only)', async () => {
    admin = await createUser('admin.v5');
    await callCallable('bootstrapAdminRole', {
      adminSecret: 'EMYTV_ADMIN_SECRET_2026',
      displayName: 'Tổng Quản Trị V5'
    }, admin.token);

    const newTeachers = [
      {
        email: `gv.mai.${Date.now()}@tieuhoc.edu.vn`,
        displayName: 'Cô Nguyễn Mai',
        initialPassword: 'GiaoVien@2026'
      },
      {
        email: `thay.hai.${Date.now()}@tieuhoc.edu.vn`,
        displayName: 'Thầy Lê Hoàng Hải',
        initialPassword: 'GiaoVien@2026'
      }
    ];

    const batchRes = await callCallable('batchCreateTeachers', {
      teachers: newTeachers
    }, admin.token);

    assert.ok(batchRes.success, 'Batch teachers creation succeeded');
    assert.equal(batchRes.totalCreated || batchRes.successCount, 2, '2 teachers created');

    // Teacher cannot call batchCreateTeachers
    await assert.rejects(
      async () => {
        await callCallable('batchCreateTeachers', { teachers: newTeachers }, teacher.token);
      },
      (err) => {
        assert.ok(err.message.includes('Quản trị viên') || err.message.includes('permission-denied'));
        return true;
      }
    );
  });

  test('8. Admin Reset Teacher Password (V5.1 Secure Firebase Link)', async () => {
    const teacherUid = teacher.uid;
    const resetRes = await callCallable('adminResetTeacherPassword', {
      targetUid: teacherUid
    }, admin.token);

    assert.ok(resetRes.success, 'Password reset succeeded');
    assert.ok(resetRes.resetLink !== undefined, 'Reset link property exists');
    assert.equal(resetRes.tempPassword, undefined, 'Plaintext temporary password MUST NOT be returned');
  });
});
