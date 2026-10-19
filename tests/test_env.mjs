/**
 * CENTRAL ISOLATED TEST ENVIRONMENT CONFIGURATION & SECURITY GUARD
 * Ensures ALL test files execute against the dedicated test emulator instance
 * and strictly blocks any write operations to demo, staging, or production.
 */

export const PROTECTED_PROJECT_IDS = Object.freeze([
  'em-yeu-tieng-viet-demo',
  'em-yeu-tieng-viet',
  'em-yeu-tieng-viet-staging',
  'em-yeu-tieng-viet-prod',
  'em-yeu-tieng-viet-production'
]);

export const PROTECTED_PORTS = Object.freeze([8080, 9099, 5001]);

export const TEST_PROJECT_ID = process.env.TEST_FIREBASE_PROJECT_ID || 'em-yeu-tieng-viet-test';
export const TEST_AUTH_PORT = Number(process.env.TEST_AUTH_PORT || 9199);
export const TEST_FIRESTORE_PORT = Number(process.env.TEST_FIRESTORE_PORT || 8180);
export const TEST_FUNCTIONS_PORT = Number(process.env.TEST_FUNCTIONS_PORT || 5101);

export const FUNCTIONS_URL = `http://127.0.0.1:${TEST_FUNCTIONS_PORT}/${TEST_PROJECT_ID}/us-central1`;
export const AUTH_EMULATOR_URL = `http://127.0.0.1:${TEST_AUTH_PORT}/identitytoolkit.googleapis.com/v1/accounts`;
export const FIRESTORE_EMULATOR_URL = `http://127.0.0.1:${TEST_FIRESTORE_PORT}/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;

/**
 * Enforces strict environment isolation before running any write tests.
 * Throws a fatal Error if any test tries to target demo or protected ports/projects.
 */
export function assertIsolatedTestEnvironment(overrideConfig = {}) {
  const targetProject = overrideConfig.projectId || TEST_PROJECT_ID;
  const authPort = Number(overrideConfig.authPort || TEST_AUTH_PORT);
  const firestorePort = Number(overrideConfig.firestorePort || TEST_FIRESTORE_PORT);
  const functionsPort = Number(overrideConfig.functionsPort || TEST_FUNCTIONS_PORT);

  if (!targetProject || PROTECTED_PROJECT_IDS.includes(targetProject.toLowerCase())) {
    throw new Error(
      `[CRITICAL SECURITY BLOCK]: Test execution REFUSED! Attempted to run tests against protected project "${targetProject}". ` +
      `Automated tests must run ONLY against an isolated test project (e.g. "em-yeu-tieng-viet-test").`
    );
  }

  if (PROTECTED_PORTS.includes(firestorePort) || PROTECTED_PORTS.includes(authPort) || PROTECTED_PORTS.includes(functionsPort)) {
    throw new Error(
      `[CRITICAL SECURITY BLOCK]: Test execution REFUSED! Ports [${authPort}, ${firestorePort}, ${functionsPort}] include protected Demo emulator ports (9099, 8080, 5001). ` +
      `Automated tests must run ONLY on isolated test emulator ports (9199, 8180, 5101).`
    );
  }

  return true;
}

// Automatically assert isolation upon import
assertIsolatedTestEnvironment();

/**
 * Creates an ephemeral user in the isolated test Auth emulator
 */
export async function createUser(rolePrefix) {
  assertIsolatedTestEnvironment();
  const email = `${rolePrefix}.${Date.now()}.${Math.random().toString(36).substring(7)}@tieuhoc.edu.vn`;
  const res = await fetch(`${AUTH_EMULATOR_URL}:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Matkhau123!@#', returnSecureToken: true })
  });
  const data = await res.json();
  return { token: data.idToken, uid: data.localId, email };
}

/**
 * Exchanges a custom token in the isolated test Auth emulator
 */
export async function exchangeCustomToken(customToken) {
  assertIsolatedTestEnvironment();
  const res = await fetch(`${AUTH_EMULATOR_URL}:signInWithCustomToken?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });
  const data = await res.json();
  return data.idToken;
}

/**
 * Calls a Cloud Function on the isolated test Functions emulator
 */
export async function callCallable(name, payload, token) {
  assertIsolatedTestEnvironment();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: payload })
  });

  const resJson = await res.json();
  if (resJson.error) {
    const err = new Error(resJson.error.message || JSON.stringify(resJson.error));
    err.status = resJson.error.status;
    throw err;
  }
  return resJson.result;
}

/**
 * Resets the isolated test Firestore database (safe: only purges the isolated test project)
 */
export async function clearTestFirestore() {
  assertIsolatedTestEnvironment();
  try {
    await fetch(`http://127.0.0.1:${TEST_FIRESTORE_PORT}/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('[Isolated Test Helper] Failed to clear test firestore:', err.message);
  }
}
