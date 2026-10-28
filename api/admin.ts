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

import { getDb } from './_helpers/firebaseAdmin.js';
import { handleApiError, requireAdmin } from './_helpers/authMiddleware.js';
import { ApiError, VercelApiRequest, VercelApiResponse } from './_helpers/types.js';

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
        result = await handleGetCurriculumFramework(req, data);
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

// Memory caches for admin endpoints to eliminate repetitive full-collection scans
const adminOverviewCache = { data: null as any, timestamp: 0 };
const ADMIN_OVERVIEW_TTL_MS = 3 * 60 * 1000;

const adminTeachersCache = { data: null as any, timestamp: 0 };
const ADMIN_TEACHERS_TTL_MS = 2 * 60 * 1000;

const adminClassesCache = { data: null as any, timestamp: 0 };
const ADMIN_CLASSES_TTL_MS = 2 * 60 * 1000;

const adminCurriculumCache = new Map<string, { data: any; timestamp: number }>();
const ADMIN_CURRICULUM_TTL_MS = 30 * 60 * 1000;

const adminAcademicYearsCache = { data: null as any, timestamp: 0 };
const ADMIN_ACADEMIC_YEARS_TTL_MS = 5 * 60 * 1000;

// 1. GET ADMIN OVERVIEW
async function handleGetAdminOverview(req: VercelApiRequest) {
  await requireAdmin(req);

  if (adminOverviewCache.data && Date.now() - adminOverviewCache.timestamp < ADMIN_OVERVIEW_TTL_MS) {
    return adminOverviewCache.data;
  }

  const db = getDb();

  const [
    teachersSnap,
    classesCountSnap,
    studentsCountSnap,
    lessonsCountSnap,
    assignmentsCountSnap,
    attemptsCountSnap,
    completedAttemptsCountSnap,
    curriculumSnap
  ] = await Promise.all([
    db.collection('users').where('role', '==', 'teacher').limit(100).get(),
    db.collection('classes').count().get(),
    db.collection('students').count().get(),
    db.collection('lessons').count().get(),
    db.collection('assignments').count().get(),
    db.collection('attempts').count().get(),
    db.collection('attempts').where('status', '==', 'completed').count().get(),
    db.collection('curriculumNodes').get()
  ]);

  let totalTeachers = 0;
  let activeTeachers = 0;
  let pendingTeachers = 0;
  let isolatedTestTeachers = 0;

  teachersSnap.forEach((d) => {
    const u = d.data();
    if (u.status === 'test_isolated') {
      isolatedTestTeachers++;
    } else {
      totalTeachers++;
      if (u.status === 'active') activeTeachers++;
      if (u.status === 'pending_approval') pendingTeachers++;
    }
  });

  const curriculumCoverage: Record<number, number> = { 2: 0, 3: 0 };
  curriculumSnap.forEach((d) => {
    const c = d.data();
    const g = Number(c.grade);
    if (g === 2 || g === 3) {
      curriculumCoverage[g] = (curriculumCoverage[g] || 0) + 1;
    }
  });

  const totalAttempts = attemptsCountSnap.data().count;
  const completedAttempts = completedAttemptsCountSnap.data().count;
  const inProgressAttempts = Math.max(0, totalAttempts - completedAttempts);

  const result = {
    success: true,
    totalClasses: classesCountSnap.data().count,
    totalStudents: studentsCountSnap.data().count,
    totalLessons: lessonsCountSnap.data().count,
    totalAssignments: assignmentsCountSnap.data().count,
    totalAttempts,
    completedAttempts,
    inProgressAttempts,
    totalTeachers,
    activeTeachers,
    pendingTeachers,
    isolatedTestTeachers,
    curriculumCoverage
  };

  adminOverviewCache.data = result;
  adminOverviewCache.timestamp = Date.now();
  return result;
}

// 2. LIST TEACHERS
async function handleListTeachers(req: VercelApiRequest) {
  await requireAdmin(req);

  if (adminTeachersCache.data && Date.now() - adminTeachersCache.timestamp < ADMIN_TEACHERS_TTL_MS) {
    return adminTeachersCache.data;
  }

  const db = getDb();

  const [usersSnap, classesSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'teacher').limit(100).get(),
    db.collection('classes').limit(100).get()
  ]);

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

  const result = { success: true, teachers };
  adminTeachersCache.data = result;
  adminTeachersCache.timestamp = Date.now();
  return result;
}

// 3. LIST ALL CLASSES ADMIN (OPTIMIZED: Eliminates full students collection scan)
async function handleListAllClassesAdmin(req: VercelApiRequest) {
  await requireAdmin(req);

  if (adminClassesCache.data && Date.now() - adminClassesCache.timestamp < ADMIN_CLASSES_TTL_MS) {
    return adminClassesCache.data;
  }

  const db = getDb();

  const [classesSnap, teachersSnap] = await Promise.all([
    db.collection('classes').limit(100).get(),
    db.collection('users').where('role', '==', 'teacher').limit(100).get()
  ]);

  const teacherMap: Record<string, string> = {};
  teachersSnap.forEach((d) => {
    teacherMap[d.id] = d.data().displayName || d.data().email || 'Giáo viên';
  });

  const classes = classesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name,
      grade: d.grade,
      classCode: d.classCode,
      academicYear: d.academicYear || '2026-2027',
      studentCount: typeof d.studentCount === 'number' ? d.studentCount : 0,
      teacherUid: d.teacherUid,
      teacherName: teacherMap[d.teacherUid] || 'Chưa phân công',
      status: d.status || 'active',
      createdAt: d.createdAt || Date.now()
    };
  });

  const result = { success: true, classes };
  adminClassesCache.data = result;
  adminClassesCache.timestamp = Date.now();
  return result;
}

// 4. GET CURRICULUM FRAMEWORK
async function handleGetCurriculumFramework(req: VercelApiRequest, data: any) {
  await requireAdmin(req);
  const { grade } = data || {};
  const cacheKey = `curr_${grade || 'all'}`;

  const cached = adminCurriculumCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ADMIN_CURRICULUM_TTL_MS) {
    return cached.data;
  }

  const db = getDb();

  let query: FirebaseFirestore.Query = db.collection('curriculumNodes');
  if (grade && (Number(grade) === 2 || Number(grade) === 3)) {
    query = query.where('grade', '==', Number(grade));
  }

  const snap = await query.get();
  const nodes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const result = { success: true, nodes };
  adminCurriculumCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// 5. LIST ACADEMIC YEARS (OPTIMIZED: Eliminates full students collection scan)
async function handleListAcademicYears(req: VercelApiRequest) {
  await requireAdmin(req);

  if (adminAcademicYearsCache.data && Date.now() - adminAcademicYearsCache.timestamp < ADMIN_ACADEMIC_YEARS_TTL_MS) {
    return adminAcademicYearsCache.data;
  }

  const db = getDb();

  const [aySnap, classesSnap] = await Promise.all([
    db.collection('academicYears').get(),
    db.collection('classes').get()
  ]);

  const configuredYears = new Map<string, any>();
  aySnap.forEach((d) => {
    configuredYears.set(d.id, { id: d.id, ...d.data() });
  });

  const allYearsSet = new Set<string>(configuredYears.keys());
  const yearClassCount = new Map<string, number>();
  const yearStudentCount = new Map<string, number>();

  classesSnap.forEach((d) => {
    const cData = d.data();
    const yr = cData.academicYear || '2026-2027';
    allYearsSet.add(yr);
    yearClassCount.set(yr, (yearClassCount.get(yr) || 0) + 1);
    const count = typeof cData.studentCount === 'number' ? cData.studentCount : 0;
    yearStudentCount.set(yr, (yearStudentCount.get(yr) || 0) + count);
  });

  // Ensure operational year 2026-2027 exists
  allYearsSet.add('2026-2027');

  let currentYearCode = '2026-2027';
  for (const [code, data] of configuredYears.entries()) {
    if (data.isCurrent) {
      currentYearCode = code;
      break;
    }
  }

  const parseStartYear = (code: string): number => {
    const match = String(code).match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : 2026;
  };
  const currentStartYear = parseStartYear(currentYearCode);

  const items = Array.from(allYearsSet)
    .sort((a, b) => (b || '').localeCompare(a || ''))
    .map((code) => {
      const existing = configuredYears.get(code);
      const startYear = parseStartYear(code);
      const isCurrent = code === currentYearCode;

      let periodType: 'past' | 'current' | 'future' = 'past';
      if (isCurrent) {
        periodType = 'current';
      } else if (startYear > currentStartYear) {
        periodType = 'future';
      } else {
        periodType = 'past';
      }

      let totalClasses = 0;
      let activeClasses = 0;
      classesSnap.forEach((d) => {
        const c = d.data();
        if ((c.academicYear || '2026-2027') === code) {
          totalClasses++;
          if (c.status !== 'archived') activeClasses++;
        }
      });

      return {
        id: code,
        code,
        name: existing?.name || `Năm học ${code}`,
        isCurrent,
        periodType,
        status: existing?.status || 'active',
        description: existing?.description || '',
        startDate: existing?.startDate || '',
        endDate: existing?.endDate || '',
        totalClasses,
        activeClasses,
        totalStudents: yearStudentCount.get(code) || 0,
        canDelete: totalClasses === 0,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: existing?.updatedAt || Date.now()
      };
    });

  const result = {
    success: true,
    academicYears: items,
    currentAcademicYear: currentYearCode
  };
  adminAcademicYearsCache.data = result;
  adminAcademicYearsCache.timestamp = Date.now();
  return result;
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
