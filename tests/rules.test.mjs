import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';

import { TEST_PROJECT_ID, TEST_FIRESTORE_PORT, assertIsolatedTestEnvironment } from './test_env.mjs';

assertIsolatedTestEnvironment();

const PROJECT_ID = TEST_PROJECT_ID;
const RULES_PATH = path.resolve('./firestore.rules');

describe('EM YÊU TIẾNG VIỆT - FIRESTORE SECURITY RULES TESTS', () => {
  let testEnv;

  before(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: 'localhost',
        port: TEST_FIRESTORE_PORT
      }
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  test('1. Deny-by-default: unauthenticated access to arbitrary collection should fail', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthedDb.collection('arbitrary_data').get());
    await assertFails(unauthedDb.collection('arbitrary_data').add({ key: 'val' }));
  });

  test('2. PrivateAnswerKeys: MUST DENY ALL CLIENT READS AND WRITES', async () => {
    const teacherDb = testEnv.authenticatedContext('teacher_1', { role: 'teacher' }).firestore();
    const studentDb = testEnv.authenticatedContext('student_1', { role: 'student' }).firestore();
    const unauthedDb = testEnv.unauthenticatedContext().firestore();

    // Teacher cannot read or write privateAnswerKeys directly via client SDK
    await assertFails(teacherDb.collection('privateAnswerKeys').doc('v1').get());
    await assertFails(teacherDb.collection('privateAnswerKeys').doc('v1').set({ key: 'leak' }));

    // Student cannot read privateAnswerKeys
    await assertFails(studentDb.collection('privateAnswerKeys').doc('v1').get());

    // Unauthenticated cannot read
    await assertFails(unauthedDb.collection('privateAnswerKeys').doc('v1').get());
  });

  test('3. StudentSecrets: MUST DENY ALL CLIENT READS AND WRITES', async () => {
    const teacherDb = testEnv.authenticatedContext('teacher_1', { role: 'teacher' }).firestore();
    const studentDb = testEnv.authenticatedContext('student_1').firestore();

    await assertFails(teacherDb.collection('studentSecrets').doc('s1').get());
    await assertFails(teacherDb.collection('studentSecrets').doc('s1').set({ hash: 'secret' }));
    await assertFails(studentDb.collection('studentSecrets').doc('s1').get());
  });

  test('4. StudentSessions: MUST DENY ALL CLIENT READS AND WRITES', async () => {
    const studentDb = testEnv.authenticatedContext('student_auth_uid').firestore();
    await assertFails(studentDb.collection('studentSessions').doc('student_auth_uid').get());
    await assertFails(studentDb.collection('studentSessions').doc('student_auth_uid').set({ valid: true }));
  });

  test('5. Users collection: user cannot grant themselves teacher role', async () => {
    const userDb = testEnv.authenticatedContext('user_hacker').firestore();
    // Cannot self-create as teacher
    await assertFails(
      userDb.collection('users').doc('user_hacker').set({
        uid: 'user_hacker',
        role: 'teacher'
      })
    );
  });

  test('6. Attempts collection: client writes MUST BE BLOCKED (scoring on server only)', async () => {
    const studentDb = testEnv.authenticatedContext('student_1', { studentId: 'st_123' }).firestore();
    // Student cannot forge an attempt with fake scores
    await assertFails(
      studentDb.collection('attempts').doc('fake_attempt').set({
        studentId: 'st_123',
        scorePercentage: 100,
        starsEarned: 3
      })
    );
  });

  test('7. Users collection: user cannot self-grant admin role', async () => {
    const userDb = testEnv.authenticatedContext('user_exploit').firestore();
    await assertFails(
      userDb.collection('users').doc('user_exploit').set({
        displayName: 'Attacker',
        role: 'admin'
      })
    );
  });

  test('8. Admin client CANNOT read privateAnswerKeys or studentSecrets (Deny All Client SDKs)', async () => {
    const adminDb = testEnv.authenticatedContext('admin_uid', { role: 'admin' }).firestore();
    await assertFails(
      adminDb.collection('privateAnswerKeys').doc('version_123').get()
    );
    await assertFails(
      adminDb.collection('studentSecrets').doc('secret_123').get()
    );
  });

  test('9. CurriculumNodes: regular user cannot write, admin can write, all auth can read', async () => {
    const teacherDb = testEnv.authenticatedContext('teacher_uid', { role: 'teacher' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin_uid', { role: 'admin' }).firestore();

    // Teacher cannot write curriculum node
    await assertFails(
      teacherDb.collection('curriculumNodes').doc('node_test').set({
        lessonTitle: 'Bài kiểm tra',
        grade: 2
      })
    );

    // Admin can write curriculum node
    await assertSucceeds(
      adminDb.collection('curriculumNodes').doc('node_test').set({
        lessonTitle: 'Bài kiểm tra',
        grade: 2
      })
    );

    // Teacher can read curriculum node
    await assertSucceeds(
      teacherDb.collection('curriculumNodes').doc('node_test').get()
    );

    // Clean up test document
    await adminDb.collection('curriculumNodes').doc('node_test').delete();
  });
});
