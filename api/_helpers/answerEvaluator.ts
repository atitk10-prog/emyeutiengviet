/**
 * EM YÊU TIẾNG VIỆT - SERVER-SIDE ANSWER EVALUATOR & QUESTION NORMALIZER
 * 
 * Centralized, canonical grading logic for all 3 question types:
 * 1. Multiple Choice (A/B/C)
 * 2. True / False
 * 3. Sequence (3 Items Order)
 */

export interface QuestionContext {
  type?: 'multiple_choice' | 'true_false' | 'sequence' | string;
  options?: string[];
  items?: string[];
  statement?: string;
  prompt?: string;
}

/**
 * Clean prefix like "A. ", "A) ", "[A] ", "1. ", "(1) " from an option/item string
 */
export function cleanOptionText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/^(\([0-9]+\)|[A-Da-d]|[0-9]+)[\.\)\:\-\s]+\s*/, '')
    .trim();
}

/**
 * Extract option letter ('A', 'B', 'C', 'D') from option text if prefixed
 */
export function extractOptionPrefix(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.trim().match(/^([A-Da-d])[\.\)\:\-\s]+/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Normalize an MCQ answer (whether it's letter 'A'/'B'/'C', index 0/1/2, or full text)
 * to a zero-based option index (0, 1, 2)
 */
export function normalizeMcqAnswerToIndex(answer: any, options?: string[]): number | null {
  if (answer === null || answer === undefined) return null;

  // 1. Direct number index
  if (typeof answer === 'number') {
    if (options && options.length > 0) {
      if (answer >= 0 && answer < options.length) return answer;
      // Handle 1-based index (1, 2, 3)
      if (answer >= 1 && answer <= options.length) return answer - 1;
    } else if (answer >= 0 && answer <= 3) {
      return answer;
    }
  }

  const str = String(answer).trim();

  // 2. Single letter 'A', 'B', 'C', 'D'
  if (/^[A-Da-d]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }

  // 3. String numeric index like "0", "1", "2"
  if (/^[0-3]$/.test(str)) {
    const num = parseInt(str, 10);
    if (options && options.length > 0) {
      if (num >= 0 && num < options.length) return num;
      if (num >= 1 && num <= options.length) return num - 1;
    } else {
      return num;
    }
  }

  // 4. Match against options array
  if (options && Array.isArray(options) && options.length > 0) {
    const cleanAns = cleanOptionText(str).toLowerCase();
    const rawAns = str.toLowerCase();

    for (let i = 0; i < options.length; i++) {
      const opt = String(options[i] || '');
      const cleanOpt = cleanOptionText(opt).toLowerCase();
      const rawOpt = opt.toLowerCase();

      // Check letter prefix in option itself (e.g. "B. Một vỏ chai nhựa")
      const optPrefix = extractOptionPrefix(opt);
      if (optPrefix && optPrefix === str.toUpperCase()) {
        return i;
      }

      // Check exact text match (cleaned or raw)
      if (cleanAns === cleanOpt || rawAns === rawOpt || rawAns === cleanOpt || cleanAns === rawOpt) {
        return i;
      }

      // Check substring match if answer is descriptive
      if (cleanAns.length > 3 && cleanOpt.length > 3) {
        if (cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt)) {
          return i;
        }
      }
    }
  }

  return null;
}

/**
 * Normalize True/False answer to canonical boolean
 */
export function normalizeBooleanAnswer(answer: any): boolean | null {
  if (answer === true || answer === 1) return true;
  if (answer === false || answer === 0) return false;

  if (typeof answer === 'string') {
    const s = answer.trim().toLowerCase();
    if (['true', 'đúng', 'dung', 't', '1', 'yes'].includes(s)) return true;
    if (['false', 'sai', 'f', '0', 'no'].includes(s)) return false;
  }

  return null;
}

/**
 * Normalize Sequence answer to an array of cleaned, lowercase string steps
 */
export function normalizeSequence(answer: any, items?: string[]): string[] | null {
  if (!Array.isArray(answer)) return null;

  // If answer is array of numbers (e.g. [1, 2, 0]) and items is provided
  if (answer.every((x) => typeof x === 'number' || (typeof x === 'string' && /^[0-9]+$/.test(x.trim())))) {
    if (items && Array.isArray(items) && items.length > 0) {
      return answer.map((idx) => {
        const num = typeof idx === 'number' ? idx : parseInt(idx, 10);
        const itemText = items[num] !== undefined ? items[num] : items[num - 1] || String(num);
        return cleanOptionText(String(itemText)).toLowerCase();
      });
    }
    // Return numeric string sequence
    return answer.map((x) => String(x).trim());
  }

  // Answer is array of strings (e.g. student rearranged steps)
  return answer.map((step) => cleanOptionText(String(step)).toLowerCase());
}

/**
 * CANONICAL ANSWER EVALUATION
 * Returns true if student answer matches correct answer, false otherwise.
 */
export function checkAnswerCorrectness(
  studentAns: any,
  correctAns: any,
  context?: QuestionContext
): boolean {
  if (studentAns === undefined || studentAns === null) return false;
  if (correctAns === undefined || correctAns === null) return false;

  const type = context?.type;
  const options = context?.options;
  const items = context?.items;

  // --- TYPE 1: MULTIPLE CHOICE ---
  if (type === 'multiple_choice' || (options && options.length > 0)) {
    const sIdx = normalizeMcqAnswerToIndex(studentAns, options);
    const cIdx = normalizeMcqAnswerToIndex(correctAns, options);

    if (sIdx !== null && cIdx !== null) {
      return sIdx === cIdx;
    }

    // Fallback: direct letter / string match
    const sStr = String(studentAns).trim().toUpperCase();
    const cStr = String(correctAns).trim().toUpperCase();
    return sStr === cStr;
  }

  // --- TYPE 2: TRUE / FALSE ---
  if (type === 'true_false' || typeof correctAns === 'boolean') {
    const sBool = normalizeBooleanAnswer(studentAns);
    const cBool = normalizeBooleanAnswer(correctAns);

    if (sBool !== null && cBool !== null) {
      return sBool === cBool;
    }
  }

  // --- TYPE 3: SEQUENCE ---
  if (type === 'sequence' || Array.isArray(correctAns)) {
    const sSeq = normalizeSequence(studentAns, items);
    const cSeq = normalizeSequence(correctAns, items);

    if (sSeq && cSeq) {
      if (sSeq.length !== cSeq.length) return false;
      for (let i = 0; i < sSeq.length; i++) {
        if (sSeq[i] !== cSeq[i]) return false;
      }
      return true;
    }
  }

  // --- GENERAL FALLBACK ---
  if (typeof correctAns === 'boolean') {
    return Boolean(studentAns) === correctAns;
  }

  return String(studentAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
}

/**
 * Check if a pedagogical hint accidentally leaks the correct answer verbatim
 */
export function isHintLeakingAnswer(hint: string, answer: any, options?: string[]): boolean {
  if (!hint || typeof hint !== 'string') return false;
  const hintLower = hint.toLowerCase();

  let answerText = String(answer || '');
  if (options && options.length > 0) {
    const idx = normalizeMcqAnswerToIndex(answer, options);
    if (idx !== null && options[idx]) {
      answerText = cleanOptionText(options[idx]);
    }
  }

  const cleanAns = cleanOptionText(answerText).toLowerCase();
  if (cleanAns.length >= 4 && hintLower.includes(cleanAns)) {
    return true;
  }

  if (/đáp án\s*(là|chính là|đúng là)?\s*([A-Da-d])/i.test(hint) || /chọn\s+([A-Da-d])\b/i.test(hint)) {
    return true;
  }

  return false;
}

/**
 * Sanitize and clean a question generated by AI or submitted in draft
 */
export function sanitizeQuestionData(q: any, idx = 0): any {
  const type = q.type || 'multiple_choice';
  const qId = q.id || `q${idx + 1}`;

  let prompt = String(q.prompt || '').trim();
  let statement = q.statement ? String(q.statement).trim() : undefined;

  if (type === 'true_false') {
    if (!prompt && statement) prompt = statement;
    if (!statement && prompt) statement = prompt;
    if (!prompt) {
      if (q.explanation) {
        prompt = `Nhận định: "${cleanOptionText(q.explanation)}"`;
        statement = prompt;
      } else {
        prompt = 'Nhận định sau Đúng hay Sai về bài đọc:';
      }
    }
  }

  let options = Array.isArray(q.options) ? q.options.map((o: any) => cleanOptionText(String(o))) : [];
  if (type === 'multiple_choice' && options.length !== 3) {
    if (!options || options.length === 0) {
      options = ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C'];
    }
  }

  let items = Array.isArray(q.items) ? q.items.map((it: any) => cleanOptionText(String(it))) : [];
  if (type === 'sequence' && items.length === 0) {
    if (Array.isArray(q.answer) && typeof q.answer[0] === 'string' && q.answer.length >= 3) {
      items = q.answer.slice(0, 3).map((it: any) => cleanOptionText(String(it)));
    } else if (Array.isArray(q.options) && q.options.length >= 3) {
      items = q.options.slice(0, 3).map((it: any) => cleanOptionText(String(it)));
    } else if (q.explanation && typeof q.explanation === 'string') {
      const matches = q.explanation.match(/\([0-9]+\)\s*([^,\.\;\n]+)/g);
      if (matches && matches.length >= 3) {
        items = matches.slice(0, 3).map((m: string) => cleanOptionText(m.replace(/^\([0-9]+\)\s*/, '')));
      }
    }
  }

  let answer = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
  if (type === 'multiple_choice') {
    const idx = normalizeMcqAnswerToIndex(answer, options);
    if (idx !== null && idx >= 0 && idx < 3) {
      answer = String.fromCharCode(65 + idx);
    } else {
      answer = 'A';
    }
  } else if (type === 'true_false') {
    const bool = normalizeBooleanAnswer(answer);
    answer = bool !== null ? bool : true;
  } else if (type === 'sequence') {
    if (Array.isArray(answer)) {
      if (typeof answer[0] === 'number' && items.length >= 3) {
        answer = answer.map((i: number) => items[i] || items[0]);
      } else {
        answer = answer.map((it: any) => cleanOptionText(String(it)));
      }
    } else if (items.length >= 3) {
      answer = [...items];
    }
  }

  let hint = String(q.hint || 'Em hãy đọc lại đoạn văn để tìm chi tiết nhé.').trim();
  if (isHintLeakingAnswer(hint, answer, options)) {
    hint = 'Em hãy đọc kỹ lại đoạn văn liên quan để tìm câu trả lời chính xác nhé.';
  }

  const explanation = String(q.explanation || 'Chi tiết được thể hiện rõ trong bài đọc.').trim();

  return {
    id: qId,
    type,
    prompt,
    statement: statement || undefined,
    options: type === 'multiple_choice' ? options : undefined,
    items: type === 'sequence' ? items : undefined,
    answer,
    correctAnswer: answer,
    hint,
    explanation,
    difficulty: q.difficulty || 'thong_hieu',
    skillTag: q.skillTag || 'thong_tin_truc_tiep',
    relatedPassagePart: q.relatedPassagePart || undefined
  };
}

/**
 * Strict validator before publishing a lesson to ensure no corrupted or empty question is published
 */
export function validateQuestionForPublish(q: any, idx = 0): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const type = q.type || 'multiple_choice';
  const qLabel = `Câu ${idx + 1} (${q.id || `q${idx + 1}`})`;

  if (!q.prompt && !q.statement) {
    errors.push(`${qLabel}: Tiêu đề hoặc nhận định câu hỏi không được để trống.`);
  }

  if (type === 'multiple_choice') {
    if (!q.options || !Array.isArray(q.options) || q.options.length !== 3) {
      errors.push(`${qLabel}: Trắc nghiệm phải có đúng 3 phương án lựa chọn (A, B, C).`);
    } else {
      if (q.options.some((opt: any) => !opt || String(opt).trim().length === 0)) {
        errors.push(`${qLabel}: Phương án lựa chọn trắc nghiệm không được để trống.`);
      }
      const unique = new Set(q.options.map((o: any) => cleanOptionText(String(o)).toLowerCase()));
      if (unique.size !== q.options.length) {
        errors.push(`${qLabel}: Các phương án trắc nghiệm không được trùng lặp nội dung.`);
      }
    }
    const ans = String(q.correctAnswer !== undefined ? q.correctAnswer : q.answer).trim().toUpperCase();
    if (!['A', 'B', 'C'].includes(ans) && typeof q.answer !== 'number') {
      errors.push(`${qLabel}: Phải chọn đúng 1 đáp án A, B hoặc C.`);
    }
  } else if (type === 'true_false') {
    const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
    if (typeof ans !== 'boolean' && !['true', 'false', 'đúng', 'sai'].includes(String(ans).toLowerCase())) {
      errors.push(`${qLabel}: Câu Đúng/Sai phải có đáp án boolean hợp lệ.`);
    }
  } else if (type === 'sequence') {
    if (!q.items || !Array.isArray(q.items) || q.items.length < 3) {
      errors.push(`${qLabel}: Bài sắp xếp trình tự phải có ít nhất 3 sự việc (hiện có ${q.items?.length || 0}).`);
    } else {
      if (q.items.some((it: any) => !it || String(it).trim().length === 0)) {
        errors.push(`${qLabel}: Nội dung sự việc trong bài sắp xếp không được để trống.`);
      }
    }
    const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
    if (!ans || !Array.isArray(ans) || ans.length < 3) {
      errors.push(`${qLabel}: Thứ tự đúng của sự việc phải gồm ít nhất 3 bước.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
