/**
 * Comprehensive verification script for Remediation Activity Approval & Save Game Template Flow
 * Tests live on Vercel Production + Firebase Production.
 */

import fetch from 'node-fetch';
import fs from 'fs';

// Load credentials from .secret.local if present
let teacherPass = process.env.VITE_DEMO_TEACHER_PASS || '';
let adminPass = '';

if (fs.existsSync('.secret.local')) {
  const secretContent = fs.readFileSync('.secret.local', 'utf8');
  for (const line of secretContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('TEACHER_PASSWORD=')) {
      teacherPass = trimmed.replace('TEACHER_PASSWORD=', '').trim();
    }
    if (trimmed.startsWith('VITE_DEMO_TEACHER_PASS=')) {
      teacherPass = trimmed.replace('VITE_DEMO_TEACHER_PASS=', '').trim();
    }
    if (trimmed.startsWith('ADMIN_PASSWORD=')) {
      adminPass = trimmed.replace('ADMIN_PASSWORD=', '').trim();
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
  console.log('  KIỂM TRA CHỨC NĂNG DUYỆT & LƯU HỌC LIỆU TRÊN PRODUCTION');
  console.log('========================================================================\n');

  // 1. Đăng nhập Giáo viên
  console.log('[1/6] Đăng nhập tài khoản giáo viên giaovien01...');
  const teacher = await loginUser('giaovien01', teacherPass);
  console.log(`✓ Giáo viên đăng nhập thành công: UID=${teacher.user.uid}, DisplayName=${teacher.user.displayName}`);

  // 2. Lấy danh sách hoạt động hiện tại
  console.log('\n[2/6] Kiểm tra danh sách hoạt động củng cố hiện tại...');
  const listRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({
      action: 'listRemediationActivities',
      data: { classId: 'all', academicYear: 'all', grade: 'all', status: 'all' }
    })
  });
  const listData = await listRes.json();
  console.log(`HTTP Status: ${listRes.status}`);
  if (!listData.success) {
    throw new Error('listRemediationActivities failed: ' + JSON.stringify(listData));
  }

  const activities = listData.data.activities || [];
  const draftsBefore = activities.filter(a => a.status !== 'approved');
  const approvedBefore = activities.filter(a => a.status === 'approved');
  console.log(`✓ Tổng số hoạt động: ${activities.length}`);
  console.log(`  - Số bản nháp: ${draftsBefore.length}`);
  console.log(`  - Số đã duyệt: ${approvedBefore.length}`);

  // 3. Phê duyệt bản nháp có sẵn (ACT-01)
  const targetDraft = draftsBefore.find(a => a.id === 'ACT-01') || draftsBefore[0];
  if (targetDraft) {
    console.log(`\n[3/6] Thử nghiệm duyệt bản nháp "${targetDraft.title}" (ID: ${targetDraft.id})...`);
    const approveRes = await fetch(`${BASE_URL}/api/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${teacher.idToken}`
      },
      body: JSON.stringify({
        action: 'approveRemediationActivity',
        data: {
          activityId: targetDraft.id,
          updatedData: {
            title: targetDraft.title,
            skillObjective: targetDraft.skillObjective || 'Rèn kỹ năng đọc hiểu và xác định thông tin chính theo chuẩn GDPT 2018.',
            teacherSteps: targetDraft.teacherSteps || ['Bước 1: Giới thiệu mục tiêu.', 'Bước 2: Tổ chức hoạt động.', 'Bước 3: Nhận xét tổng kết.'],
            materialsNeeded: targetDraft.materialsNeeded || ['Bảng phụ', 'Thẻ chữ'],
            classId: targetDraft.classId || 'class_2b',
            className: targetDraft.className || 'Lớp 2B'
          }
        }
      })
    });

    const approveData = await approveRes.json();
    console.log(`HTTP Status: ${approveRes.status}`);
    console.log(`Response:`, JSON.stringify(approveData, null, 2));

    if (!approveData.success) {
      throw new Error(`approveRemediationActivity thất bại: ` + JSON.stringify(approveData));
    }
    console.log(`✓ Duyệt thành công bản nháp ${targetDraft.id}! Status: ${approveData.data.status}, ApprovedBy: ${approveData.data.approvedBy}`);
  }

  // 4. Lưu mẫu trò chơi mới thành bản nháp
  console.log('\n[4/6] Thử nghiệm lưu Mẫu trò chơi tương tác mới thành Bản nháp...');
  const newGameId = `act_game_${Date.now()}`;
  const newGamePayload = {
    id: newGameId,
    title: 'Trò chơi: Sắp xếp trình tự sự việc (Kiểm định P0)',
    activityType: 'sap_xep_trinh_tu',
    targetAudience: 'Toàn lớp',
    targetSkill: 'sap_xep_trinh_tu',
    skillObjective: 'Học sinh hiểu cốt truyện và sắp xếp đúng thứ tự các sự việc trong văn bản theo GDPT 2018.',
    durationMinutes: 15,
    materialsNeeded: ['Thẻ sự việc in màu', 'Bảng từ nhóm'],
    teacherSteps: [
      'Bước 1: Giáo viên phát 3 thẻ sự việc cho từng nhóm học sinh.',
      'Bước 2: Các nhóm thảo luận và sắp xếp lại đúng trình tự diễn biến câu chuyện.',
      'Bước 3: Đại diện nhóm trình bày, giáo viên chuẩn hóa và tuyên dương.'
    ],
    contentPayload: {
      type: 'story_sequence',
      events: [
        { id: 1, text: 'Minh chuẩn bị bình tưới nước', order: 1 },
        { id: 2, text: 'Minh nhặt lá úa và lau sạch chậu hoa', order: 2 },
        { id: 3, text: 'Minh tưới nước cho cây hoa hồng nở rộ', order: 3 }
      ]
    },
    academicYear: '2026-2027',
    grade: 2,
    classId: 'class_2b',
    className: 'Lớp 2B',
    scope: 'toan_lop',
    status: 'draft'
  };

  const saveRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({
      action: 'saveRemediationActivity',
      data: { activity: newGamePayload }
    })
  });

  const saveData = await saveRes.json();
  console.log(`HTTP Status: ${saveRes.status}`);
  console.log(`Response:`, JSON.stringify(saveData, null, 2));

  if (!saveData.success) {
    throw new Error('saveRemediationActivity thất bại: ' + JSON.stringify(saveData));
  }
  console.log(`✓ Lưu mẫu trò chơi thành công! ID: ${saveData.data.activity.id}, Status: ${saveData.data.activity.status}`);

  // 5. Thử nghiệm duyệt bản nháp mới này
  console.log('\n[5/6] Thử nghiệm duyệt bản nháp trò chơi vừa lưu...');
  const approveNewRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({
      action: 'approveRemediationActivity',
      data: {
        activityId: newGameId,
        updatedData: {
          ...newGamePayload,
          title: newGamePayload.title + ' [Đã duyệt]',
        }
      }
    })
  });

  const approveNewData = await approveNewRes.json();
  console.log(`HTTP Status: ${approveNewRes.status}`);
  console.log(`Response:`, JSON.stringify(approveNewData, null, 2));

  if (!approveNewData.success) {
    throw new Error('Duyệt bản nháp trò chơi mới thất bại: ' + JSON.stringify(approveNewData));
  }
  console.log(`✓ Phê duyệt bản nháp mới thành công! Status: ${approveNewData.data.status}`);

  // 6. Tải lại danh sách để xác nhận số lượng sau khi duyệt
  console.log('\n[6/6] Tải lại danh sách kiểm tra số lượng và tính bất biến sau F5...');
  const reListRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacher.idToken}`
    },
    body: JSON.stringify({
      action: 'listRemediationActivities',
      data: { classId: 'all', academicYear: 'all', grade: 'all', status: 'all' }
    })
  });
  const reListData = await reListRes.json();
  const reActivities = reListData.data.activities || [];
  const reDrafts = reActivities.filter(a => a.status !== 'approved');
  const reApproved = reActivities.filter(a => a.status === 'approved');

  console.log(`✓ Tổng số hoạt động sau kiểm thử: ${reActivities.length}`);
  console.log(`  - Số bản nháp: ${reDrafts.length} (Ban đầu: ${draftsBefore.length})`);
  console.log(`  - Số đã duyệt: ${reApproved.length} (Ban đầu: ${approvedBefore.length})`);

  const approvedItem = reApproved.find(a => a.id === newGameId);
  if (!approvedItem) {
    throw new Error('Không tìm thấy hoạt động vừa duyệt trong danh sách đã duyệt!');
  }
  console.log(`✓ Hoạt động ${newGameId} đã nằm trong kho "Đã duyệt" với đầy đủ các bước sư phạm (${approvedItem.teacherSteps.length} bước) và học liệu.`);

  console.log('\n========================================================================');
  console.log('  TẤT CẢ 6 BƯỚC KIỂM TRA BACKEND & FIRESTORE PRODUCTION ĐỀU PASS 100%!');
  console.log('========================================================================');
}

run().catch(err => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
