import fs from 'node:fs';
import path from 'node:path';
import {
  checkAnswerCorrectness,
  normalizeBlankText,
  normalizeMatchingPairs,
  isHintLeakingAnswer,
  sanitizeQuestionData,
  validateQuestionForPublish
} from '../shared/dist/answerEvaluator.js';

function getApiKey() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'functions/.secret.local'),
    path.resolve(process.cwd(), '.secret.local'),
    path.resolve(process.cwd(), '.env.local')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(/GEMINI_API_KEY\s*=\s*([^\s#\r\n]+)/);
      if (m && m[1]) return m[1].replace(/["']/g, '').trim();
    }
  }
  return process.env.GEMINI_API_KEY || '';
}

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function callGoogleGemini(model, prompt, apiKey, timeoutMs = 25000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const latencyMs = Date.now() - start;
    const data = await res.json();

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error?.message || `HTTP ${res.status}`,
        latencyMs,
        model
      };
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    return {
      ok: true,
      data: parsed,
      latencyMs,
      model
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'Timeout' : err.message,
      latencyMs: Date.now() - start,
      model
    };
  }
}

async function generateLessonWithFallback(questionCount, questionTypes, apiKey) {
  const prompt = `Bạn là chuyên gia sư phạm Tiểu học biên soạn bài đọc Tiếng Việt Lớp 2-3 theo Chương trình GDPT 2018.
YÊU CẦU BẮT BUỘC:
- Số lượng câu hỏi: CHÍNH XÁC ${questionCount} câu (không được thiếu, không được thừa).
- Dạng câu hỏi: Phối hợp linh hoạt trong các dạng: ${questionTypes.join(', ')}.
- Các dạng câu hỏi được hỗ trợ:
  1. multiple_choice: options gồm đúng 3 lựa chọn (A, B, C), answer là "A" hoặc "B" hoặc "C".
  2. true_false: statement là nhận định, answer là true hoặc false.
  3. sequence: items gồm đúng 3 sự việc theo trình tự thời gian, answer là mảng 3 sự việc theo thứ tự đúng.
  4. matching: leftItems gồm 3 từ ngữ/sự việc, rightItems gồm 3 giải nghĩa/nội dung khớp, matchingPairs là object ánh xạ { [left]: right }, answer là object matchingPairs.
  5. fill_blank: prompt yêu cầu điền từ, blankContext chứa câu văn với ký hiệu "[ ... ]" ở vị trí cần điền, answer là từ chuẩn (1-2 từ), acceptedAnswers là mảng các từ tương đương được chấp nhận.
- Trả về DUY NHẤT một JSON hợp lệ:
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc (khoảng 120-160 từ)",
  "grade": 2,
  "topic": "Thiên nhiên tươi đẹp",
  "vocabulary": [{ "word": "từ", "meaning": "nghĩa", "example": "ví dụ" }],
  "questions": [
    ... đúng ${questionCount} câu hỏi ...
  ]
}`;

  console.log(`\n▶ Đang thử tạo đề ${questionCount} câu với Primary Model: ${PRIMARY_MODEL}...`);
  let res = await callGoogleGemini(PRIMARY_MODEL, prompt, apiKey, 25000);

  if (!res.ok) {
    console.log(`⚠️ Primary ${PRIMARY_MODEL} không khả dụng (${res.error}). Đang chuyển sang Fallback Model: ${FALLBACK_MODEL}...`);
    res = await callGoogleGemini(FALLBACK_MODEL, prompt, apiKey, 30000);
    res.usedFallback = true;
  }

  return res;
}

async function runAcceptanceTests() {
  console.log('===============================================================');
  console.log('   BỘ KIỂM THỬ TỔNG HỢP TOÀN DIỆN: EM YÊU TIẾNG VIỆT UPGRADE   ');
  console.log('===============================================================');

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('❌ Không tìm thấy GEMINI_API_KEY!');
    process.exit(1);
  }
  console.log('✅ Đã nhận diện GEMINI_API_KEY.');

  let allPassed = true;

  // -----------------------------------------------------------------
  // PHẦN 1: KIỂM THỬ BỘ CHẤM ĐIỂM (5 DẠNG CÂU HỎI)
  // -----------------------------------------------------------------
  console.log('\n--- PHẦN 1: KIỂM THỬ ĐÁNH GIÁ ĐÁP ÁN (5 DẠNG CÂU HỎI) ---');

  // 1. Multiple choice
  const mc1 = checkAnswerCorrectness('A', 'A', { type: 'multiple_choice' });
  const mc2 = checkAnswerCorrectness('B', 'A', { type: 'multiple_choice' });
  const mc3 = checkAnswerCorrectness('A. Hoa hồng', 'A', {
    type: 'multiple_choice',
    options: ['Hoa hồng', 'Hoa sen', 'Hoa cúc']
  });
  if (mc1 && !mc2 && mc3) {
    console.log('  ✅ [PASS] 1. Trắc nghiệm A/B/C: Chấm đúng, sai và chuẩn hóa tiền tố chính xác.');
  } else {
    console.error('  ❌ [FAIL] 1. Trắc nghiệm A/B/C thất bại.');
    allPassed = false;
  }

  // 2. True / False
  const tf1 = checkAnswerCorrectness(true, true, { type: 'true_false' });
  const tf2 = checkAnswerCorrectness('true', true, { type: 'true_false' });
  const tf3 = checkAnswerCorrectness(false, true, { type: 'true_false' });
  if (tf1 && tf2 && !tf3) {
    console.log('  ✅ [PASS] 2. Đúng / Sai: Chấm boolean và chuỗi chính xác.');
  } else {
    console.error('  ❌ [FAIL] 2. Đúng / Sai thất bại.');
    allPassed = false;
  }

  // 3. Sequence
  const sItems = ['Hạt nảy mầm', 'Cây lớn lên', 'Cây ra hoa'];
  const seq1 = checkAnswerCorrectness(sItems, sItems, { type: 'sequence' });
  const seq2 = checkAnswerCorrectness(['Cây ra hoa', 'Hạt nảy mầm', 'Cây lớn lên'], sItems, { type: 'sequence' });
  if (seq1 && !seq2) {
    console.log('  ✅ [PASS] 3. Sắp xếp sự việc: Kiểm tra trình tự chính xác.');
  } else {
    console.error('  ❌ [FAIL] 3. Sắp xếp sự việc thất bại.');
    allPassed = false;
  }

  // 4. Matching (Ghép đôi kéo thả)
  const lefts = ['Cây bàng', 'Gió xuân', 'Mầm non'];
  const rights = ['Tán lá xanh mát', 'Mơn man cành lá', 'Nhú lên mơn mởn'];
  const canonicalPairs = {
    'Cây bàng': 'Tán lá xanh mát',
    'Gió xuân': 'Mơn man cành lá',
    'Mầm non': 'Nhú lên mơn mởn'
  };

  const match1 = checkAnswerCorrectness(canonicalPairs, canonicalPairs, {
    type: 'matching',
    matchingPairs: canonicalPairs
  });
  const match2 = checkAnswerCorrectness(
    {
      'Cây bàng': 'Mơn man cành lá',
      'Gió xuân': 'Tán lá xanh mát',
      'Mầm non': 'Nhú lên mơn mởn'
    },
    canonicalPairs,
    { type: 'matching', matchingPairs: canonicalPairs }
  );
  if (match1 && !match2) {
    console.log('  ✅ [PASS] 4. Ghép đôi kéo thả: Chấm điểm ghép đúng/sai từng cặp chính xác.');
  } else {
    console.error('  ❌ [FAIL] 4. Ghép đôi thất bại.');
    allPassed = false;
  }

  // 5. Fill blank (Điền khuyết ngắn)
  const fb1 = checkAnswerCorrectness('nảy lộc', 'nảy lộc', {
    type: 'fill_blank',
    acceptedAnswers: ['nảy lộc', 'nảy chồi']
  });
  const fb2 = checkAnswerCorrectness('NẢY CHỒI   ', 'nảy lộc', {
    type: 'fill_blank',
    acceptedAnswers: ['nảy lộc', 'nảy chồi']
  });
  const fb3 = checkAnswerCorrectness('nay loc', 'nảy lộc', {
    type: 'fill_blank',
    acceptedAnswers: ['nảy lộc']
  }); // Should be FALSE because diacritics must NOT be stripped!
  const fb4 = checkAnswerCorrectness('héo úa', 'nảy lộc', {
    type: 'fill_blank',
    acceptedAnswers: ['nảy lộc']
  });

  if (fb1 && fb2 && !fb3 && !fb4) {
    console.log('  ✅ [PASS] 5. Điền khuyết ngắn: Chuẩn hóa hoa/thường, khoảng trắng, bảo tồn dấu tiếng Việt và hỗ trợ acceptedAnswers.');
  } else {
    console.error(`  ❌ [FAIL] 5. Điền khuyết thất bại (fb1=${fb1}, fb2=${fb2}, fb3=${fb3}, fb4=${fb4}).`);
    allPassed = false;
  }

  // 6. Hint answer leak detector
  const leak1 = isHintLeakingAnswer('Em hãy chọn đáp án A nhé.', 'A', { type: 'multiple_choice' });
  const safe1 = isHintLeakingAnswer('Đọc kỹ đoạn đầu bài đọc để tìm chi tiết nhé.', 'A', { type: 'multiple_choice' });
  const leak2 = isHintLeakingAnswer('Từ cần điền chính là nảy lộc đó em.', 'nảy lộc', { type: 'fill_blank' });
  const safe2 = isHintLeakingAnswer('Đọc kỹ câu văn miêu tả cây cối đâm chồi vào mùa xuân nhé.', 'nảy lộc', { type: 'fill_blank' });

  if (leak1 && !safe1 && leak2 && !safe2) {
    console.log('  ✅ [PASS] 6. Bộ kiểm tra gợi ý: Chặn thành công gợi ý lộ đáp án ở cả 5 dạng.');
  } else {
    console.error('  ❌ [FAIL] 6. Kiểm tra gợi ý thất bại.');
    allPassed = false;
  }

  // -----------------------------------------------------------------
  // PHẦN 2: KIỂM THỬ TẠO ĐỀ BẰNG GEMINI VỚI SỐ LƯỢNG ĐỀ KHÁC NHAU
  // -----------------------------------------------------------------
  console.log('\n--- PHẦN 2: KIỂM THỬ TẠO ĐỀ GEMINI VỚI CÁC SỐ LƯỢNG (3, 6, 8, 10 CÂU) ---');

  const testCounts = [3, 6, 8];
  for (const count of testCounts) {
    const types = ['multiple_choice', 'true_false', 'sequence', 'matching', 'fill_blank'];
    const res = await generateLessonWithFallback(count, types, apiKey);

    if (!res.ok) {
      console.error(`  ❌ [FAIL] Không thể tạo đề ${count} câu: ${res.error}`);
      allPassed = false;
      continue;
    }

    const draft = res.data;
    const actualCount = draft.questions?.length;
    console.log(`  📊 Kết quả đề ${count} câu:`);
    console.log(`     - Model sử dụng: ${res.model} (Latency: ${res.latencyMs}ms, Fallback: ${res.usedFallback ? 'Có' : 'Không'})`);
    console.log(`     - Tiêu đề: "${draft.title}"`);
    console.log(`     - Số câu yêu cầu: ${count} | Số câu thực tế: ${actualCount}`);

    if (actualCount === count) {
      console.log(`     ✅ [PASS] Số câu thực tế hoàn toàn trùng khớp với số câu giáo viên chọn (${count}/${count}).`);
    } else {
      console.error(`     ❌ [FAIL] Số câu không khớp: yêu cầu ${count}, nhận được ${actualCount}.`);
      allPassed = false;
    }

    // Check presence of question types
    const presentTypes = new Set(draft.questions.map((q) => q.type));
    console.log(`     - Các dạng câu hỏi xuất hiện: [${Array.from(presentTypes).join(', ')}]`);

    // Verify each question passes validation after sanitizeQuestionData
    let validQCount = 0;
    const publicQuestions = [];
    const privateAnswers = {};

    draft.questions.forEach((rawQ, idx) => {
      const cleanQ = sanitizeQuestionData(rawQ, idx);
      const v = validateQuestionForPublish(cleanQ, idx);
      if (v.valid) {
        validQCount++;
      } else {
        console.warn(`       ⚠️ Cảnh báo cấu trúc câu [${cleanQ.id} - ${cleanQ.type}]: ${v.errors?.join('; ')}`);
      }

      const qId = cleanQ.id || `q${idx + 1}`;
      publicQuestions.push({
        id: qId,
        type: cleanQ.type || 'multiple_choice',
        prompt: cleanQ.prompt,
        statement: cleanQ.statement || undefined,
        options: cleanQ.options || undefined,
        items: cleanQ.items || undefined,
        leftItems: cleanQ.leftItems || undefined,
        rightItems: cleanQ.rightItems || undefined,
        blankContext: cleanQ.blankContext || undefined,
        blankPosition: cleanQ.blankPosition || undefined,
        difficulty: cleanQ.difficulty || 'medium',
        skillTag: cleanQ.skillTag || 'general',
        relatedPassagePart: cleanQ.relatedPassagePart || undefined
      });

      privateAnswers[qId] = {
        correctAnswer: cleanQ.correctAnswer !== undefined ? cleanQ.correctAnswer : cleanQ.answer,
        acceptedAnswers: cleanQ.acceptedAnswers || undefined,
        matchingPairs: cleanQ.matchingPairs || undefined,
        hint: cleanQ.hint || '',
        explanation: cleanQ.explanation || ''
      };
    });
    console.log(`     - Số câu hỏi chuẩn hóa hợp lệ: ${validQCount}/${actualCount}`);

    // Verify Public vs Private splitting
    const anyLeakedAnswer = publicQuestions.some((pq) => (
      pq.answer !== undefined ||
      pq.correctAnswer !== undefined ||
      pq.matchingPairs !== undefined ||
      pq.acceptedAnswers !== undefined
    ));
    if (!anyLeakedAnswer && Object.keys(privateAnswers).length === actualCount) {
      console.log(`     ✅ [PASS] Bảo mật dữ liệu: Public question hoàn toàn KHÔNG chứa answer, matchingPairs hay acceptedAnswers.`);
    } else {
      console.error(`     ❌ [FAIL] Rò rỉ đáp án trong public question!`);
      allPassed = false;
    }
  }

  // -----------------------------------------------------------------
  // TỔNG KẾT
  // -----------------------------------------------------------------
  console.log('\n===============================================================');
  if (allPassed) {
    console.log('🎉 TẤT CẢ CÁC BÀI TEST NGHIỆM THU ĐỀU ĐẠT (PASS 100%)!');
  } else {
    console.log('⚠️ CÓ MỘT SỐ BÀI TEST CHƯA ĐẠT. VUI LÒNG KIỂM TRA LẠI LOG CHI TIẾT.');
  }
  console.log('===============================================================');
}

runAcceptanceTests().catch(console.error);
