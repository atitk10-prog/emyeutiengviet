import fs from 'fs';
import path from 'path';
import assert from 'assert';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';
import { checkAnswerCorrectness, cleanOptionText } from '../api/_helpers/answerEvaluator';

async function runE2ETest() {
  console.log('===============================================================');
  console.log(' E2E INTEGRATION TEST: PREVIEW SIMULATION & SCORING PIPELINE');
  console.log('===============================================================\n');

  const db = getDb();

  // 1. Audit Lesson "Cây bàng non và gió xuân-2" (Kzpw4eVXHPLMfsYQY7m2)
  console.log('1. Loading lesson "Cây bàng non và gió xuân-2" (Kzpw4eVXHPLMfsYQY7m2)...');
  const lDoc = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').get();
  assert(lDoc.exists, 'Lesson doc must exist');
  const lData = lDoc.data()!;

  // 2. Simulate Teacher Opening Preview from Draft / Library
  console.log('2. Simulating Teacher Preview initialization...');
  const questions = (lData.draftData?.questions || []).map((q: any) => {
    const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
    return {
      ...q,
      correctAnswer: ans,
      answer: ans,
      hint: q.hint || '',
      explanation: q.explanation || ''
    };
  });

  assert.strictEqual(questions.length, 5, 'Must have 5 questions');

  // 3. Test Question 1 (The exact reported bug)
  console.log('3. Testing Question 1: "Vật gì nằm dưới gốc cây bàng làm cành lá buồn bã?"');
  const q1 = questions[0];
  assert.strictEqual(q1.prompt, 'Vật gì nằm dưới gốc cây bàng làm cành lá buồn bã?');
  const targetCorrectQ1 = q1.correctAnswer !== undefined ? q1.correctAnswer : q1.answer;
  assert.strictEqual(targetCorrectQ1, 'B', 'Correct answer must be B');

  // Option B
  const isB = checkAnswerCorrectness('B', targetCorrectQ1, {
    type: 'multiple_choice',
    options: q1.options
  });
  console.log(`   - Selecting B: isCorrect = ${isB}`);
  assert.strictEqual(isB, true, 'Selecting B MUST be TRUE');

  // Option A
  const isA = checkAnswerCorrectness('A', targetCorrectQ1, {
    type: 'multiple_choice',
    options: q1.options
  });
  console.log(`   - Selecting A: isCorrect = ${isA}`);
  assert.strictEqual(isA, false, 'Selecting A MUST be FALSE');

  // Option C
  const isC = checkAnswerCorrectness('C', targetCorrectQ1, {
    type: 'multiple_choice',
    options: q1.options
  });
  console.log(`   - Selecting C: isCorrect = ${isC}`);
  assert.strictEqual(isC, false, 'Selecting C MUST be FALSE');

  // Cleaned options
  const cleanOpts = q1.options.map(cleanOptionText);
  console.log('   - Cleaned Options:', cleanOpts);
  assert.strictEqual(cleanOpts[1], 'Một vỏ chai nhựa', 'Cleaned option B must be "Một vỏ chai nhựa"');

  // 4. Test Question 2 (MCQ)
  console.log('\n4. Testing Question 2: "Bạn Na đã làm gì khi nghe gió nhắc nhở?"');
  const q2 = questions[1];
  const targetCorrectQ2 = q2.correctAnswer !== undefined ? q2.correctAnswer : q2.answer;
  assert.strictEqual(targetCorrectQ2, 'A', 'Correct answer must be A');
  assert.strictEqual(
    checkAnswerCorrectness('A', targetCorrectQ2, { type: 'multiple_choice', options: q2.options }),
    true
  );
  assert.strictEqual(
    checkAnswerCorrectness('B', targetCorrectQ2, { type: 'multiple_choice', options: q2.options }),
    false
  );
  console.log('   - Q2 evaluation: PASSED (A is correct, B is wrong)');

  // 5. Test Question 3 & 4 (True/False)
  console.log('\n5. Testing True/False Questions 3 & 4...');
  const q3 = questions[2];
  const targetCorrectQ3 = q3.correctAnswer !== undefined ? q3.correctAnswer : q3.answer;
  assert.strictEqual(checkAnswerCorrectness(true, targetCorrectQ3, { type: 'true_false' }), true);
  assert.strictEqual(checkAnswerCorrectness(false, targetCorrectQ3, { type: 'true_false' }), false);
  console.log('   - Q3 evaluation: PASSED (true is correct, false is wrong)');

  const q4 = questions[3];
  const targetCorrectQ4 = q4.correctAnswer !== undefined ? q4.correctAnswer : q4.answer;
  assert.strictEqual(checkAnswerCorrectness(false, targetCorrectQ4, { type: 'true_false' }), true);
  assert.strictEqual(checkAnswerCorrectness(true, targetCorrectQ4, { type: 'true_false' }), false);
  console.log('   - Q4 evaluation: PASSED (false is correct, true is wrong)');

  // 6. Test Question 5 (Sequence)
  console.log('\n6. Testing Question 5 (Sequence)...');
  const q5 = questions[4];
  const targetCorrectQ5 = q5.correctAnswer !== undefined ? q5.correctAnswer : q5.answer;
  assert(Array.isArray(targetCorrectQ5), 'Sequence target answer must be array');
  assert.strictEqual(
    checkAnswerCorrectness(targetCorrectQ5, targetCorrectQ5, { type: 'sequence' }),
    true
  );
  console.log('   - Q5 evaluation: PASSED');

  // 7. Verify All Published Lessons in DB Have Working Answer Keys
  console.log('\n7. Verifying all published lessons in Firestore have valid privateAnswerKeys...');
  const publishedSnap = await db.collection('lessons').where('status', '==', 'published').get();
  console.log(`   Found ${publishedSnap.size} published lessons.`);
  for (const doc of publishedSnap.docs) {
    const l = doc.data();
    if (l.currentVersionId) {
      const keyDoc = await db.collection('privateAnswerKeys').doc(l.currentVersionId).get();
      assert(keyDoc.exists, `PrivateAnswerKey for version ${l.currentVersionId} of lesson ${doc.id} must exist`);
      const answers = keyDoc.data()?.answers;
      assert(answers && Object.keys(answers).length >= 5, `Must have >= 5 question answers in key`);
    }
  }
  console.log('   - All published lessons have valid, protected privateAnswerKeys!');

  console.log('\n===============================================================');
  console.log(' ALL E2E PREVIEW & SCORING PIPELINE CHECKS PASSED 100%!');
  console.log('===============================================================\n');
}

runE2ETest().catch((err) => {
  console.error('Fatal E2E test failure:', err);
  process.exit(1);
});
