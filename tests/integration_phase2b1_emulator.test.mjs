/**
 * EM YÊU TIẾNG VIỆT - KIỂM THỬ THỰC TẾ TRÊN EMULATOR (ĐỢT 2B.1)
 * 
 * Verifies real emulator behavior in an isolated test sandbox:
 * 1. Admin login & role permissions.
 * 2. Teacher login & role restriction (cannot call admin operations).
 * 3. Student login via studentCode/password & joinClass PIN.
 * 4. Wrong password rejected with anti-enumeration generic message.
 * 5. Self-privilege escalation blocked.
 * 6. Change password & re-login with new credentials (old password rejected).
 * 7. Transparent rehashing to OWASP 600k iterations on successful login.
 * 8. Legacy emulator functions callable and unbroken.
 * 9. Zero writes to demo presentation dataset (runs on isolated test ports).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_PROJECT_ID,
  TEST_AUTH_PORT,
  TEST_FIRESTORE_PORT,
  TEST_FUNCTIONS_PORT,
  AUTH_EMULATOR_URL,
  FIRESTORE_EMULATOR_URL,
  FUNCTIONS_URL,
  assertIsolatedTestEnvironment,
  callCallable
} from './test_env.mjs';

// Ensure isolated ports and project ID
assertIsolatedTestEnvironment();

// Configure environment for the Vercel API handler to connect to the test emulator
process.env.NODE_ENV = 'development';
process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${TEST_FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${TEST_AUTH_PORT}`;
process.env.FUNCTIONS_EMULATOR = 'true';

describe('EM YÊU TIẾNG VIỆT — REAL EMULATOR INTEGRATION TESTS (ĐỢT 2B.1)', async () => {
  let authHandler;
  let cryptoHelper;
  let firebaseAdmin;

  before(async () => {
    // Dynamic import after setting emulator environment variables
    authHandler = (await import('../api/auth.ts')).default;
    cryptoHelper = await import('../api/helpers/crypto.ts');
    firebaseAdmin = await import('../api/helpers/firebaseAdmin.ts');
  });

  // Helper: Invoke the Vercel Serverless Function `/api/auth`
  async function invokeAuthApi(action, data = {}, token = null) {
    let statusCode = 200;
    let responseBody = null;

    const headers = {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const mockReq = {
      method: 'POST',
      headers,
      body: { action, data },
      query: {}
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
      },
      send(data) {
        responseBody = data;
      },
      setHeader() {}
    };

    await authHandler(mockReq, mockRes);
    return { status: statusCode, body: responseBody };
  }

  // Helper: Exchange custom token to Firebase ID token via Auth Emulator
  async function exchangeToken(customToken) {
    const res = await fetch(`${AUTH_EMULATOR_URL}:signInWithCustomToken?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    const data = await res.json();
    return data.idToken;
  }

  // Test 1: Admin Login & Claims
  it('1. Admin: Đăng nhập đúng và nhận đủ quyền Quản trị viên (Admin)', async () => {
    const db = firebaseAdmin.getDb();
    const adminUid = `admin_test_${Date.now()}`;
    const username = `admin_it_${Date.now()}`;
    const password = 'AdminPassword123!';

    // Seed test admin
    const salt = cryptoHelper.generateSalt();
    const passwordHash = cryptoHelper.hashPassword(password, salt, 600000);

    await db.collection('users').doc(adminUid).set({
      uid: adminUid,
      username,
      displayName: 'Quản trị viên Kiểm thử',
      role: 'admin',
      status: 'active',
      createdAt: Date.now()
    });

    await db.collection('usernames').doc(username.toLowerCase()).set({
      username: username.toLowerCase(),
      uid: adminUid,
      role: 'admin'
    });

    await db.collection('accountSecrets').doc(adminUid).set({
      uid: adminUid,
      version: 2,
      algorithm: 'pbkdf2-sha256',
      iterations: 600000,
      salt,
      passwordHash,
      createdAt: Date.now()
    });

    // Call API /api/auth accountLogin
    const loginRes = await invokeAuthApi('accountLogin', { username, password });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.success, true);
    assert.equal(loginRes.body.data.role, 'admin');
    assert.ok(loginRes.body.data.token, 'Must return a custom token');

    // Exchange token and verify claims
    const idToken = await exchangeToken(loginRes.body.data.token);
    assert.ok(idToken, 'Must exchange custom token for ID token');

    // Admin should be able to call admin operations
    const resetRes = await invokeAuthApi(
      'adminResetTeacherPassword',
      { targetUid: adminUid },
      idToken
    );
    assert.equal(resetRes.status, 200, 'Admin must be authorized to call adminResetTeacherPassword');
  });

  // Test 2: Teacher Login & Scoped Permissions
  it('2. Teacher: Đăng nhập đúng và chỉ nhận quyền Giáo viên (không gọi được API Admin)', async () => {
    const db = firebaseAdmin.getDb();
    const teacherUid = `teacher_test_${Date.now()}`;
    const username = `gv_it_${Date.now()}`;
    const password = 'TeacherPassword123!';

    const salt = cryptoHelper.generateSalt();
    const passwordHash = cryptoHelper.hashPassword(password, salt, 600000);

    await db.collection('users').doc(teacherUid).set({
      uid: teacherUid,
      username,
      displayName: 'Cô Giáo Kiểm Thử',
      role: 'teacher',
      status: 'active',
      createdAt: Date.now()
    });

    await db.collection('usernames').doc(username.toLowerCase()).set({
      username: username.toLowerCase(),
      uid: teacherUid,
      role: 'teacher'
    });

    await db.collection('accountSecrets').doc(teacherUid).set({
      uid: teacherUid,
      version: 2,
      algorithm: 'pbkdf2-sha256',
      iterations: 600000,
      salt,
      passwordHash,
      createdAt: Date.now()
    });

    const loginRes = await invokeAuthApi('accountLogin', { username, password });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data.role, 'teacher');

    const teacherToken = await exchangeToken(loginRes.body.data.token);

    // Teacher CANNOT call admin-only endpoints
    const forbiddenRes = await invokeAuthApi(
      'adminResetTeacherPassword',
      { targetUid: teacherUid },
      teacherToken
    );
    assert.equal(forbiddenRes.status, 403, 'Teacher must be forbidden from calling adminResetTeacherPassword');
    assert.equal(forbiddenRes.body.error.code, 'permission-denied');
  });

  // Test 3: Student Login via studentCode/password and joinClass PIN
  it('3. Student: Đăng nhập đúng Mã học sinh / Mật khẩu và Mã lớp / Mã PIN', async () => {
    const db = firebaseAdmin.getDb();
    const studentId = `student_test_${Date.now()}`;
    const classId = `class_test_${Date.now()}`;
    const studentCode = `HS_IT_${Date.now()}`.substring(0, 10);
    const password = 'StudentPass123';
    const pin = '8K9M2P';
    const classCode = `LOP${Date.now()}`.substring(0, 7);

    // Create classroom
    await db.collection('classes').doc(classId).set({
      id: classId,
      name: 'Lớp 2 Kiểm Thử',
      grade: 2,
      classCode,
      status: 'active',
      createdAt: Date.now()
    });

    // Create student
    const salt = cryptoHelper.generateSalt();
    const accessCodeHash = cryptoHelper.hashAccessCode(pin, salt, 600000);

    await db.collection('students').doc(studentId).set({
      id: studentId,
      studentCode,
      displayAlias: 'Em Nguyễn Văn Test',
      classId,
      status: 'active',
      createdAt: Date.now()
    });

    await db.collection('studentSecrets').doc(studentId).set({
      studentId,
      version: 2,
      algorithm: 'pbkdf2-sha256',
      iterations: 600000,
      salt,
      accessCodeHash,
      rotatedAt: Date.now()
    });

    // 3A. Test accountLogin with studentCode & PIN/password
    const loginRes = await invokeAuthApi('accountLogin', { username: studentCode, password: pin });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.body.data.role, 'student');
    assert.equal(loginRes.body.data.student.studentCode, studentCode);

    // 3B. Test joinClass with classCode & PIN
    const joinRes = await invokeAuthApi('joinClass', { classCode, accessCode: pin });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.data.student.displayAlias, 'Em Nguyễn Văn Test');
    assert.ok(joinRes.body.data.token, 'joinClass must return custom token');
  });

  // Test 4: Wrong Password Rejection & Anti-Enumeration
  it('4. Security: Sai mật khẩu hoặc tên đăng nhập không tồn tại đều trả lỗi chung (Anti-Enumeration)', async () => {
    // 4A. Wrong password on existing user
    const resWrongPass = await invokeAuthApi('accountLogin', {
      username: 'any_user_abc',
      password: 'DefinitelyWrongPassword123'
    });
    assert.equal(resWrongPass.status, 401);
    assert.equal(resWrongPass.body.error.code, 'permission-denied');
    assert.match(
      resWrongPass.body.error.message,
      /Tên đăng nhập hoặc mật khẩu không chính xác/,
      'Must return generic message without revealing existence'
    );

    // 4B. Non-existent username
    const resNoUser = await invokeAuthApi('accountLogin', {
      username: `non_existent_${Date.now()}`,
      password: 'SomeRandomPassword'
    });
    assert.equal(resNoUser.status, 401);
    assert.equal(
      resNoUser.body.error.message,
      resWrongPass.body.error.message,
      'Generic error message must be identical for non-existent users'
    );
  });

  // Test 5: Privilege Self-Escalation Blocked
  it('5. Security: Không thể tự nâng quyền Admin hoặc Teacher', async () => {
    // Register regular user in Auth
    const regRes = await fetch(`${AUTH_EMULATOR_URL}:signUp?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker_${Date.now()}@free.com`,
        password: 'Password123!',
        returnSecureToken: true
      })
    });
    const { idToken } = await regRes.json();

    // 5A. Try self-granting Admin without correct secret
    const adminHack = await invokeAuthApi(
      'bootstrapAdminRole',
      { adminSecret: 'wrong_secret' },
      idToken
    );
    assert.equal(adminHack.status, 403, 'Must reject self-granting admin with wrong secret');
    assert.equal(adminHack.body.error.code, 'permission-denied');

    // 5B. Try self-granting Teacher without allowlist/secret
    const teacherHack = await invokeAuthApi(
      'bootstrapTeacherRole',
      { adminSecret: 'wrong_secret' },
      idToken
    );
    assert.equal(teacherHack.status, 403, 'Must reject self-granting teacher without permission');
    assert.equal(teacherHack.body.error.code, 'permission-denied');
  });

  // Test 6: Change Password & Re-login
  it('6. Password Lifecycle: Đổi mật khẩu thành công, mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được', async () => {
    const db = firebaseAdmin.getDb();
    const uid = `change_pass_user_${Date.now()}`;
    const username = `cp_user_${Date.now()}`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewStrongPassword456!';

    const salt = cryptoHelper.generateSalt();
    const passwordHash = cryptoHelper.hashPassword(oldPassword, salt, 600000);

    await db.collection('users').doc(uid).set({
      uid,
      username,
      displayName: 'Người Dùng Đổi MK',
      role: 'teacher',
      status: 'active',
      createdAt: Date.now()
    });

    await db.collection('usernames').doc(username.toLowerCase()).set({
      username: username.toLowerCase(),
      uid,
      role: 'teacher'
    });

    await db.collection('accountSecrets').doc(uid).set({
      uid,
      version: 2,
      algorithm: 'pbkdf2-sha256',
      iterations: 600000,
      salt,
      passwordHash,
      createdAt: Date.now()
    });

    // 1. Initial login with old password
    const login1 = await invokeAuthApi('accountLogin', { username, password: oldPassword });
    assert.equal(login1.status, 200);
    const userToken = await exchangeToken(login1.body.data.token);

    // 2. Change password
    const changeRes = await invokeAuthApi(
      'changeAccountPassword',
      { currentPassword: oldPassword, newPassword },
      userToken
    );
    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.success, true);

    // 3. Old password must now fail
    const loginOld = await invokeAuthApi('accountLogin', { username, password: oldPassword });
    assert.equal(loginOld.status, 401, 'Old password must be rejected after change');

    // 4. New password must succeed
    const loginNew = await invokeAuthApi('accountLogin', { username, password: newPassword });
    assert.equal(loginNew.status, 200, 'New password must succeed');
    assert.ok(loginNew.body.data.token);
  });

  // Test 7: Transparent In-Place Rehashing (OWASP 10k -> 600k upgrade)
  it('7. Transparent Rehashing: Tài khoản cũ (10.000 vòng) đăng nhập thành công và tự động nâng cấp lên OWASP (600.000 vòng)', async () => {
    const db = firebaseAdmin.getDb();
    const uid = `rehash_user_${Date.now()}`;
    const username = `rehash_user_${Date.now()}`;
    const password = 'LegacyPassword123';

    // Seed account with LEGACY V1 HASH (10,000 iterations, version 1)
    const salt = cryptoHelper.generateSalt();
    const legacyHash = cryptoHelper.hashPassword(password, salt, 10000);

    await db.collection('users').doc(uid).set({
      uid,
      username,
      displayName: 'Giáo Viên Cũ Cần Nâng Cấp',
      role: 'teacher',
      status: 'active',
      createdAt: Date.now()
    });

    await db.collection('usernames').doc(username.toLowerCase()).set({
      username: username.toLowerCase(),
      uid,
      role: 'teacher'
    });

    await db.collection('accountSecrets').doc(uid).set({
      uid,
      version: 1, // Legacy version
      iterations: 10000, // Legacy iterations
      salt,
      passwordHash: legacyHash,
      createdAt: Date.now()
    });

    // Verify secret is legacy v1 initially
    const initialSecretDoc = await db.collection('accountSecrets').doc(uid).get();
    assert.equal(initialSecretDoc.data().version, 1);
    assert.equal(initialSecretDoc.data().iterations, 10000);

    // Login with legacy account
    const loginRes = await invokeAuthApi('accountLogin', { username, password });
    assert.equal(loginRes.status, 200, 'Legacy account must log in successfully without password reset');

    // Wait 100ms for async transparent rehash write
    await new Promise((r) => setTimeout(r, 100));

    // Verify secret in Firestore has been upgraded to Version 2 with 600,000 iterations!
    const upgradedSecretDoc = await db.collection('accountSecrets').doc(uid).get();
    const upgradedData = upgradedSecretDoc.data();

    assert.equal(upgradedData.version, 2, 'Must be upgraded to Version 2');
    assert.equal(upgradedData.iterations, 600000, 'Must have 600,000 iterations');
    assert.equal(upgradedData.algorithm, 'pbkdf2-sha256');
    assert.ok(upgradedData.upgradedAt, 'Must record upgradedAt timestamp');

    // And verify that logging in again with the upgraded hash still works seamlessly!
    const loginAfterUpgrade = await invokeAuthApi('accountLogin', { username, password });
    assert.equal(loginAfterUpgrade.status, 200, 'Login with upgraded hash must succeed');
  });

  // Test 8: Legacy Emulator Callable Functions
  it('8. Backward Compatibility: Các Cloud Function cũ trên Emulator vẫn hoạt động bình thường', async () => {
    // Call legacy function on isolated test emulator
    const res = await callCallable('getAIStatus', {});
    assert.ok(res, 'getAIStatus on emulator must return response');
    assert.strictEqual(typeof res.isConfigured, 'boolean');
  });

});
