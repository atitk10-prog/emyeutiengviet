import fetch from 'node-fetch';
import fs from 'fs';

let teacherPass = '';
if (fs.existsSync('.secret.local')) {
  const secretContent = fs.readFileSync('.secret.local', 'utf8');
  for (const line of secretContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('TEACHER_PASSWORD=')) {
      teacherPass = trimmed.replace('TEACHER_PASSWORD=', '').trim();
    }
  }
}

const API_KEY = 'AIzaSyDhx3ubazUjmaaNdhmXSD3uDhVD1s0fHCk';
const BASE_URL = 'https://emyeutiengviet-zeta.vercel.app';

async function exchangeCustomToken(customToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) throw new Error('Failed to exchange custom token: ' + JSON.stringify(data));
  return data.idToken;
}

async function loginUser(username, password) {
  const loginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username, password } })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) {
    throw new Error(`Login failed for ${username}: ` + JSON.stringify(loginData));
  }
  const idToken = await exchangeCustomToken(loginData.data.token);
  return { idToken, user: loginData.data.user };
}

async function run() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ THỰC TẾ GEMINI AI TRÊN PRODUCTION (VERCEL + GOOGLE AI)   ');
  console.log('========================================================================\n');

  // 1. Đăng nhập Giáo viên
  console.log('[1/3] Đăng nhập tài khoản giáo viên giaovien01...');
  const teacher = await loginUser('giaovien01', teacherPass);
  console.log(`✓ Đăng nhập thành công: UID=${teacher.user.uid}, DisplayName=${teacher.user.displayName}`);

  // 2. Kiểm tra kết nối AI (Test AI Connection)
  console.log('\n[2/3] Kiểm tra kết nối Gemini AI (testAIConnection)...');
  const pingStart = Date.now();
  const testRes = await fetch(`${BASE_URL}/api/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({ action: 'testAIConnection', data: {} })
  });
  const pingDuration = Date.now() - pingStart;
  const testData = await testRes.json();
  console.log(`HTTP Status: ${testRes.status}, Tổng thời gian phản hồi: ${pingDuration}ms`);
  console.log('Response body:', JSON.stringify(testData, null, 2));

  if (!testData.success) {
    throw new Error('testAIConnection thất bại: ' + JSON.stringify(testData));
  }
  console.log(`✓ Kết nối AI thành công! Model: ${testData.data?.status?.activeModel}, Độ trễ Google: ${testData.data?.status?.lastLatencyMs}ms`);

  // 3. Tạo bài đọc hiểu và câu hỏi với AI (generateLessonDraft)
  console.log('\n[3/3] Tạo bài đọc hiểu hoàn chỉnh bằng Gemini AI (generateLessonDraft)...');
  const genPayload = {
    grade: 2,
    semester: 1,
    week: 1,
    topic: 'Tình bạn tuổi thơ dưới mái trường',
    genre: 'narrative',
    targetWordCount: 140,
    readingGoal: 'Nhận biết các chi tiết về tình bạn gắn bó, hiểu nghĩa từ trong ngữ cảnh',
    difficulty: 'thong_hieu',
    questionCount: 5,
    questionTypes: ['multiple_choice', 'true_false', 'sequence']
  };

  const genStart = Date.now();
  const genRes = await fetch(`${BASE_URL}/api/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({ action: 'generateLessonDraft', data: genPayload })
  });
  const genDuration = Date.now() - genStart;
  const genData = await genRes.json();
  console.log(`HTTP Status: ${genRes.status}, Thời gian phản hồi tổng: ${genDuration}ms`);

  if (!genData.success) {
    throw new Error('generateLessonDraft thất bại: ' + JSON.stringify(genData));
  }

  const draft = genData.data.draft;
  console.log('\n--- KẾT QUẢ SINH BÀI ĐỌC TỪ GEMINI AI THẬT ---');
  console.log(`Tên bài: "${draft.title}"`);
  console.log(`Số từ bài đọc: ${draft.passage?.split(/\s+/).length} từ`);
  console.log(`Đoạn trích: "${draft.passage?.slice(0, 150)}..."`);
  console.log(`Số từ vựng giải nghĩa: ${draft.vocabulary?.length || 0}`);
  draft.vocabulary?.forEach((v, i) => {
    console.log(`   ${i + 1}. [${v.word}]: ${v.meaning}`);
  });
  console.log(`Số câu hỏi sinh ra: ${draft.questions?.length || 0}`);
  draft.questions?.forEach((q, i) => {
    console.log(`   Câu ${i + 1} (${q.type}): "${q.prompt || q.statement}"`);
    console.log(`      -> Đáp án server: ${JSON.stringify(q.answer)}`);
    console.log(`      -> Gợi ý: "${q.hint}"`);
  });

  console.log(`\nModel AI sử dụng: ${genData.data.model}`);
  console.log(`Thời gian xử lý tại backend AI: ${genData.data.latencyMs}ms`);
  console.log(`Fallback sử dụng: ${genData.data.fallbackUsed ? 'Có' : 'Không (Primary model phản hồi trực tiếp)'}`);

  console.log('\n========================================================================');
  console.log('   TẤT CẢ CÁC BƯỚC KIỂM THỬ GEMINI AI PRODUCTION ĐỀU PASS 100%!');
  console.log('========================================================================');
}

run().catch(err => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
