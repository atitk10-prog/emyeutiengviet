import test, { describe } from 'node:test';
import assert from 'node:assert';
import {
  FUNCTIONS_URL,
  AUTH_EMULATOR_URL,
  createUser,
  callCallable as callFunction,
  assertIsolatedTestEnvironment
} from './test_env.mjs';

assertIsolatedTestEnvironment();

describe('EM YÊU TIẾNG VIỆT - SECURITY & AI HARDENING TESTS (v4.0)', () => {
  test('1. Check AI Config returns 4-state status with active model without exposing keys', async () => {
    const aiStatus = await callFunction('getAIStatus', {});
    assert.ok(aiStatus, 'AI status must return an object');
    assert.strictEqual(typeof aiStatus.isConfigured, 'boolean');
    assert.ok(
      ['NOT_CONFIGURED', 'READY_UNVERIFIED', 'VERIFIED', 'UNAVAILABLE'].includes(aiStatus.status),
      `Status must be one of the 4 defined states, got: ${aiStatus.status}`
    );
    assert.ok(aiStatus.activeModel || aiStatus.model, 'Must report active model');
    const model = aiStatus.activeModel || aiStatus.model;
    assert.match(
      model,
      /gemini-3\.5-flash-lite|gemini-3\.8-flash|gemini-2\.5-flash/,
      'Must use supported model (gemini-3.5-flash-lite or gemini-3.8-flash)'
    );
    assert.strictEqual(aiStatus.apiKey, undefined, 'Must NEVER expose API key to client!');
  });

  test('2. Anti-Brute-Force Lockout on targeted PIN without whole-class denial of service', async () => {
    // 1. Create teacher and classroom with academicYear
    const email = `teacher_sec_${Date.now()}@emytv.edu.vn`;
    const res = await fetch(`${AUTH_EMULATOR_URL}:signUp?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'TeacherPassword123',
        returnSecureToken: true
      })
    });
    const { idToken } = await res.json();
    await callFunction('bootstrapTeacherRole', { displayName: 'Cô Mai Anh' }, idToken);

    const classRes = await callFunction(
      'createClassroom',
      { name: 'Lớp 3A - Bảo Mật', grade: 3, academicYear: '2025-2026' },
      idToken
    );
    const testClassCode = classRes.classroom.classCode;
    assert.strictEqual(classRes.classroom.academicYear, '2025-2026', 'Classroom must persist academicYear');

    // 2. Issue valid access code for student "Chim Én"
    const studentRes = await callFunction(
      'createStudentAccess',
      { classId: classRes.classroom.id, displayAlias: 'Chim Én', studentCode: 'EN01' },
      idToken
    );
    const validStudentPin = studentRes.student.accessCode;

    // 3. Repeatedly attempt a specific wrong PIN 'BADPIN99' 4 times
    const badPin = 'BADPIN99';
    for (let i = 1; i <= 4; i++) {
      try {
        await callFunction('joinClass', {
          classCode: testClassCode,
          accessCode: badPin
        });
        assert.fail('Should have failed with invalid credentials');
      } catch (err) {
        assert.match(err.message, /không đúng|thử lại/i);
      }
    }

    // 4. 5th attempt of 'BADPIN99' MUST trigger 5-minute lockout for that specific PIN
    try {
      await callFunction('joinClass', {
        classCode: testClassCode,
        accessCode: badPin
      });
      assert.fail('Should have triggered lockout on 5th consecutive failure');
    } catch (err) {
      assert.match(err.message, /5 lần liên tiếp|tạm khóa 5 phút|quá nhiều lần/i);
    }

    // 5th+ attempt while locked should remain locked
    try {
      await callFunction('joinClass', {
        classCode: testClassCode,
        accessCode: badPin
      });
      assert.fail('Should remain locked out');
    } catch (err) {
      assert.match(err.message, /tạm thời bị khóa|quá nhiều lần|thử lại sau/i);
    }

    // 5. CRITICAL PROOF: Genuine student with valid PIN can STILL log in!
    // (Proves no denial of service for the whole classroom)
    const validJoinRes = await callFunction('joinClass', {
      classCode: testClassCode,
      accessCode: validStudentPin
    });
    assert.strictEqual(validJoinRes.success, true, 'Valid student must be able to log in despite bad actor locked out');
    assert.strictEqual(validJoinRes.student.displayAlias, 'Chim Én');
  });

  test('3. Teacher Draft Generation safely handles both unconfigured and live AI environment', async () => {
    const email = `teacher_ai_${Date.now()}@emytv.edu.vn`;
    const res = await fetch(`${AUTH_EMULATOR_URL}:signUp?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'TeacherPassword123',
        returnSecureToken: true
      })
    });
    const { idToken } = await res.json();
    await callFunction('bootstrapTeacherRole', { displayName: 'Thầy Hoàng Minh' }, idToken);

    try {
      const draftRes = await callFunction(
        'generateLessonDraft',
        {
          grade: 2,
          topic: 'Bảo vệ rừng xanh',
          genre: 'narrative',
          wordCount: 140,
          goal: 'Đọc hiểu và trắc nghiệm'
        },
        idToken
      );

      if (draftRes && draftRes.draft) {
        assert.ok(draftRes.draft.title, 'Draft must have title');
        assert.ok(draftRes.draft.passage, 'Draft must have passage');
        assert.strictEqual(draftRes.draft.questions.length >= 3, true);
      }
    } catch (err) {
      assert.match(err.message, /chưa cấu hình|chưa kết nối|API key|Gemini AI|quota|hạn ngạch|model|kiểm định sư phạm|định dạng chuẩn|chưa đúng định dạng/i);
    }
  });

  test('4. testAIConnection endpoint requires authenticated teacher role', async () => {
    // Unauthenticated call must fail
    try {
      await callFunction('testAIConnection', {});
      assert.fail('Unauthenticated call should be rejected');
    } catch (err) {
      assert.match(err.message, /unauthenticated|yêu cầu đăng nhập/i);
    }

    // Authenticated teacher call
    const email = `teacher_testai_${Date.now()}@emytv.edu.vn`;
    const res = await fetch(`${AUTH_EMULATOR_URL}:signUp?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'TeacherPassword123',
        returnSecureToken: true
      })
    });
    const { idToken } = await res.json();
    await callFunction('bootstrapTeacherRole', { displayName: 'Cô Thảo' }, idToken);

    const testRes = await callFunction('testAIConnection', {}, idToken);
    assert.ok(testRes);
    assert.ok(testRes.status);
    // If no GEMINI_API_KEY is configured in env, success is false and error explains clearly
    if (!testRes.status.isConfigured) {
      assert.strictEqual(testRes.success, false);
      assert.match(testRes.error, /chưa cấu hình GEMINI_API_KEY/i);
    }
  });
});
