/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Classroom API Group: /api/classrooms
 *
 * Implements 5 Core Classroom Operations:
 * 1. createClassroom
 * 2. updateClassroom
 * 3. archiveClassroom
 * 4. deleteClassroom (with dependency safeguard)
 * 5. checkClassCode
 */

import { getDb } from './helpers/firebaseAdmin.js';
import { generateClassCode } from './helpers/crypto.js';
import {
  handleApiError,
  requireTeacherOrAdmin,
  verifyAuthToken
} from './helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './helpers/types.js';

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
      case 'createClassroom':
        result = await handleCreateClassroom(req, data);
        break;

      case 'updateClassroom':
        result = await handleUpdateClassroom(req, data);
        break;

      case 'archiveClassroom':
        result = await handleArchiveClassroom(req, data);
        break;

      case 'deleteClassroom':
        result = await handleDeleteClassroom(req, data);
        break;

      case 'checkClassCode':
        result = await handleCheckClassCode(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động quản lý lớp học "${action}" không được hỗ trợ hoặc chưa được phân quyền.`
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
// 1. CREATE CLASSROOM
// ==========================================
async function handleCreateClassroom(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { name, grade, academicYear, classCode: customCode, teacherUid: targetTeacherUid } =
    data || {};

  const numGrade = Number(grade);
  if (!name || (numGrade !== 2 && numGrade !== 3)) {
    throw new ApiError(400, 'invalid-argument', 'Tên lớp và Khối lớp (2 hoặc 3) là bắt buộc.');
  }

  const assignedTeacherUid =
    role === 'admin' && targetTeacherUid ? String(targetTeacherUid).trim() : uid;

  const db = getDb();
  let classCode = customCode ? String(customCode).trim().toUpperCase() : generateClassCode(6);

  if (customCode) {
    const existing = await db
      .collection('classes')
      .where('classCode', '==', classCode)
      .get();
    if (!existing.empty) {
      throw new ApiError(
        409,
        'already-exists',
        `Mã lớp "${classCode}" đã tồn tại. Vui lòng chọn mã khác.`
      );
    }
  }

  const classRef = db.collection('classes').doc();
  const classData = {
    id: classRef.id,
    teacherUid: assignedTeacherUid,
    name: String(name).trim(),
    grade: numGrade,
    classCode,
    academicYear: academicYear ? String(academicYear).trim() : '2026-2027',
    status: 'active',
    studentCount: 0,
    createdAt: Date.now()
  };

  await classRef.set(classData);
  return { success: true, classroom: classData };
}

// ==========================================
// 2. UPDATE CLASSROOM
// ==========================================
async function handleUpdateClassroom(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { classId, name, grade, academicYear, classCode } = data || {};

  if (!classId) {
    throw new ApiError(400, 'invalid-argument', 'Thiếu mã định danh lớp học (classId).');
  }

  const db = getDb();
  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists) {
    throw new ApiError(404, 'not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền chỉnh sửa lớp học này.');
  }

  const updateFields: any = {
    updatedAt: Date.now()
  };

  if (name && typeof name === 'string') {
    updateFields.name = name.trim();
  }

  if (grade !== undefined) {
    const numGrade = Number(grade);
    if (numGrade === 2 || numGrade === 3) {
      updateFields.grade = numGrade;
    }
  }

  if (academicYear && typeof academicYear === 'string') {
    updateFields.academicYear = academicYear.trim();
  }

  if (classCode && typeof classCode === 'string') {
    const cleanCode = classCode.trim().toUpperCase();
    if (cleanCode !== classData.classCode) {
      const existingSnap = await db
        .collection('classes')
        .where('classCode', '==', cleanCode)
        .get();
      const duplicates = existingSnap.docs.filter((d) => d.id !== classId);
      if (duplicates.length > 0) {
        throw new ApiError(
          409,
          'already-exists',
          `Mã lớp "${cleanCode}" đã được sử dụng bởi lớp khác.`
        );
      }
      updateFields.classCode = cleanCode;
    }
  }

  await classRef.update(updateFields);
  return { success: true, classroom: { ...classData, ...updateFields } };
}

// ==========================================
// 3. ARCHIVE / RESTORE CLASSROOM
// ==========================================
async function handleArchiveClassroom(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { classId, status } = data || {};

  if (!classId || (status !== 'active' && status !== 'archived')) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Thiếu mã lớp hoặc trạng thái không hợp lệ (active|archived).'
    );
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

  await classRef.update({
    status,
    updatedAt: Date.now()
  });

  return {
    success: true,
    status,
    message:
      status === 'archived'
        ? `Đã chuyển lớp "${classData.name}" sang trạng thái Lưu trữ.`
        : `Đã khôi phục lớp "${classData.name}" hoạt động trở lại!`
  };
}

// ==========================================
// 4. DELETE CLASSROOM (WITH SAFE DEPENDENCY CHECK)
// ==========================================
async function handleDeleteClassroom(req: VercelApiRequest, data: any) {
  const { uid, role } = await requireTeacherOrAdmin(req);
  const { classId } = data || {};

  if (!classId) {
    throw new ApiError(400, 'invalid-argument', 'Thiếu mã lớp cần xóa.');
  }

  const db = getDb();
  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();

  if (!classDoc.exists) {
    throw new ApiError(404, 'not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new ApiError(403, 'permission-denied', 'Bạn không có quyền xóa lớp học này.');
  }

  // Check dependencies: students and assignments
  const [studentsSnap, assignmentsSnap] = await Promise.all([
    db.collection('students').where('classId', '==', classId).get(),
    db.collection('assignments').where('classId', '==', classId).get()
  ]);

  const studentCount = studentsSnap.size;
  const assignmentCount = assignmentsSnap.size;

  if (studentCount > 0 || assignmentCount > 0) {
    throw new ApiError(
      412,
      'failed-precondition',
      `Không thể xóa vĩnh viễn lớp "${classData.name}" vì đang có ${studentCount} học sinh và ${assignmentCount} bài đã giao. Vui lòng chuyển sang trạng thái "Lưu trữ" để bảo toàn lịch sử học tập.`
    );
  }

  await classRef.delete();
  return {
    success: true,
    message: `Đã xóa lớp "${classData.name}" thành công.`
  };
}

// ==========================================
// 5. CHECK CLASS CODE AVAILABILITY
// ==========================================
async function handleCheckClassCode(req: VercelApiRequest, data: any) {
  await verifyAuthToken(req);
  const { classCode, excludeClassId } = data || {};

  if (!classCode) return { isAvailable: false, exists: false };

  const cleanCode = String(classCode).trim().toUpperCase();
  const db = getDb();
  const snap = await db.collection('classes').where('classCode', '==', cleanCode).get();
  const duplicates = snap.docs.filter((d) => d.id !== excludeClassId);

  return {
    isAvailable: duplicates.length === 0,
    exists: duplicates.length > 0
  };
}
