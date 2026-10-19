/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Admin Operations API Group: /api/admin
 *
 * Implements System Administration:
 * 1. getAdminOverview
 * 2. listTeachers
 * 3. listAllClassesAdmin
 * 4. getCurriculumFramework
 * 5. listAcademicYears
 * 6. approveTeacherAccount
 * 7. toggleTeacherStatus
 */

import { getDb } from './helpers/firebaseAdmin.js';
import { handleApiError, requireAdmin } from './helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './helpers/types.js';

export default async function handler(req: VercelApiRequest, res: VercelApiResponse) {
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
      case 'getAdminOverview':
        result = await handleGetAdminOverview(req);
        break;

      case 'listTeachers':
        result = await handleListTeachers(req);
        break;

      case 'listAllClassesAdmin':
        result = await handleListAllClassesAdmin(req);
        break;

      case 'getCurriculumFramework':
        result = await handleGetCurriculumFramework(req);
        break;

      case 'listAcademicYears':
        result = await handleListAcademicYears(req);
        break;

      case 'approveTeacherAccount':
        result = await handleApproveTeacherAccount(req, data);
        break;

      case 'toggleTeacherStatus':
        result = await handleToggleTeacherStatus(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động quản trị "${action}" không được hỗ trợ trong nhóm /api/admin.`
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

// 1. GET ADMIN OVERVIEW
async function handleGetAdminOverview(req: VercelApiRequest) {
  await requireAdmin(req);
  const db = getDb();

  const [
    usersSnap,
    classesSnap,
    studentsSnap,
    lessonsSnap,
    assignmentsSnap,
    attemptsSnap
  ] = await Promise.all([
    db.collection('users').get(),
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get()
  ]);

  let totalTeachers = 0;
  let activeTeachers = 0;
  let pendingTeachers = 0;

  usersSnap.forEach((d) => {
    const u = d.data();
    if (u.role === 'teacher') {
      totalTeachers++;
      if (u.status === 'active') activeTeachers++;
      if (u.status === 'pending_approval') pendingTeachers++;
    }
  });

  return {
    success: true,
    totalClasses: classesSnap.size,
    totalStudents: studentsSnap.size,
    totalLessons: lessonsSnap.size,
    totalAssignments: assignmentsSnap.size,
    totalAttempts: attemptsSnap.size,
    totalTeachers,
    activeTeachers,
    pendingTeachers
  };
}

// 2. LIST TEACHERS
async function handleListTeachers(req: VercelApiRequest) {
  await requireAdmin(req);
  const db = getDb();

  const usersSnap = await db.collection('users').where('role', '==', 'teacher').get();
  const classesSnap = await db.collection('classes').get();

  const classCountMap: Record<string, number> = {};
  classesSnap.forEach((c) => {
    const tUid = c.data().teacherUid;
    if (tUid) {
      classCountMap[tUid] = (classCountMap[tUid] || 0) + 1;
    }
  });

  const teachers = usersSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      email: d.email || '',
      displayName: d.displayName || 'Giáo viên',
      status: d.status || 'active',
      role: 'teacher',
      classCount: classCountMap[doc.id] || 0,
      createdAt: d.createdAt || Date.now()
    };
  });

  return { success: true, teachers };
}

// 3. LIST ALL CLASSES ADMIN
async function handleListAllClassesAdmin(req: VercelApiRequest) {
  await requireAdmin(req);
  const db = getDb();

  const [classesSnap, usersSnap, studentsSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('users').get(),
    db.collection('students').get()
  ]);

  const teacherMap: Record<string, string> = {};
  usersSnap.forEach((d) => {
    teacherMap[d.id] = d.data().displayName || d.data().email || 'Giáo viên';
  });

  const studentCountMap: Record<string, number> = {};
  studentsSnap.forEach((s) => {
    const cId = s.data().classId;
    if (cId) {
      studentCountMap[cId] = (studentCountMap[cId] || 0) + 1;
    }
  });

  const classes = classesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      grade: d.grade,
      classCode: d.classCode,
      academicYear: d.academicYear || '2025-2026',
      studentCount: studentCountMap[doc.id] || 0,
      teacherUid: d.teacherUid,
      teacherName: teacherMap[d.teacherUid] || 'Chưa phân công',
      status: d.status || 'active',
      createdAt: d.createdAt || Date.now()
    };
  });

  return { success: true, classes };
}

// 4. GET CURRICULUM FRAMEWORK
async function handleGetCurriculumFramework(req: VercelApiRequest) {
  await requireAdmin(req);
  const db = getDb();

  const snap = await db.collection('curriculumNodes').get();
  const nodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return { success: true, nodes };
}

// 5. LIST ACADEMIC YEARS
async function handleListAcademicYears(req: VercelApiRequest) {
  await requireAdmin(req);
  return {
    success: true,
    academicYears: ['2025-2026', '2026-2027'],
    currentAcademicYear: '2025-2026'
  };
}

// 6. APPROVE TEACHER ACCOUNT
async function handleApproveTeacherAccount(req: VercelApiRequest, data: any) {
  await requireAdmin(req);
  const { teacherUid } = data || {};
  if (!teacherUid) throw new ApiError(400, 'invalid-argument', 'Mã giáo viên không được để trống.');

  const db = getDb();
  await db.collection('users').doc(teacherUid).update({
    status: 'active',
    updatedAt: Date.now()
  });

  return { success: true, message: 'Đã phê duyệt tài khoản giáo viên thành công.' };
}

// 7. TOGGLE TEACHER STATUS
async function handleToggleTeacherStatus(req: VercelApiRequest, data: any) {
  await requireAdmin(req);
  const { teacherUid, status } = data || {};
  if (!teacherUid || !status) {
    throw new ApiError(400, 'invalid-argument', 'Mã giáo viên và trạng thái không được để trống.');
  }

  const db = getDb();
  await db.collection('users').doc(teacherUid).update({
    status,
    updatedAt: Date.now()
  });

  return { success: true, message: `Đã cập nhật trạng thái tài khoản thành ${status}.` };
}
