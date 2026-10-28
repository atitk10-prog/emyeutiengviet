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

async function testGenerateLesson(modelName) {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const prompt = `Bạn là chuyên gia sư phạm tiểu học môn Tiếng Việt cho học sinh lớp 2.
Hãy tạo một bài đọc hiểu mới ngắn hoàn chỉnh bằng Tiếng Việt chuẩn GDPT 2018.
Chủ đề: "Bảo vệ môi trường". Thể loại: "Văn bản tự sự / Truyện ngắn".
Độ dài bài đọc: khoảng 120 từ.
Trả về định dạng JSON thuần dạng:
{
  "title": "Tên bài đọc",
  "passage": "Nội dung bài đọc...",
  "grade": 2,
  "topic": "Bảo vệ môi trường",
  "genre": "narrative",
  "vocabulary": [
    {"word": "từ 1", "meaning": "nghĩa 1", "example": "ví dụ 1"}
  ],
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Câu hỏi trắc nghiệm?",
      "options": ["A. Lựa chọn 1", "B. Lựa chọn 2", "C. Lựa chọn 3"],
      "answer": "A",
      "hint": "Gợi ý",
      "explanation": "Giải thích",
      "skillTag": "thong_tin_truc_tiep",
      "difficulty": "nhan_biet"
    }
  ]
}`;

  console.log(`\nCalling generateContent with model: ${modelName}...`);
  const start = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
      signal: controller.signal
    });
    clearTimeout(t);
    const duration = Date.now() - start;
    console.log(`Status: ${res.status} ${res.statusText} in ${duration}ms`);
    const text = await res.text();
    if (!res.ok) {
      console.log('Error body:', text.slice(0, 300));
      return { ok: false, status: res.status, duration, error: text.slice(0, 200) };
    }
    const data = JSON.parse(text);
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(content);
    console.log(`Generated Title: "${parsed.title}"`);
    console.log(`Passage length: ${parsed.passage?.length} chars`);
    console.log(`Questions count: ${parsed.questions?.length}`);
    return { ok: true, status: 200, duration, title: parsed.title };
  } catch (err) {
    clearTimeout(t);
    console.log('Fetch error:', err.message);
    return { ok: false, status: 0, duration: Date.now() - start, error: err.message };
  }
}

async function main() {
  console.log('--- 1. TESTING PRIMARY MODEL: gemini-3.8-flash ---');
  const res38 = await testGenerateLesson('gemini-3.8-flash');

  console.log('\n--- 2. TESTING FALLBACK MODEL: gemini-3.5-flash-lite ---');
  const res35 = await testGenerateLesson('gemini-3.5-flash-lite');

  console.log('\nSummary:');
  console.log('Primary (gemini-3.8-flash):', res38);
  console.log('Fallback (gemini-3.5-flash-lite):', res35);
}

main().catch(console.error);
