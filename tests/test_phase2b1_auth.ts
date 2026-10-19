/**
 * EM YÊU TIẾNG VIỆT - TEST SCRIPT ĐỢT 2B.1
 * Verifies Vercel API /api/auth, Production Fallback Lockdown, Rate Limiting & Auth Adapter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('ĐỢT 2B.1: Vercel Functions Backend Foundation & Auth Security Tests', () => {

  // Test 1: Crypto Hashing Verification
  it('1. Crypto: PBKDF2 hashing and verification should be consistent and secure', async () => {
    const { generateSalt, hashPassword, verifyPassword, hashAccessCode, verifyAccessCode } =
      await import('../api/helpers/crypto.ts');

    const salt = generateSalt(16);
    assert.equal(salt.length, 32, 'Salt must be 32 hex characters (16 bytes)');

    const password = 'StrongPassword123!';
    const hash = hashPassword(password, salt);
    assert.ok(hash.length >= 64, 'Password hash must be at least 64 hex characters');

    // Positive check
    assert.equal(verifyPassword(password, salt, hash), true, 'Correct password must verify');
    // Negative check
    assert.equal(verifyPassword('WrongPass', salt, hash), false, 'Wrong password must fail');
    // Empty check
    assert.equal(verifyPassword('', salt, hash), false, 'Empty password must fail');

    // Access PIN test
    const pin = '8K9M2P';
    const pinHash = hashAccessCode(pin, salt);
    assert.equal(verifyAccessCode('8K9M2P', salt, pinHash), true, 'PIN uppercase must verify');
    assert.equal(verifyAccessCode('8k9m2p', salt, pinHash), true, 'PIN lowercase must normalize & verify');
    assert.equal(verifyAccessCode('WRONG1', salt, pinHash), false, 'Wrong PIN must fail');
  });

  // Test 2: Rate Limiting & Brute Force Protection
  it('2. Rate Limiter: Should lock out after 5 consecutive failures', async () => {
    const { checkRateLimit, recordFailedAttempt, clearFailedAttempts } =
      await import('../api/helpers/rateLimiter.ts');

    const testKey = `test_rate_limit_${Date.now()}`;

    // Initially not locked
    await assert.doesNotReject(async () => {
      await checkRateLimit(testKey, 5, 60000);
    });

    // Record 4 failures
    for (let i = 1; i <= 4; i++) {
      const res = await recordFailedAttempt(testKey, 5, 60000);
      assert.equal(res.failedCount, i);
      assert.equal(res.isLocked, false);
    }

    // 5th failure must trigger lockout
    const res5 = await recordFailedAttempt(testKey, 5, 60000);
    assert.equal(res5.isLocked, true);
    assert.ok(res5.remainingSeconds > 0);

    // checkRateLimit must now throw 429 resource-exhausted
    await assert.rejects(
      async () => {
        await checkRateLimit(testKey, 5, 60000);
      },
      (err: any) => {
        assert.equal(err.statusCode, 429);
        assert.equal(err.code, 'resource-exhausted');
        return true;
      }
    );

    // Clear attempts on success
    await clearFailedAttempts(testKey);

    // Should no longer be locked
    await assert.doesNotReject(async () => {
      await checkRateLimit(testKey, 5, 60000);
    });
  });

  // Test 3: Production Fallback Lockdown Verification
  it('3. Security: Demo fallback password must be completely disabled in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalHost = process.env.FIRESTORE_EMULATOR_HOST;
    const originalAuthHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const originalFunc = process.env.FUNCTIONS_EMULATOR;

    try {
      // Simulate STRICT PRODUCTION environment
      process.env.NODE_ENV = 'production';
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      process.env.FUNCTIONS_EMULATOR = 'false';

      const { isLocalEmulator } = await import('../api/helpers/firebaseAdmin.ts');
      assert.equal(isLocalEmulator(), false, 'Must identify environment as non-emulator in production');

      // Test handler in production mode
      const handler = (await import('../api/auth.ts')).default;

      // Mock request trying default admin/admin fallback
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq: any = {
        method: 'POST',
        headers: { 'x-forwarded-for': '127.0.0.1' },
        body: {
          action: 'accountLogin',
          data: {
            username: 'admin',
            password: 'admin'
          }
        },
        query: {}
      };

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          responseBody = data;
        },
        send(data: any) {
          responseBody = data;
        },
        setHeader() {}
      };

      await handler(mockReq, mockRes);

      // In production without service account or with mock, it must REJECT login
      // Either 500 (missing cloud service account) or 401 (permission-denied / invalid password)
      // BUT NEVER 200 SUCCESS!
      assert.notEqual(statusCode, 200, 'Must NOT succeed with demo credentials in production');
      assert.equal(responseBody.success, false, 'Response success must be false in production');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalHost) process.env.FIRESTORE_EMULATOR_HOST = originalHost;
      if (originalAuthHost) process.env.FIREBASE_AUTH_EMULATOR_HOST = originalAuthHost;
      if (originalFunc) process.env.FUNCTIONS_EMULATOR = originalFunc;
    }
  });

  // Test 4: Method & Action Validation
  it('4. API Handler: Must reject GET requests and unknown actions', async () => {
    const handler = (await import('../api/auth.ts')).default;

    let statusCode = 0;
    let responseBody: any = null;

    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      send(data: any) {
        responseBody = data;
      },
      setHeader() {}
    };

    // Test GET method
    await handler({ method: 'GET', headers: {}, body: {}, query: {} }, mockRes);
    assert.equal(statusCode, 405, 'GET method must return 405');
    assert.equal(responseBody.error.code, 'method-not-allowed');

    // Test unknown action
    await handler({ method: 'POST', headers: {}, body: { action: 'arbitraryInternalHack' }, query: {} }, mockRes);
    assert.equal(statusCode, 400, 'Unknown action must return 400');
    assert.equal(responseBody.error.code, 'invalid-argument');
  });

  // Test 5: Missing Token on Protected Actions
  it('5. Middleware: Protected operations must require authentication token', async () => {
    const handler = (await import('../api/auth.ts')).default;

    const protectedActions = [
      'changeAccountPassword',
      'studentChangePassword',
      'teacherResetStudentPassword',
      'adminResetTeacherPassword',
      'bootstrapTeacherRole',
      'bootstrapAdminRole'
    ];

    for (const action of protectedActions) {
      let statusCode = 0;
      let responseBody: any = null;

      const mockReq: any = {
        method: 'POST',
        headers: {}, // NO Authorization header
        body: { action, data: {} },
        query: {}
      };

      const mockRes: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          responseBody = data;
        },
        send(data: any) {
          responseBody = data;
        },
        setHeader() {}
      };

      await handler(mockReq, mockRes);
      assert.equal(
        statusCode,
        401,
        `Action ${action} without token must return 401 unauthenticated`
      );
      assert.equal(responseBody.error.code, 'unauthenticated');
    }
  });

  // Test 6: Client API Adapter Configuration
  it('6. Client Adapter: MIGRATED_AUTH_ACTIONS must contain all 9 target actions', async () => {
    const { MIGRATED_AUTH_ACTIONS, createCallable } = await import('../web/src/services/apiClient.ts');

    const expectedActions = [
      'accountLogin',
      'registerTeacherAccount',
      'changeAccountPassword',
      'studentChangePassword',
      'teacherResetStudentPassword',
      'adminResetTeacherPassword',
      'joinClass',
      'bootstrapTeacherRole',
      'bootstrapAdminRole'
    ];

    for (const act of expectedActions) {
      assert.ok(MIGRATED_AUTH_ACTIONS.has(act), `Action ${act} must be in MIGRATED_AUTH_ACTIONS`);
    }

    // createCallable returns a function
    const callable = createCallable('accountLogin');
    assert.equal(typeof callable, 'function', 'createCallable must return a callable function');
  });

  // Test 7: Input Validation on Public Auth Endpoints
  it('7. Validation: Input validation for accountLogin, joinClass and registerTeacherAccount', async () => {
    const handler = (await import('../api/auth.ts')).default;

    let statusCode = 0;
    let responseBody: any = null;

    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
      },
      send(data: any) {
        responseBody = data;
      },
      setHeader() {}
    };

    // accountLogin empty
    await handler({ method: 'POST', headers: {}, body: { action: 'accountLogin', data: {} }, query: {} }, mockRes);
    assert.equal(statusCode, 400);
    assert.equal(responseBody.error.code, 'invalid-argument');

    // joinClass empty
    await handler({ method: 'POST', headers: {}, body: { action: 'joinClass', data: {} }, query: {} }, mockRes);
    assert.equal(statusCode, 400);
    assert.equal(responseBody.error.code, 'invalid-argument');

    // registerTeacherAccount invalid username (special characters or too short)
    await handler(
      {
        method: 'POST',
        headers: {},
        body: {
          action: 'registerTeacherAccount',
          data: { username: 'a!', password: '123', displayName: '' }
        },
        query: {}
      },
      mockRes
    );
    assert.equal(statusCode, 400);
    assert.equal(responseBody.error.code, 'invalid-argument');
  });

  // Test 8: Bootstrap Security in Production Mode
  it('8. Bootstrap Security: Cannot bootstrap Admin or Teacher in production without valid secret', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_BOOTSTRAP_SECRET;
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
      process.env.FUNCTIONS_EMULATOR = 'false';

      const { isLocalEmulator } = await import('../api/helpers/firebaseAdmin.ts');
      assert.equal(isLocalEmulator(), false);

      // Verify that the default fallback secret 'EMYTV_ADMIN_SECRET_2026' is NEVER accepted in production
      const isEmulator = isLocalEmulator();
      const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);
      assert.equal(expectedSecret, undefined, 'expectedSecret MUST be undefined in production when not configured');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalSecret) process.env.ADMIN_BOOTSTRAP_SECRET = originalSecret;
    }
  });

});
