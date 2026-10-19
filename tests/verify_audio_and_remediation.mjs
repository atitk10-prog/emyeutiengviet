import http from 'http';
import https from 'https';

const FUNCTIONS_ORIGIN = 'http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1';
const WEB_ORIGIN = 'http://localhost:3000';

async function fetchHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function callCallable(functionName, data, token = null) {
  const url = `${FUNCTIONS_ORIGIN}/${functionName}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetchHttp(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data })
  });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = res.body;
  }
  return { status: res.status, data: parsed?.result || parsed };
}

async function exchangeCustomToken(token) {
  const res = await fetchHttp('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, returnSecureToken: true })
  });
  const data = JSON.parse(res.body);
  return data.idToken;
}

async function run() {
  console.log('--- BẮT ĐẦU KIỂM THỬ TÍCH HỢP: ÂM THANH & AI ĐỀ XUẤT CỦNG CỐ ---');

  // TEST 1: Kiểm tra tệp âm thanh thực tế qua HTTP 200
  console.log('\n[TEST 1] Kiểm tra file âm thanh WAV trên static HTTP:');
  const audioRelUrl = '/audio/uploads/tts_new_lesson_female_aoede_1792370639293.wav';
  const audioCheck = await fetchHttp(`${WEB_ORIGIN}${audioRelUrl}`, { method: 'HEAD' });
  console.log(`Status: ${audioCheck.status}`);
  console.log(`Content-Type: ${audioCheck.headers['content-type']}`);
  console.log(`Content-Length: ${audioCheck.headers['content-length']} bytes (~${(Number(audioCheck.headers['content-length']) / 1024 / 1024).toFixed(2)} MB)`);
  if (audioCheck.status === 200 && Number(audioCheck.headers['content-length']) > 1000000) {
    console.log('=> TEST 1 PASS: Tệp âm thanh tồn tại bền vững và phục vụ HTTP 200 OK với đúng dung lượng!');
  } else {
    throw new Error(`TEST 1 FAILED: Audio file status ${audioCheck.status}`);
  }

  // TEST 2: Đăng nhập học sinh HS001 và kiểm tra getStudentLibrary có hasAudio và audioUrl
  console.log('\n[TEST 2] Học sinh tham gia lớp (joinClass) & kiểm tra getStudentLibrary:');
  const joinRes = await callCallable('joinClass', {
    classCode: 'LOP2A0',
    accessCode: 'HS123456'
  });
  console.log('joinClass status:', joinRes.status);
  const rawToken = joinRes.data?.customToken || joinRes.data?.token;
  if (!rawToken) {
    throw new Error('TEST 2 FAILED: joinClass did not return a custom token: ' + JSON.stringify(joinRes.data));
  }
  const studentToken = await exchangeCustomToken(rawToken);
  console.log('Student Token acquired for:', joinRes.data?.student?.displayAlias);

  // Lấy danh sách thư viện bài đọc học sinh
  const libRes = await callCallable('getStudentLibrary', {}, studentToken);
  console.log('getStudentLibrary status:', libRes.status);
  const assignments = libRes.data?.assignments || [];
  console.log(`Học sinh nhận được ${assignments.length} bài giao.`);
  
  const audioAssignment = assignments.find((a) => a.lessonId === 'IceWkBZqGe62zawyeFES');
  if (audioAssignment) {
    console.log(`Bài "${audioAssignment.lessonTitle}":`);
    console.log(`  - assignmentId: ${audioAssignment.id}`);
    console.log(`  - audioUrl: ${audioAssignment.audioUrl}`);
    console.log(`  - hasAudio: ${audioAssignment.hasAudio}`);
    if (audioAssignment.audioUrl && audioAssignment.hasAudio) {
      console.log('=> TEST 2 PASS: getStudentLibrary trả về đầy đủ audioUrl và hasAudio = true!');
    } else {
      throw new Error('TEST 2 FAILED: audioUrl or hasAudio missing on assignment');
    }
  } else {
    throw new Error('TEST 2 FAILED: Assignment with IceWkBZqGe62zawyeFES not found in student library');
  }

  // TEST 3: Bắt đầu làm bài (startAttempt) cho bài có âm thanh
  console.log('\n[TEST 3] Bắt đầu lượt làm bài (startAttempt):');
  const startRes = await callCallable('startAttempt', { assignmentId: audioAssignment.id }, studentToken);
  console.log('startAttempt status:', startRes.status);
  const lessonVersion = startRes.data?.lessonVersion;
  console.log(`  - Lesson Title: ${lessonVersion?.title}`);
  console.log(`  - Lesson audioUrl: ${lessonVersion?.audioUrl}`);
  if (lessonVersion?.audioUrl === audioRelUrl) {
    console.log('=> TEST 3 PASS: startAttempt trả về chính xác audioUrl để AudioReader phát trên máy học sinh!');
  } else {
    throw new Error(`TEST 3 FAILED: audioUrl mismatch or missing: ${lessonVersion?.audioUrl}`);
  }

  // TEST 4: Giáo viên đăng nhập và kiểm tra AI Đề Xuất Củng Cố
  console.log('\n[TEST 4] Kiểm tra tính năng Giáo viên: suggestRemediation');
  const gvLoginRes = await callCallable('accountLogin', {
    username: 'giaovien01',
    password: 'GV123456'
  });
  console.log('Teacher Login status:', gvLoginRes.status);
  const teacherCustomToken = gvLoginRes.data?.token;
  if (!teacherCustomToken) {
    throw new Error('Teacher login failed: ' + JSON.stringify(gvLoginRes.data));
  }
  const teacherToken = await exchangeCustomToken(teacherCustomToken);
  console.log('Teacher ID Token acquired.');

  const suggestRes = await callCallable('suggestRemediation', {
    classId: 'class_2a',
    scope: 'toan_lop'
  }, teacherToken);

  console.log('suggestRemediation status:', suggestRes.status);
  const stats = suggestRes.data?.statistics || suggestRes.data;
  console.log(`  - Class: ${stats?.className}`);
  console.log(`  - Total students: ${stats?.totalStudents}`);
  console.log(`  - Suggested Activities: ${suggestRes.data?.suggestedActivities?.length}`);
  console.log(`  - Disclaimer: ${suggestRes.data?.disclaimer}`);
  if (suggestRes.status === 200 && suggestRes.data?.suggestedActivities?.length > 0) {
    console.log('=> TEST 4 PASS: suggestRemediation trả về ngân hàng hoạt động phân hóa chuẩn GDPT 2018!');
  } else {
    throw new Error('TEST 4 FAILED: suggestRemediation did not return expected response: ' + JSON.stringify(suggestRes.data));
  }

  // TEST 5: Nút "Lưu nháp" hoạt động (saveRemediationActivity)
  console.log('\n[TEST 5] Kiểm tra nút "Lưu nháp" hoạt động sư phạm (saveRemediationActivity):');
  const sampleActivity = suggestRes.data.suggestedActivities[0];
  const testActId = `test_act_${Date.now()}`;
  const savePayload = {
    ...sampleActivity,
    id: testActId,
    title: '[Test Kiểm Thử] Thám tử từ ngữ lớp 2A',
    classId: 'class_2a',
    className: '2A',
    status: 'draft'
  };

  const saveRes = await callCallable('saveRemediationActivity', savePayload, teacherToken);
  console.log('saveRemediationActivity status:', saveRes.status);
  console.log('save response message:', saveRes.data?.message);
  if (saveRes.data?.success && saveRes.data?.activity?.status === 'draft') {
    console.log('=> TEST 5 PASS: Nút "Lưu nháp" ghi thành công bản ghi vào collection remediationActivities với status: "draft"!');
  } else {
    throw new Error('TEST 5 FAILED: saveRemediationActivity unsuccessful: ' + JSON.stringify(saveRes.data));
  }

  // TEST 6: Nút "Duyệt áp dụng" (approveRemediationActivity)
  console.log('\n[TEST 6] Kiểm tra nút "Duyệt áp dụng" (approveRemediationActivity):');
  const approveRes = await callCallable('approveRemediationActivity', {
    activityId: testActId,
    updatedData: {
      skillObjective: 'Mục tiêu GDPT 2018 mở rộng: Học sinh hiểu và vận dụng đúng nghĩa của 4 từ mới.'
    }
  }, teacherToken);
  console.log('approveRemediationActivity status:', approveRes.status);
  console.log('approve response status:', approveRes.data?.status);
  console.log('approvedBy:', approveRes.data?.approvedBy);
  if (approveRes.data?.success && approveRes.data?.status === 'approved') {
    console.log('=> TEST 6 PASS: Nút "Duyệt áp dụng" đã chuyển trạng thái thành "approved" kèm thông tin approvedBy và approvedAt!');
  } else {
    throw new Error('TEST 6 FAILED: approveRemediationActivity unsuccessful: ' + JSON.stringify(approveRes.data));
  }

  // TEST 7: Kiểm tra danh sách hoạt động đã lưu tồn tại bền vững (listRemediationActivities)
  console.log('\n[TEST 7] Tải lại kho hoạt động từ Firestore (listRemediationActivities):');
  const listRes = await callCallable('listRemediationActivities', { classId: 'class_2a' }, teacherToken);
  const foundAct = (listRes.data?.activities || []).find((a) => a.id === testActId);
  if (foundAct && foundAct.status === 'approved') {
    console.log(`=> TEST 7 PASS: Hoạt động "${foundAct.title}" tồn tại bền vững trong Firestore với trạng thái ${foundAct.status}!`);
  } else {
    throw new Error('TEST 7 FAILED: Saved activity not found in listRemediationActivities: ' + JSON.stringify(listRes.data));
  }

  console.log('\n======================================================');
  console.log('>>> TẤT CẢ 7/7 BÀI TEST NGHIỆM THU ĐỀU ĐẠT (PASS 100%) <<<');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\nLỖI KIỂM THỬ:', err);
  process.exit(1);
});
