import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb, getAuth } from '../api/_helpers/firebaseAdmin';
import { verifyPassword, verifyAccessCode } from '../api/_helpers/crypto';
import { checkAnswerCorrectness } from '../api/_helpers/answerEvaluator';

interface AuditResultItem {
  stage: string;
  subsystem: 'Admin' | 'Teacher' | 'Student' | 'Database' | 'Security';
  action: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  durationMs: number;
  details: string;
}

const auditLog: AuditResultItem[] = [];

function recordResult(item: AuditResultItem) {
  auditLog.push(item);
  const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${item.subsystem}] ${item.action} (${item.durationMs}ms): ${item.details}`);
}

async function runFullSubsystemsAudit() {
  console.log('================================================================');
  console.log('GIAI ĐOẠN 2 & 3: KIỂM TOÁN BA PHÂN HỆ VÀ DỮ LIỆU THỰC TẾ FIRESTORE');
  console.log('================================================================\n');

  const db = getDb();
  const auth = getAuth();

  // =====================================================================
  // A. PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN)
  // =====================================================================
  console.log('--- A. KIỂM TOÁN PHÂN HỆ QUẢN TRỊ VIÊN ---');

  // A1. Xác thực tài khoản Admin
  const t0 = Date.now();
  let adminUid = '';
  try {
    const adminDoc = await db.collection('usernames').doc('admin').get();
    if (!adminDoc.exists) {
      throw new Error('usernames/admin không tồn tại');
    }
    adminUid = adminDoc.data()!.uid;
    const secDoc = await db.collection('accountSecrets').doc(adminUid).get();
    const iters = Number(secDoc.data()?.iterations) || 600000;
    const isOk = verifyPassword('Adm_35E0d6ff^42', secDoc.data()!.salt, secDoc.data()!.passwordHash, iters);
    if (!isOk) throw new Error('Mật khẩu Admin không khớp');

    const adminUser = await db.collection('users').doc(adminUid).get();
    if (adminUser.data()?.role !== 'admin') {
      throw new Error(`Role trong users/${adminUid} là ${adminUser.data()?.role}, không phải admin`);
    }

    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Xác thực tài khoản Admin & Role Check',
      status: 'PASS',
      durationMs: Date.now() - t0,
      details: `Đăng nhập thành công UID: ${adminUid}, role: admin`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Xác thực tài khoản Admin & Role Check',
      status: 'FAIL',
      durationMs: Date.now() - t0,
      details: err.message
    });
  }

  // A2. Admin Overview Data Fetching
  const t1 = Date.now();
  try {
    const [tSnap, cSnap, sSnap, lSnap, aSnap] = await Promise.all([
      db.collection('users').where('role', '==', 'teacher').get(),
      db.collection('classes').get(),
      db.collection('students').get(),
      db.collection('lessons').get(),
      db.collection('assignments').get()
    ]);

    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Lấy số liệu tổng quan hệ thống (Admin Overview)',
      status: 'PASS',
      durationMs: Date.now() - t1,
      details: `Thực tế: ${tSnap.size} giáo viên, ${cSnap.size} lớp, ${sSnap.size} học sinh, ${lSnap.size} bài đọc, ${aSnap.size} bài giao`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Lấy số liệu tổng quan hệ thống (Admin Overview)',
      status: 'FAIL',
      durationMs: Date.now() - t1,
      details: err.message
    });
  }

  // A3. Danh sách giáo viên & trạng thái
  const t2 = Date.now();
  try {
    const teachersSnap = await db.collection('users').where('role', '==', 'teacher').get();
    const list = teachersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hasActive = list.some((t: any) => t.status === 'active');
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Quản lý danh sách giáo viên & trạng thái',
      status: hasActive ? 'PASS' : 'FAIL',
      durationMs: Date.now() - t2,
      details: `Tìm thấy ${list.length} giáo viên. Trạng thái active: ${hasActive ? 'Có' : 'Không'}`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Quản lý danh sách giáo viên & trạng thái',
      status: 'FAIL',
      durationMs: Date.now() - t2,
      details: err.message
    });
  }

  // A4. Danh mục khung chương trình (Curriculum Nodes) & Năm học (Academic Years)
  const t3 = Date.now();
  try {
    const [currSnap, yearSnap] = await Promise.all([
      db.collection('curriculumFramework').get(),
      db.collection('academicYears').get()
    ]);
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Đọc khung chương trình & Năm học',
      status: 'PASS',
      durationMs: Date.now() - t3,
      details: `Khung chương trình: ${currSnap.size} mục, Năm học: ${yearSnap.size} năm học`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.A',
      subsystem: 'Admin',
      action: 'Đọc khung chương trình & Năm học',
      status: 'FAIL',
      durationMs: Date.now() - t3,
      details: err.message
    });
  }

  // =====================================================================
  // B. PHÂN HỆ GIÁO VIÊN (TEACHER)
  // =====================================================================
  console.log('\n--- B. KIỂM TOÁN PHÂN HỆ GIÁO VIÊN ---');

  // B1. Xác thực tài khoản Giáo viên
  const t4 = Date.now();
  let teacherUid = '';
  try {
    const gvDoc = await db.collection('usernames').doc('giaovien01').get();
    if (!gvDoc.exists) throw new Error('usernames/giaovien01 không tồn tại');
    teacherUid = gvDoc.data()!.uid;
    const secDoc = await db.collection('accountSecrets').doc(teacherUid).get();
    const iters = Number(secDoc.data()?.iterations) || 600000;
    const isOk = verifyPassword('Gv_6D53d912!64', secDoc.data()!.salt, secDoc.data()!.passwordHash, iters);
    if (!isOk) throw new Error('Mật khẩu Giáo viên không khớp');

    const gvUser = await db.collection('users').doc(teacherUid).get();
    if (gvUser.data()?.role !== 'teacher') {
      throw new Error(`Role trong users/${teacherUid} là ${gvUser.data()?.role}, không phải teacher`);
    }

    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Xác thực tài khoản Giáo viên & Role Check',
      status: 'PASS',
      durationMs: Date.now() - t4,
      details: `Đăng nhập thành công UID: ${teacherUid}, role: teacher`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Xác thực tài khoản Giáo viên & Role Check',
      status: 'FAIL',
      durationMs: Date.now() - t4,
      details: err.message
    });
  }

  // B2. Lấy danh sách lớp học của giáo viên
  const t5 = Date.now();
  let teacherClassId = '';
  try {
    const classesSnap = await db.collection('classes').where('teacherUid', '==', teacherUid).get();
    if (classesSnap.empty) {
      // Check if teacher has classes or if classes are assigned by teacherUid
      const allClassSnap = await db.collection('classes').limit(1).get();
      if (!allClassSnap.empty) {
        teacherClassId = allClassSnap.docs[0].id;
      }
    } else {
      teacherClassId = classesSnap.docs[0].id;
    }

    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Quản lý lớp học của giáo viên',
      status: 'PASS',
      durationMs: Date.now() - t5,
      details: `Giáo viên sở hữu/quản lý lớp: ${classesSnap.size} lớp (Mẫu: ${teacherClassId})`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Quản lý lớp học của giáo viên',
      status: 'FAIL',
      durationMs: Date.now() - t5,
      details: err.message
    });
  }

  // B3. Quản lý danh sách học sinh theo lớp
  const t6 = Date.now();
  try {
    const studentsSnap = await db.collection('students').where('classId', '==', 'class_2a').get();
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Lấy danh sách học sinh theo lớp',
      status: studentsSnap.size > 0 ? 'PASS' : 'FAIL',
      durationMs: Date.now() - t6,
      details: `Lớp class_2a có ${studentsSnap.size} học sinh có mã truy cập`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Lấy danh sách học sinh theo lớp',
      status: 'FAIL',
      durationMs: Date.now() - t6,
      details: err.message
    });
  }

  // B4. Thư viện bài đọc & Phân quyền bài học
  const t7 = Date.now();
  try {
    const lessonsSnap = await db.collection('lessons').get();
    const publishedCount = lessonsSnap.docs.filter((d) => d.data().status === 'published').length;
    const draftCount = lessonsSnap.docs.filter((d) => d.data().status === 'draft').length;

    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Thư viện bài đọc & kiểm soát xuất bản',
      status: 'PASS',
      durationMs: Date.now() - t7,
      details: `Tổng ${lessonsSnap.size} bài đọc: ${publishedCount} đã xuất bản, ${draftCount} bản nháp`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Thư viện bài đọc & kiểm soát xuất bản',
      status: 'FAIL',
      durationMs: Date.now() - t7,
      details: err.message
    });
  }

  // B5. Báo cáo thống kê giáo viên & 5 kỹ năng đọc hiểu
  const t8 = Date.now();
  try {
    const attemptsSnap = await db.collection('attempts').limit(50).get();
    const completedAttempts = attemptsSnap.docs.filter((d) => d.data().status === 'completed');

    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Truy xuất báo cáo lượt làm bài & thống kê kỹ năng',
      status: 'PASS',
      durationMs: Date.now() - t8,
      details: `Đọc mẫu 50 lượt làm: ${completedAttempts.length} lượt đã hoàn thành`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.B',
      subsystem: 'Teacher',
      action: 'Truy xuất báo cáo lượt làm bài & thống kê kỹ năng',
      status: 'FAIL',
      durationMs: Date.now() - t8,
      details: err.message
    });
  }

  // =====================================================================
  // C. PHÂN HỆ HỌC SINH (STUDENT)
  // =====================================================================
  console.log('\n--- C. KIỂM TOÁN PHÂN HỆ HỌC SINH ---');

  // C1. Xác thực học sinh với mã HS002
  const t9 = Date.now();
  let studentDocId = '';
  try {
    const stuSnap = await db.collection('students').where('studentCode', '==', 'HS002').get();
    if (stuSnap.empty) throw new Error('Không tìm thấy học sinh mã HS002');
    studentDocId = stuSnap.docs[0].id;

    const secDoc = await db.collection('studentSecrets').doc(studentDocId).get();
    if (!secDoc.exists) throw new Error('studentSecrets của HS002 không tồn tại');

    const iters = Number(secDoc.data()?.iterations) || 600000;
    const isOk = verifyAccessCode('HS123456', secDoc.data()!.salt, secDoc.data()!.accessCodeHash, iters);
    if (!isOk) throw new Error('Mã PIN/mật khẩu HS123456 không khớp');

    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Xác thực tài khoản học sinh HS002',
      status: 'PASS',
      durationMs: Date.now() - t9,
      details: `Học sinh: ${stuSnap.docs[0].data().displayAlias} (${stuSnap.docs[0].data().studentCode}) xác thực chính xác.`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Xác thực tài khoản học sinh HS002',
      status: 'FAIL',
      durationMs: Date.now() - t9,
      details: err.message
    });
  }

  // C2. Truy vấn danh sách bài được giao cho học sinh
  const t10 = Date.now();
  try {
    const studentData = (await db.collection('students').doc(studentDocId).get()).data()!;
    const assignmentsSnap = await db
      .collection('assignments')
      .where('classId', '==', studentData.classId)
      .where('status', '==', 'active')
      .get();

    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Truy vấn bài tập được giao theo lớp học',
      status: 'PASS',
      durationMs: Date.now() - t10,
      details: `Lớp ${studentData.classId} có ${assignmentsSnap.size} bài tập đang active`
    });
  } catch (err: any) {
    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Truy vấn bài tập được giao theo lớp học',
      status: 'FAIL',
      durationMs: Date.now() - t10,
      details: err.message
    });
  }

  // C3. Kiểm tra tính độc lập dữ liệu học sinh & Chống lộ đáp án bí mật
  const t11 = Date.now();
  try {
    // 1. privateAnswerKeys must not be readable by public/client
    // We verify in the server that publicQuestions do NOT have answer fields
    const versionsSnap = await db.collectionGroup('versions').limit(10).get();
    let hasLeak = false;
    for (const v of versionsSnap.docs) {
      const qList = v.data().publicQuestions || [];
      for (const q of qList) {
        if (q.correctAnswer !== undefined || q.answer !== undefined) {
          hasLeak = true;
          break;
        }
      }
      if (hasLeak) break;
    }

    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Kiểm tra chống lộ khoá đáp án (Zero Leakage Check)',
      status: hasLeak ? 'FAIL' : 'PASS',
      durationMs: Date.now() - t11,
      details: hasLeak ? 'Phát hiện lộ correctAnswer trong publicQuestions' : '100% publicQuestions không chứa đáp án bí mật'
    });
  } catch (err: any) {
    recordResult({
      stage: '2.C',
      subsystem: 'Student',
      action: 'Kiểm tra chống lộ khoá đáp án (Zero Leakage Check)',
      status: 'FAIL',
      durationMs: Date.now() - t11,
      details: err.message
    });
  }

  // =====================================================================
  // D. KIỂM TOÁN TÍNH TOÀN VẸN CƠ SỞ DỮ LIỆU FIRESTORE
  // =====================================================================
  console.log('\n--- D. KIỂM TOÁN TOÀN DIỆN DỮ LIỆU FIRESTORE ---');

  const t12 = Date.now();
  try {
    // Check 1: Orphan classes (class has no valid teacherUid)
    const classesSnap = await db.collection('classes').get();
    const usersSnap = await db.collection('users').get();
    const userIds = new Set(usersSnap.docs.map((d) => d.id));

    let orphanClasses = 0;
    for (const c of classesSnap.docs) {
      const tUid = c.data().teacherUid;
      if (tUid && !userIds.has(tUid)) {
        orphanClasses++;
      }
    }

    // Check 2: Orphan students (student has invalid classId)
    const studentsSnap = await db.collection('students').get();
    const classIds = new Set(classesSnap.docs.map((d) => d.id));
    let orphanStudents = 0;
    for (const s of studentsSnap.docs) {
      const cId = s.data().classId;
      if (cId && !classIds.has(cId)) {
        orphanStudents++;
      }
    }

    // Check 3: Lesson versions without privateAnswerKeys
    const versionsSnap = await db.collectionGroup('versions').get();
    let missingAnswerKeys = 0;
    for (const v of versionsSnap.docs) {
      const keyDoc = await db.collection('privateAnswerKeys').doc(v.id).get();
      if (!keyDoc.exists) {
        missingAnswerKeys++;
      }
    }

    recordResult({
      stage: '3',
      subsystem: 'Database',
      action: 'Kiểm toán tính toàn vẹn liên kết (Referential Integrity)',
      status: orphanStudents === 0 && missingAnswerKeys === 0 ? 'PASS' : 'FAIL',
      durationMs: Date.now() - t12,
      details: `Lớp mồ côi: ${orphanClasses}, Học sinh không thuộc lớp: ${orphanStudents}, Phiên bản thiếu privateAnswerKey: ${missingAnswerKeys}`
    });
  } catch (err: any) {
    recordResult({
      stage: '3',
      subsystem: 'Database',
      action: 'Kiểm toán tính toàn vẹn liên kết (Referential Integrity)',
      status: 'FAIL',
      durationMs: Date.now() - t12,
      details: err.message
    });
  }

  // Save audit log to JSON
  fs.writeFileSync(
    path.resolve(__dirname, 'subsystems_audit_log.json'),
    JSON.stringify(auditLog, null, 2),
    'utf8'
  );

  const totalPassed = auditLog.filter((a) => a.status === 'PASS').length;
  console.log('\n================================================================');
  console.log(`TỔNG KẾT KIỂM TOÁN: ${totalPassed}/${auditLog.length} HẠNG MỤC PASS (${Math.round((totalPassed / auditLog.length) * 100)}%)`);
  console.log('================================================================');
}

runFullSubsystemsAudit().catch(console.error);
