import assert from 'assert';
import { 
  assertIsolatedTestEnvironment, 
  PROTECTED_PROJECT_IDS, 
  PROTECTED_PORTS, 
  TEST_PROJECT_ID,
  TEST_FIRESTORE_PORT,
  TEST_AUTH_PORT,
  TEST_FUNCTIONS_PORT 
} from '../tests/test_env.mjs';

console.log("=== TESTING ISOLATION SECURITY GUARD ===");

// 1. Current default config must pass
assert.doesNotThrow(() => {
  assertIsolatedTestEnvironment();
}, "Default test environment must pass guard");
console.log(`[PASS] Default isolated config passed (${TEST_PROJECT_ID}, ports: ${TEST_AUTH_PORT}, ${TEST_FIRESTORE_PORT}, ${TEST_FUNCTIONS_PORT})`);

// 2. Passing demo project ID must be blocked immediately
for (const p of PROTECTED_PROJECT_IDS) {
  assert.throws(() => {
    assertIsolatedTestEnvironment({ projectId: p });
  }, /CRITICAL SECURITY BLOCK/, `Project "${p}" must be blocked`);
  console.log(`[PASS] Protected project "${p}" was successfully BLOCKED.`);
}

// 3. Passing demo ports must be blocked immediately
for (const port of PROTECTED_PORTS) {
  assert.throws(() => {
    assertIsolatedTestEnvironment({ firestorePort: port });
  }, /CRITICAL SECURITY BLOCK/, `Port ${port} must be blocked`);
  console.log(`[PASS] Demo port ${port} was successfully BLOCKED.`);
}

console.log("\nALL ISOLATION SECURITY GUARD CHECKS PASSED 100%!");
