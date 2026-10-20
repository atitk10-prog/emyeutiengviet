/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Student Management API Group: /api/students
 *
 * Implements 8 Core Student Operations:
 * 1. createStudentAccess
 * 2. rotateStudentAccess
 * 3. updateStudentInfo
 * 4. toggleStudentStatus
 * 5. deleteStudent (with attempt safeguard)
 * 6. batchUpdateStudents
 * 7. transferStudentClass (with academic history & grade invariants)
 * 8. batchCreateStudents (Excel / batch import)
 */

import { getDb } from './_helpers/firebaseAdmin.js';
import {
  generateAccessCode,
  createAccessCodeHashRecord
} from './_helpers/crypto.js';
import {
  handleApiError,
  requireTeacherOrAdmin
} from './_helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './_helpers/types.js';

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
  // CORS & OPTIONS support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: { code: 'method-not-allowed', message: 'Chỉ chấp nhận phương thức POST.' }
    });
    return;
  }

  try {
    const { action, data } = req.body || {};
    if (!action || typeof action !== 'string') {
      throw new ApiError(400, 'invalid-argument', 'Yêu cầu thiếu tên hành động (action).');
    }

    let result: any;

    switch (action) {
      case 'createStudentAccess':
        result = await handleCreateStudentAccess(req, data);
        break;

      case 'rotateStudentAccess':
        result = await handleRotateStudentAccess(req, data);
        break;

      case 'updateStudentInfo':
        result = await handleUpdateStudentInfo(req, data);
        break;

      case 'toggleStudentStatus':
        result = await handleToggleStudentStatus(req, data);
        break;

      case 'deleteStudent':
        result = await handleDeleteStudent(req, data);
        break;

      case 'batchUpdateStudents':
        result = await handleBatchUpdateStudents(req, data);
        break;

      case 'transferStudentClass':
        result = await handleTransferStudentClass(req, data);
        break;

      case 'batchCreateStudents':
        result = await handleBatchCreateStudents(req, data);
        break;

      case 'getStudentsByClass':
        result = await handleGetStudentsByClass(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động quản lý học sinh "${action}" không được hỗ trợ hoặc chưa được phân quyền.`
        );
    }

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    handleApiError(res, error);
  }
}

// ==========================================
// 1. CREATE STUDENT ACCESS CODE
// ==========================================
async function handleCreateStudentAccess(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { classId, displayAlias, studentCode, gender } = data || {};

  if (!classId || !displayAlias) {
    throw new ApiError(400, 'invalid-argument', 'Thiếu mã lớp hoặc họ tên / biệt danh học sinh.');
  }

  const db = getDb();
  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists) {
    throw new ApiError(404, 'not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý lớp học này.');
  }

  const cleanAlias = String(displayAlias).trim();
  let cleanCode = studentCode ? String(studentCode).trim().toUpperCase() : '';

  if (!cleanCode) {
    cleanCode = `HS${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // Check code uniqueness in this class
  const existingDoc = await db
    .collection('students')
    .where('classId', '==', classId)
    .where('studentCode', '==', cleanCode)
    .get();

  if (!existingDoc.empty) {
    if (studentCode) {
      throw new ApiError(
        409,
        'already-exists',
        `Mã học sinh "${cleanCode}" đã tồn tại trong lớp này.`
      );
    } else {
      cleanCode = `HS${Math.floor(10000 + Math.random() * 90000)}`;
    }
  }

  // Generate 6-char access pin and OWASP 600k PBKDF2 hash record
  const accessCode = generateAccessCode(6);
  const secretRecord = createAccessCodeHashRecord(accessCode);

  const studentRef = db.collection('students').doc();
  const studentId = studentRef.id;
  const now = Date.now();

  const studentDocData: any = {
    id: studentId,
    classId,
    classCode: classData.classCode || '',
    grade: classData.grade || 2,
    academicYear: classData.academicYear || '2026-2027',
    studentCode: cleanCode,
    displayAlias: cleanAlias,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  if (gender) {
    studentDocData.gender = gender;
  }

  const batch = db.batch();

  // 1. Safe student profile (NO HASH)
  batch.set(studentRef, studentDocData);

  // 2. Secret record isolated for Admin SDK
  batch.set(db.collection('studentSecrets').doc(studentId), {
    studentId,
    version: secretRecord.version,
    algorithm: secretRecord.algorithm,
    iterations: secretRecord.iterations,
    salt: secretRecord.salt,
    accessCodeHash: secretRecord.passwordHash,
    rotatedAt: now
  });

  // 3. Atomically update class student count
  const currentCount = classData.studentCount || 0;
  batch.update(classRef, {
    studentCount: currentCount + 1,
    updatedAt: now
  });

  await batch.commit();

  return {
    success: true,
    student: {
      id: studentId,
      classId,
      classCode: classData.classCode,
      className: classData.name,
      studentCode: cleanCode,
      displayAlias: cleanAlias,
      accessCode // Returned once so teacher can distribute slip to student
    }
  };
}

// ==========================================
// 2. ROTATE STUDENT ACCESS CODE
// ==========================================
async function handleRotateStudentAccess(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentId } = data || {};

  if (!studentId) {
    throw new ApiError(400, 'invalid-argument', 'Mã học sinh không được để trống.');
  }

  const db = getDb();
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const studentData = studentDoc.data()!;
  const classDoc = await db.collection('classes').doc(studentData.classId).get();
  if (!classDoc.exists || (role !== 'admin' && classDoc.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  // Generate new 6-char code and OWASP 600k PBKDF2 hash record
  const newAccessCode = generateAccessCode(6);
  const secretRecord = createAccessCodeHashRecord(newAccessCode);
  const now = Date.now();

  const batch = db.batch();

  // Update secret
  batch.set(
    db.collection('studentSecrets').doc(studentId),
    {
      studentId,
      version: secretRecord.version,
      algorithm: secretRecord.algorithm,
      iterations: secretRecord.iterations,
      salt: secretRecord.salt,
      accessCodeHash: secretRecord.passwordHash,
      rotatedAt: now
    },
    { merge: true }
  );

  // Invalidate any active student sessions
  const activeSessions = await db
    .collection('studentSessions')
    .where('studentId', '==', studentId)
    .get();

  activeSessions.docs.forEach((doc) => {
    batch.update(doc.ref, { revokedAt: now });
  });

  // Update student document metadata
  batch.update(studentDoc.ref, {
    lastPinRotatedAt: now,
    updatedAt: now
  });

  await batch.commit();

  return {
    success: true,
    studentId,
    displayAlias: studentData.displayAlias,
    newAccessCode
  };
}

// ==========================================
// 3. UPDATE STUDENT INFO
// ==========================================
async function handleUpdateStudentInfo(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentId, displayAlias, studentCode, gender } = data || {};

  if (!studentId || !displayAlias) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Mã học sinh và họ tên hiển thị không được để trống.'
    );
  }

  const db = getDb();
  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  if (!classDoc.exists || (role !== 'admin' && classDoc.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  const updates: any = {
    displayAlias: String(displayAlias).trim(),
    updatedAt: Date.now()
  };

  if (gender !== undefined) {
    updates.gender = gender;
  }

  if (studentCode) {
    const cleanCode = String(studentCode).trim().toUpperCase();
    if (cleanCode !== sData.studentCode) {
      const dup = await db
        .collection('students')
        .where('classId', '==', sData.classId)
        .where('studentCode', '==', cleanCode)
        .get();

      const duplicates = dup.docs.filter((d) => d.id !== studentId);
      if (duplicates.length > 0) {
        throw new ApiError(
          409,
          'already-exists',
          `Mã học sinh "${cleanCode}" đã tồn tại trong lớp này.`
        );
      }
      updates.studentCode = cleanCode;
    }
  }

  await sDoc.ref.update(updates);

  return {
    success: true,
    message: 'Đã cập nhật thông tin học sinh thành công.'
  };
}

// ==========================================
// 4. TOGGLE STUDENT STATUS (LOCK / UNLOCK / ARCHIVE / RESTORE)
// ==========================================
async function handleToggleStudentStatus(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentId, status } = data || {};

  if (!studentId || !['active', 'suspended', 'archived'].includes(status)) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Dữ liệu trạng thái học sinh không hợp lệ (active|suspended|archived).'
    );
  }

  const db = getDb();
  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  if (!classDoc.exists || (role !== 'admin' && classDoc.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  const now = Date.now();
  await sDoc.ref.update({
    status,
    updatedAt: now
  });

  // Revoke active sessions if locked or archived
  if (status === 'suspended' || status === 'archived') {
    const sessions = await db
      .collection('studentSessions')
      .where('studentId', '==', studentId)
      .get();

    const batch = db.batch();
    sessions.docs.forEach((doc) => {
      batch.update(doc.ref, { revokedAt: now });
    });
    await batch.commit();
  }

  const statusLabel =
    status === 'suspended'
      ? 'Đã tạm khóa tài khoản học sinh.'
      : status === 'archived'
      ? 'Đã lưu trữ hồ sơ học sinh.'
      : 'Đã kích hoạt / phục hồi tài khoản học sinh.';

  return {
    success: true,
    status,
    message: statusLabel
  };
}

// ==========================================
// 5. DELETE STUDENT (SAFEGUARD: PROTECT ATTEMPTS & LEARNING HISTORY)
// ==========================================
async function handleDeleteStudent(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentId } = data || {};

  if (!studentId) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng cung cấp studentId.');
  }

  const db = getDb();
  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  if (!classDoc.exists || (role !== 'admin' && classDoc.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền xóa học sinh này.');
  }

  // Check if student has attempts (lượt làm bài)
  const attemptsSnap = await db
    .collection('attempts')
    .where('studentId', '==', studentId)
    .limit(1)
    .get();

  if (!attemptsSnap.empty) {
    throw new ApiError(
      412,
      'failed-precondition',
      'Học sinh này đã có lịch sử làm bài và kết quả đọc hiểu trong hệ thống. Để bảo vệ dữ liệu đánh giá học tập, không được xóa vĩnh viễn hồ sơ. Bạn hãy sử dụng tính năng "Lưu trữ hồ sơ" (Archive).'
    );
  }

  // Safe to permanently delete
  const batch = db.batch();
  batch.delete(sDoc.ref);
  batch.delete(db.collection('studentSecrets').doc(studentId));

  if (sData.username || sData.studentCode) {
    const uCode = (sData.username || sData.studentCode).toLowerCase();
    batch.delete(db.collection('usernames').doc(uCode));
  }

  if (classDoc.exists) {
    const cur = classDoc.data()?.studentCount || 1;
    batch.update(classDoc.ref, {
      studentCount: Math.max(0, cur - 1),
      updatedAt: Date.now()
    });
  }

  await batch.commit();

  return {
    success: true,
    message: `Đã xóa vĩnh viễn hồ sơ học sinh "${sData.displayAlias}" (${sData.studentCode || ''}) thành công.`
  };
}

// ==========================================
// 6. BATCH UPDATE STUDENTS (LOCK / UNLOCK / ARCHIVE / DELETE)
// ==========================================
async function handleBatchUpdateStudents(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentIds, action } = data || {};

  if (
    !Array.isArray(studentIds) ||
    studentIds.length === 0 ||
    !['lock', 'unlock', 'archive', 'delete'].includes(action)
  ) {
    throw new ApiError(400, 'invalid-argument', 'Dữ liệu thao tác hàng loạt không hợp lệ.');
  }

  if (studentIds.length > 100) {
    throw new ApiError(400, 'invalid-argument', 'Mỗi lần chỉ thao tác tối đa 100 học sinh.');
  }

  const db = getDb();
  let successCount = 0;
  let protectedCount = 0;
  const messages: string[] = [];

  for (const sId of studentIds) {
    const sDoc = await db.collection('students').doc(sId).get();
    if (!sDoc.exists) continue;
    const sData = sDoc.data()!;

    const classDoc = await db.collection('classes').doc(sData.classId).get();
    const isOwner = classDoc.exists && classDoc.data()?.teacherUid === uid;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) continue;

    if (action === 'delete') {
      const attemptsSnap = await db
        .collection('attempts')
        .where('studentId', '==', sId)
        .limit(1)
        .get();

      if (!attemptsSnap.empty) {
        // Protect attempts: auto-archive instead of deleting
        await sDoc.ref.update({ status: 'archived', updatedAt: Date.now() });
        protectedCount++;
        messages.push(
          `Học sinh "${sData.displayAlias}" đã có bài làm -> đã tự động chuyển sang Lưu trữ để bảo vệ kết quả.`
        );
      } else {
        const batch = db.batch();
        batch.delete(sDoc.ref);
        batch.delete(db.collection('studentSecrets').doc(sId));
        if (sData.username || sData.studentCode) {
          batch.delete(
            db.collection('usernames').doc((sData.username || sData.studentCode).toLowerCase())
          );
        }
        if (classDoc.exists) {
          const cur = classDoc.data()?.studentCount || 1;
          batch.update(classDoc.ref, {
            studentCount: Math.max(0, cur - 1),
            updatedAt: Date.now()
          });
        }
        await batch.commit();
        successCount++;
      }
    } else {
      const newStatus =
        action === 'lock' ? 'suspended' : action === 'archive' ? 'archived' : 'active';
      await sDoc.ref.update({ status: newStatus, updatedAt: Date.now() });
      if (newStatus !== 'active') {
        const sessions = await db
          .collection('studentSessions')
          .where('studentId', '==', sId)
          .get();
        const batch = db.batch();
        sessions.docs.forEach((d) => batch.update(d.ref, { revokedAt: Date.now() }));
        await batch.commit();
      }
      successCount++;
    }
  }

  return {
    success: true,
    action,
    processedCount: successCount + protectedCount,
    successCount,
    protectedCount,
    messages
  };
}

// ==========================================
// 7. TRANSFER STUDENT CLASS (PRESERVES LEARNING HISTORY & YEAR INVARIANTS)
// ==========================================
async function handleTransferStudentClass(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { studentId, targetClassId, transferType, reason } = data || {};

  if (!studentId || !targetClassId) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng cung cấp mã học sinh và lớp đích.');
  }

  const db = getDb();
  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const sData = sDoc.data()!;
  if (sData.classId === targetClassId) {
    return { success: true, message: 'Học sinh đã thuộc lớp này.' };
  }

  const [sourceClass, targetClass] = await Promise.all([
    db.collection('classes').doc(sData.classId).get(),
    db.collection('classes').doc(targetClassId).get()
  ]);

  if (!sourceClass.exists || (role !== 'admin' && sourceClass.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý lớp nguồn.');
  }
  if (!targetClass.exists || (role !== 'admin' && targetClass.data()?.teacherUid !== uid)) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền quản lý lớp đích.');
  }

  const sourceData = sourceClass.data()!;
  const targetData = targetClass.data()!;

  const sourceYear = sourceData.academicYear || '2026-2027';
  const targetYear = targetData.academicYear || '2026-2027';
  const effectiveTransferType =
    transferType ||
    (sourceData.grade !== targetData.grade || sourceYear !== targetYear
      ? 'promote_next_year'
      : 'same_year');

  // Business Rule Invariants: Validate class compatibility
  if (effectiveTransferType === 'same_year') {
    if (sourceYear !== targetYear) {
      throw new ApiError(
        400,
        'invalid-argument',
        `Chuyển lớp cùng năm học yêu cầu lớp đích phải cùng năm học với lớp nguồn (${sourceYear}). Lớp đích "${targetData.name}" thuộc năm học ${targetYear}.`
      );
    }
    if (sourceData.grade !== targetData.grade) {
      throw new ApiError(
        400,
        'invalid-argument',
        `Chuyển lớp cùng năm học yêu cầu cùng khối lớp (Khối ${sourceData.grade}). Lớp đích "${targetData.name}" thuộc Khối ${targetData.grade}.`
      );
    }
  } else if (effectiveTransferType === 'promote_next_year') {
    if (sourceYear === '2026-2027' && targetYear === '2025-2026') {
      throw new ApiError(
        400,
        'invalid-argument',
        `Không thể chuyển lên lớp năm mới lùi về niên khóa trước (từ ${sourceYear} về ${targetYear}).`
      );
    }
    if (targetData.grade < sourceData.grade) {
      throw new ApiError(
        400,
        'invalid-argument',
        `Không thể chuyển lên lớp năm mới vào khối lớp thấp hơn (Khối ${sourceData.grade} về Khối ${targetData.grade}).`
      );
    }
  }

  // Avoid student code collision in target class
  const existingInTarget = await db
    .collection('students')
    .where('classId', '==', targetClassId)
    .where('studentCode', '==', sData.studentCode)
    .get();

  let finalCode = sData.studentCode;
  if (!existingInTarget.empty) {
    finalCode = `${sData.studentCode}_${Math.floor(100 + Math.random() * 900)}`;
  }

  const now = Date.now();
  const transferLog = {
    fromClassId: sData.classId,
    fromClassName: sourceData.name || '',
    fromClassCode: sourceData.classCode || '',
    fromGrade: sourceData.grade || null,
    toClassId: targetClassId,
    toClassName: targetData.name || '',
    toClassCode: targetData.classCode || '',
    toGrade: targetData.grade || null,
    transferredAt: now,
    transferredBy: uid,
    transferType: effectiveTransferType,
    academicYear: targetYear,
    reason:
      reason ||
      (effectiveTransferType === 'promote_next_year'
        ? 'Lên lớp năm học mới'
        : 'Chuyển lớp cùng năm học')
  };

  const existingHistory = Array.isArray(sData.transferHistory) ? sData.transferHistory : [];

  const batch = db.batch();

  // 1. Update Student Document (INVARIANT: ATTEMPTS ARE NEVER ALTERED)
  batch.update(sDoc.ref, {
    classId: targetClassId,
    classCode: targetData.classCode || '',
    grade: targetData.grade || sData.grade || 2,
    academicYear: targetData.academicYear || sData.academicYear || '2026-2027',
    studentCode: finalCode,
    previousClassId: sData.classId,
    previousClassCode: sourceData.classCode || '',
    transferredAt: now,
    transferHistory: [...existingHistory, transferLog],
    updatedAt: now
  });

  // 2. Update Student Sessions for seamless continuation
  const sessionsSnap = await db
    .collection('studentSessions')
    .where('studentId', '==', studentId)
    .get();

  sessionsSnap.forEach((sesDoc) => {
    batch.update(sesDoc.ref, {
      classId: targetClassId,
      updatedAt: now
    });
  });

  // 3. Atomically update accurate student counts
  const [sourceStudentsSnap, targetStudentsSnap] = await Promise.all([
    db.collection('students').where('classId', '==', sData.classId).get(),
    db.collection('students').where('classId', '==', targetClassId).get()
  ]);
  const realSourceCount = Math.max(0, sourceStudentsSnap.size - 1);
  const realTargetCount = targetStudentsSnap.size + 1;

  batch.update(sourceClass.ref, { studentCount: realSourceCount, updatedAt: now });
  batch.update(targetClass.ref, { studentCount: realTargetCount, updatedAt: now });

  await batch.commit();

  return {
    success: true,
    transferLog,
    message: `Đã chuyển học sinh ${sData.displayAlias} từ ${sourceData.name} sang ${targetData.name} (${targetData.academicYear || '2026-2027'}) thành công!`
  };
}

// ==========================================
// 8. BATCH CREATE STUDENTS (FROM EXCEL / BATCH INPUT)
// ==========================================
async function handleBatchCreateStudents(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { classId, students: studentList } = data || {};

  if (!classId || !Array.isArray(studentList) || studentList.length === 0) {
    throw new ApiError(400, 'invalid-argument', 'Dữ liệu danh sách học sinh không hợp lệ.');
  }

  if (studentList.length > 100) {
    throw new ApiError(400, 'invalid-argument', 'Mỗi lần nhập tối đa 100 học sinh.');
  }

  const db = getDb();
  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy lớp học.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền thêm học sinh vào lớp này.');
  }

  // Preload existing student codes to prevent duplicates
  const existingSnap = await db.collection('students').where('classId', '==', classId).get();
  const existingCodes = new Set<string>();
  existingSnap.forEach((d) => {
    const s = d.data();
    if (s.studentCode) existingCodes.add(s.studentCode.toUpperCase());
  });

  const createdSlips: any[] = [];
  const errors: string[] = [];

  const batch = db.batch();
  const now = Date.now();

  for (let i = 0; i < studentList.length; i++) {
    const row = studentList[i];
    const rawAlias = String(row.displayAlias || row.name || '').trim();
    if (!rawAlias) {
      errors.push(`Dòng ${i + 1}: Thiếu họ tên / biệt danh học sinh.`);
      continue;
    }

    let code = String(row.studentCode || '').trim().toUpperCase();
    if (!code) {
      code = `HS${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (existingCodes.has(code)) {
      errors.push(`Dòng ${i + 1}: Mã học sinh "${code}" đã tồn tại trong lớp.`);
      continue;
    }

    const accessCode = generateAccessCode(6);
    const secretRecord = createAccessCodeHashRecord(accessCode);

    const studentRef = db.collection('students').doc();
    const studentId = studentRef.id;

    batch.set(studentRef, {
      id: studentId,
      classId,
      classCode: classData.classCode || '',
      grade: classData.grade || 2,
      academicYear: classData.academicYear || '2026-2027',
      studentCode: code,
      displayAlias: rawAlias,
      status: 'active',
      gender: row.gender || null,
      createdAt: now,
      updatedAt: now
    });

    batch.set(db.collection('studentSecrets').doc(studentId), {
      studentId,
      version: secretRecord.version,
      algorithm: secretRecord.algorithm,
      iterations: secretRecord.iterations,
      salt: secretRecord.salt,
      accessCodeHash: secretRecord.passwordHash,
      rotatedAt: now
    });

    existingCodes.add(code);
    createdSlips.push({
      id: studentId,
      studentCode: code,
      displayAlias: rawAlias,
      classCode: classData.classCode,
      className: classData.name,
      accessCode
    });
  }

  if (createdSlips.length === 0) {
    throw new ApiError(
      400,
      'invalid-argument',
      `Không có học sinh nào hợp lệ để tạo. ${errors.join('; ')}`
    );
  }

  // Atomically update class student count
  const newTotalCount = existingSnap.size + createdSlips.length;
  batch.update(classDoc.ref, {
    studentCount: newTotalCount,
    updatedAt: now
  });

  await batch.commit();

  return {
    success: true,
    totalCreated: createdSlips.length,
    students: createdSlips,
    warnings: errors
  };
}

// ==========================================
// 9. GET STUDENTS BY CLASS
// ==========================================
async function handleGetStudentsByClass(req: VercelApiRequest, data: any) {
  const { uid: teacherUid, role } = await requireTeacherOrAdmin(req);
  const { classId } = data || {};
  if (!classId) {
    throw new ApiError(400, 'invalid-argument', 'Yêu cầu cung cấp mã định danh lớp học (classId).');
  }

  const db = getDb();
  if (role !== 'admin') {
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
      throw new ApiError(403, 'permission-denied', 'Không có quyền truy cập danh sách học sinh của lớp này.');
    }
  }

  const studentsSnap = await db.collection('students').where('classId', '==', classId).get();
  const students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  students.sort((a: any, b: any) => (a.studentCode || '').localeCompare(b.studentCode || ''));
  return { success: true, students };
}

