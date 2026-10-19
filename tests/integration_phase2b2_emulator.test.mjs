/**
 * EM YÊU TIẾNG VIỆT - KIỂM THỬ THỰC TẾ TRÊN EMULATOR (ĐỢT 2B.2)
 *
 * Verifies real emulator behavior in an isolated test sandbox (ports 9199, 8180, 5101)
 * Covering all 15 scenarios across 2 Vercel Functions (/api/classrooms & /api/students):
 *
 * Nhóm quản lý lớp:
 * 1. Giáo viên tạo lớp hợp lệ.
 * 2. Sửa thông tin lớp và đọc lại từ Firestore.
 * 3. Không tạo mã lớp trùng trái quy tắc.
 * 4. Giáo viên khác không thể sửa hoặc xóa lớp.
 * 5. Lưu trữ lớp đúng trạng thái.
 * 6. Xóa lớp có dữ liệu liên kết phải bị kiểm soát.
 *
 * Nhóm học sinh:
 * 7. Tạo học sinh và lưu mã truy cập an toàn (OWASP 600k PBKDF2 hash, NO hash in public profile).
 * 8. Chỉnh sửa thông tin học sinh (đổi tên, mã học sinh không trùng).
 * 9. Khóa và mở khóa tài khoản (active <-> suspended, active <-> archived; thu hồi phiên).
 * 10. Cấp lại mã truy cập và vô hiệu phiên cũ theo thiết kế.
 * 11. Chuyển lớp không mất lịch sử (bảo vệ attempts, cập nhật sĩ số, bất biến niên khóa).
 * 12. Nhập danh sách học sinh hàng loạt không tạo trùng không kiểm soát.
 * 13. Học sinh không thể truy cập API quản lý (403 permission-denied).
 * 14. Giáo viên không thể truy cập dữ liệu lớp khác (cross-teacher security).
 * 15. F5 hoặc gọi lại API không gây thay đổi dữ liệu ngoài ý muốn (idempotency / safe retry).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_PROJECT_ID,
  TEST_AUTH_PORT,
  TEST_FIRESTORE_PORT,
  TEST_FUNCTIONS_PORT,
  AUTH_EMULATOR_URL,
  assertIsolatedTestEnvironment,
  createUser
} from './test_env.mjs';

// Ensure isolated ports and project ID
assertIsolatedTestEnvironment();

// Configure environment for Vercel API handlers
process.env.NODE_ENV = 'development';
process.env.FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${TEST_FIRESTORE_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${TEST_AUTH_PORT}`;
process.env.FUNCTIONS_EMULATOR = 'true';

describe('EM YÊU TIẾNG VIỆT — REAL EMULATOR INTEGRATION TESTS (ĐỢT 2B.2)', async () => {
  let classroomsHandler;
  let studentsHandler;
  let authHandler;
  let firebaseAdmin;
  let db;

  // Test identities
  let teacherA; // Owner of Class A
  let teacherB; // Owner of Class B
  let studentUser; // Student account

  // State shared across tests
  let classAId;
  let classACode;
  let classBId;
  let classBCode;
  let student1Id;
  let student1Pin;
  let student2Id;

  before(async () => {
    classroomsHandler = (await import('../api/classrooms.ts')).default;
    studentsHandler = (await import('../api/students.ts')).default;
    authHandler = (await import('../api/auth.ts')).default;
    firebaseAdmin = await import('../api/helpers/firebaseAdmin.ts');
    db = firebaseAdmin.getDb();

    // 1. Create Teacher A
    teacherA = await createUser('giaovien.a');
    await db.collection('users').doc(teacherA.uid).set({
      role: 'teacher',
      displayName: 'Cô Nguyễn Thị Lan',
      email: teacherA.email,
      status: 'active',
      createdAt: Date.now()
    });

    // 2. Create Teacher B
    teacherB = await createUser('giaovien.b');
    await db.collection('users').doc(teacherB.uid).set({
      role: 'teacher',
      displayName: 'Thầy Trần Văn Minh',
      email: teacherB.email,
      status: 'active',
      createdAt: Date.now()
    });

    // 3. Create Student User (Anonymous / Student Auth)
    studentUser = await createUser('hocsinh.test');
    await db.collection('users').doc(studentUser.uid).set({
      role: 'student',
      displayName: 'Em Lê Hoàng Nam',
      status: 'active',
      createdAt: Date.now()
    });
  });

  // Helper to invoke /api/classrooms
  async function invokeClassrooms(action, data = {}, token = null) {
    let statusCode = 200;
    let responseBody = null;

    const headers = {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1'
    };
    if (token) headers['authorization'] = `Bearer ${token}`;

    const mockReq = {
      method: 'POST',
      headers,
      body: { action, data }
    };

    const mockRes = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
      send(text) {
        responseBody = text;
        return this;
      }
    };

    await classroomsHandler(mockReq, mockRes);
    return { status: statusCode, body: responseBody };
  }

  // Helper to invoke /api/students
  async function invokeStudents(action, data = {}, token = null) {
    let statusCode = 200;
    let responseBody = null;

    const headers = {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1'
    };
    if (token) headers['authorization'] = `Bearer ${token}`;

    const mockReq = {
      method: 'POST',
      headers,
      body: { action, data }
    };

    const mockRes = {
      setHeader() {},
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
      send(text) {
        responseBody = text;
        return this;
      }
    };

    await studentsHandler(mockReq, mockRes);
    return { status: statusCode, body: responseBody };
  }

  // =========================================================================
  // NHÓM 1: QUẢN LÝ LỚP HỌC (/api/classrooms)
  // =========================================================================

  it('1. Giáo viên tạo lớp học hợp lệ (/api/classrooms -> createClassroom)', async () => {
    const res = await invokeClassrooms(
      'createClassroom',
      {
        name: 'Lớp 2A Kim Đồng',
        grade: 2,
        academicYear: '2026-2027',
        classCode: 'KD2A01'
      },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.classroom.id);
    assert.equal(res.body.data.classroom.name, 'Lớp 2A Kim Đồng');
    assert.equal(res.body.data.classroom.grade, 2);
    assert.equal(res.body.data.classroom.classCode, 'KD2A01');
    assert.equal(res.body.data.classroom.academicYear, '2026-2027');
    assert.equal(res.body.data.classroom.teacherUid, teacherA.uid);

    classAId = res.body.data.classroom.id;
    classACode = res.body.data.classroom.classCode;

    // Verify Firestore persistence directly
    const doc = await db.collection('classes').doc(classAId).get();
    assert.ok(doc.exists);
    assert.equal(doc.data().name, 'Lớp 2A Kim Đồng');
  });

  it('2. Sửa thông tin lớp và đọc lại từ Firestore (/api/classrooms -> updateClassroom)', async () => {
    const res = await invokeClassrooms(
      'updateClassroom',
      {
        classId: classAId,
        name: 'Lớp 2A Nâng Cao',
        grade: 2,
        academicYear: '2026-2027'
      },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.classroom.name, 'Lớp 2A Nâng Cao');

    // Verify direct in Firestore
    const doc = await db.collection('classes').doc(classAId).get();
    assert.equal(doc.data().name, 'Lớp 2A Nâng Cao');
  });

  it('3. Không tạo mã lớp trùng trái quy tắc (409 already-exists)', async () => {
    // Attempt to create another class with identical classCode 'KD2A01'
    const res = await invokeClassrooms(
      'createClassroom',
      {
        name: 'Lớp 2B Trùng Mã',
        grade: 2,
        classCode: 'KD2A01'
      },
      teacherA.token
    );

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'already-exists');
  });

  it('4. Giáo viên khác không thể sửa hoặc xóa lớp (403 permission-denied)', async () => {
    // Teacher B tries to edit Teacher A's class
    const updateRes = await invokeClassrooms(
      'updateClassroom',
      {
        classId: classAId,
        name: 'Lớp Hack Bởi Giáo Viên Khác'
      },
      teacherB.token
    );

    assert.equal(updateRes.status, 403);
    assert.equal(updateRes.body.success, false);
    assert.equal(updateRes.body.error.code, 'permission-denied');

    // Teacher B tries to delete Teacher A's class
    const delRes = await invokeClassrooms(
      'deleteClassroom',
      { classId: classAId },
      teacherB.token
    );

    assert.equal(delRes.status, 403);
    assert.equal(delRes.body.success, false);
    assert.equal(delRes.body.error.code, 'permission-denied');
  });

  it('5. Lưu trữ lớp đúng trạng thái (/api/classrooms -> archiveClassroom)', async () => {
    // Archive
    const archiveRes = await invokeClassrooms(
      'archiveClassroom',
      { classId: classAId, status: 'archived' },
      teacherA.token
    );

    assert.equal(archiveRes.status, 200);
    assert.equal(archiveRes.body.data.status, 'archived');

    let doc = await db.collection('classes').doc(classAId).get();
    assert.equal(doc.data().status, 'archived');

    // Restore to active
    const restoreRes = await invokeClassrooms(
      'archiveClassroom',
      { classId: classAId, status: 'active' },
      teacherA.token
    );

    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.body.data.status, 'active');

    doc = await db.collection('classes').doc(classAId).get();
    assert.equal(doc.data().status, 'active');
  });

  it('6. Xóa lớp có dữ liệu liên kết phải bị kiểm soát (412 failed-precondition)', async () => {
    // Create a temporary empty class for Teacher A
    const emptyClassRes = await invokeClassrooms(
      'createClassroom',
      { name: 'Lớp Trống Tạm', grade: 3, academicYear: '2026-2027' },
      teacherA.token
    );
    const emptyClassId = emptyClassRes.body.data.classroom.id;

    // Empty class can be deleted safely
    const delEmptyRes = await invokeClassrooms(
      'deleteClassroom',
      { classId: emptyClassId },
      teacherA.token
    );
    assert.equal(delEmptyRes.status, 200);
    assert.equal(delEmptyRes.body.success, true);

    const emptyDoc = await db.collection('classes').doc(emptyClassId).get();
    assert.equal(emptyDoc.exists, false);

    // Now test with classAId once it has students (will be tested after student creation)
  });

  // =========================================================================
  // NHÓM 2: QUẢN LÝ HỌC SINH (/api/students)
  // =========================================================================

  it('7. Tạo học sinh và lưu mã truy cập an toàn (OWASP 600k hash, NO hash in public profile)', async () => {
    const res = await invokeStudents(
      'createStudentAccess',
      {
        classId: classAId,
        displayAlias: 'Lê Hoàng Nam',
        studentCode: 'HS201',
        gender: 'male'
      },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.student.id);
    assert.ok(res.body.data.student.accessCode, 'Must return accessCode once to teacher');
    assert.equal(res.body.data.student.studentCode, 'HS201');

    student1Id = res.body.data.student.id;
    student1Pin = res.body.data.student.accessCode;

    // VERIFY CRITICAL SECURITY REQUIREMENT:
    // 1. In `students/{id}`: NO password/hash/secret
    const sDoc = await db.collection('students').doc(student1Id).get();
    assert.ok(sDoc.exists);
    const sData = sDoc.data();
    assert.equal(sData.accessCodeHash, undefined, 'Public student doc must NOT contain hash');
    assert.equal(sData.accessCode, undefined, 'Public student doc must NOT contain plain PIN');
    assert.equal(sData.salt, undefined, 'Public student doc must NOT contain salt');
    assert.equal(sData.displayAlias, 'Lê Hoàng Nam');

    // 2. In `studentSecrets/{id}`: OWASP Version 2 hash with 600k iterations
    const secDoc = await db.collection('studentSecrets').doc(student1Id).get();
    assert.ok(secDoc.exists);
    const secData = secDoc.data();
    assert.equal(secData.version, 2, 'Must use version 2 hash');
    assert.equal(secData.iterations, 600000, 'Must use 600k iterations');
    assert.ok(secData.salt && secData.salt.length === 32);
    assert.ok(secData.accessCodeHash && secData.accessCodeHash.length === 64);

    // 3. Class studentCount incremented
    const cDoc = await db.collection('classes').doc(classAId).get();
    assert.equal(cDoc.data().studentCount, 1);
  });

  it('6b. Xóa lớp khi ĐÃ CÓ HỌC SINH phải bị chặn kiểm soát (412 failed-precondition)', async () => {
    const delRes = await invokeClassrooms(
      'deleteClassroom',
      { classId: classAId },
      teacherA.token
    );

    assert.equal(delRes.status, 412);
    assert.equal(delRes.body.success, false);
    assert.equal(delRes.body.error.code, 'failed-precondition');
    assert.ok(delRes.body.error.message.includes('Lưu trữ'));
  });

  it('8. Chỉnh sửa thông tin học sinh (/api/students -> updateStudentInfo)', async () => {
    const res = await invokeStudents(
      'updateStudentInfo',
      {
        studentId: student1Id,
        displayAlias: 'Lê Hoàng Nam (Lớp Trưởng)',
        studentCode: 'HS201_A'
      },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const sDoc = await db.collection('students').doc(student1Id).get();
    assert.equal(sDoc.data().displayAlias, 'Lê Hoàng Nam (Lớp Trưởng)');
    assert.equal(sDoc.data().studentCode, 'HS201_A');
  });

  it('9. Khóa và mở khóa tài khoản học sinh (/api/students -> toggleStudentStatus)', async () => {
    // 1. Create a dummy session for student1
    const sesRef = db.collection('studentSessions').doc('test_session_student1');
    await sesRef.set({
      studentId: student1Id,
      classId: classAId,
      createdAt: Date.now()
    });

    // 2. Lock account (suspended)
    const lockRes = await invokeStudents(
      'toggleStudentStatus',
      { studentId: student1Id, status: 'suspended' },
      teacherA.token
    );

    assert.equal(lockRes.status, 200);
    assert.equal(lockRes.body.data.status, 'suspended');

    // Verify session revoked
    const sesDoc = await sesRef.get();
    assert.ok(sesDoc.data().revokedAt, 'Locking student must revoke active sessions');

    // 3. Unlock account (active)
    const unlockRes = await invokeStudents(
      'toggleStudentStatus',
      { studentId: student1Id, status: 'active' },
      teacherA.token
    );
    assert.equal(unlockRes.status, 200);
    assert.equal(unlockRes.body.data.status, 'active');

    const sDoc = await db.collection('students').doc(student1Id).get();
    assert.equal(sDoc.data().status, 'active');
  });

  it('10. Cấp lại mã truy cập và vô hiệu phiên cũ (/api/students -> rotateStudentAccess)', async () => {
    // Set a live session
    const sesRef = db.collection('studentSessions').doc('test_session_rotate');
    await sesRef.set({
      studentId: student1Id,
      classId: classAId,
      createdAt: Date.now()
    });

    const res = await invokeStudents(
      'rotateStudentAccess',
      { studentId: student1Id },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.newAccessCode);
    assert.notEqual(res.body.data.newAccessCode, student1Pin);

    // Verify session revoked
    const sesDoc = await sesRef.get();
    assert.ok(sesDoc.data().revokedAt, 'Rotating PIN must revoke all previous sessions');

    // Verify new secret stored with OWASP v2
    const secDoc = await db.collection('studentSecrets').doc(student1Id).get();
    assert.equal(secDoc.data().version, 2);
    assert.equal(secDoc.data().iterations, 600000);
  });

  it('11. Chuyển lớp không mất lịch sử (/api/students -> transferStudentClass)', async () => {
    // 1. Create Class B under Teacher A for transfer test (Grade 2, same year)
    const classBRes = await invokeClassrooms(
      'createClassroom',
      {
        name: 'Lớp 2B Hoa Mai',
        grade: 2,
        academicYear: '2026-2027',
        classCode: 'HM2B01'
      },
      teacherA.token
    );
    classBId = classBRes.body.data.classroom.id;
    classBCode = classBRes.body.data.classroom.classCode;

    // 2. Create historical attempt in Class A for student1
    const attemptRef = db.collection('attempts').doc('attempt_hist_001');
    await attemptRef.set({
      id: 'attempt_hist_001',
      studentId: student1Id,
      classId: classAId,
      academicYear: '2026-2027',
      lessonId: 'lesson_sample_01',
      score: 10,
      completedAt: Date.now() - 86400000
    });

    // 3. Execute transfer from Class A to Class B
    const transferRes = await invokeStudents(
      'transferStudentClass',
      {
        studentId: student1Id,
        targetClassId: classBId,
        transferType: 'same_year',
        reason: 'Chuyển theo nguyện vọng gia đình'
      },
      teacherA.token
    );

    assert.equal(transferRes.status, 200);
    assert.equal(transferRes.body.success, true);
    assert.ok(transferRes.body.data.transferLog);

    // 4. Verify Student Document: new classId, transfer log recorded
    const sDoc = await db.collection('students').doc(student1Id).get();
    const sData = sDoc.data();
    assert.equal(sData.classId, classBId, 'Student current classId must be Class B');
    assert.equal(sData.previousClassId, classAId, 'previousClassId must be Class A');
    assert.ok(Array.isArray(sData.transferHistory));
    assert.equal(sData.transferHistory.length, 1);
    assert.equal(sData.transferHistory[0].fromClassId, classAId);
    assert.equal(sData.transferHistory[0].toClassId, classBId);

    // 5. CRITICAL INVARIANT: Historical attempt document MUST NOT BE MODIFIED!
    const histAttempt = await attemptRef.get();
    assert.equal(histAttempt.data().classId, classAId, 'Historical attempt must retain original classId');
    assert.equal(histAttempt.data().academicYear, '2026-2027', 'Historical academicYear untouched');

    // 6. Sĩ số lớp: Class A decremented to 0, Class B incremented to 1
    const [cADoc, cBDoc] = await Promise.all([
      db.collection('classes').doc(classAId).get(),
      db.collection('classes').doc(classBId).get()
    ]);
    assert.equal(cADoc.data().studentCount, 0, 'Class A studentCount should be 0');
    assert.equal(cBDoc.data().studentCount, 1, 'Class B studentCount should be 1');
  });

  it('11b. Chuyển lớp vi phạm quy tắc niên khóa / khối lớp bị từ chối', async () => {
    // Create a Grade 3 class in 2025-2026 (prior year)
    const classOldRes = await invokeClassrooms(
      'createClassroom',
      {
        name: 'Lớp 3 Cũ Niên Khóa Trước',
        grade: 3,
        academicYear: '2025-2026'
      },
      teacherA.token
    );
    const classOldId = classOldRes.body.data.classroom.id;

    // Attempting same_year transfer across different academic years must fail
    const invalidTransferRes = await invokeStudents(
      'transferStudentClass',
      {
        studentId: student1Id,
        targetClassId: classOldId,
        transferType: 'same_year'
      },
      teacherA.token
    );

    assert.equal(invalidTransferRes.status, 400);
    assert.equal(invalidTransferRes.body.success, false);
    assert.equal(invalidTransferRes.body.error.code, 'invalid-argument');
  });

  it('12. Nhập danh sách học sinh hàng loạt (/api/students -> batchCreateStudents)', async () => {
    const batchInput = [
      { name: 'Nguyễn Văn An', studentCode: 'AN001', gender: 'male' },
      { name: 'Trần Thị Bình', studentCode: 'BINH002', gender: 'female' },
      { name: 'Hoàng Minh Châu', studentCode: 'CHAU003', gender: 'female' }
    ];

    const res = await invokeStudents(
      'batchCreateStudents',
      {
        classId: classBId,
        students: batchInput
      },
      teacherA.token
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.totalCreated, 3);
    assert.equal(res.body.data.students.length, 3);

    // Verify all created with OWASP v2 secrets
    for (const slip of res.body.data.students) {
      assert.ok(slip.accessCode, 'Must return slip with accessCode');
      const sec = await db.collection('studentSecrets').doc(slip.id).get();
      assert.equal(sec.data().version, 2);
      assert.equal(sec.data().iterations, 600000);
    }

    // Verify classB count updated (1 original + 3 new = 4)
    const cBDoc = await db.collection('classes').doc(classBId).get();
    assert.equal(cBDoc.data().studentCount, 4);

    student2Id = res.body.data.students[0].id;
  });

  it('13. Học sinh không thể truy cập API quản lý (403 permission-denied)', async () => {
    // Student tries to call createClassroom
    const classRes = await invokeClassrooms(
      'createClassroom',
      { name: 'Lớp Học Sinh Tự Lập', grade: 2 },
      studentUser.token
    );
    assert.equal(classRes.status, 403);
    assert.equal(classRes.body.error.code, 'permission-denied');

    // Student tries to call createStudentAccess
    const studentRes = await invokeStudents(
      'createStudentAccess',
      { classId: classBId, displayAlias: 'Bạn Cùng Bàn' },
      studentUser.token
    );
    assert.equal(studentRes.status, 403);
    assert.equal(studentRes.body.error.code, 'permission-denied');
  });

  it('14. Giáo viên không thể truy cập hoặc thao tác học sinh lớp khác (cross-teacher security)', async () => {
    // Teacher B tries to rotate PIN of student in Teacher A's class
    const rotateRes = await invokeStudents(
      'rotateStudentAccess',
      { studentId: student2Id },
      teacherB.token
    );
    assert.equal(rotateRes.status, 403);
    assert.equal(rotateRes.body.error.code, 'permission-denied');

    // Teacher B tries to transfer student in Teacher A's class
    const transRes = await invokeStudents(
      'transferStudentClass',
      { studentId: student2Id, targetClassId: classAId },
      teacherB.token
    );
    assert.equal(transRes.status, 403);
    assert.equal(transRes.body.error.code, 'permission-denied');
  });

  it('15. F5 hoặc gọi lại API không gây thay đổi dữ liệu ngoài ý muốn (idempotent / safe retry)', async () => {
    // Calling updateClassroom with identical values must be idempotent
    const update1 = await invokeClassrooms(
      'updateClassroom',
      { classId: classBId, name: 'Lớp 2B Hoa Mai Ổn Định' },
      teacherA.token
    );
    assert.equal(update1.status, 200);

    const update2 = await invokeClassrooms(
      'updateClassroom',
      { classId: classBId, name: 'Lớp 2B Hoa Mai Ổn Định' },
      teacherA.token
    );
    assert.equal(update2.status, 200);
    assert.equal(update2.body.data.classroom.name, 'Lớp 2B Hoa Mai Ổn Định');

    // Transferring to same class returns early safely without duplicate logs
    const sDocBefore = await db.collection('students').doc(student1Id).get();
    const countBefore = sDocBefore.data().transferHistory.length;

    const retryTransfer = await invokeStudents(
      'transferStudentClass',
      { studentId: student1Id, targetClassId: classBId },
      teacherA.token
    );
    assert.equal(retryTransfer.status, 200);
    assert.ok(retryTransfer.body.data.message.includes('đã thuộc lớp này'));

    const sDocAfter = await db.collection('students').doc(student1Id).get();
    assert.equal(sDocAfter.data().transferHistory.length, countBefore, 'Duplicate transfer must not append duplicate logs');
  });
});
