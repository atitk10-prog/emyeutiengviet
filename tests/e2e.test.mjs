import test, { describe } from 'node:test';
import assert from 'node:assert';
import {
  FUNCTIONS_URL,
  AUTH_EMULATOR_URL,
  createUser,
  exchangeCustomToken,
  callCallable as callFunction,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

async function getTeacherToken() {
  const teacher = await createUser('teacher_e2e');
  await callFunction('bootstrapTeacherRole', { displayName: 'Cô Lan Phương', adminSecret: 'EMYTV_ADMIN_SECRET_2026' }, teacher.token);
  return teacher.token;
}

describe('EM YÊU TIẾNG VIỆT - END-TO-END PEDAGOGICAL WORKFLOW TEST', () => {
  let teacherIdToken = null;
  let testClassCode = null;
  let testClassId = null;
  let testStudentAccessCode = null;
  let testStudentId = null;
  let testAssignmentId = null;
  let studentIdToken = null;
  let testAttemptId = null;

  test('Step 1: Bootstrap Teacher and Seed Database', async () => {
    teacherIdToken = await getTeacherToken();
    assert.ok(teacherIdToken, 'Teacher must receive authenticated token');

    const seedResult = await callFunction('seedDatabase', {}, teacherIdToken);
    assert.strictEqual(seedResult.success, true);
    assert.match(seedResult.message, /thành công/);
  });

  test('Step 2: Teacher Creates Classroom', async () => {
    const classRes = await callFunction(
      'createClassroom',
      {
        name: 'Lớp 2A - Thực Nghiệm',
        grade: 2
      },
      teacherIdToken
    );

    assert.strictEqual(classRes.success, true);
    assert.ok(classRes.classroom.classCode);
    testClassCode = classRes.classroom.classCode;
    testClassId = classRes.classroom.id;
  });

  test('Step 3: Teacher Creates Student & Issues Secure Random Access Pin', async () => {
    const studentRes = await callFunction(
      'createStudentAccess',
      {
        classId: testClassId,
        displayAlias: 'Sơn Ca Nhỏ',
        studentCode: 'HS2026'
      },
      teacherIdToken
    );

    assert.strictEqual(studentRes.success, true);
    assert.ok(studentRes.student.accessCode);
    assert.strictEqual(studentRes.student.displayAlias, 'Sơn Ca Nhỏ');
    testStudentAccessCode = studentRes.student.accessCode;
    testStudentId = studentRes.student.id;
  });

  test('Step 4: Teacher Assigns Published Lesson to Classroom', async () => {
    const assignRes = await callFunction(
      'assignLesson',
      {
        classId: testClassId,
        lessonId: 'seed-lop2-bai1',
        lessonVersionId: 'seed-lop2-bai1-v1',
        maxAttempts: 3,
        isPreTest: true
      },
      teacherIdToken
    );

    assert.strictEqual(assignRes.success, true);
    assert.ok(assignRes.assignment.id);
    testAssignmentId = assignRes.assignment.id;
  });

  test('Step 5: Student Joins Class with Access Code (Verified on Server)', async () => {
    const joinRes = await callFunction('joinClass', {
      classCode: testClassCode,
      accessCode: testStudentAccessCode
    });

    assert.strictEqual(joinRes.success, true);
    assert.strictEqual(joinRes.student.displayAlias, 'Sơn Ca Nhỏ');
    assert.ok(joinRes.token);

    // Exchange custom token for Student ID Token
    studentIdToken = await exchangeCustomToken(joinRes.token);
    assert.ok(studentIdToken);
  });

  test('Step 6: Student Starts Attempt & Verifies No Answer Leaks in Public Payload', async () => {
    const startRes = await callFunction(
      'startAttempt',
      { assignmentId: testAssignmentId },
      studentIdToken
    );

    assert.ok(startRes.attemptId);
    assert.ok(startRes.lessonVersion);
    assert.strictEqual(startRes.lessonVersion.publicQuestions.length, 5);

    // Verify questions DO NOT contain correct answers or hints in public payload
    for (const q of startRes.lessonVersion.publicQuestions) {
      assert.strictEqual(q.answer, undefined, `Public question ${q.id} must not leak answer!`);
      assert.strictEqual(q.hint, undefined, `Public question ${q.id} must not leak hint!`);
      assert.strictEqual(q.explanation, undefined, `Public question ${q.id} must not leak explanation!`);
    }

    testAttemptId = startRes.attemptId;
  });

  test('Step 7: Student Submits Wrong Answer -> Server Returns Hint, NO Answer Leak', async () => {
    // Question 1: "Chim sâu nhỏ thức dậy vào lúc nào?", correct is 'A' (Sáng sớm).
    // Student submits 'B' on first try:
    const submitWrong = await callFunction(
      'submitAnswer',
      {
        attemptId: testAttemptId,
        questionId: 'q1',
        answer: 'B',
        phase: 'first_try',
        requestId: `req_${Date.now()}_1`
      },
      studentIdToken
    );

    assert.strictEqual(submitWrong.correct, false);
    assert.strictEqual(submitWrong.isFirstTry, true);
    assert.strictEqual(submitWrong.canRetry, true);
    assert.ok(submitWrong.hint, 'Must return pedagogical hint');
    assert.strictEqual(submitWrong.correctAnswer, undefined, 'Must not leak correct answer on hint!');
  });

  test('Step 8: Student Retries Question 1 -> Server Verifies & Returns Explanation', async () => {
    const submitRetry = await callFunction(
      'submitAnswer',
      {
        attemptId: testAttemptId,
        questionId: 'q1',
        answer: 'A', // Correct answer
        phase: 'retry',
        requestId: `req_${Date.now()}_2`
      },
      studentIdToken
    );

    assert.strictEqual(submitRetry.correct, true);
    assert.strictEqual(submitRetry.canRetry, false);
    assert.ok(submitRetry.explanation);
    assert.strictEqual(submitRetry.correctAnswer, 'A');
  });

  test('Step 9: Finish Attempt & Verify Server-Side Score Integrity', async () => {
    const finishRes = await callFunction(
      'finishAttempt',
      {
        attemptId: testAttemptId,
        idempotencyKey: `finish_${testAttemptId}`
      },
      studentIdToken
    );

    assert.strictEqual(finishRes.success, true);
    assert.strictEqual(finishRes.attempt.status, 'completed');
    assert.strictEqual(finishRes.attempt.finalCorrectCount, 1);
    assert.strictEqual(finishRes.attempt.firstTryCorrectCount, 0); // Corrected only on retry
    assert.strictEqual(finishRes.attempt.hintCount, 1);
  });

  test('Step 10: Teacher Analytics Aggregation & UTF-8 BOM CSV Export', async () => {
    const analytics = await callFunction(
      'getTeacherAnalytics',
      { classId: testClassId },
      teacherIdToken
    );

    assert.ok(analytics);
    assert.ok(analytics.skillBreakdown);

    const exportRes = await callFunction(
      'exportTeacherData',
      { classId: testClassId },
      teacherIdToken
    );

    assert.ok(exportRes.csv);
    // Verify UTF-8 BOM \uFEFF for proper Microsoft Excel Vietnamese encoding
    assert.strictEqual(exportRes.csv.charCodeAt(0), 0xFEFF, 'CSV must start with UTF-8 BOM');
    assert.match(exportRes.csv, /Sơn Ca Nhỏ/);
  });
});
