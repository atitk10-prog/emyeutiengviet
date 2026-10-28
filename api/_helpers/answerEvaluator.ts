/**
 * EM YÊU TIẾNG VIỆT - SERVER-SIDE ANSWER EVALUATOR & QUESTION NORMALIZER
 * 
 * Centralized, canonical grading logic for all 5 question types:
 * 1. Multiple Choice (A/B/C)
 * 2. True / False
 * 3. Sequence (3+ Items Order with Drag & Drop)
 * 4. Matching (Drag & Drop or Touch/Click to Pair)
 * 5. Fill in the Blank (Short 1-2 words with teacher accepted variants)
 */

export interface QuestionContext {
  type?: 'multiple_choice' | 'true_false' | 'sequence' | 'matching' | 'fill_blank' | string;
  options?: string[];
  items?: string[];
  statement?: string;
  prompt?: string;
  leftItems?: string[];
  rightItems?: string[];
  blankContext?: string;
  blankPosition?: number;
  acceptedAnswers?: string[];
  matchingPairs?: Record<string, string> | Array<{ left: string; right: string }>;
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

      const optPrefix = extractOptionPrefix(opt);
      if (optPrefix && optPrefix === str.toUpperCase()) {
        return i;
      }

      if (cleanAns === cleanOpt || rawAns === rawOpt || rawAns === cleanOpt || cleanAns === rawOpt) {
        return i;
      }

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

  if (answer.every((x) => typeof x === 'number' || (typeof x === 'string' && /^[0-9]+$/.test(x.trim())))) {
    if (items && Array.isArray(items) && items.length > 0) {
      return answer.map((idx) => {
        const num = typeof idx === 'number' ? idx : parseInt(idx, 10);
        const itemText = items[num] !== undefined ? items[num] : items[num - 1] || String(num);
        return cleanOptionText(String(itemText)).toLowerCase();
      });
    }
    return answer.map((x) => String(x).trim());
  }

  return answer.map((step) => cleanOptionText(String(step)).toLowerCase());
}

/**
 * Normalize text for fill_blank comparison:
 * - Trims leading and trailing whitespace
 * - Unicode NFC normalization
 * - Collapses consecutive spaces
 * - Strips outer punctuation (e.g. .,!?;"')
 * - Lowercases for comparison
 * - NOTE: VIETNAMESE DIACRITICS ARE PRESERVED!
 */
export function normalizeBlankText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?;:"'«»()\[\]{}]+|[.,!?;:"'«»()\[\]{}]+$/g, '')
    .toLowerCase();
}

/**
 * Canonical representation of matching pairs as Map of normalized left -> normalized right
 */
export function normalizeMatchingPairs(
  pairsData: any,
  leftItems?: string[],
  rightItems?: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  if (!pairsData) return result;

  if (Array.isArray(pairsData)) {
    for (const item of pairsData) {
      if (item && typeof item === 'object') {
        const left = item.left !== undefined ? item.left : item.source || item[0];
        const right = item.right !== undefined ? item.right : item.target || item[1];
        if (left !== undefined && right !== undefined) {
          const lKey = cleanOptionText(String(left)).normalize('NFC').toLowerCase();
          const rVal = cleanOptionText(String(right)).normalize('NFC').toLowerCase();
          if (lKey) result.set(lKey, rVal);
        }
      }
    }
    return result;
  }

  if (typeof pairsData === 'object') {
    const record = pairsData as Record<string, any>;
    for (const [key, val] of Object.entries(record)) {
      if (val !== undefined && val !== null) {
        let leftStr = key;
        if (/^[0-9]+$/.test(key) && leftItems && leftItems[parseInt(key, 10)]) {
          leftStr = leftItems[parseInt(key, 10)];
        }
        let rightStr = String(val);
        if (typeof val === 'number' || /^[0-9]+$/.test(String(val))) {
          const rIdx = typeof val === 'number' ? val : parseInt(String(val), 10);
          if (rightItems && rightItems[rIdx]) {
            rightStr = rightItems[rIdx];
          }
        }
        const lKey = cleanOptionText(String(leftStr)).normalize('NFC').toLowerCase();
        const rVal = cleanOptionText(String(rightStr)).normalize('NFC').toLowerCase();
        if (lKey) result.set(lKey, rVal);
      }
    }
  }

  return result;
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
  if (type === 'sequence' || (Array.isArray(correctAns) && !context?.leftItems)) {
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

  // --- TYPE 4: MATCHING ---
  if (type === 'matching' || context?.leftItems || context?.matchingPairs) {
    const sPairs = normalizeMatchingPairs(studentAns, context?.leftItems, context?.rightItems);
    const cPairs = normalizeMatchingPairs(
      context?.matchingPairs || correctAns,
      context?.leftItems,
      context?.rightItems
    );

    if (cPairs.size === 0) return false;
    if (sPairs.size !== cPairs.size) return false;

    for (const [leftKey, rightVal] of cPairs.entries()) {
      const studentRight = sPairs.get(leftKey);
      if (!studentRight) return false;
      if (studentRight !== rightVal) {
        if (studentRight.length > 5 && rightVal.length > 5) {
          if (!studentRight.includes(rightVal) && !rightVal.includes(studentRight)) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    return true;
  }

  // --- TYPE 5: FILL IN THE BLANK ---
  if (type === 'fill_blank' || context?.acceptedAnswers) {
    const studentClean = normalizeBlankText(String(studentAns || ''));
    if (!studentClean) return false;

    const correctClean = normalizeBlankText(String(correctAns || ''));
    if (studentClean === correctClean) return true;

    const accepted = context?.acceptedAnswers || [];
    for (const alt of accepted) {
      if (studentClean === normalizeBlankText(String(alt))) {
        return true;
      }
    }

    return false;
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
export function isHintLeakingAnswer(hint: string, answer: any, options?: string[], acceptedAnswers?: string[]): boolean {
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

  if (acceptedAnswers && Array.isArray(acceptedAnswers)) {
    for (const acc of acceptedAnswers) {
      const c = normalizeBlankText(acc);
      if (c.length >= 4 && hintLower.includes(c)) return true;
    }
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

  let prompt = String(q.prompt || q.question || q.text || q.content || q.title || '').trim();
  let statement = q.statement ? String(q.statement).trim() : undefined;

  if (!prompt && statement) prompt = statement;
  if (!prompt && q.blankContext) prompt = String(q.blankContext).trim();
  if (!prompt) {
    if (type === 'multiple_choice') prompt = 'Chọn câu trả lời đúng nhất theo bài đọc:';
    else if (type === 'matching') prompt = 'Em hãy ghép từ ở Cột A với lời giải nghĩa phù hợp ở Cột B:';
    else if (type === 'fill_blank') prompt = 'Điền từ ngữ thích hợp vào chỗ trống trong câu:';
    else if (type === 'sequence') prompt = 'Sắp xếp đúng thứ tự các sự việc diễn ra trong bài:';
    else if (type === 'true_false') prompt = 'Nhận định sau Đúng hay Sai về bài đọc:';
  }

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

  // Multiple Choice Options
  let options = Array.isArray(q.options) ? q.options.map((o: any) => cleanOptionText(String(o))) : [];
  if (type === 'multiple_choice' && options.length !== 3) {
    if (!options || options.length === 0) {
      options = ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C'];
    }
  }

  // Sequence Items
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

  // Matching Items & Pairs
  let leftItems = Array.isArray(q.leftItems) ? q.leftItems.map((it: any) => cleanOptionText(String(it))) : undefined;
  let rightItems = Array.isArray(q.rightItems) ? q.rightItems.map((it: any) => cleanOptionText(String(it))) : undefined;
  let matchingPairs = q.matchingPairs || (typeof q.answer === 'object' && !Array.isArray(q.answer) ? q.answer : undefined);

  if (type === 'matching') {
    if (!prompt) prompt = 'Ghép đôi các nội dung tương ứng ở cột trái và cột phải:';
    if (!leftItems || leftItems.length === 0) {
      if (q.pairs && Array.isArray(q.pairs)) {
        leftItems = q.pairs.map((p: any) => cleanOptionText(String(p.left || p[0] || '')));
        rightItems = q.pairs.map((p: any) => cleanOptionText(String(p.right || p[1] || '')));
      } else if (matchingPairs && typeof matchingPairs === 'object') {
        leftItems = Object.keys(matchingPairs).map((k) => cleanOptionText(k));
        rightItems = Object.values(matchingPairs).map((v) => cleanOptionText(String(v)));
      }
    }
    if (!matchingPairs && leftItems && rightItems && leftItems.length === rightItems.length) {
      matchingPairs = {};
      for (let i = 0; i < leftItems.length; i++) {
        matchingPairs[leftItems[i]] = rightItems[i];
      }
    }
  }

  // Fill in the Blank
  let blankContext = q.blankContext ? String(q.blankContext).trim() : undefined;
  let acceptedAnswers: string[] | undefined = undefined;
  if (type === 'fill_blank') {
    if (!prompt) prompt = 'Điền từ ngữ thích hợp vào chỗ trống:';
    if (!blankContext && prompt.includes('[') && prompt.includes(']')) {
      blankContext = prompt;
    }
    const rawAnswer = String(q.correctAnswer !== undefined ? q.correctAnswer : (q.answer || '')).trim();
    const primaryAns = rawAnswer.replace(/^[.,!?;:"'«»()\[\]{}]+|[.,!?;:"'«»()\[\]{}]+$/g, '').trim();
    const list = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map((s: any) => String(s).trim()) : [];
    if (primaryAns && !list.some((a: string) => normalizeBlankText(a) === normalizeBlankText(primaryAns))) {
      list.unshift(primaryAns);
    }
    acceptedAnswers = list.length > 0 ? list : [primaryAns || 'từ cần điền'];
  }

  // Canonicalize answer
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
  } else if (type === 'matching') {
    answer = matchingPairs || answer;
  } else if (type === 'fill_blank') {
    answer = acceptedAnswers?.[0] || String(answer || '').trim();
  }

  let hint = String(q.hint || 'Em hãy đọc lại đoạn văn để tìm chi tiết nhé.').trim();
  if (isHintLeakingAnswer(hint, answer, options, acceptedAnswers)) {
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
    leftItems: type === 'matching' ? leftItems : undefined,
    rightItems: type === 'matching' ? rightItems : undefined,
    blankContext: type === 'fill_blank' ? blankContext : undefined,
    acceptedAnswers: type === 'fill_blank' ? acceptedAnswers : undefined,
    matchingPairs: type === 'matching' ? matchingPairs : undefined,
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
  } else if (type === 'matching') {
    if (!q.leftItems || !Array.isArray(q.leftItems) || q.leftItems.length < 2) {
      errors.push(`${qLabel}: Bài ghép đôi phải có ít nhất 2 đối tượng ở cột trái.`);
    }
    if (!q.rightItems || !Array.isArray(q.rightItems) || q.rightItems.length < 2) {
      errors.push(`${qLabel}: Bài ghép đôi phải có ít nhất 2 đối tượng ở cột phải.`);
    }
    const pairs = q.matchingPairs || (typeof q.correctAnswer === 'object' ? q.correctAnswer : q.answer);
    if (!pairs) {
      errors.push(`${qLabel}: Bài ghép đôi phải có bảng ánh xạ cặp đáp án đúng.`);
    }
  } else if (type === 'fill_blank') {
    const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
    if (!ans || typeof ans !== 'string' || ans.trim().length === 0) {
      errors.push(`${qLabel}: Bài điền khuyết phải có đáp án chữ chính xác.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
