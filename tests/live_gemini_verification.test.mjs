import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shared = await import(`file://${path.resolve(__dirname, '../shared/dist/index.js').replace(/\\/g, '/')}`);
const { LessonDraftSchema } = shared;

import {
  createUser,
  callCallable,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

async function getTeacherSession() {
  const teacher = await createUser('co.lan.gemini');
  await callCallable('bootstrapTeacherRole', { displayName: 'Cô Lan Phương', uid: teacher.uid }, teacher.token);
  return teacher;
}

// Global container to store generated lessons for reporting
export const liveTestResults = {
  grade2: null,
  grade3: null,
  publishAndStudentFlow: null,
  apiLatencies: {}
};

describe('EM YÊU TIẾNG VIỆT - LIVE GEMINI AI INTEGRATION TESTS (v4.0)', () => {

  test('1. Verify Live AI Status & Connectivity via testAIConnection', async () => {
    const { token } = await getTeacherSession();
    const startTime = Date.now();
    const result = await callCallable('testAIConnection', {}, token);
    const latency = Date.now() - startTime;
    liveTestResults.apiLatencies.syntheticTest = latency;

    assert.equal(result.success, true, 'testAIConnection must return success: true');
    assert.equal(result.status.status, 'VERIFIED', 'AI status must be VERIFIED with live key');
    assert.equal(result.status.activeModel, 'gemini-3.5-flash-lite', 'Active model must be gemini-3.5-flash-lite');
    assert.ok(result.sampleOutput && result.sampleOutput.length > 5, 'Must return sample pedagogical sentence');
  });

  test('2. Generate Live Grade 2 Lesson: "Chăm sóc cây xanh" with 5 Questions', async () => {
    const { token } = await getTeacherSession();
    const startTime = Date.now();

    const result = await callCallable('generateLessonDraft', {
      grade: 2,
      topic: 'Chăm sóc cây xanh',
      genre: 'narrative',
      targetWordCount: 140,
      questionCount: 5,
      readingGoal: 'Tìm thông tin chi tiết và hiểu trình tự chăm sóc cây'
    }, token);

    const latency = Date.now() - startTime;
    liveTestResults.apiLatencies.grade2Gen = latency;

    assert.equal(result.success, true);
    assert.ok(result.draft, 'Must return draft lesson');

    const draft = result.draft;
    liveTestResults.grade2 = draft;

    // Validate with Zod LessonDraftSchema
    const parseResult = LessonDraftSchema.safeParse(draft);
    assert.ok(parseResult.success, `Draft schema validation failed: ${JSON.stringify(parseResult.error?.issues)}`);

    // Verify pedagogical constraints
    assert.equal(draft.grade, 2);
    assert.ok(draft.title && draft.title.length >= 3, 'Title must be present');
    assert.ok(draft.passage && draft.passage.length >= 100, 'Passage must have sufficient length');
    assert.equal(draft.questions.length, 5, 'Must contain exactly 5 questions');

    // Verify 3 distinct question types
    const types = draft.questions.map((q) => q.type);
    assert.ok(types.includes('multiple_choice'), 'Must have multiple_choice');
    assert.ok(types.includes('true_false'), 'Must have true_false');
    assert.ok(types.includes('sequence'), 'Must have sequence');

    // Verify answer keys, hints, explanations
    for (const q of draft.questions) {
      assert.ok(q.answer !== undefined && q.answer !== null, `Question ${q.id} must have answer`);
      assert.ok(q.hint && q.hint.length >= 5, `Question ${q.id} must have pedagogical hint`);
      assert.ok(q.explanation && q.explanation.length >= 5, `Question ${q.id} must have explanation`);
      
      if (q.type === 'multiple_choice') {
        assert.equal(q.options?.length, 3, 'MCQ must have 3 options (A, B, C)');
        assert.ok(['A', 'B', 'C'].includes(String(q.answer).toUpperCase()), 'MCQ answer must be A, B, or C');
      } else if (q.type === 'true_false') {
        assert.equal(typeof q.answer, 'boolean', 'TF answer must be boolean');
      } else if (q.type === 'sequence') {
        assert.equal(q.items?.length, 3, 'Sequence must have 3 events');
        assert.ok(Array.isArray(q.answer) && q.answer.length === 3, 'Sequence answer must be 3 items array');
      }
    }
  });

  test('3. Teacher Review, Edit, Publish & Complete Student Flow on Live AI Lesson', async () => {
    const { token, uid: teacherUid } = await getTeacherSession();
    const draft = liveTestResults.grade2;
    assert.ok(draft, 'Must have Grade 2 draft from step 2');

    // Teacher edits draft slightly before approving (e.g. title suffix)
    draft.title = `${draft.title} (Bản cô Lan duyệt)`;

    // Publish lesson
    const pubRes = await callCallable('publishLesson', { draft }, token);
    assert.equal(pubRes.success, true);
    const { lessonId, versionId } = pubRes;

    // Create classroom with academicYear
    const clsRes = await callCallable('createClassroom', {
      name: 'Lớp 2B Vườn Ươm',
      grade: 2,
      academicYear: '2025-2026'
    }, token);
    assert.equal(clsRes.success, true);
    const classId = clsRes.classroom.id;
    const classCode = clsRes.classroom.classCode;

    // Assign published lesson to class
    const assignRes = await callCallable('assignLesson', {
      classId,
      lessonId,
      lessonVersionId: versionId,
      maxAttempts: 3
    }, token);
    assert.equal(assignRes.success, true);
    const assignmentId = assignRes.assignment.id;

    // Create student access PIN
    const stRes = await callCallable('createStudentAccess', {
      classId,
      displayAlias: 'Mầm Xanh',
      studentCode: 'MX01'
    }, token);
    assert.equal(stRes.success, true);
    const accessCode = stRes.student.accessCode;

    // Student joins with classCode + accessCode
    const joinRes = await callCallable('joinClass', { classCode, accessCode });
    assert.equal(joinRes.success, true);

    // Exchange customToken for idToken
    const authRes = await fetch(`${AUTH_EMULATOR_URL}:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: joinRes.token, returnSecureToken: true })
    });
    const authData = await authRes.json();
    const studentToken = authData.idToken;

    // Student starts attempt
    const startRes = await callCallable('startAttempt', { assignmentId }, studentToken);
    assert.ok(startRes.attemptId, 'startAttempt must return attemptId');
    const attemptId = startRes.attemptId;
    const publicQuestions = startRes.lessonVersion.publicQuestions;

    // Verify NO answers leak in student public payload
    for (const q of publicQuestions) {
      assert.equal(q.answer, undefined, 'Public question MUST NOT leak answer');
      assert.equal(q.hint, undefined, 'Public question MUST NOT leak hint');
      assert.equal(q.explanation, undefined, 'Public question MUST NOT leak explanation');
    }

    // Student submits answer to first question
    const q1 = publicQuestions[0];
    const subRes1 = await callCallable('submitAnswer', {
      attemptId,
      questionId: q1.id,
      answer: 'WRONG_TEST_CHOICE',
      phase: 'first_try',
      requestId: `req_${Date.now()}`
    }, studentToken);

    assert.equal(subRes1.correct, false);
    assert.equal(subRes1.canRetry, true);
    assert.ok(subRes1.hint && subRes1.hint.length >= 5, 'Must receive pedagogical hint');
    assert.equal(subRes1.correctAnswer, undefined, 'Must not leak correct answer upon first wrong try');

    // Finish attempt
    const finishRes = await callCallable('finishAttempt', { attemptId }, studentToken);
    assert.equal(finishRes.success, true);
    assert.ok(finishRes.attempt, 'Must return attempt object');

    // 1. Teacher views real-time analytics
    const analyticsRes = await callCallable('getTeacherAnalytics', { classId }, token);
    assert.ok(analyticsRes.totalAttempts >= 1, 'Analytics must reflect the student completed attempt');
    assert.ok(analyticsRes.totalAssignments >= 1, 'Analytics must show assignments');

    // 2. Teacher requests AI remediation recommendations
    const remediationRes = await callCallable('suggestRemediation', { classId }, token);
    assert.ok(Array.isArray(remediationRes.suggestedActivities), 'Remediation must return suggestedActivities array');
    assert.ok(remediationRes.suggestedActivities.length >= 1, 'Must have at least 1 remediation exercise');
    assert.ok(remediationRes.disclaimer, 'Remediation must have teacher disclaimer');

    // 3. Multi-device student resumption (another device joins with same credentials)
    const joinResDevice2 = await callCallable('joinClass', { classCode, accessCode });
    assert.equal(joinResDevice2.success, true);
    assert.equal(joinResDevice2.student.id, joinRes.student.id, 'Must bind to the same student ID across devices');

    // Device 2 exchanges token and gets student library
    const authRes2 = await fetch(`${AUTH_EMULATOR_URL}:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: joinResDevice2.token, returnSecureToken: true })
    });
    const authData2 = await authRes2.json();
    const studentToken2 = authData2.idToken;

    const libraryRes = await callCallable('getStudentLibrary', {}, studentToken2);
    assert.ok(Array.isArray(libraryRes.assignments), 'Library must return assignments');
    assert.ok(libraryRes.assignments.some(a => a.id === assignmentId), 'Must see assigned lesson on device 2');

    liveTestResults.publishAndStudentFlow = {
      lessonId,
      versionId,
      classId,
      classCode,
      assignmentId,
      attemptId,
      remediationCount: remediationRes.suggestedActivities.length,
      multiDeviceVerified: true,
      status: 'VERIFIED_END_TO_END'
    };
  });

  test('4. Generate Live Grade 3 Lesson: "Bảo vệ nguồn nước sạch" (Informational Text)', async () => {
    const { token } = await getTeacherSession();
    const startTime = Date.now();

    const result = await callCallable('generateLessonDraft', {
      grade: 3,
      topic: 'Bảo vệ nguồn nước sạch',
      genre: 'informational',
      targetWordCount: 180,
      questionCount: 5,
      readingGoal: 'Nắm được nội dung chính của văn bản thông tin và liên hệ thực tế'
    }, token);

    const latency = Date.now() - startTime;
    liveTestResults.apiLatencies.grade3Gen = latency;

    assert.equal(result.success, true);
    assert.ok(result.draft, 'Must return draft lesson');

    const draft = result.draft;
    liveTestResults.grade3 = draft;

    const parseResult = LessonDraftSchema.safeParse(draft);
    assert.ok(parseResult.success, `Grade 3 draft validation failed: ${JSON.stringify(parseResult.error?.issues)}`);
    assert.equal(draft.grade, 3);
    assert.equal(draft.questions.length, 5);
  });

  test('5. Output Audit Artifact for GEMINI_REAL_API_TEST.md', () => {
    // Write full test summary to scratch json for reporting
    const artifactPath = path.resolve(__dirname, '../artifacts/live_gemini_test_run.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    
    // Sanitize before saving: absolute zero API key, only metadata & pedagogical content
    const sanitizedReport = {
      timestamp: new Date().toISOString(),
      modelCalled: 'gemini-3.5-flash-lite',
      latencies: liveTestResults.apiLatencies,
      grade2Lesson: {
        title: liveTestResults.grade2?.title,
        topic: liveTestResults.grade2?.topic,
        wordCountApprox: liveTestResults.grade2?.passage?.split(/\s+/).length,
        questionCount: liveTestResults.grade2?.questions?.length,
        passageSnippet: liveTestResults.grade2?.passage?.slice(0, 150) + '...'
      },
      grade3Lesson: {
        title: liveTestResults.grade3?.title,
        topic: liveTestResults.grade3?.topic,
        wordCountApprox: liveTestResults.grade3?.passage?.split(/\s+/).length,
        questionCount: liveTestResults.grade3?.questions?.length,
        passageSnippet: liveTestResults.grade3?.passage?.slice(0, 150) + '...'
      },
      endToEndFlow: liveTestResults.publishAndStudentFlow
    };

    fs.writeFileSync(artifactPath, JSON.stringify(sanitizedReport, null, 2), 'utf8');
    assert.ok(fs.existsSync(artifactPath), 'Artifact JSON must be written');
  });

});
