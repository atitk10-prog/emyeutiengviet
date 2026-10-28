import fs from 'node:fs';
import path from 'node:path';

function getApiKey() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'functions/.secret.local'),
    path.resolve(process.cwd(), '.secret.local')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(/GEMINI_API_KEY\s*=\s*([^\s#\r\n]+)/);
      if (m && m[1]) return m[1].replace(/["']/g, '').trim();
    }
  }
  return '';
}

const apiKey = getApiKey();

const testPrompt = `Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp 2.
Hãy tạo một bài đọc hiểu mới hoàn chỉnh bằng Tiếng Việt theo chuẩn chương trình GDPT 2018.
Chủ đề: "Bảo vệ môi trường". Thể loại: Văn bản tự sự / Truyện ngắn.
Độ dài bài đọc: khoảng 120 từ.
BẮT BUỘC trả về định dạng JSON thuần dạng:
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc...",
  "vocabulary": [
    { "word": "từ khó", "meaning": "giải nghĩa", "example": "ví dụ" }
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Câu hỏi 1?",
      "options": ["Đáp án A", "Đáp án B", "Đáp án C"],
      "answer": "A",
      "hint": "Gợi ý",
      "explanation": "Giải thích",
      "skillTag": "thong_tin_truc_tiep",
      "difficulty": "nhan_biet"
    },
    {
      "id": "q2",
      "type": "true_false",
      "prompt": "Câu hỏi 2?",
      "statement": "Nhận định đúng sai",
      "answer": true,
      "hint": "Gợi ý",
      "explanation": "Giải thích",
      "skillTag": "thong_tin_truc_tiep",
      "difficulty": "nhan_biet"
    },
    {
      "id": "q3",
      "type": "sequence",
      "prompt": "Sắp xếp thứ tự các sự việc:",
      "items": ["Sự việc 1", "Sự việc 2", "Sự việc 3"],
      "answer": ["Sự việc 1", "Sự việc 2", "Sự việc 3"],
      "hint": "Gợi ý",
      "explanation": "Giải thích",
      "skillTag": "sap_xep_trinh_tu",
      "difficulty": "thong_hieu"
    }
  ]
}`;

async function testGeneration(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();
  console.log(`\nTesting generation on model: ${model}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    const text = await res.text();
    console.log(`[${model}] Status: ${res.status}, Duration: ${duration}ms, Ok: ${res.ok}`);
    if (res.ok) {
      let json = JSON.parse(text);
      const output = json.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log(`Output parsed successfully, length: ${output?.length}`);
      const lesson = JSON.parse(output);
      console.log(`Lesson title: "${lesson.title}", passage words: ${lesson.passage?.split(' ').length}, questions: ${lesson.questions?.length}`);
      return { ok: true, duration, model, lesson };
    } else {
      console.log(`Error body:`, text.slice(0, 300));
      return { ok: false, duration, model, error: text };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`[${model}] Exception (${Date.now() - start}ms):`, err.message);
    return { ok: false, duration: Date.now() - start, model, error: err.message };
  }
}

async function main() {
  // Test gemini-3.5-flash
  const r1 = await testGeneration('gemini-3.5-flash');

  // Test gemini-3.5-flash-lite
  const r2 = await testGeneration('gemini-3.5-flash-lite');

  // Test gemini-3.8-flash
  const r3 = await testGeneration('gemini-3.8-flash');
}

main();
