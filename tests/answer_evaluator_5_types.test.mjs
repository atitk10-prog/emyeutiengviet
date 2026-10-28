import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAnswerCorrectness,
  normalizeBlankText,
  normalizeMatchingPairs,
  cleanOptionText,
  sanitizeQuestionData,
  validateQuestionForPublish
} from '../shared/dist/answerEvaluator.js';

describe('ANSWER EVALUATOR 5 QUESTION TYPES SUITE', () => {

  test('1. Multiple Choice (A/B/C) - Canonical index & letter match', () => {
    const ctx = {
      type: 'multiple_choice',
      options: ['Một chiếc lá khô', 'Một vỏ chai nhựa', 'Một viên sỏi nhỏ']
    };
    // Letter answer
    assert.equal(checkAnswerCorrectness('B', 'B', ctx), true);
    assert.equal(checkAnswerCorrectness('A', 'B', ctx), false);
    // Student selected option text
    assert.equal(checkAnswerCorrectness('Một vỏ chai nhựa', 'B', ctx), true);
    assert.equal(checkAnswerCorrectness('B. Một vỏ chai nhựa', 'B', ctx), true);
    // Index answer
    assert.equal(checkAnswerCorrectness(1, 'B', ctx), true);
    assert.equal(checkAnswerCorrectness(0, 'B', ctx), false);
  });

  test('2. True / False - Boolean variations', () => {
    const ctx = { type: 'true_false' };
    assert.equal(checkAnswerCorrectness(true, true, ctx), true);
    assert.equal(checkAnswerCorrectness(false, true, ctx), false);
    assert.equal(checkAnswerCorrectness('Đúng', true, ctx), true);
    assert.equal(checkAnswerCorrectness('Sai', true, ctx), false);
    assert.equal(checkAnswerCorrectness('true', true, ctx), true);
    assert.equal(checkAnswerCorrectness(false, false, ctx), true);
  });

  test('3. Sequence - Chronological events ordering', () => {
    const items = ['Gieo hạt mầm', 'Tưới nước mỗi ngày', 'Cây nở hoa'];
    const ctx = { type: 'sequence', items };
    const correctSeq = ['Gieo hạt mầm', 'Tưới nước mỗi ngày', 'Cây nở hoa'];

    // Matching exact string sequence
    assert.equal(checkAnswerCorrectness(['Gieo hạt mầm', 'Tưới nước mỗi ngày', 'Cây nở hoa'], correctSeq, ctx), true);
    // Inverted order
    assert.equal(checkAnswerCorrectness(['Cây nở hoa', 'Tưới nước mỗi ngày', 'Gieo hạt mầm'], correctSeq, ctx), false);
    // Index array [0, 1, 2]
    assert.equal(checkAnswerCorrectness([0, 1, 2], correctSeq, ctx), true);
    assert.equal(checkAnswerCorrectness([2, 1, 0], correctSeq, ctx), false);
  });

  test('4. Matching (Ghép đôi) - Pair verification', () => {
    const ctx = {
      type: 'matching',
      leftItems: ['Hoa bàng', 'Lá bàng', 'Quả bàng'],
      rightItems: ['Màu trắng ngà', 'Dày và xanh mướt', 'Hình bầu dục'],
      matchingPairs: {
        'Hoa bàng': 'Màu trắng ngà',
        'Lá bàng': 'Dày và xanh mướt',
        'Quả bàng': 'Hình bầu dục'
      }
    };

    // Correct pairs submitted as Object
    const studentCorrectObj = {
      'Hoa bàng': 'Màu trắng ngà',
      'Lá bàng': 'Dày và xanh mướt',
      'Quả bàng': 'Hình bầu dục'
    };
    assert.equal(checkAnswerCorrectness(studentCorrectObj, ctx.matchingPairs, ctx), true);

    // One pair mismatched
    const studentWrongObj = {
      'Hoa bàng': 'Hình bầu dục',
      'Lá bàng': 'Dày và xanh mướt',
      'Quả bàng': 'Màu trắng ngà'
    };
    assert.equal(checkAnswerCorrectness(studentWrongObj, ctx.matchingPairs, ctx), false);

    // Correct pairs submitted as Array of { left, right }
    const studentArray = [
      { left: 'Hoa bàng', right: 'Màu trắng ngà' },
      { left: 'Lá bàng', right: 'Dày và xanh mướt' },
      { left: 'Quả bàng', right: 'Hình bầu dục' }
    ];
    assert.equal(checkAnswerCorrectness(studentArray, ctx.matchingPairs, ctx), true);
  });

  test('5. Fill in the Blank (Điền khuyết) - Normalization & Vietnamese diacritics', () => {
    const ctx = {
      type: 'fill_blank',
      acceptedAnswers: ['mùa xuân', 'xuân', 'mùa xuân ấm áp']
    };
    const correctAnswer = 'mùa xuân';

    // Exact match
    assert.equal(checkAnswerCorrectness('mùa xuân', correctAnswer, ctx), true);
    // Case-insensitive
    assert.equal(checkAnswerCorrectness('MÙA XUÂN', correctAnswer, ctx), true);
    // Extra whitespace and punctuation
    assert.equal(checkAnswerCorrectness('   mùa   xuân.  ', correctAnswer, ctx), true);
    // Accepted alternative
    assert.equal(checkAnswerCorrectness('xuân', correctAnswer, ctx), true);
    assert.equal(checkAnswerCorrectness('Mùa xuân ấm áp!', correctAnswer, ctx), true);

    // WRONG ANSWERS:
    // Missing diacritics / accents (MUST NOT PASS because it alters meaning)
    assert.equal(checkAnswerCorrectness('mua xuan', correctAnswer, ctx), false);
    // Completely wrong word
    assert.equal(checkAnswerCorrectness('mùa hạ', correctAnswer, ctx), false);
  });

  test('6. Sanitizer & Validator handles all 5 question types', () => {
    // MCQ
    const mcq = sanitizeQuestionData({
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Câu hỏi 1?',
      options: ['A. Lựa chọn 1', 'B. Lựa chọn 2', 'C. Lựa chọn 3'],
      answer: 'B'
    });
    assert.equal(mcq.type, 'multiple_choice');
    assert.equal(mcq.answer, 'B');
    assert.equal(validateQuestionForPublish(mcq, 0).valid, true);

    // Matching
    const matching = sanitizeQuestionData({
      id: 'q2',
      type: 'matching',
      prompt: 'Ghép đôi từ ngữ:',
      leftItems: ['Từ A', 'Từ B'],
      rightItems: ['Nghĩa A', 'Nghĩa B'],
      matchingPairs: { 'Từ A': 'Nghĩa A', 'Từ B': 'Nghĩa B' }
    });
    assert.equal(matching.type, 'matching');
    assert.equal(validateQuestionForPublish(matching, 1).valid, true);

    // Fill Blank
    const fillBlank = sanitizeQuestionData({
      id: 'q3',
      type: 'fill_blank',
      prompt: 'Điền từ: Mưa [ ... ] rả rích.',
      answer: 'xuân',
      acceptedAnswers: ['xuân', 'mùa xuân']
    });
    assert.equal(fillBlank.type, 'fill_blank');
    assert.equal(validateQuestionForPublish(fillBlank, 2).valid, true);
  });
});
