import fs from 'fs';
import path from 'path';
import assert from 'assert';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';
import {
  checkAnswerCorrectness,
  cleanOptionText,
  normalizeMcqAnswerToIndex,
  normalizeBooleanAnswer,
  normalizeSequence,
  isHintLeakingAnswer,
  sanitizeQuestionData
} from '../api/_helpers/answerEvaluator';

async function runTestSuite() {
  console.log('===============================================================');
  console.log(' P0 TEST SUITE: ANSWER SCORING, PREVIEW & PERSISTENCE AUDIT');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: REGRESSION TEST FOR "CÂY BÀNG NON VÀ GIÓ XUÂN-2"
  // -------------------------------------------------------------
  console.log('--- GROUP 1: Regression Test for "Cây bàng non và gió xuân-2" ---');

  const db = getDb();
  const bangDoc = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').get();
  assert(bangDoc.exists, 'Document Kzpw4eVXHPLMfsYQY7m2 must exist in staging DB');
  const bangData = bangDoc.data()!;
  const draftQ1 = bangData.draftData?.questions?.[0];
  assert(draftQ1, 'Draft Q1 must exist');

  test('Bang Lesson Q1: selecting "B" returns TRUE (fixed bug)', () => {
    const targetCorrect = draftQ1.correctAnswer !== undefined ? draftQ1.correctAnswer : draftQ1.answer;
    assert.strictEqual(targetCorrect, 'B', 'Target correct answer in draftData must be B');
    
    // User clicks option B ('B')
    const resultB = checkAnswerCorrectness('B', targetCorrect, {
      type: 'multiple_choice',
      options: draftQ1.options
    });
    assert.strictEqual(resultB, true, 'Selecting B must be evaluated as TRUE (Đúng)');
  });

  test('Bang Lesson Q1: selecting "A" or "C" returns FALSE', () => {
    const targetCorrect = draftQ1.correctAnswer !== undefined ? draftQ1.correctAnswer : draftQ1.answer;
    const resultA = checkAnswerCorrectness('A', targetCorrect, {
      type: 'multiple_choice',
      options: draftQ1.options
    });
    const resultC = checkAnswerCorrectness('C', targetCorrect, {
      type: 'multiple_choice',
      options: draftQ1.options
    });
    assert.strictEqual(resultA, false, 'Selecting A must be FALSE (Chưa đúng)');
    assert.strictEqual(resultC, false, 'Selecting C must be FALSE (Chưa đúng)');
  });

  test('Bang Lesson Q1: selecting option text "Một vỏ chai nhựa" returns TRUE', () => {
    const targetCorrect = draftQ1.correctAnswer !== undefined ? draftQ1.correctAnswer : draftQ1.answer;
    const resultText = checkAnswerCorrectness('Một vỏ chai nhựa', targetCorrect, {
      type: 'multiple_choice',
      options: draftQ1.options
    });
    assert.strictEqual(resultText, true, 'Selecting option text must evaluate to TRUE');
  });

  test('Bang Lesson Q1: option display text is cleaned (no duplicate "A. ")', () => {
    const cleaned = draftQ1.options.map(cleanOptionText);
    assert.deepStrictEqual(cleaned, [
      'Một chiếc lá khô',
      'Một vỏ chai nhựa',
      'Một viên sỏi nhỏ'
    ]);
  });

  test('Bang Lesson Q1: Pedagogical hint guides to reading without leaking answer', () => {
    const hint = draftQ1.hint;
    const leaks = isHintLeakingAnswer(hint, draftQ1.answer, draftQ1.options);
    assert.strictEqual(leaks, false, 'Hint must not leak the answer verbatim');
  });

  // -------------------------------------------------------------
  // TEST GROUP 2: THREE QUESTION TYPES COMPREHENSIVE AUDIT
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: Three Question Types Canonical Grading ---');

  // A. Multiple Choice A/B/C
  test('MCQ: Letter A matches A (case-insensitive and trimmed)', () => {
    assert.strictEqual(checkAnswerCorrectness('a ', ' A', { type: 'multiple_choice' }), true);
    assert.strictEqual(checkAnswerCorrectness('B', 'B', { type: 'multiple_choice' }), true);
    assert.strictEqual(checkAnswerCorrectness('C', 'C', { type: 'multiple_choice' }), true);
  });

  test('MCQ: Index matching (0 -> A, 1 -> B, 2 -> C)', () => {
    const options = ['Con mèo', 'Con chó', 'Con chim'];
    assert.strictEqual(checkAnswerCorrectness(0, 'A', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('B', 1, { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('2', 'C', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness(1, 'A', { type: 'multiple_choice', options }), false);
  });

  test('MCQ: Full option text vs letter matching', () => {
    const options = ['Con mèo', 'Con chó', 'Con chim'];
    assert.strictEqual(checkAnswerCorrectness('Con chó', 'B', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('A', 'Con mèo', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('Con chim', 'A', { type: 'multiple_choice', options }), false);
  });

  test('MCQ: Prefixed options ("A. Con mèo") match correctly', () => {
    const options = ['A. Con mèo', 'B. Con chó', 'C. Con chim'];
    assert.strictEqual(checkAnswerCorrectness('B', 'B', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('Con chó', 'B', { type: 'multiple_choice', options }), true);
    assert.strictEqual(checkAnswerCorrectness('B. Con chó', 'B', { type: 'multiple_choice', options }), true);
  });

  // B. True / False
  test('True/False: Boolean true/false matching', () => {
    assert.strictEqual(checkAnswerCorrectness(true, true, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness(false, false, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness(true, false, { type: 'true_false' }), false);
    assert.strictEqual(checkAnswerCorrectness(false, true, { type: 'true_false' }), false);
  });

  test('True/False: String "true" / "false" does not suffer Boolean("false") === true bug', () => {
    // Crucial bug test: in vanilla JS, Boolean("false") is true!
    assert.strictEqual(normalizeBooleanAnswer('false'), false, 'normalizeBooleanAnswer("false") must be false');
    assert.strictEqual(normalizeBooleanAnswer('true'), true, 'normalizeBooleanAnswer("true") must be true');
    assert.strictEqual(checkAnswerCorrectness('false', false, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('false', true, { type: 'true_false' }), false);
    assert.strictEqual(checkAnswerCorrectness('true', true, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('true', false, { type: 'true_false' }), false);
  });

  test('True/False: Vietnamese words "Đúng" / "Sai"', () => {
    assert.strictEqual(checkAnswerCorrectness('Đúng', true, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('Sai', false, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('dung', true, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('sai', false, { type: 'true_false' }), true);
    assert.strictEqual(checkAnswerCorrectness('Sai', true, { type: 'true_false' }), false);
  });

  // C. Sequence
  test('Sequence: Array of strings exact order match', () => {
    const student = ['Gieo hạt', 'Nảy mầm', 'Ra hoa'];
    const correct = ['Gieo hạt', 'Nảy mầm', 'Ra hoa'];
    const wrong = ['Ra hoa', 'Gieo hạt', 'Nảy mầm'];
    assert.strictEqual(checkAnswerCorrectness(student, correct, { type: 'sequence' }), true);
    assert.strictEqual(checkAnswerCorrectness(wrong, correct, { type: 'sequence' }), false);
  });

  test('Sequence: Array of indices [1, 2, 0] vs strings', () => {
    const items = ['Ra hoa', 'Gieo hạt', 'Nảy mầm'];
    // [1, 2, 0] means items[1] ('Gieo hạt'), items[2] ('Nảy mầm'), items[0] ('Ra hoa')
    const student = ['Gieo hạt', 'Nảy mầm', 'Ra hoa'];
    assert.strictEqual(
      checkAnswerCorrectness(student, [1, 2, 0], { type: 'sequence', items }),
      true,
      'Student strings must match index array [1, 2, 0]'
    );
    const wrongStudent = ['Ra hoa', 'Gieo hạt', 'Nảy mầm'];
    assert.strictEqual(
      checkAnswerCorrectness(wrongStudent, [1, 2, 0], { type: 'sequence', items }),
      false,
      'Wrong order must evaluate to false'
    );
  });

  test('Sequence: Array of indices vs Array of indices', () => {
    assert.strictEqual(checkAnswerCorrectness([1, 2, 0], [1, 2, 0], { type: 'sequence' }), true);
    assert.strictEqual(checkAnswerCorrectness([0, 1, 2], [1, 2, 0], { type: 'sequence' }), false);
  });

  // -------------------------------------------------------------
  // TEST GROUP 3: TWO-PHASE HINT AND EXPLANATION LEAKAGE
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: Two-Phase Pedagogical Hint & Anti-Leakage ---');

  test('Hint leak detector flags verbatim answers in hints', () => {
    const leakingHint = 'Em hãy nhớ rằng một vỏ chai nhựa đang nằm dưới gốc cây.';
    const goodHint = 'Em hãy đọc lại đoạn đầu xem vật gì nằm dưới gốc cây nhé.';
    const options = ['Một chiếc lá khô', 'Một vỏ chai nhựa', 'Một viên sỏi'];

    assert.strictEqual(isHintLeakingAnswer(leakingHint, 'B', options), true, 'Leaking hint must be detected');
    assert.strictEqual(isHintLeakingAnswer(goodHint, 'B', options), false, 'Good pedagogical hint must pass');
  });

  test('Question Sanitizer strips prefixes and neutralizes leaking hints', () => {
    const rawQuestion = {
      id: 'q_test',
      type: 'multiple_choice',
      prompt: 'Bạn Lan làm gì?',
      options: ['A. Tưới cây', 'B. Nhặt rác', 'C. Chơi đùa'],
      answer: 'B. Nhặt rác',
      hint: 'Đáp án là B, em chọn nhặt rác nhé.',
      explanation: 'Bạn Lan nhặt rác để giữ sạch sân trường.'
    };

    const clean = sanitizeQuestionData(rawQuestion, 0);
    assert.strictEqual(clean.options[0], 'Tưới cây');
    assert.strictEqual(clean.options[1], 'Nhặt rác');
    assert.strictEqual(clean.options[2], 'Chơi đùa');
    assert.strictEqual(clean.answer, 'B');
    assert.strictEqual(clean.correctAnswer, 'B');
    // Leaking hint replaced
    assert.strictEqual(clean.hint.includes('Đáp án là B'), false);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
