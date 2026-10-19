import * as functions from 'firebase-functions';
import * as fs from 'fs';
import * as path from 'path';
import { db, auth, admin } from './config/firebase';
import {
  generateAccessCode,
  generateClassCode,
  generateSalt,
  hashAccessCode,
  verifyAccessCode,
  hashPassword,
  verifyPassword
} from './utils/crypto';
import {
  generateLessonWithAI,
  generateRemediationWithAI,
  checkAIConfig,
  runAILiveTest,
  generateAdditionalQuestionsWithAI,
  generateSpeechWithGeminiTTS,
  normalizeDraftQuestions
} from './services/aiAdapter';
import { StorageService } from './services/storageService';
import { PiperService } from './services/piperService';
import { SEED_LESSONS } from './seed/seedData';
import { VERIFIED_CURRICULUM_NODES } from './services/curriculumBank';
import {
  DifficultyLevel,
  FullAuthoringQuestion,
  Grade,
  LessonDraftInput,
  LessonDraftSchema,
  QuestionAnswerDetail,
  SkillTag,
  SKILL_LABELS,
  CurriculumNodeSchema,
  CurriculumNode,
  AudioMetadata,
  RemediationSkillDetail,
  RemediationQuestionInsight,
  RemediationClassStatistics,
  AnalysisScope,
  ANALYSIS_SCOPE_LABELS,
  QuestionType,
  RemediationActivity,
  RemediationActivityType
} from '@emytv/shared';

// ==========================================
// HELPER: VERIFY TEACHER AUTH
// ==========================================
async function requireTeacher(context: functions.https.CallableContext): Promise<string> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Yêu cầu đăng nhập tài khoản giáo viên.'
    );
  }
  const uid = context.auth.uid;

  // Check custom claim or Firestore user doc
  if (context.auth.token.role === 'teacher') {
    return uid;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'teacher') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Chỉ tài khoản có vai trò Giáo viên mới có quyền thực hiện thao tác này.'
    );
  }

  return uid;
}

// ==========================================
// HELPER: VERIFY ADMIN AUTH
// ==========================================
async function requireAdmin(context: functions.https.CallableContext): Promise<string> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Yêu cầu đăng nhập tài khoản Quản trị viên.'
    );
  }
  const uid = context.auth.uid;

  if (context.auth.token.role === 'admin') {
    return uid;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập chức năng này.'
    );
  }

  return uid;
}

// ==========================================
// HELPER: VERIFY TEACHER OR ADMIN AUTH
// ==========================================
async function requireTeacherOrAdmin(context: functions.https.CallableContext): Promise<{ uid: string; role: 'teacher' | 'admin' }> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập tài khoản.');
  }
  const uid = context.auth.uid;
  if (context.auth.token.role === 'admin') return { uid, role: 'admin' };
  if (context.auth.token.role === 'teacher') return { uid, role: 'teacher' };

  const userDoc = await db.collection('users').doc(uid).get();
  const role = userDoc.data()?.role;
  if (role === 'admin' || role === 'teacher') {
    return { uid, role };
  }
  throw new functions.https.HttpsError('permission-denied', 'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền thực hiện.');
}

// ==========================================
// HELPER: VERIFY STUDENT SESSION
// ==========================================
async function requireStudentSession(context: functions.https.CallableContext): Promise<{
  authUid: string;
  studentId: string;
  classId: string;
  displayAlias: string;
}> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Yêu cầu đăng nhập phiên học sinh.'
    );
  }
  const authUid = context.auth.uid;

  const sessionDoc = await db.collection('studentSessions').doc(authUid).get();
  if (!sessionDoc.exists) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Phiên học sinh không hợp lệ hoặc đã hết hạn.'
    );
  }

  const data = sessionDoc.data()!;
  if (data.revokedAt || data.validUntil < Date.now()) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Mã truy cập hoặc phiên học sinh đã hết hiệu lực. Vui lòng đăng nhập lại.'
    );
  }

  let authoritativeClassId = data.classId;
  let authoritativeDisplayAlias = data.displayAlias;

  // Cross-reference with students collection to guarantee real-time class synchronization (Module 1.1 Hotfix)
  if (data.studentId) {
    const sDoc = await db.collection('students').doc(data.studentId).get();
    if (sDoc.exists) {
      const sData = sDoc.data()!;
      if (sData.classId && sData.classId !== data.classId) {
        authoritativeClassId = sData.classId;
        // Self-heal studentSessions doc
        await sessionDoc.ref.update({
          classId: authoritativeClassId,
          updatedAt: Date.now()
        }).catch(() => null);
      }
      if (sData.displayAlias) {
        authoritativeDisplayAlias = sData.displayAlias;
      }
    }
  }

  return {
    authUid,
    studentId: data.studentId,
    classId: authoritativeClassId,
    displayAlias: authoritativeDisplayAlias
  };
}

// ==========================================
// HELPER: VIETNAMESE TIMEZONE & ACADEMIC YEAR AUDIT (GIAI ĐOẠN 2)
// ==========================================
export function formatVietnamDateTime(ts: number | string | Date | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatVietnamDate(ts: number | string | Date | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function getAcademicYearFromTimestamp(ts: number | null | undefined): {
  academicYear: string;
  semester: number;
  semesterLabel: string;
} {
  if (!ts) {
    return { academicYear: '2026-2027', semester: 1, semesterLabel: 'Học kỳ I' };
  }
  const d = new Date(ts);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '10', 10);

  // Vietnam school calendar:
  // Month 8-12: Year N to Year N+1, Semester 1
  // Month 1: Year N to Year N+1, Semester 1
  // Month 2-6: Year N to Year N+1, Semester 2
  // Month 7: Transition
  let academicYear = '2026-2027';
  let semester = 1;
  if (month >= 8) {
    academicYear = `${year}-${year + 1}`;
    semester = 1;
  } else if (month <= 6) {
    academicYear = `${year - 1}-${year}`;
    semester = (month === 1) ? 1 : 2;
  } else {
    academicYear = `${year - 1}-${year}`;
    semester = 2;
  }
  return {
    academicYear,
    semester,
    semesterLabel: semester === 2 ? 'Học kỳ II' : 'Học kỳ I'
  };
}

// ==========================================
// 1. BOOTSTRAP TEACHER ROLE
// ==========================================
export const bootstrapTeacherRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập.');
  }

  // Reject anonymous users from attempting to become teacher
  if (context.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Tài khoản ẩn danh của học sinh không thể nhận quyền Giáo viên.');
  }

  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const displayName = context.auth.token.name || email.split('@')[0] || 'Giáo viên';

  // SECURITY GUARD:
  // In production, prevent arbitrary users from granting themselves the teacher role.
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const adminSecret = data?.adminSecret;
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);
  const emailAllowlist = (process.env.TEACHER_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const isCallerAdmin = context.auth.token.role === 'admin';
  const isAllowedBySecret = Boolean(expectedSecret && adminSecret && adminSecret === expectedSecret);
  const isAllowedByAllowlist = Boolean(
    email && 
    (emailAllowlist.includes(email.toLowerCase()) || email.endsWith('@emytv.edu.vn')) && 
    (isEmulator || context.auth.token.email_verified === true)
  );

  if (!isCallerAdmin && !isAllowedBySecret && !isAllowedByAllowlist) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Thao tác tự cấp quyền Giáo viên bị từ chối. Vui lòng liên hệ Quản trị viên hệ thống để được phê duyệt tài khoản.'
    );
  }

  // Set user role in users collection and set custom claim
  await db.collection('users').doc(uid).set(
    {
      uid,
      email,
      displayName,
      role: 'teacher',
      status: 'active',
      updatedAt: Date.now(),
      createdAt: Date.now()
    },
    { merge: true }
  );

  // Set custom user claim for efficient Security Rules checks
  await auth.setCustomUserClaims(uid, { role: 'teacher' });

  return {
    success: true,
    message: `Đã cấp quyền Giáo viên thành công cho tài khoản ${email}.`
  };
});

// ==========================================
// 2. CHECK AI SERVICE STATUS
// ==========================================
export const getAIStatus = functions.https.onCall(async (_data, _context) => {
  return checkAIConfig();
});

// ==========================================
// 2.5. TEST LIVE AI CONNECTION (TEACHER ONLY, RATE-LIMITED)
// ==========================================
export const testAIConnection = functions.https.onCall(async (_data, context) => {
  await requireTeacher(context);
  return await runAILiveTest();
});

// ==========================================
// 3. STUDENT JOIN CLASS (AUTHENTICATION & BINDING)
// ==========================================
export const joinClass = functions.https.onCall(async (data, context) => {
  const { classCode, accessCode } = data || {};
  if (!classCode || !accessCode) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Vui lòng nhập đầy đủ Mã lớp và Mã học sinh.'
    );
  }

  const cleanClassCode = String(classCode).trim().toUpperCase();
  const cleanAccessCode = String(accessCode).trim().toUpperCase();

  // 1. Anti-brute-force rate limiting check (per class + accessCode attempt)
  // Prevents locking out the whole classroom when one user repeatedly fails!
  const attemptKey = `${cleanClassCode}_${cleanAccessCode}`;
  const attemptRef = db.collection('loginAttempts').doc(attemptKey);
  const attemptSnap = await attemptRef.get();
  const attemptData = attemptSnap.data() || { failedCount: 0, lockedUntil: 0 };
  const now = Date.now();

  if (attemptData.lockedUntil && now < attemptData.lockedUntil) {
    const remainingSeconds = Math.ceil((attemptData.lockedUntil - now) / 1000);
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Mã này tạm thời bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainingSeconds} giây.`
    );
  }

  // Find class
  const classSnap = await db
    .collection('classes')
    .where('classCode', '==', cleanClassCode)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (classSnap.empty) {
    throw new functions.https.HttpsError(
      'not-found',
      'Mã lớp không tồn tại hoặc đã bị khóa. Vui lòng kiểm tra lại với giáo viên.'
    );
  }

  const classDoc = classSnap.docs[0];
  const classData = classDoc.data();
  const classId = classDoc.id;

  // Search students in class to match access code
  const studentsSnap = await db
    .collection('students')
    .where('classId', '==', classId)
    .get();

  if (studentsSnap.empty) {
    throw new functions.https.HttpsError(
      'not-found',
      'Lớp học chưa có danh sách học sinh. Vui lòng liên hệ giáo viên.'
    );
  }

  // Check if student accidentally entered studentCode (e.g. HS2A-01) instead of their secret access PIN
  const matchedStudentCodeDoc = studentsSnap.docs.find((d) => {
    const s = d.data();
    return s.studentCode && s.studentCode.trim().toUpperCase() === cleanAccessCode;
  });

  if (matchedStudentCodeDoc) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Bạn đang nhập Mã học sinh (${cleanAccessCode}). Vui lòng nhập đúng Mã PIN cá nhân 6 ký tự do thầy cô cung cấp (hoặc nhờ cô giáo cấp lại PIN mới).`
    );
  }

  let matchedStudent: any = null;

  for (const sDoc of studentsSnap.docs) {
    const sId = sDoc.id;
    const secretDoc = await db.collection('studentSecrets').doc(sId).get();
    if (!secretDoc.exists) continue;

    const secret = secretDoc.data()!;
    if (verifyAccessCode(cleanAccessCode, secret.salt, secret.accessCodeHash) || verifyPassword(String(accessCode).trim(), secret.salt, secret.accessCodeHash)) {
      matchedStudent = { id: sId, ...sDoc.data() };
      break;
    }
  }

  if (!matchedStudent) {
    const newFailedCount = (attemptData.failedCount || 0) + 1;
    const isLock = newFailedCount >= 5;
    await attemptRef.set(
      {
        classCode: cleanClassCode,
        accessCode: cleanAccessCode,
        failedCount: isLock ? 0 : newFailedCount,
        lockedUntil: isLock ? now + 5 * 60 * 1000 : 0, // 5 min lockout for this specific code
        lastFailedAt: now
      },
      { merge: true }
    );

    if (isLock) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Đã nhập sai mã này 5 lần liên tiếp. Mã tạm khóa 5 phút để bảo vệ an toàn.'
      );
    }

    throw new functions.https.HttpsError(
      'permission-denied',
      `Mã PIN không đúng hoặc đã bị đổi (Lần thử ${newFailedCount}/5). Vui lòng kiểm tra lại.`
    );
  }

  // Check if student account is suspended by teacher
  if (matchedStudent.status === 'suspended') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Tài khoản học sinh này đang bị tạm khóa bởi giáo viên. Vui lòng liên hệ thầy cô giáo phụ trách để được mở khóa.'
    );
  }

  // Clear failed attempts counter on successful verification
  if (attemptSnap.exists && (attemptData.failedCount > 0 || attemptData.lockedUntil > 0)) {
    await attemptRef.delete().catch(() => {});
  }

  // Bind authUid to student
  let authUid = context.auth?.uid;
  if (!authUid) {
    // If not authenticated anonymously yet, create custom token
    const customToken = await auth.createCustomToken(`student_${matchedStudent.id}`, {
      role: 'student',
      classId,
      studentId: matchedStudent.id
    });
    authUid = `student_${matchedStudent.id}`;

    // Store server-trusted session
    await db.collection('studentSessions').doc(authUid).set({
      authUid,
      studentId: matchedStudent.id,
      classId,
      displayAlias: matchedStudent.displayAlias,
      validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      createdAt: Date.now()
    });

    return {
      success: true,
      token: customToken,
      student: {
        id: matchedStudent.id,
        displayAlias: matchedStudent.displayAlias,
        studentCode: matchedStudent.studentCode,
        classId,
        className: classData.name,
        grade: classData.grade
      }
    };
  } else {
    // Bind existing anonymous authUid
    await db.collection('studentSessions').doc(authUid).set({
      authUid,
      studentId: matchedStudent.id,
      classId,
      displayAlias: matchedStudent.displayAlias,
      validUntil: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now()
    });

    return {
      success: true,
      student: {
        id: matchedStudent.id,
        displayAlias: matchedStudent.displayAlias,
        studentCode: matchedStudent.studentCode,
        classId,
        className: classData.name,
        grade: classData.grade
      }
    };
  }
});

// ==========================================
// 4. CREATE CLASSROOM
// ==========================================
export const createClassroom = functions.https.onCall(async (data, context) => {
  const { uid, role } = await requireTeacherOrAdmin(context);
  const { name, grade, academicYear, classCode: customCode, teacherUid: targetTeacherUid } = data || {};

  const numGrade = Number(grade);
  if (!name || (numGrade !== 2 && numGrade !== 3)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Tên lớp và Khối lớp (2 hoặc 3) là bắt buộc.'
    );
  }

  const assignedTeacherUid = role === 'admin' && targetTeacherUid ? String(targetTeacherUid).trim() : uid;

  let classCode = customCode ? String(customCode).trim().toUpperCase() : generateClassCode(6);
  if (customCode) {
    const existing = await db.collection('classes').where('classCode', '==', classCode).get();
    if (!existing.empty) {
      throw new functions.https.HttpsError('already-exists', `Mã lớp "${classCode}" đã tồn tại. Vui lòng chọn mã khác.`);
    }
  }

  const classRef = db.collection('classes').doc();
  const classData = {
    id: classRef.id,
    teacherUid: assignedTeacherUid,
    name: String(name).trim(),
    grade: numGrade as Grade,
    classCode,
    academicYear: academicYear ? String(academicYear).trim() : '2026-2027',
    status: 'active',
    studentCount: 0,
    createdAt: Date.now()
  };

  await classRef.set(classData);
  return { success: true, classroom: classData };
});

// ==========================================
// 4B. UPDATE CLASSROOM (NAME, GRADE, ACADEMIC YEAR, CODE)
// ==========================================
export const updateClassroom = functions.https.onCall(async (data, context) => {
  const { uid, role } = await requireTeacherOrAdmin(context);
  const { classId, name, grade, academicYear, classCode } = data || {};

  if (!classId) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu mã định danh lớp học (classId).');
  }

  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền chỉnh sửa lớp học này.');
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
      updateFields.grade = numGrade as Grade;
    }
  }

  if (academicYear && typeof academicYear === 'string') {
    updateFields.academicYear = academicYear.trim();
  }

  if (classCode && typeof classCode === 'string') {
    const cleanCode = classCode.trim().toUpperCase();
    if (cleanCode !== classData.classCode) {
      const existingSnap = await db.collection('classes').where('classCode', '==', cleanCode).get();
      const duplicates = existingSnap.docs.filter((d) => d.id !== classId);
      if (duplicates.length > 0) {
        throw new functions.https.HttpsError('already-exists', `Mã lớp "${cleanCode}" đã được sử dụng bởi lớp khác.`);
      }
      updateFields.classCode = cleanCode;
    }
  }

  await classRef.update(updateFields);
  return { success: true, classroom: { ...classData, ...updateFields } };
});

// ==========================================
// 4C. ARCHIVE / RESTORE CLASSROOM
// ==========================================
export const archiveClassroom = functions.https.onCall(async (data, context) => {
  const { uid, role } = await requireTeacherOrAdmin(context);
  const { classId, status } = data || {};

  if (!classId || (status !== 'active' && status !== 'archived')) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu mã lớp hoặc trạng thái không hợp lệ (active|archived).');
  }

  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý lớp học này.');
  }

  await classRef.update({
    status,
    updatedAt: Date.now()
  });

  return {
    success: true,
    status,
    message: status === 'archived'
      ? `Đã chuyển lớp "${classData.name}" sang trạng thái Lưu trữ.`
      : `Đã khôi phục lớp "${classData.name}" hoạt động trở lại!`
  };
});

// ==========================================
// 4D. DELETE CLASSROOM (SAFE DEPENDENCY CHECK)
// ==========================================
export const deleteClassroom = functions.https.onCall(async (data, context) => {
  const { uid, role } = await requireTeacherOrAdmin(context);
  const { classId } = data || {};

  if (!classId) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu mã lớp cần xóa.');
  }

  const classRef = db.collection('classes').doc(classId);
  const classDoc = await classRef.get();
  if (!classDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Lớp học không tồn tại.');
  }

  const classData = classDoc.data()!;
  if (role !== 'admin' && classData.teacherUid !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền xóa lớp học này.');
  }

  // Check dependencies: students and assignments
  const [studentsSnap, assignmentsSnap] = await Promise.all([
    db.collection('students').where('classId', '==', classId).get(),
    db.collection('assignments').where('classId', '==', classId).get()
  ]);

  const studentCount = studentsSnap.size;
  const assignmentCount = assignmentsSnap.size;

  if (studentCount > 0 || assignmentCount > 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Không thể xóa vĩnh viễn lớp "${classData.name}" vì đang có ${studentCount} học sinh và ${assignmentCount} bài đã giao. Vui lòng chuyển sang trạng thái "Lưu trữ" để bảo toàn lịch sử học tập.`
    );
  }

  await classRef.delete();
  return {
    success: true,
    message: `Đã xóa lớp "${classData.name}" thành công.`
  };
});

// ==========================================
// 4E. CHECK CLASS CODE AVAILABILITY
// ==========================================
export const checkClassCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập.');
  }
  const { classCode, excludeClassId } = data || {};
  if (!classCode) return { isAvailable: false, exists: false };

  const cleanCode = String(classCode).trim().toUpperCase();
  const snap = await db.collection('classes').where('classCode', '==', cleanCode).get();
  const duplicates = snap.docs.filter((d) => d.id !== excludeClassId);

  return {
    isAvailable: duplicates.length === 0,
    exists: duplicates.length > 0
  };
});

// ==========================================
// 5. CREATE STUDENT ACCESS CODE
// ==========================================
export const createStudentAccess = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { classId, displayAlias, studentCode } = data || {};

  if (!classId || !displayAlias) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Thiếu mã lớp hoặc tên/biệt danh học sinh.'
    );
  }

  // Verify teacher owns class
  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý lớp này.');
  }

  const cleanAlias = String(displayAlias).trim();
  const cleanCode = studentCode ? String(studentCode).trim() : `HS${Math.floor(1000 + Math.random() * 9000)}`;

  // Generate 6-char access pin
  const accessCode = generateAccessCode(6);
  const salt = generateSalt();
  const accessCodeHash = hashAccessCode(accessCode, salt);

  const studentRef = db.collection('students').doc();
  const studentId = studentRef.id;

  // Write safe student profile (NO HASH)
  await studentRef.set({
    id: studentId,
    classId,
    studentCode: cleanCode,
    displayAlias: cleanAlias,
    status: 'active',
    createdAt: Date.now()
  });

  // Write secret hash in isolated collection (Admin SDK only)
  await db.collection('studentSecrets').doc(studentId).set({
    studentId,
    accessCodeHash,
    salt,
    rotatedAt: Date.now()
  });

  return {
    success: true,
    student: {
      id: studentId,
      classId,
      studentCode: cleanCode,
      displayAlias: cleanAlias,
      accessCode // Returned once so teacher can distribute to student
    }
  };
});

// ==========================================
// 6. ROTATE STUDENT ACCESS CODE
// ==========================================
export const rotateStudentAccess = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId } = data || {};

  if (!studentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã học sinh không được để trống.');
  }

  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy hồ sơ học sinh.');
  }

  const studentData = studentDoc.data()!;
  const classDoc = await db.collection('classes').doc(studentData.classId).get();
  if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  // Generate new access code
  const newAccessCode = generateAccessCode(6);
  const salt = generateSalt();
  const accessCodeHash = hashAccessCode(newAccessCode, salt);

  await db.collection('studentSecrets').doc(studentId).set({
    studentId,
    accessCodeHash,
    salt,
    rotatedAt: Date.now()
  });

  // Invalidate any active sessions for this student
  const activeSessions = await db
    .collection('studentSessions')
    .where('studentId', '==', studentId)
    .get();

  const batch = db.batch();
  activeSessions.docs.forEach((doc) => {
    batch.update(doc.ref, { revokedAt: Date.now() });
  });
  batch.update(studentDoc.ref, { lastPinRotatedAt: Date.now(), updatedAt: Date.now() });
  await batch.commit();

  return {
    success: true,
    studentId,
    displayAlias: studentData.displayAlias,
    newAccessCode
  };
});

// ==========================================
// 6B. UPDATE STUDENT INFO (PHASE 3 - P0)
// ==========================================
export const updateStudentInfo = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId, displayAlias, studentCode } = data || {};

  if (!studentId || !displayAlias) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã học sinh và tên hiển thị không được để trống.');
  }

  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  const updates: any = {
    displayAlias: String(displayAlias).trim(),
    updatedAt: Date.now()
  };

  if (studentCode) {
    const cleanCode = String(studentCode).trim().toUpperCase();
    if (cleanCode !== sData.studentCode) {
      const dup = await db.collection('students')
        .where('classId', '==', sData.classId)
        .where('studentCode', '==', cleanCode)
        .get();
      if (!dup.empty) {
        throw new functions.https.HttpsError('already-exists', `Mã học sinh "${cleanCode}" đã tồn tại trong lớp này.`);
      }
      updates.studentCode = cleanCode;
    }
  }

  await sDoc.ref.update(updates);
  return { success: true, message: 'Đã cập nhật thông tin học sinh thành công.' };
});

// ==========================================
// 6C. TOGGLE STUDENT STATUS (LOCK / UNLOCK / ARCHIVE / RESTORE)
// ==========================================
export const toggleStudentStatus = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId, status } = data || {};

  if (!studentId || !['active', 'suspended', 'archived'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu trạng thái học sinh không hợp lệ.');
  }

  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  const isOwner = classDoc.exists && classDoc.data()?.teacherUid === teacherUid;
  const isAdmin = context.auth?.token.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý học sinh này.');
  }

  await sDoc.ref.update({
    status,
    updatedAt: Date.now()
  });

  if (status === 'suspended' || status === 'archived') {
    const sessions = await db.collection('studentSessions').where('studentId', '==', studentId).get();
    const batch = db.batch();
    sessions.docs.forEach((doc) => {
      batch.update(doc.ref, { revokedAt: Date.now() });
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
});

// ==========================================
// 6E. DELETE STUDENT (PROTECT ATTEMPTS & LEARNING HISTORY)
// ==========================================
export const deleteStudent = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId } = data || {};
  if (!studentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp studentId.');
  }

  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const sData = sDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  const isOwner = classDoc.exists && classDoc.data()?.teacherUid === teacherUid;
  const isAdmin = context.auth?.token.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền xóa học sinh này.');
  }

  // Check if student has attempts (lượt làm bài)
  const attemptsSnap = await db.collection('attempts').where('studentId', '==', studentId).limit(1).get();
  if (!attemptsSnap.empty) {
    throw new functions.https.HttpsError(
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
    batch.update(classDoc.ref, { studentCount: Math.max(0, cur - 1), updatedAt: Date.now() });
  }

  await batch.commit();
  return {
    success: true,
    message: `Đã xóa vĩnh viễn hồ sơ học sinh "${sData.displayAlias}" (${sData.studentCode || ''}) thành công.`
  };
});

// ==========================================
// 6F. BATCH UPDATE STUDENTS STATUS
// ==========================================
export const batchUpdateStudents = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentIds, action } = data || {};

  if (!Array.isArray(studentIds) || studentIds.length === 0 || !['lock', 'unlock', 'archive', 'delete'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu thao tác hàng loạt không hợp lệ.');
  }

  let successCount = 0;
  let protectedCount = 0;
  const messages: string[] = [];

  for (const sId of studentIds) {
    const sDoc = await db.collection('students').doc(sId).get();
    if (!sDoc.exists) continue;
    const sData = sDoc.data()!;

    const classDoc = await db.collection('classes').doc(sData.classId).get();
    const isOwner = classDoc.exists && classDoc.data()?.teacherUid === teacherUid;
    const isAdmin = context.auth?.token.role === 'admin';
    if (!isOwner && !isAdmin) continue;

    if (action === 'delete') {
      const attemptsSnap = await db.collection('attempts').where('studentId', '==', sId).limit(1).get();
      if (!attemptsSnap.empty) {
        await sDoc.ref.update({ status: 'archived', updatedAt: Date.now() });
        protectedCount++;
        messages.push(`Học sinh "${sData.displayAlias}" đã có bài làm -> đã chuyển sang Lưu trữ để bảo vệ kết quả.`);
      } else {
        const batch = db.batch();
        batch.delete(sDoc.ref);
        batch.delete(db.collection('studentSecrets').doc(sId));
        if (sData.username || sData.studentCode) {
          batch.delete(db.collection('usernames').doc((sData.username || sData.studentCode).toLowerCase()));
        }
        await batch.commit();
        successCount++;
      }
    } else {
      const newStatus = action === 'lock' ? 'suspended' : action === 'archive' ? 'archived' : 'active';
      await sDoc.ref.update({ status: newStatus, updatedAt: Date.now() });
      if (newStatus !== 'active') {
        const sessions = await db.collection('studentSessions').where('studentId', '==', sId).get();
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
});

// ==========================================
// 6D. TRANSFER STUDENT TO ANOTHER CLASS (PHASE 3 - P0)
// ==========================================
export const transferStudentClass = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId, targetClassId, transferType, reason } = data || {};

  if (!studentId || !targetClassId) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã học sinh và lớp đích.');
  }

  const sDoc = await db.collection('students').doc(studentId).get();
  if (!sDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const sData = sDoc.data()!;
  if (sData.classId === targetClassId) {
    return { success: true, message: 'Học sinh đã thuộc lớp này.' };
  }

  const [sourceClass, targetClass] = await Promise.all([
    db.collection('classes').doc(sData.classId).get(),
    db.collection('classes').doc(targetClassId).get()
  ]);

  if (!sourceClass.exists || sourceClass.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý lớp nguồn.');
  }
  if (!targetClass.exists || targetClass.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý lớp đích.');
  }

  const sourceData = sourceClass.data()!;
  const targetData = targetClass.data()!;

  const sourceYear = sourceData.academicYear || '2026-2027';
  const targetYear = targetData.academicYear || '2026-2027';
  const effectiveTransferType = transferType || (sourceData.grade !== targetData.grade || sourceYear !== targetYear ? 'promote_next_year' : 'same_year');

  // Business Rule Invariants: Validate class compatibility
  if (effectiveTransferType === 'same_year') {
    if (sourceYear !== targetYear) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Chuyển lớp cùng năm học yêu cầu lớp đích phải cùng năm học với lớp nguồn (${sourceYear}). Lớp đích "${targetData.name}" thuộc năm học ${targetYear}.`
      );
    }
    if (sourceData.grade !== targetData.grade) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Chuyển lớp cùng năm học yêu cầu cùng khối lớp (Khối ${sourceData.grade}). Lớp đích "${targetData.name}" thuộc Khối ${targetData.grade}.`
      );
    }
  } else if (effectiveTransferType === 'promote_next_year') {
    if (sourceYear === '2026-2027' && targetYear === '2025-2026') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Không thể chuyển lên lớp năm mới lùi về niên khóa trước (từ ${sourceYear} về ${targetYear}).`
      );
    }
    if (targetData.grade < sourceData.grade) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Không thể chuyển lên lớp năm mới vào khối lớp thấp hơn (Khối ${sourceData.grade} về Khối ${targetData.grade}).`
      );
    }
  }

  // Avoid code collision in target class
  const existingInTarget = await db.collection('students')
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
    transferredBy: teacherUid,
    transferType: effectiveTransferType,
    academicYear: targetYear,
    reason: reason || (effectiveTransferType === 'promote_next_year' ? 'Lên lớp năm học mới' : 'Chuyển lớp cùng năm học')
  };

  const existingHistory = Array.isArray(sData.transferHistory) ? sData.transferHistory : [];

  const batch = db.batch();

  // 1. Update Student Document
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
  const sessionsSnap = await db.collection('studentSessions').where('studentId', '==', studentId).get();
  sessionsSnap.forEach((sesDoc) => {
    batch.update(sesDoc.ref, {
      classId: targetClassId,
      updatedAt: now
    });
  });

  // 3. Atomically update accurate student counts based on actual database size
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
});



// ==========================================
// 7. GENERATE LESSON DRAFT WITH AI
// ==========================================
export const generateLessonDraft = functions.https.onCall(async (data, context) => {
  await requireTeacher(context);

  const {
    grade,
    topic,
    genre,
    readingGoal,
    targetWordCount,
    difficulty,
    questionCount,
    customVocabulary,
    localContext
  } = data || {};

  if (!topic || (grade !== 2 && grade !== 3)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Vui lòng chọn khối lớp (2 hoặc 3) và chủ đề bài đọc.'
    );
  }

  try {
    const draft = await generateLessonWithAI({
      grade: Number(grade) as Grade,
      topic: String(topic),
      genre,
      readingGoal,
      targetWordCount: targetWordCount ? Number(targetWordCount) : undefined,
      difficulty,
      questionCount: questionCount ? Number(questionCount) : undefined,
      customVocabulary,
      localContext
    });

    return { success: true, draft, isAiGenerated: true };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// ==========================================
// 8. SAVE LESSON DRAFT (PHASE 1 - P0)
// ==========================================
export const saveLessonDraft = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId: existingLessonId, draft } = data || {};

  if (!draft || !draft.title || !draft.passage) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Bản nháp cần có tối thiểu tiêu đề và nội dung bài đọc.'
    );
  }

  const now = Date.now();
  const lessonRef = existingLessonId
    ? db.collection('lessons').doc(existingLessonId)
    : db.collection('lessons').doc();
  const lessonId = lessonRef.id;

  let existingLessonDocData: any = null;
  if (existingLessonId) {
    const existingDoc = await lessonRef.get();
    if (existingDoc.exists) {
      existingLessonDocData = existingDoc.data();
      if (existingLessonDocData?.teacherUid !== teacherUid) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền sửa bản nháp này.');
      }
    }
  }

  let resolvedAudioUrl = draft.audioUrl && !draft.audioUrl.startsWith('data:audio') ? draft.audioUrl : (draft.audioMetadata?.downloadUrl || undefined);
  let resolvedAudioMetadata = draft.audioMetadata || undefined;

  // Fallback to existing audio on disk/Firestore if draft didn't provide new audio
  if (!resolvedAudioUrl && existingLessonDocData?.audioUrl) {
    resolvedAudioUrl = existingLessonDocData.audioUrl;
    resolvedAudioMetadata = resolvedAudioMetadata || existingLessonDocData.audioMetadata;
  }

  const draftPayload = {
    ...draft,
    lessonId,
    title: String(draft.title).trim(),
    topic: String(draft.topic || 'Chủ đề chung').trim(),
    grade: Number(draft.grade || 2) as Grade,
    semester: Number(draft.semester || 1) as 1 | 2,
    week: draft.week ? Number(draft.week) : 1,
    genre: draft.genre || 'narrative',
    curriculumRequirement: draft.curriculumRequirement ? String(draft.curriculumRequirement).trim() : '',
    source: draft.source || 'ai_curriculum_aligned',
    referenceSource: draft.referenceSource ? String(draft.referenceSource).trim() : '',
    verificationStatus: draft.verificationStatus || 'ai_curriculum_aligned',
    academicYearScope: draft.academicYearScope || (draft.academicYear ? 'specific' : 'shared'),
    academicYear: draft.academicYearScope === 'specific' ? (draft.academicYear || '2026-2027') : null,
    passage: String(draft.passage).trim(),
    vocabulary: Array.isArray(draft.vocabulary) ? draft.vocabulary : [],
    questions: Array.isArray(draft.questions) ? normalizeDraftQuestions(draft.questions) : [],
    audioUrl: resolvedAudioUrl,
    audioMetadata: resolvedAudioMetadata
  };

  await lessonRef.set(
    {
      id: lessonId,
      teacherUid,
      title: draftPayload.title,
      topic: draftPayload.topic,
      grade: draftPayload.grade,
      semester: draftPayload.semester,
      week: draftPayload.week,
      genre: draftPayload.genre,
      curriculumRequirement: draftPayload.curriculumRequirement,
      source: draftPayload.source,
      referenceSource: draftPayload.referenceSource,
      verificationStatus: draftPayload.verificationStatus,
      academicYearScope: draftPayload.academicYearScope,
      academicYear: draftPayload.academicYear,
      audioUrl: draftPayload.audioUrl,
      audioMetadata: draftPayload.audioMetadata,
      status: 'draft',
      draftData: draftPayload,
      updatedAt: now,
      createdAt: existingLessonId ? undefined : now
    },
    { merge: true }
  );

  return {
    success: true,
    lessonId,
    message: 'Đã lưu bản nháp bài đọc thành công vào hệ thống máy chủ.'
  };
});

// ==========================================
// 8B. PUBLISH LESSON (SPLIT INTO PUBLIC & PRIVATE KEY - IMMUTABLE VERSIONS)
// ==========================================
export const publishLesson = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const existingLessonId = data?.lessonId || data?.draft?.lessonId;
  const rawDraft = data?.draft;

  if (!rawDraft) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu bài đọc không được để trống.');
  }

  // Pre-normalize draft questions to avoid Zod schema rejection on AI-generated variations (e.g. true_false options)
  const normalizedDraft = {
    ...rawDraft,
    lessonId: existingLessonId || rawDraft.lessonId || undefined,
    questions: Array.isArray(rawDraft.questions) ? normalizeDraftQuestions(rawDraft.questions) : []
  };

  // Validate draft with Zod
  const validation = LessonDraftSchema.safeParse(normalizedDraft);
  if (!validation.success) {
    const issues = validation.error.issues.map((i) => i.message).join('; ');
    throw new functions.https.HttpsError('invalid-argument', `Bài đọc chưa đạt yêu cầu: ${issues}`);
  }

  const validDraft: LessonDraftInput = validation.data;
  const now = Date.now();

  const lessonRef = existingLessonId
    ? db.collection('lessons').doc(existingLessonId)
    : db.collection('lessons').doc();
  const lessonId = lessonRef.id;

  let versionNumber = 1;
  let previousLessonData: any = null;

  if (existingLessonId) {
    const existingDoc = await lessonRef.get();
    if (existingDoc.exists) {
      previousLessonData = existingDoc.data();
      if (previousLessonData.teacherUid !== teacherUid) {
        throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền chỉnh sửa bài đọc này.');
      }
      // Calculate version number based on existing versions count
      const versionsSnap = await lessonRef.collection('versions').get();
      versionNumber = versionsSnap.size + 1;
    }
  }

  const versionRef = lessonRef.collection('versions').doc();
  const versionId = versionRef.id;

  // Split questions into public and private key
  const publicQuestions: any[] = [];
  const privateAnswers: Record<string, QuestionAnswerDetail> = {};

  for (const q of validDraft.questions) {
    // 1. Public question (no answer, no hint, no explanation)
    publicQuestions.push({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options || undefined,
      statement: q.statement || undefined,
      items: q.items || undefined,
      skillTag: q.skillTag,
      difficulty: q.difficulty,
      relatedPassagePart: q.relatedPassagePart || ''
    });

    // 2. Private answer detail
    privateAnswers[q.id] = {
      correctAnswer: q.answer,
      hint: q.hint,
      explanation: q.explanation
    };
  }

  // Extract unique skill tags
  const skillTags = Array.from(new Set(validDraft.questions.map((q) => q.skillTag)));

  let cleanAudioUrl = validDraft.audioUrl && !validDraft.audioUrl.startsWith('data:audio')
    ? validDraft.audioUrl
    : (validDraft.audioMetadata?.downloadUrl || undefined);

  let cleanAudioMetadata = validDraft.audioMetadata || undefined;

  // Fallback to previous audio if draft didn't provide audio
  if (!cleanAudioUrl && previousLessonData?.audioUrl) {
    cleanAudioUrl = previousLessonData.audioUrl;
    cleanAudioMetadata = cleanAudioMetadata || previousLessonData.audioMetadata;
  }
  if (!cleanAudioUrl && (previousLessonData as any)?.draftData?.audioUrl) {
    cleanAudioUrl = (previousLessonData as any).draftData.audioUrl;
    cleanAudioMetadata = cleanAudioMetadata || (previousLessonData as any).draftData.audioMetadata;
  }

  // When publishing, ensure approved status on audio metadata
  if (cleanAudioMetadata) {
    cleanAudioMetadata = {
      ...cleanAudioMetadata,
      status: 'approved',
      approvalStatus: 'approved',
      uploadedBy: cleanAudioMetadata.uploadedBy || teacherUid
    };
  } else if (cleanAudioUrl) {
    cleanAudioMetadata = {
      storagePath: cleanAudioUrl,
      downloadUrl: cleanAudioUrl,
      audioUrl: cleanAudioUrl,
      fileName: cleanAudioUrl.split('/').pop() || 'audio.wav',
      status: 'approved',
      approvalStatus: 'approved',
      uploadedBy: teacherUid
    };
  }

  // Write immutable public version snapshot
  const versionData = {
    versionId,
    lessonId,
    versionNumber,
    passage: validDraft.passage,
    vocabulary: validDraft.vocabulary,
    publicQuestions,
    grade: validDraft.grade,
    semester: validDraft.semester || 1,
    week: validDraft.week || 1,
    genre: validDraft.genre || 'narrative',
    curriculumRequirement: validDraft.curriculumRequirement || '',
    source: validDraft.source || 'ai_curriculum_aligned',
    referenceSource: validDraft.referenceSource || '',
    verificationStatus: validDraft.verificationStatus || 'ai_curriculum_aligned',
    academicYearScope: validDraft.academicYearScope || (validDraft.academicYear ? 'specific' : 'shared'),
    academicYear: validDraft.academicYearScope === 'specific' ? (validDraft.academicYear || '2026-2027') : null,
    approvedBy: 'Cô giáo Mai Phương',
    approvedAt: now,
    topic: validDraft.topic,
    title: validDraft.title,
    audioUrl: cleanAudioUrl,
    audioMetadata: cleanAudioMetadata,
    skillTags,
    totalQuestions: validDraft.questions.length,
    publishedAt: now,
    createdAt: now
  };

  const batch = db.batch();

  batch.set(
    lessonRef,
    {
      id: lessonId,
      teacherUid,
      title: validDraft.title,
      topic: validDraft.topic,
      grade: validDraft.grade,
      semester: validDraft.semester || 1,
      week: validDraft.week || 1,
      genre: validDraft.genre || 'narrative',
      curriculumRequirement: validDraft.curriculumRequirement || '',
      source: validDraft.source || 'ai_curriculum_aligned',
      referenceSource: validDraft.referenceSource || '',
      verificationStatus: validDraft.verificationStatus || 'ai_curriculum_aligned',
      academicYearScope: validDraft.academicYearScope || (validDraft.academicYear ? 'specific' : 'shared'),
      academicYear: validDraft.academicYearScope === 'specific' ? (validDraft.academicYear || '2026-2027') : null,
      approvedBy: 'Cô giáo Mai Phương',
      approvedAt: now,
      status: 'published',
      currentVersionId: versionId,
      currentVersionNumber: versionNumber,
      totalVersions: versionNumber,
      totalQuestions: validDraft.questions.length,
      audioUrl: cleanAudioUrl,
      audioMetadata: cleanAudioMetadata || null,
      draftData: null, // Clear active draft upon successful publication
      updatedAt: now,
      createdAt: previousLessonData?.createdAt || now
    },
    { merge: true }
  );

  batch.set(versionRef, versionData);

  // Write isolated private answer key
  const keyRef = db.collection('privateAnswerKeys').doc(versionId);
  batch.set(keyRef, {
    versionId,
    lessonId,
    answers: privateAnswers,
    createdAt: now
  });

  await batch.commit();

  return {
    success: true,
    lessonId,
    versionId,
    versionNumber,
    message: `Bài đọc "${validDraft.title}" đã được xuất bản thành công (Phiên bản v${versionNumber}). Khóa đáp án và âm thanh được bảo vệ an toàn trên máy chủ.`
  };
});

// ==========================================
// 8C. AI GENERATE VIETNAMESE AUDIO (GEMINI TTS & PIPER TTS)
// ==========================================
export const checkTtsAvailability = functions.https.onCall(async (data, context) => {
  await requireTeacher(context);

  const piperCheck = PiperService.isAvailable();
  const apiKey = process.env.GEMINI_API_KEY;
  const geminiAvailable = !!apiKey && apiKey.trim().length > 5;

  return {
    gemini: {
      available: geminiAvailable,
      reason: geminiAvailable ? undefined : 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.'
    },
    piper: {
      available: piperCheck.available,
      reason: piperCheck.reason
    }
  };
});

export const generateLessonAudioWithAI = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);

  const { passage, title, grade, voiceGender, readingStyle, lessonId, engine, lengthScale } = data || {};

  if (!passage || typeof passage !== 'string' || passage.trim().length < 20) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Văn bản bài đọc quá ngắn hoặc không hợp lệ để tạo giọng đọc AI (tối thiểu 20 ký tự).'
    );
  }

  const selectedEngine: 'gemini_tts' | 'piper_tts' = engine === 'piper_tts' ? 'piper_tts' : 'gemini_tts';

  try {
    let ttsResult: {
      audioBuffer: Buffer;
      durationSeconds: number;
      mimeType: string;
      model: string;
      voiceId: string;
    };

    if (selectedEngine === 'piper_tts') {
      ttsResult = await PiperService.generateSpeech({
        text: passage.trim(),
        title: title ? String(title).trim() : undefined,
        grade: grade === 3 ? 3 : 2,
        lengthScale: typeof lengthScale === 'number' ? lengthScale : undefined,
        readingStyle: readingStyle || 'standard'
      });
    } else {
      ttsResult = await generateSpeechWithGeminiTTS({
        text: passage.trim(),
        title: title ? String(title).trim() : undefined,
        grade: grade === 3 ? 3 : 2,
        voiceGender: voiceGender === 'male' ? 'male' : 'female',
        readingStyle: readingStyle || 'standard'
      });
    }

    const timestamp = Date.now();
    const safeLessonId = (lessonId || 'ai_lesson').replace(/[^a-zA-Z0-9_-]/g, '');
    const voicePrefix = selectedEngine === 'piper_tts'
      ? 'piper_vais1000'
      : (voiceGender === 'male' ? 'male_puck' : 'female_aoede');
    const fileName = `tts_${safeLessonId}_${voicePrefix}_${timestamp}.wav`;

    // Persist to StorageService (persistent_storage/audio and web mirror)
    const saved = await StorageService.saveAudioBuffer(fileName, ttsResult.audioBuffer);

    const metadata: AudioMetadata = {
      lessonId: lessonId || undefined,
      storagePath: saved.storagePath,
      audioUrl: saved.audioUrl,
      downloadUrl: saved.audioUrl,
      engine: selectedEngine,
      model: ttsResult.model,
      voiceId: ttsResult.voiceId,
      duration: Math.round(ttsResult.durationSeconds),
      durationSeconds: Math.round(ttsResult.durationSeconds),
      size: saved.sizeBytes,
      sizeBytes: saved.sizeBytes,
      status: 'pending_approval',
      approvalStatus: 'pending_review',
      voiceType: selectedEngine,
      createdAt: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: teacherUid,
      fileName,
      mimeType: ttsResult.mimeType
    };

    return {
      success: true,
      metadata,
      audioUrl: saved.audioUrl,
      downloadUrl: saved.audioUrl,
      durationSeconds: ttsResult.durationSeconds,
      voiceId: ttsResult.voiceId,
      model: ttsResult.model,
      engine: selectedEngine,
      message: selectedEngine === 'piper_tts'
        ? `Piper AI đã tạo thành công giọng đọc ngoại tuyến (~${ttsResult.durationSeconds}s, mô hình ${ttsResult.model})!`
        : `Gemini AI đã tạo thành công giọng đọc trực tuyến (~${ttsResult.durationSeconds}s, giọng ${ttsResult.voiceId})!`
    };
  } catch (err: any) {
    console.error('Error in generateLessonAudioWithAI:', err);
    if (err.message && err.message.includes('429')) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Hạn mức dịch vụ Gemini TTS tạm thời bị giới hạn (Quota/Rate limit 429). Vui lòng đợi 1–2 phút rồi thử lại.'
      );
    }
    throw new functions.https.HttpsError('internal', err.message || 'Lỗi khi tạo giọng đọc AI.');
  }
});

// ==========================================
// 8D. UPLOAD LESSON AUDIO (MAX 15MB MP3/M4A, 30MB WAV)
// ==========================================
export const uploadLessonAudio = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);

  const { fileName, fileBase64, mimeType, sizeBytes, durationSeconds, voiceType, lessonId } = data || {};

  if (!fileName || !fileBase64 || !mimeType) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin tệp âm thanh cần tải lên.');
  }

  const normalizedMime = String(mimeType).toLowerCase();
  const isWav = normalizedMime.includes('wav');
  const isMp3OrM4a = normalizedMime.includes('mpeg') || normalizedMime.includes('mp3') || normalizedMime.includes('m4a') || normalizedMime.includes('mp4');

  if (!isWav && !isMp3OrM4a) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Định dạng tệp không hợp lệ. Hệ thống chỉ hỗ trợ định dạng âm thanh MP3, M4A và WAV.'
    );
  }

  // Size limit validation: 15MB for MP3/M4A, 30MB for WAV
  const maxBytes = isWav ? 30 * 1024 * 1024 : 15 * 1024 * 1024;
  const actualSizeBytes = Number(sizeBytes) || 0;

  if (actualSizeBytes > maxBytes) {
    const limitMb = isWav ? 30 : 15;
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Dung lượng tệp (${(actualSizeBytes / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn cho phép (${limitMb} MB cho định dạng ${isWav ? 'WAV' : 'MP3/M4A'}).`
    );
  }

  // Decode buffer from base64 (remove data URI prefix if present)
  const base64Data = fileBase64.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length > maxBytes) {
    const limitMb = isWav ? 30 : 15;
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Kích thước tệp giải mã thực tế (${(buffer.length / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn ${limitMb} MB.`
    );
  }

  // Verify magic bytes for WAV authenticity
  if (isWav && buffer.length >= 12) {
    const riff = buffer.toString('utf8', 0, 4);
    const wave = buffer.toString('utf8', 8, 12);
    if (riff !== 'RIFF' || wave !== 'WAVE') {
      throw new functions.https.HttpsError('invalid-argument', 'Tệp WAV không hợp lệ hoặc cấu trúc header bị hỏng.');
    }
  }

  // Safe file naming
  const ext = isWav ? 'wav' : normalizedMime.includes('m4a') ? 'm4a' : 'mp3';
  const timestamp = Date.now();
  const safeLessonId = (lessonId || 'teacher_rec').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFileName = `${safeLessonId}_${timestamp}.${ext}`;

  // Save to persistent storage and web mirror via StorageService
  const saved = await StorageService.saveAudioBuffer(safeFileName, buffer);

  const metadata: AudioMetadata = {
    lessonId: lessonId || undefined,
    storagePath: saved.storagePath,
    audioUrl: saved.audioUrl,
    downloadUrl: saved.audioUrl,
    engine: 'teacher_upload',
    model: 'human_recording',
    voiceId: 'teacher_voice',
    duration: durationSeconds ? Math.round(Number(durationSeconds)) : undefined,
    durationSeconds: durationSeconds ? Math.round(Number(durationSeconds)) : undefined,
    size: saved.sizeBytes,
    sizeBytes: saved.sizeBytes,
    status: 'approved',
    approvalStatus: 'approved',
    voiceType: (voiceType as any) || 'teacher_voice',
    createdAt: new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    uploadedBy: teacherUid,
    fileName: String(fileName),
    mimeType: normalizedMime
  };

  return {
    success: true,
    metadata,
    downloadUrl: saved.audioUrl,
    audioUrl: saved.audioUrl,
    message: `Tải lên tệp âm thanh thành công (${(buffer.length / (1024 * 1024)).toFixed(2)} MB). Đã lưu bền vững trong kho lưu trữ.`
  };
});

// ==========================================
// 8E. APPROVE LESSON AUDIO
// ==========================================
export const approveLessonAudio = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId, metadata } = data || {};

  if (!metadata || !metadata.storagePath) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin metadata âm thanh để phê duyệt.');
  }

  const approvedMetadata: AudioMetadata = {
    ...metadata,
    status: 'approved',
    approvalStatus: 'approved',
    uploadedBy: metadata.uploadedBy || teacherUid
  };

  if (lessonId) {
    const lessonRef = db.collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (lessonDoc.exists) {
      await lessonRef.update({
        audioUrl: approvedMetadata.audioUrl || approvedMetadata.downloadUrl,
        audioMetadata: approvedMetadata,
        updatedAt: new Date().toISOString()
      });

      // Also update currentVersion if it exists
      const currentVersionId = lessonDoc.data()?.currentVersionId;
      if (currentVersionId) {
        const verRef = lessonRef.collection('versions').doc(currentVersionId);
        const verDoc = await verRef.get();
        if (verDoc.exists) {
          await verRef.update({
            audioUrl: approvedMetadata.audioUrl || approvedMetadata.downloadUrl,
            audioMetadata: approvedMetadata
          });
        }
      }
    }
  }

  return {
    success: true,
    metadata: approvedMetadata,
    message: 'Đã phê duyệt và lưu tệp âm thanh vào bài học thành công.'
  };
});

// ==========================================
// 8F. DELETE LESSON AUDIO
// ==========================================
export const deleteLessonAudio = functions.https.onCall(async (data, context) => {
  await requireTeacher(context);
  const { storagePath, lessonId } = data || {};
  if (!storagePath) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu đường dẫn tệp âm thanh cần xóa.');
  }

  try {
    await StorageService.deleteAudioFile(storagePath);

    // If lessonId provided, clear audio metadata in lesson
    if (lessonId) {
      const lessonRef = db.collection('lessons').doc(lessonId);
      const lessonDoc = await lessonRef.get();
      if (lessonDoc.exists) {
        await lessonRef.update({
          audioUrl: admin.firestore.FieldValue.delete(),
          audioMetadata: admin.firestore.FieldValue.delete(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    return { success: true, message: 'Đã xóa tệp âm thanh khỏi hệ thống lưu trữ bền vững.' };
  } catch (err: any) {
    return { success: false, message: 'Lỗi khi xóa tệp âm thanh: ' + err.message };
  }
});

// ==========================================
// 8C. GET TEACHER LESSONS (PHASE 1 - P0)
// ==========================================
export const getTeacherLessons = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { status, grade, semester } = data || {};

  let lessonQuery = db.collection('lessons').where('teacherUid', '==', teacherUid);
  if (status && status !== 'all') {
    lessonQuery = lessonQuery.where('status', '==', status);
  }
  if (grade) {
    lessonQuery = lessonQuery.where('grade', '==', Number(grade));
  }
  if (semester) {
    lessonQuery = lessonQuery.where('semester', '==', Number(semester));
  }

  const snap = await lessonQuery.get();
  const lessons: any[] = [];

  for (const doc of snap.docs) {
    const lData = doc.data();

    // Count active assignments for this lesson
    const assignSnap = await db.collection('assignments')
      .where('lessonId', '==', doc.id)
      .where('status', '==', 'active')
      .get();

    const assignedClasses = assignSnap.docs.map((ad) => ({
      assignmentId: ad.id,
      classId: ad.data().classId,
      roundName: ad.data().roundName || 'Đợt 1',
      lessonVersionId: ad.data().lessonVersionId
    }));

    lessons.push({
      ...lData,
      assignedClassCount: assignSnap.size,
      assignedClasses
    });
  }

  // Also include system seed lessons if teacher has fewer than 2 lessons or requests all
  if (lessons.length === 0 || status === 'all') {
    const publishedSnap = await db.collection('lessons').where('status', '==', 'published').get();
    publishedSnap.forEach((doc) => {
      const sData = doc.data();
      const isSeed = doc.id.startsWith('seed-') || sData.teacherUid === 'system' || sData.teacherUid === 'seed_teacher_uid' || sData.teacherUid === 'uVyuBAvFTDdY0If9iUg27QaBnaSB';
      if (isSeed && !lessons.some((l) => l.id === doc.id)) {
        if (!grade || sData.grade === Number(grade)) {
          lessons.push({
            ...sData,
            assignedClassCount: 0,
            isSystemLesson: true
          });
        }
      }
    });
  }

  // Sort by updatedAt descending
  lessons.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return { success: true, lessons };
});

// ==========================================
// 8D. GET LESSON DETAIL & VERSIONS (PHASE 1 & 3 - P0)
// ==========================================
export const getLessonDetail = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId, versionId } = data || {};

  if (!lessonId) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã bài đọc.');
  }

  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bài đọc không tồn tại.');
  }

  const lessonData = lessonDoc.data()!;
  const isSeedLesson = lessonId.startsWith('seed-') || lessonData.teacherUid === 'system' || lessonData.teacherUid === 'seed_teacher_uid' || lessonData.teacherUid === 'uVyuBAvFTDdY0If9iUg27QaBnaSB';
  const isOwner = lessonData.teacherUid === teacherUid || isSeedLesson;

  const targetVersionId = versionId || lessonData.currentVersionId;
  let versionData: any = null;
  let privateAnswers: any = null;

  if (targetVersionId) {
    const vDoc = await db.collection('lessons').doc(lessonId).collection('versions').doc(targetVersionId).get();
    if (vDoc.exists) {
      versionData = vDoc.data();
      if (versionData && !versionData.audioUrl && lessonData.audioUrl) {
        versionData.audioUrl = lessonData.audioUrl;
        versionData.audioMetadata = versionData.audioMetadata || lessonData.audioMetadata;
      }
    }
    if (isOwner) {
      const keyDoc = await db.collection('privateAnswerKeys').doc(targetVersionId).get();
      if (keyDoc.exists) {
        const rawAnswers = keyDoc.data()?.answers || null;
        privateAnswers = rawAnswers;
      }
    }
  }

  // Normalize private answers into both Record and Array formats for 100% client robustness
  let privateAnswersList: any[] = [];
  let privateAnswersMap: Record<string, any> = {};

  if (privateAnswers) {
    if (Array.isArray(privateAnswers)) {
      privateAnswersList = privateAnswers.map((item: any, idx: number) => ({
        questionId: item.questionId || item.id || `q${idx + 1}`,
        id: item.questionId || item.id || `q${idx + 1}`,
        correctAnswer: item.correctAnswer !== undefined ? item.correctAnswer : item.answer,
        answer: item.correctAnswer !== undefined ? item.correctAnswer : item.answer,
        hint: item.hint || '',
        explanation: item.explanation || ''
      }));
      privateAnswersList.forEach((item) => {
        privateAnswersMap[item.questionId] = item;
      });
    } else if (typeof privateAnswers === 'object') {
      privateAnswersMap = privateAnswers;
      privateAnswersList = Object.entries(privateAnswers).map(([qId, val]: [string, any]) => ({
        questionId: qId,
        id: qId,
        correctAnswer: val?.correctAnswer !== undefined ? val.correctAnswer : val?.answer,
        answer: val?.correctAnswer !== undefined ? val.correctAnswer : val?.answer,
        hint: val?.hint || '',
        explanation: val?.explanation || ''
      }));
    }
  }

  // Fetch all published versions list for version history
  const allVersionsSnap = await db
    .collection('lessons')
    .doc(lessonId)
    .collection('versions')
    .orderBy('versionNumber', 'desc')
    .get();

  const versionsList = allVersionsSnap.docs.map((d) => ({
    versionId: d.id,
    versionNumber: d.data().versionNumber || 1,
    title: d.data().title,
    publishedAt: d.data().publishedAt,
    totalQuestions: d.data().totalQuestions || d.data().publicQuestions?.length || 0
  }));

  // Fetch assignments for this lesson and teacher safely via Admin SDK
  let assignmentsList: any[] = [];
  try {
    const assignSnap = await db.collection('assignments')
      .where('lessonId', '==', lessonId)
      .where('teacherUid', '==', teacherUid)
      .get();
    assignmentsList = assignSnap.docs.map((ad) => ({ id: ad.id, ...ad.data() }));
  } catch {
    // Graceful fallback
  }

  return {
    success: true,
    lesson: lessonData,
    version: versionData,
    privateAnswers: privateAnswersMap,
    privateAnswersList,
    versionsList,
    assignmentsList,
    isOwner
  };
});

// ==========================================
// 8E. ARCHIVE LESSON (PHASE 3 - P0)
// ==========================================
export const archiveLesson = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId } = data || {};

  if (!lessonId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã bài đọc không được để trống.');
  }

  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bài đọc không tồn tại.');
  }

  if (lessonDoc.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền lưu trữ bài đọc này.');
  }

  await db.collection('lessons').doc(lessonId).update({
    status: 'archived',
    archivedAt: Date.now(),
    updatedAt: Date.now()
  });

  return {
    success: true,
    message: 'Bài đọc đã được lưu trữ an toàn. Lịch sử bài làm của học sinh vẫn được bảo toàn nguyên vẹn.'
  };
});

// ==========================================
// 8F. DELETE DRAFT LESSON (PHASE 3 - P0)
// ==========================================
export const deleteDraftLesson = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId } = data || {};

  if (!lessonId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã bài đọc không được để trống.');
  }

  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  if (!lessonDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bài đọc không tồn tại.');
  }

  const lData = lessonDoc.data()!;
  if (lData.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền xóa bài đọc này.');
  }

  // Only allowed to hard delete if never published and never assigned
  if (lData.status !== 'draft') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Bài học đã xuất bản hoặc đã giao chỉ có thể chuyển sang chế độ Lưu trữ để bảo vệ kết quả học tập của học sinh.'
    );
  }

  await db.collection('lessons').doc(lessonId).delete();

  return {
    success: true,
    message: 'Đã xóa bản nháp bài đọc thành công.'
  };
});

// ==========================================
// 9. ASSIGN LESSON TO CLASS (PHASE 4 - DUPLICATE ASSIGNMENT PREVENTION & IDEMPOTENCY)
// ==========================================
export const assignLesson = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const {
    classId,
    classIds,
    lessonId,
    lessonVersionId,
    availableFrom,
    availableUntil,
    maxAttempts,
    isPreTest,
    isPostTest,
    pairedAssessmentId,
    roundName,
    forceNewRound,
    allowEarlyAccess
  } = data || {};

  const targetClassIds: string[] = Array.isArray(classIds) && classIds.length > 0
    ? classIds
    : (classId ? [classId] : []);

  if (targetClassIds.length === 0 || !lessonId || !lessonVersionId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Vui lòng chọn ít nhất một lớp học và bài đọc đã xuất bản.'
    );
  }

  // Verify lesson version exists
  const versionDoc = await db
    .collection('lessons')
    .doc(lessonId)
    .collection('versions')
    .doc(lessonVersionId)
    .get();

  if (!versionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Phiên bản bài học không tồn tại.');
  }

  const vData = versionDoc.data()!;
  const targetRound = String(roundName || 'Đợt 1').trim();

  // Check curriculum progress for week policy (Giai đoạn 3: Tuần 7)
  const progressDoc = await db.collection('systemSettings').doc('curriculumProgress').get();
  const currentWeek = progressDoc.exists ? (progressDoc.data()?.currentWeek || 7) : 7;
  const lessonWeek = Number(vData.week || 1);
  const isFutureWeek = lessonWeek > currentWeek;

  let assignStatus: 'active' | 'paused' = 'active';
  if (isFutureWeek && !allowEarlyAccess) {
    assignStatus = 'paused';
  }

  const createdAssignments: any[] = [];
  const preventedDuplicates: any[] = [];

  for (const cId of targetClassIds) {
    const classDoc = await db.collection('classes').doc(cId).get();
    if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
      continue;
    }
    const cData = classDoc.data()!;

    // Duplicate Assignment Prevention
    const existingAssignSnap = await db.collection('assignments')
      .where('classId', '==', cId)
      .where('lessonVersionId', '==', lessonVersionId)
      .where('status', 'in', ['active', 'paused'])
      .get();

    if (!existingAssignSnap.empty && !forceNewRound) {
      const duplicateDoc = existingAssignSnap.docs.find(
        (d) => (d.data().roundName || 'Đợt 1') === targetRound
      );
      if (duplicateDoc) {
        preventedDuplicates.push({
          classId: cId,
          className: cData.name,
          assignment: duplicateDoc.data()
        });
        continue;
      }
    }

    const assignRef = db.collection('assignments').doc();
    const assignmentData = {
      id: assignRef.id,
      classId: cId,
      academicYear: cData.academicYear || '2026-2027',
      semester: Number(vData.semester || 1),
      week: lessonWeek,
      allowEarlyAccess: Boolean(allowEarlyAccess),
      lessonId,
      lessonVersionId,
      teacherUid,
      lessonTitle: vData.title,
      grade: vData.grade,
      topic: vData.topic,
      audioUrl: vData.audioUrl || undefined,
      hasAudio: Boolean(vData.audioUrl),
      roundName: targetRound,
      isDuplicatePrevented: false,
      availableFrom: availableFrom || Date.now(),
      availableUntil: availableUntil || null,
      maxAttempts: maxAttempts ? Number(maxAttempts) : 3,
      isPreTest: Boolean(isPreTest),
      isPostTest: Boolean(isPostTest),
      pairedAssessmentId: pairedAssessmentId || null,
      status: assignStatus,
      assignedAt: Date.now(),
      createdAt: Date.now()
    };

    await assignRef.set(assignmentData);
    createdAssignments.push(assignmentData);
  }

  if (targetClassIds.length === 1 && createdAssignments.length === 0 && preventedDuplicates.length > 0) {
    return {
      success: true,
      isExisting: true,
      isDuplicatePrevented: true,
      message: `Bài đọc này đã được giao cho lớp ${preventedDuplicates[0].className} (${targetRound}). Hệ thống tự động chống tạo trùng lặp.`,
      assignment: preventedDuplicates[0].assignment
    };
  }

  return {
    success: true,
    isDuplicatePrevented: preventedDuplicates.length > 0,
    createdCount: createdAssignments.length,
    duplicateCount: preventedDuplicates.length,
    assignment: createdAssignments[0] || (preventedDuplicates[0]?.assignment),
    assignments: createdAssignments,
    duplicates: preventedDuplicates,
    message: createdAssignments.length > 0
      ? `Đã giao bài thành công cho ${createdAssignments.length} lớp học.` + (preventedDuplicates.length > 0 ? ` (${preventedDuplicates.length} lớp đã có bài trong đợt này nên được bỏ qua).` : '')
      : `Tất cả các lớp đã chọn đều đã được giao bài này trong ${targetRound}.`
  };
});

// ==========================================
// 9B. AI GENERATE ADDITIONAL QUESTIONS (PHASE 5 - P1)
// ==========================================
export const generateAdditionalQuestions = functions.https.onCall(async (data, context) => {
  await requireTeacher(context);
  const { passage, currentQuestions, count, questionType, skillTag, grade } = data || {};

  if (!passage || String(passage).trim().length < 50) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Văn bản bài đọc quá ngắn để tạo thêm câu hỏi (tối thiểu 50 từ).'
    );
  }

  try {
    const res = await generateAdditionalQuestionsWithAI({
      passage: String(passage).trim(),
      grade: Number(grade || 2) as Grade,
      currentQuestions: Array.isArray(currentQuestions) ? currentQuestions : [],
      count: Number(count) || 2,
      questionType,
      skillTag
    });

    return {
      success: true,
      questions: res.questions,
      isAiGenerated: res.isAiGenerated,
      message: res.message
    };
  } catch (err: any) {
    throw new functions.https.HttpsError('internal', `Lỗi tạo câu hỏi: ${err.message}`);
  }
});

// ==========================================
// 10. STUDENT: GET ASSIGNMENTS LIBRARY
// ==========================================
export const getStudentLibrary = functions.https.onCall(async (data, context) => {
  const session = await requireStudentSession(context);

  // Authoritative student & class lookup for real-time display and metadata sync
  let studentCode = '';
  let className = '';
  let grade = 2;
  let academicYear = '2026-2027';

  if (session.studentId) {
    const sDoc = await db.collection('students').doc(session.studentId).get();
    if (sDoc.exists) {
      const sData = sDoc.data()!;
      studentCode = sData.studentCode || '';
      grade = sData.grade || 2;
      academicYear = sData.academicYear || academicYear;
    }
  }

  if (session.classId) {
    const cDoc = await db.collection('classes').doc(session.classId).get();
    if (cDoc.exists) {
      const cData = cDoc.data()!;
      className = cData.name || '';
      grade = cData.grade || grade;
      academicYear = cData.academicYear || academicYear;
    }
  }

  const progressDoc = await db.collection('systemSettings').doc('curriculumProgress').get();
  const currentWeek = progressDoc.exists ? (progressDoc.data()?.currentWeek || 7) : 7;

  const assignmentsSnap = await db
    .collection('assignments')
    .where('classId', '==', session.classId)
    .where('status', '==', 'active')
    .get();

  const assignments: any[] = [];

  for (const doc of assignmentsSnap.docs) {
    const aData = doc.data();

    // Week policy check (Giai đoạn 3: Tuần 7)
    // Học sinh chỉ thấy bài được phép học ở tuần hiện tại hoặc đã được cho học trước
    const assignWeek = Number(aData.week || 1);
    if (assignWeek > currentWeek && !aData.allowEarlyAccess) {
      continue;
    }

    // Check attempts made by this student
    const attemptsSnap = await db
      .collection('attempts')
      .where('assignmentId', '==', doc.id)
      .where('studentId', '==', session.studentId)
      .get();

    let inProgressAttemptId: string | null = null;
    let latestCompletedAttemptId: string | null = null;
    let completedCount = 0;
    let bestStars = 0;
    const history: any[] = [];

    attemptsSnap.forEach((att) => {
      const attData = att.data();
      if (attData.status === 'completed') {
        completedCount++;
        if (attData.starsEarned > bestStars) {
          bestStars = attData.starsEarned;
        }
        latestCompletedAttemptId = att.id;
        history.push({
          attemptId: att.id,
          completedAt: attData.completedAt,
          scorePercentage: attData.scorePercentage,
          starsEarned: attData.starsEarned
        });
      } else if (attData.status === 'in_progress') {
        inProgressAttemptId = att.id;
      }
    });

    const maxAttempts = aData.maxAttempts || 3;
    let statusText: 'not_started' | 'in_progress' | 'completed' | 'max_reached' = 'not_started';
    if (inProgressAttemptId) {
      statusText = 'in_progress';
    } else if (completedCount >= maxAttempts) {
      statusText = 'max_reached';
    } else if (completedCount > 0) {
      statusText = 'completed';
    }

    // Resolve real authentic lesson title and audio from lesson doc / version doc if missing (Phần B.5)
    let realLessonTitle = aData.lessonTitle || aData.title || '';
    let realGrade = aData.grade || grade;
    let realTopic = aData.topic || '';
    let realAudioUrl = aData.audioUrl || undefined;

    if (aData.lessonId) {
      if (aData.lessonVersionId) {
        const vDoc = await db.collection('lessons').doc(aData.lessonId).collection('versions').doc(aData.lessonVersionId).get();
        if (vDoc.exists) {
          const vData = vDoc.data()!;
          realLessonTitle = vData.title || realLessonTitle;
          realGrade = vData.grade || realGrade;
          realTopic = vData.topic || realTopic;
          if (vData.audioUrl) realAudioUrl = vData.audioUrl;
        }
      }
      if (!realLessonTitle || !realAudioUrl) {
        const lDoc = await db.collection('lessons').doc(aData.lessonId).get();
        if (lDoc.exists) {
          const lData = lDoc.data()!;
          realLessonTitle = realLessonTitle || lData.title;
          realGrade = realGrade || lData.grade;
          realTopic = realTopic || lData.topic;
          if (!realAudioUrl && lData.audioUrl) realAudioUrl = lData.audioUrl;
        }
      }
    }

    assignments.push({
      ...aData,
      lessonTitle: realLessonTitle,
      grade: realGrade,
      topic: realTopic,
      audioUrl: realAudioUrl,
      hasAudio: Boolean(realAudioUrl),
      attemptsCount: completedCount,
      maxAttempts,
      statusText,
      isCompleted: completedCount > 0,
      bestStars,
      canAttempt: completedCount < maxAttempts || Boolean(inProgressAttemptId),
      inProgressAttemptId,
      latestCompletedAttemptId,
      history
    });
  }

  return {
    success: true,
    student: {
      id: session.studentId,
      studentCode,
      displayAlias: session.displayAlias,
      classId: session.classId,
      className,
      grade,
      academicYear
    },
    assignments
  };
});

// ==========================================
// 11. STUDENT: START ATTEMPT
// ==========================================
export const startAttempt = functions.https.onCall(async (data, context) => {
  const session = await requireStudentSession(context);
  const { assignmentId, idempotencyKey } = data || {};

  if (!assignmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã bài giao không được để trống.');
  }

  // Check assignment
  const assignDoc = await db.collection('assignments').doc(assignmentId).get();
  if (!assignDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy bài giao.');
  }

  const assignData = assignDoc.data()!;
  if (assignData.classId !== session.classId) {
    throw new functions.https.HttpsError('permission-denied', 'Bài học này không thuộc lớp của bạn.');
  }

  if (assignData.status === 'paused') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Bài học này đang ở trạng thái Tạm dừng / Chờ mở theo tiến độ tuần học.'
    );
  }

  const progressDoc = await db.collection('systemSettings').doc('curriculumProgress').get();
  const currentWeek = progressDoc.exists ? (progressDoc.data()?.currentWeek || 7) : 7;
  const aWeek = Number(assignData.week || 1);
  if (aWeek > currentWeek && !assignData.allowEarlyAccess) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Bài đọc thuộc Tuần ${aWeek}, chưa đến tuần học (tiến độ hiện tại là Tuần ${currentWeek}).`
    );
  }

  // 1. Check if an attempt is already IN_PROGRESS for this student on this assignment
  const inProgressSnap = await db
    .collection('attempts')
    .where('assignmentId', '==', assignmentId)
    .where('studentId', '==', session.studentId)
    .where('status', '==', 'in_progress')
    .limit(1)
    .get();

  if (!inProgressSnap.empty) {
    const inProgressDoc = inProgressSnap.docs[0];
    const versionDoc = await db
      .collection('lessons')
      .doc(assignData.lessonId)
      .collection('versions')
      .doc(assignData.lessonVersionId)
      .get();

    const versionData = versionDoc.data() || {};
    if (!versionData.audioUrl) {
      const lDoc = await db.collection('lessons').doc(assignData.lessonId).get();
      if (lDoc.exists && lDoc.data()?.audioUrl) {
        versionData.audioUrl = lDoc.data()!.audioUrl;
        versionData.audioMetadata = versionData.audioMetadata || lDoc.data()!.audioMetadata;
      }
    }

    // Fetch existing responses for this in-progress attempt
    const responsesSnap = await inProgressDoc.ref.collection('responses').get();
    const existingResponses: Record<string, any> = {};
    responsesSnap.forEach((r) => {
      existingResponses[r.id] = r.data();
    });

    return {
      attemptId: inProgressDoc.id,
      assignment: assignData,
      lessonVersion: versionData,
      isResumed: true,
      existingResponses
    };
  }

  // Idempotency check: if attempt with idempotencyKey exists, return it
  if (idempotencyKey) {
    const existing = await db
      .collection('attempts')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      const attDoc = existing.docs[0];
      const att = attDoc.data();

      const versionDoc = await db
        .collection('lessons')
        .doc(att.lessonId)
        .collection('versions')
        .doc(att.lessonVersionId)
        .get();

      const versionData = versionDoc.data() || {};
      if (!versionData.audioUrl) {
        const lDoc = await db.collection('lessons').doc(att.lessonId).get();
        if (lDoc.exists && lDoc.data()?.audioUrl) {
          versionData.audioUrl = lDoc.data()!.audioUrl;
          versionData.audioMetadata = versionData.audioMetadata || lDoc.data()!.audioMetadata;
        }
      }

      return {
        attemptId: attDoc.id,
        assignment: att,
        lessonVersion: versionData,
        alreadyCompleted: att.status === 'completed'
      };
    }
  }

  // 2. Check completed attempts against maxAttempts
  const completedSnap = await db
    .collection('attempts')
    .where('assignmentId', '==', assignmentId)
    .where('studentId', '==', session.studentId)
    .where('status', '==', 'completed')
    .get();

  const maxAttempts = assignData.maxAttempts || 3;
  if (completedSnap.size >= maxAttempts) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Em đã hoàn thành đủ số lượt làm bài tối đa (${maxAttempts} lượt). Em có thể bấm "Xem lại bài đã làm" để ôn tập.`
    );
  }

  // Get public lesson version (NO ANSWER KEYS)
  const versionDoc = await db
    .collection('lessons')
    .doc(assignData.lessonId)
    .collection('versions')
    .doc(assignData.lessonVersionId)
    .get();

  if (!versionDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy nội dung bài học.');
  }

  const versionData = versionDoc.data()!;
  if (!versionData.audioUrl) {
    const lDoc = await db.collection('lessons').doc(assignData.lessonId).get();
    if (lDoc.exists && lDoc.data()?.audioUrl) {
      versionData.audioUrl = lDoc.data()!.audioUrl;
      versionData.audioMetadata = versionData.audioMetadata || lDoc.data()!.audioMetadata;
    }
  }

  // Create new attempt
  const attemptRef = db.collection('attempts').doc();
  const attemptId = attemptRef.id;

  const newAttempt = {
    id: attemptId,
    studentId: session.studentId,
    classId: assignData.classId || session.classId, // REQUIREMENT 4: Bảo tồn lớp lịch sử gắn với đợt giao
    academicYear: assignData.academicYear || '2026-2027',
    semester: Number(assignData.semester || 1),
    assignmentId,
    lessonId: assignData.lessonId,
    lessonVersionId: assignData.lessonVersionId,
    teacherUid: assignData.teacherUid,
    roundName: assignData.roundName || 'Đợt 1',
    startedAt: Date.now(),
    completedAt: null,
    status: 'in_progress',
    firstTryCorrectCount: 0,
    finalCorrectCount: 0,
    hintCount: 0,
    totalQuestions: (versionData.publicQuestions || []).length,
    starsEarned: 0,
    scorePercentage: 0,
    idempotencyKey: idempotencyKey || null
  };

  await attemptRef.set(newAttempt);

  return {
    attemptId,
    assignment: assignData,
    lessonVersion: versionData,
    isResumed: false
  };
});

// ==========================================
// 12. STUDENT: SUBMIT ANSWER (SERVER-SIDE SCORING & HINTS)
// ==========================================
export const submitAnswer = functions.https.onCall(async (data, context) => {
  const session = await requireStudentSession(context);
  const { attemptId, questionId, answer, phase, requestId } = data || {};

  if (!attemptId || !questionId || answer === undefined || !phase) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu nộp câu trả lời không đầy đủ.');
  }

  const attemptRef = db.collection('attempts').doc(attemptId);
  const attemptDoc = await attemptRef.get();

  if (!attemptDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy lượt làm bài.');
  }

  const att = attemptDoc.data()!;
  if (att.studentId !== session.studentId) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không phải chủ nhân của lượt làm này.');
  }

  if (att.status === 'completed') {
    throw new functions.https.HttpsError('failed-precondition', 'Lượt làm bài này đã hoàn thành.');
  }

  // Idempotency: check if response already recorded for this requestId or questionId
  const respRef = attemptRef.collection('responses').doc(questionId);
  const existingRespDoc = await respRef.get();

  if (existingRespDoc.exists) {
    const existing = existingRespDoc.data()!;
    // If retry was already done, return existing
    if (phase === 'retry' && existing.retryAnswer !== undefined) {
      return {
        correct: existing.finalCorrect,
        isFirstTry: false,
        canRetry: false,
        explanation: existing.explanationSent,
        correctAnswer: existing.correctAnswerSent
      };
    }
    // If first try was already done and was correct, return existing
    if (phase === 'first_try') {
      return {
        correct: existing.firstTryCorrect,
        isFirstTry: true,
        canRetry: !existing.firstTryCorrect,
        hint: existing.hintSent,
        explanation: existing.explanationSent,
        correctAnswer: existing.correctAnswerSent
      };
    }
  }

  // Fetch private answer key (Admin SDK only)
  const keyDoc = await db.collection('privateAnswerKeys').doc(att.lessonVersionId).get();
  if (!keyDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy đáp án chấm của bài học này.');
  }

  const keyData = keyDoc.data()!;
  const qDetail: QuestionAnswerDetail = keyData.answers[questionId];

  if (!qDetail) {
    throw new functions.https.HttpsError('not-found', `Không tìm thấy câu hỏi ${questionId} trong đáp án.`);
  }

  // Compare answer
  const isMatch = checkAnswerCorrectness(answer, qDetail.correctAnswer);

  if (phase === 'first_try' || phase === 1 || phase === '1') {
    if (isMatch) {
      // Correct on first try!
      await respRef.set({
        questionId,
        firstAnswer: answer,
        firstTryCorrect: true,
        finalCorrect: true,
        hintUsed: false,
        explanationSent: qDetail.explanation,
        correctAnswerSent: qDetail.correctAnswer,
        requestId,
        recordedAt: Date.now()
      });

      return {
        correct: true,
        isFirstTry: true,
        canRetry: false,
        explanation: qDetail.explanation,
        correctAnswer: qDetail.correctAnswer
      };
    } else {
      // Incorrect on first try -> Send pedagogical hint, allow exactly 1 retry!
      await respRef.set({
        questionId,
        firstAnswer: answer,
        firstTryCorrect: false,
        finalCorrect: false,
        hintUsed: true,
        hintSent: qDetail.hint,
        requestId,
        recordedAt: Date.now()
      });

      return {
        correct: false,
        isFirstTry: true,
        canRetry: true,
        hint: qDetail.hint // Pedagogical hint without leaking answer
      };
    }
  } else {
    // Phase is 'retry'
    const finalCorrect = isMatch;

    await respRef.set(
      {
        retryAnswer: answer,
        finalCorrect,
        explanationSent: qDetail.explanation,
        correctAnswerSent: qDetail.correctAnswer,
        retryRequestId: requestId,
        retryRecordedAt: Date.now()
      },
      { merge: true }
    );

    return {
      correct: finalCorrect,
      isFirstTry: false,
      canRetry: false,
      explanation: qDetail.explanation,
      correctAnswer: qDetail.correctAnswer
    };
  }
});

// Compare answer helper
function checkAnswerCorrectness(studentAns: any, correctAns: any): boolean {
  if (typeof correctAns === 'boolean') {
    return Boolean(studentAns) === correctAns;
  }
  if (Array.isArray(correctAns)) {
    if (!Array.isArray(studentAns)) return false;
    if (studentAns.length !== correctAns.length) return false;
    for (let i = 0; i < correctAns.length; i++) {
      if (String(studentAns[i]).trim() !== String(correctAns[i]).trim()) {
        return false;
      }
    }
    return true;
  }
  return String(studentAns).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
}

// ==========================================
// 13. STUDENT: FINISH ATTEMPT
// ==========================================
export const finishAttempt = functions.https.onCall(async (data, context) => {
  const session = await requireStudentSession(context);
  const { attemptId } = data || {};

  if (!attemptId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã lượt làm bài không được để trống.');
  }

  const attemptRef = db.collection('attempts').doc(attemptId);
  const attemptDoc = await attemptRef.get();

  if (!attemptDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy lượt làm bài.');
  }

  const att = attemptDoc.data()!;
  if (att.studentId !== session.studentId) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền chốt lượt làm này.');
  }

  if (att.status === 'completed') {
    return {
      success: true,
      attempt: att
    };
  }

  // Calculate scores from all responses
  const responsesSnap = await attemptRef.collection('responses').get();
  let firstTryCorrectCount = 0;
  let finalCorrectCount = 0;
  let hintCount = 0;
  const responsesMap: Record<string, any> = {};

  responsesSnap.forEach((doc) => {
    const r = doc.data();
    responsesMap[doc.id] = r;
    if (r.firstTryCorrect) firstTryCorrectCount++;
    if (r.finalCorrect) finalCorrectCount++;
    if (r.hintUsed) hintCount++;
  });

  const totalQuestions = att.totalQuestions || Math.max(1, responsesSnap.size);
  const primaryScore = Number(((firstTryCorrectCount / totalQuestions) * 10).toFixed(1));
  const finalScore = Number(((finalCorrectCount / totalQuestions) * 10).toFixed(1));
  const progressCount = Math.max(0, finalCorrectCount - firstTryCorrectCount);
  const progressPercentagePoints = Number((((finalCorrectCount - firstTryCorrectCount) / totalQuestions) * 100).toFixed(1));
  const firstTryScorePercentage = Math.round((firstTryCorrectCount / totalQuestions) * 100);
  const scorePercentage = Math.round((finalCorrectCount / totalQuestions) * 100);

  // Stars: 3 stars for >= 80%, 2 stars for >= 60%, 1 star for >= 40%
  let starsEarned = 1;
  if (scorePercentage >= 80) starsEarned = 3;
  else if (scorePercentage >= 60) starsEarned = 2;

  const updateData = {
    status: 'completed',
    completedAt: Date.now(),
    firstTryCorrectCount,
    finalCorrectCount,
    hintCount,
    primaryScore,
    finalScore,
    progressCount,
    progressPercentagePoints,
    firstTryScorePercentage,
    scorePercentage,
    starsEarned
  };

  await attemptRef.update(updateData);

  return {
    success: true,
    attempt: {
      ...att,
      ...updateData
    },
    responses: responsesMap
  };
});

// ==========================================
// 13B. GET ATTEMPT REVIEW (READ-ONLY FOR STUDENT / TEACHER / ADMIN)
// ==========================================
export const getAttemptReview = functions.https.onCall(async (data, context) => {
  const { attemptId } = data || {};
  if (!attemptId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã lượt làm không được để trống.');
  }

  const attemptDoc = await db.collection('attempts').doc(attemptId).get();
  if (!attemptDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy lượt làm bài.');
  }

  const attempt = attemptDoc.data()!;

  // Authorization check: student who owns it, or teacher/admin of class
  let isAuthorized = false;
  if (context.auth) {
    // Check if student
    const studentSessionDoc = await db.collection('studentSessions').doc(context.auth.uid).get();
    if (studentSessionDoc.exists && studentSessionDoc.data()?.studentId === attempt.studentId) {
      isAuthorized = true;
    } else {
      // Check if teacher/admin
      const userDoc = await db.collection('users').doc(context.auth.uid).get();
      if (userDoc.exists) {
        const uData = userDoc.data()!;
        if (uData.role === 'admin' || attempt.teacherUid === context.auth.uid) {
          isAuthorized = true;
        }
      }
    }
  }

  if (!isAuthorized) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền xem lại bài làm này.');
  }

  // Get lesson version
  const versionDoc = await db
    .collection('lessons')
    .doc(attempt.lessonId)
    .collection('versions')
    .doc(attempt.lessonVersionId)
    .get();

  const lessonVersion = versionDoc.data()!;
  if (!lessonVersion.audioUrl) {
    const lDoc = await db.collection('lessons').doc(attempt.lessonId).get();
    if (lDoc.exists && lDoc.data()?.audioUrl) {
      lessonVersion.audioUrl = lDoc.data()!.audioUrl;
      lessonVersion.audioMetadata = lessonVersion.audioMetadata || lDoc.data()!.audioMetadata;
    }
  }

  // Get responses
  const respSnap = await db.collection('attempts').doc(attemptId).collection('responses').get();
  const responses: Record<string, any> = {};
  respSnap.forEach((d) => {
    responses[d.id] = d.data();
  });

  // If completed, fetch private answer key to reveal explanations and correct answers
  let answerKey: Record<string, any> | null = null;
  if (attempt.status === 'completed') {
    const keyDoc = await db.collection('privateAnswerKeys').doc(attempt.lessonVersionId).get();
    if (keyDoc.exists) {
      answerKey = keyDoc.data()?.answers || null;
    }
  }

  return {
    success: true,
    attempt,
    lessonVersion,
    responses,
    answerKey: attempt.status === 'completed' ? answerKey : null
  };
});

// ==========================================
// 13C. BATCH CREATE STUDENTS (FROM EXCEL)
// ==========================================
export const batchCreateStudents = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { classId, students: studentList } = data || {};

  if (!classId || !Array.isArray(studentList) || studentList.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu danh sách học sinh không hợp lệ.');
  }

  if (studentList.length > 100) {
    throw new functions.https.HttpsError('invalid-argument', 'Mỗi lần nhập tối đa 100 học sinh.');
  }

  // Verify class exists and owned by teacher
  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy lớp học.');
  }
  const classData = classDoc.data()!;
  if (classData.teacherUid !== teacherUid) {
    const userDoc = await db.collection('users').doc(teacherUid).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền thêm học sinh vào lớp này.');
    }
  }

  // Existing students to prevent duplicates
  const existingSnap = await db.collection('students').where('classId', '==', classId).get();
  const existingCodes = new Set<string>();
  existingSnap.forEach((d) => {
    const s = d.data();
    if (s.studentCode) existingCodes.add(s.studentCode.toUpperCase());
  });

  const createdSlips: any[] = [];
  const errors: string[] = [];

  const batch = db.batch();

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
    const salt = generateSalt();
    const accessCodeHash = hashAccessCode(accessCode, salt);

    const studentRef = db.collection('students').doc();
    const studentId = studentRef.id;

    batch.set(studentRef, {
      id: studentId,
      classId,
      studentCode: code,
      displayAlias: rawAlias,
      status: 'active',
      createdAt: Date.now()
    });

    batch.set(db.collection('studentSecrets').doc(studentId), {
      studentId,
      accessCodeHash,
      salt,
      rotatedAt: Date.now()
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
    throw new functions.https.HttpsError('invalid-argument', `Không có học sinh nào hợp lệ để tạo. ${errors.join('; ')}`);
  }

  await batch.commit();

  return {
    success: true,
    totalCreated: createdSlips.length,
    students: createdSlips,
    warnings: errors
  };
});

// ==========================================
// 13D. BATCH CREATE TEACHERS (ADMIN ONLY)
// ==========================================
export const batchCreateTeachers = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { teachers } = data || {};

  if (!Array.isArray(teachers) || teachers.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu danh sách giáo viên không hợp lệ.');
  }

  const results: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < teachers.length; i++) {
    const t = teachers[i];
    const email = String(t.email || '').trim().toLowerCase();
    const displayName = String(t.displayName || t.name || '').trim();

    if (!email || !email.includes('@')) {
      errors.push(`Dòng ${i + 1}: Email "${email}" không đúng định dạng.`);
      continue;
    }

    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          const tempPassword = `Emytv@${Math.floor(100000 + Math.random() * 900000)}`;
          userRecord = await auth.createUser({
            email,
            password: tempPassword,
            displayName: displayName || 'Giáo viên'
          });
        } else {
          throw err;
        }
      }

      await auth.setCustomUserClaims(userRecord.uid, { role: 'teacher' });

      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName: displayName || 'Giáo viên',
        role: 'teacher',
        status: 'active',
        updatedAt: Date.now()
      }, { merge: true });

      results.push({
        uid: userRecord.uid,
        email,
        displayName: displayName || 'Giáo viên',
        status: 'active'
      });
    } catch (err: any) {
      errors.push(`Dòng ${i + 1} (${email}): ${err.message}`);
    }
  }

  return {
    success: true,
    totalCreated: results.length,
    teachers: results,
    errors
  };
});
export const getTeacherAnalytics = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { classId, assignmentId, academicYear, grade } = data || {};

  // Query classes of teacher
  let classQuery = db.collection('classes').where('teacherUid', '==', teacherUid);
  if (classId) {
    classQuery = classQuery.where('id', '==', classId);
  }
  const rawClassDocs = await classQuery.get();
  const classDocs = rawClassDocs.docs.filter((d) => {
    const c = d.data();
    if (academicYear && academicYear !== 'all' && (c.academicYear || '2026-2027') !== academicYear) return false;
    if (grade && grade !== 'all' && Number(c.grade) !== Number(grade)) return false;
    return true;
  });
  const classIds = new Set(classDocs.map((d) => d.id));

  if (classIds.size === 0) {
    return {
      totalClasses: 0,
      totalStudents: 0,
      totalAssignments: 0,
      totalAttempts: 0,
      avgFirstTryAccuracy: 0,
      avgFinalAccuracy: 0,
      skillBreakdown: {}
    };
  }

  // Query assignments
  let assignQuery = db.collection('assignments').where('teacherUid', '==', teacherUid);
  if (assignmentId) {
    assignQuery = assignQuery.where('id', '==', assignmentId);
  }
  const rawAssignDocs = await assignQuery.get();
  const assignMap: Record<string, any> = {};
  rawAssignDocs.docs.forEach((d) => (assignMap[d.id] = d.data()));
  const assignDocs = rawAssignDocs.docs.filter((d) => classIds.has(d.data().classId));

  // Query completed attempts with direct query filtering
  let attemptsQuery = db
    .collection('attempts')
    .where('teacherUid', '==', teacherUid)
    .where('status', '==', 'completed');

  if (classId) {
    attemptsQuery = attemptsQuery.where('classId', '==', classId);
  }
  if (assignmentId) {
    attemptsQuery = attemptsQuery.where('assignmentId', '==', assignmentId);
  }

  const rawAttemptsSnap = await attemptsQuery.get();
  const attemptsDocs = rawAttemptsSnap.docs.filter((d) => {
    const historicalClassId = d.data().classId || assignMap[d.data().assignmentId]?.classId;
    return historicalClassId && classIds.has(historicalClassId);
  });

  let totalFirstTry = 0;
  let totalFinal = 0;
  let totalQuestionsCount = 0;

  const skillAccumulator: Record<
    SkillTag,
    { label: string; tested: number; firstTryCorrect: number; finalCorrect: number }
  > = {
    thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, tested: 0, firstTryCorrect: 0, finalCorrect: 0 }
  };

  // Cache versions questions skill map in parallel
  const versionSkillCache: Record<string, Record<string, SkillTag>> = {};
  const neededVersionIds = Array.from(new Set(attemptsDocs.map(d => d.data().lessonVersionId).filter(Boolean)));
  await Promise.all(
    neededVersionIds.map(async (vId) => {
      const sampleAtt = attemptsDocs.find(d => d.data().lessonVersionId === vId)?.data();
      if (!sampleAtt) return;
      const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
      const vData = vDoc.data();
      const map: Record<string, SkillTag> = {};
      if (vData && vData.publicQuestions) {
        vData.publicQuestions.forEach((q: any) => {
          map[q.id] = q.skillTag;
        });
      }
      versionSkillCache[vId] = map;
    })
  );

  // Parallel fetch responses for filtered attempts (eliminating sequential N+1 bottleneck)
  await Promise.all(
    attemptsDocs.map(async (attDoc) => {
      const att = attDoc.data();
      totalFirstTry += att.firstTryCorrectCount || 0;
      totalFinal += att.finalCorrectCount || 0;
      totalQuestionsCount += att.totalQuestions || 5;

      const qMap = versionSkillCache[att.lessonVersionId] || {};
      const responsesSnap = await attDoc.ref.collection('responses').get();

      responsesSnap.forEach((rDoc) => {
        const r = rDoc.data();
        const skill = qMap[r.questionId];
        if (skill && skillAccumulator[skill]) {
          skillAccumulator[skill].tested++;
          if (r.firstTryCorrect) skillAccumulator[skill].firstTryCorrect++;
          if (r.finalCorrect) skillAccumulator[skill].finalCorrect++;
        }
      });
    })
  );

  // Pre / Post paired comparison
  let prePostStats = null;
  const preAssignment = assignDocs.find((d) => d.data().isPreTest);
  const postAssignment = assignDocs.find((d) => d.data().isPostTest);

  if (preAssignment && postAssignment) {
    const preAttempts = attemptsDocs.filter((d) => d.data().assignmentId === preAssignment.id);
    const postAttempts = attemptsDocs.filter((d) => d.data().assignmentId === postAssignment.id);

    // Group by studentId
    const preByStudent: Record<string, number> = {};
    const postByStudent: Record<string, number> = {};

    preAttempts.forEach((d) => {
      preByStudent[d.data().studentId] = d.data().scorePercentage;
    });
    postAttempts.forEach((d) => {
      postByStudent[d.data().studentId] = d.data().scorePercentage;
    });

    const pairedStudentIds = Object.keys(preByStudent).filter((sId) => postByStudent[sId] !== undefined);
    if (pairedStudentIds.length > 0) {
      const preAvg = Math.round(
        pairedStudentIds.reduce((sum, id) => sum + preByStudent[id], 0) / pairedStudentIds.length
      );
      const postAvg = Math.round(
        pairedStudentIds.reduce((sum, id) => sum + postByStudent[id], 0) / pairedStudentIds.length
      );

      prePostStats = {
        pairedCount: pairedStudentIds.length,
        preAvgPercentage: preAvg,
        postAvgPercentage: postAvg,
        percentagePointDiff: postAvg - preAvg
      };
    }
  }

  // Format skill breakdown
  const skillBreakdown: any = {};
  for (const [tag, data] of Object.entries(skillAccumulator)) {
    const firstPct = data.tested > 0 ? Math.round((data.firstTryCorrect / data.tested) * 100) : 0;
    const finalPct = data.tested > 0 ? Math.round((data.finalCorrect / data.tested) * 100) : 0;
    skillBreakdown[tag] = {
      label: data.label,
      totalTested: data.tested,
      firstTryCorrect: data.firstTryCorrect,
      finalCorrect: data.finalCorrect,
      firstTryPercentage: firstPct,
      finalPercentage: finalPct,
      progressPercentagePoints: Math.max(0, finalPct - firstPct),
      percentage: firstPct
    };
  }

  const avgFirstTry = totalQuestionsCount > 0 ? Math.round((totalFirstTry / totalQuestionsCount) * 100) : 0;
  const avgFinal = totalQuestionsCount > 0 ? Math.round((totalFinal / totalQuestionsCount) * 100) : 0;
  const avgFirstTryScore = totalQuestionsCount > 0 ? Number(((totalFirstTry / totalQuestionsCount) * 10).toFixed(1)) : 0;
  const avgFinalScore = totalQuestionsCount > 0 ? Number(((totalFinal / totalQuestionsCount) * 10).toFixed(1)) : 0;
  const avgProgressPoints = totalQuestionsCount > 0 ? Number((((totalFinal - totalFirstTry) / totalQuestionsCount) * 100).toFixed(1)) : 0;

  return {
    totalClasses: classDocs.length,
    totalStudents: classDocs.reduce((sum, d) => sum + (d.data().studentCount || 0), 0),
    totalAssignments: assignDocs.length,
    totalAttempts: attemptsDocs.length,
    totalQuestionsCount,
    totalFirstTry,
    totalFinal,
    avgFirstTryAccuracy: avgFirstTry,
    avgFinalAccuracy: avgFinal,
    avgFirstTryScore,
    avgFinalScore,
    avgProgressPoints,
    skillBreakdown,
    pairedPrePostStats: prePostStats
  };
});

// ==========================================
// 15. AI REMEDIATION SUGGESTION
// ==========================================
export const suggestRemediation = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const {
    classId,
    academicYear,
    semester,
    assignmentId,
    scope,
    targetStudentId,
    targetSkill,
    targetAssignmentId,
    targetQuestionType
  } = data || {};

  const activeScope: AnalysisScope = (scope as AnalysisScope) || 'toan_lop';

  if (!classId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã lớp không được để trống.');
  }

  const classDoc = await db.collection('classes').doc(classId).get();
  if (!classDoc.exists || classDoc.data()?.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền quản lý lớp này.');
  }

  const classData = classDoc.data()!;

  // 1. Fetch all students in this class for exact roster count (Sĩ số) & build student map
  const studentsSnap = await db.collection('students').where('classId', '==', classId).get();
  const studentMap: Record<string, { id: string; studentCode: string; displayAlias: string }> = {};
  studentsSnap.docs.forEach((d) => {
    const s = d.data();
    studentMap[d.id] = {
      id: d.id,
      studentCode: s.studentCode || `HS-${d.id.slice(-4).toUpperCase()}`,
      displayAlias: s.displayAlias || s.name || `Học sinh ${d.id.slice(-4)}`
    };
  });
  const totalStudents = studentsSnap.size || classData.studentCount || 20;

  // 2. Fetch assignments for this class to map lesson & semester
  const assignmentsSnap = await db.collection('assignments').where('classId', '==', classId).get();
  const assignmentMap: Record<string, any> = {};
  const lessonIds = new Set<string>();

  assignmentsSnap.docs.forEach((doc) => {
    const a = doc.data();
    assignmentMap[doc.id] = { id: doc.id, ...a };
    if (a.lessonId) lessonIds.add(a.lessonId);
  });

  // Fetch lesson metadata for title, topic, passage, vocabulary and semester
  const lessonMetaMap: Record<string, any> = {};
  await Promise.all(
    Array.from(lessonIds).map(async (lId) => {
      const lDoc = await db.collection('lessons').doc(lId).get();
      if (lDoc.exists) {
        lessonMetaMap[lId] = { id: lId, ...lDoc.data() };
      }
    })
  );

  // 3. Query completed attempts for this class
  let attemptsQuery = db
    .collection('attempts')
    .where('classId', '==', classId)
    .where('status', '==', 'completed');

  // If specific assignment is filtered
  const effAssignmentId = targetAssignmentId || (assignmentId !== 'all' ? assignmentId : undefined);
  if (effAssignmentId) {
    attemptsQuery = attemptsQuery.where('assignmentId', '==', effAssignmentId);
  }

  const attemptsSnap = await attemptsQuery.get();

  // Filter by semester if specified
  const filteredAttemptDocs = attemptsSnap.docs.filter((doc) => {
    const att = doc.data();
    if (semester && semester !== 'all') {
      const sem = lessonMetaMap[att.lessonId]?.semester || 1;
      if (sem !== Number(semester)) return false;
    }
    return true;
  });

  // Calculate unique student participation
  const participatedStudentIds = new Set<string>();
  filteredAttemptDocs.forEach((doc) => {
    participatedStudentIds.add(doc.data().studentId);
  });
  const participatedCount = participatedStudentIds.size;
  const notParticipatedCount = Math.max(0, totalStudents - participatedCount);
  const completionRate = totalStudents > 0 ? Math.round((participatedCount / totalStudents) * 100) : 0;

  // 4. Cache question metadata (prompt & skillTag) from lesson versions
  const neededVersionIds = Array.from(new Set(filteredAttemptDocs.map((d) => d.data().lessonVersionId).filter(Boolean)));
  const questionMetaMap: Record<string, { prompt: string; skillTag: SkillTag; type?: string; options?: string[]; hint?: string; explanation?: string }> = {};

  await Promise.all(
    neededVersionIds.map(async (vId) => {
      const sampleAtt = filteredAttemptDocs.find((d) => d.data().lessonVersionId === vId)?.data();
      if (!sampleAtt) return;
      try {
        const vDoc = await db.collection('lessons').doc(sampleAtt.lessonId).collection('versions').doc(vId).get();
        const vData = vDoc.data();
        if (vData && vData.publicQuestions) {
          vData.publicQuestions.forEach((q: any) => {
            questionMetaMap[q.id] = {
              prompt: q.prompt || '',
              skillTag: q.skillTag || 'thong_tin_truc_tiep',
              type: q.type || 'multiple_choice',
              options: q.options,
              hint: q.hint,
              explanation: q.explanation
            };
          });
        }
      } catch (err) {
        console.warn('Could not load version for question mapping:', vId, err);
      }
    })
  );

  // 5. Accumulators for skills, per-student performance, question errors & question types
  const skillAccumulator: Record<
    SkillTag,
    { label: string; tested: number; firstTryCorrect: number; finalCorrect: number }
  > = {
    thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
    lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, tested: 0, firstTryCorrect: 0, finalCorrect: 0 }
  };

  const studentSkillMap: Record<string, Record<SkillTag, { tested: number; firstTryCorrect: number; finalCorrect: number }>> = {};
  const studentTotalTracker: Record<
    string,
    {
      studentId: string;
      totalAttempts: number;
      totalFirstTry: number;
      totalFinal: number;
      totalQuestions: number;
      attempts: Array<{
        attemptId: string;
        lessonTitle: string;
        firstScore: number;
        finalScore: number;
        progress: number;
        completedAt: number;
      }>;
    }
  > = {};

  const questionErrorTracker: Record<
    string,
    { prompt: string; skillTag: SkillTag; testedCount: number; firstTryIncorrectCount: number }
  > = {};

  let totalClassFirstTry = 0;
  let totalClassFinal = 0;
  let totalClassQuestions = 0;

  await Promise.all(
    filteredAttemptDocs.map(async (attDoc) => {
      const att = attDoc.data();
      const sId = att.studentId;
      const lessonTitle = lessonMetaMap[att.lessonId]?.title || 'Bài đọc Tiếng Việt';

      if (!studentSkillMap[sId]) {
        studentSkillMap[sId] = {
          thong_tin_truc_tiep: { tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
          tu_trong_ngu_canh: { tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
          noi_dung_chinh: { tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
          sap_xep_trinh_tu: { tested: 0, firstTryCorrect: 0, finalCorrect: 0 },
          lien_he_van_dung: { tested: 0, firstTryCorrect: 0, finalCorrect: 0 }
        };
      }

      if (!studentTotalTracker[sId]) {
        studentTotalTracker[sId] = {
          studentId: sId,
          totalAttempts: 0,
          totalFirstTry: 0,
          totalFinal: 0,
          totalQuestions: 0,
          attempts: []
        };
      }

      const attFirst = att.firstTryCorrectCount || 0;
      const attFinal = att.finalCorrectCount || 0;
      const attTotalQ = att.totalQuestions || 5;

      totalClassFirstTry += attFirst;
      totalClassFinal += attFinal;
      totalClassQuestions += attTotalQ;

      studentTotalTracker[sId].totalAttempts++;
      studentTotalTracker[sId].totalFirstTry += attFirst;
      studentTotalTracker[sId].totalFinal += attFinal;
      studentTotalTracker[sId].totalQuestions += attTotalQ;
      studentTotalTracker[sId].attempts.push({
        attemptId: attDoc.id,
        lessonTitle,
        firstScore: attTotalQ > 0 ? Math.round((attFirst / attTotalQ) * 100) : 0,
        finalScore: attTotalQ > 0 ? Math.round((attFinal / attTotalQ) * 100) : 0,
        progress: Math.max(0, Math.round(((attFinal - attFirst) / (attTotalQ || 1)) * 100)),
        completedAt: att.completedAt || att.startedAt || Date.now()
      });

      const responsesSnap = await attDoc.ref.collection('responses').get();
      responsesSnap.forEach((rDoc) => {
        const r = rDoc.data();
        const qMeta = questionMetaMap[r.questionId];
        const tag: SkillTag = qMeta?.skillTag || (r.skillTag as SkillTag) || 'thong_tin_truc_tiep';
        const prompt = qMeta?.prompt || r.prompt || `Câu hỏi #${r.questionId}`;

        if (skillAccumulator[tag]) {
          skillAccumulator[tag].tested++;
          if (r.firstTryCorrect) skillAccumulator[tag].firstTryCorrect++;
          if (r.finalCorrect) skillAccumulator[tag].finalCorrect++;
        }

        if (studentSkillMap[sId] && studentSkillMap[sId][tag]) {
          studentSkillMap[sId][tag].tested++;
          if (r.firstTryCorrect) studentSkillMap[sId][tag].firstTryCorrect++;
          if (r.finalCorrect) studentSkillMap[sId][tag].finalCorrect++;
        }

        if (!questionErrorTracker[r.questionId]) {
          questionErrorTracker[r.questionId] = {
            prompt,
            skillTag: tag,
            testedCount: 0,
            firstTryIncorrectCount: 0
          };
        }
        questionErrorTracker[r.questionId].testedCount++;
        if (!r.firstTryCorrect) {
          questionErrorTracker[r.questionId].firstTryIncorrectCount++;
        }
      });
    })
  );

  // 6. Calculate accurate skill metrics & count students needing help (< 70%)
  const allSkillsList: RemediationSkillDetail[] = [];
  const goodSkills: RemediationSkillDetail[] = [];
  const weakSkills: RemediationSkillDetail[] = [];
  const untestedSkills: RemediationSkillDetail[] = [];

  for (const [tagStr, acc] of Object.entries(skillAccumulator)) {
    const tag = tagStr as SkillTag;
    const tested = acc.tested;
    const firstCorrect = acc.firstTryCorrect;
    const finalCorrect = acc.finalCorrect;
    const firstAccuracy = tested > 0 ? Math.round((firstCorrect / tested) * 100) : null;
    const finalAccuracy = tested > 0 ? Math.round((finalCorrect / tested) * 100) : null;
    const progressPoints =
      firstAccuracy !== null && finalAccuracy !== null ? Math.max(0, finalAccuracy - firstAccuracy) : null;

    let studentsNeedingHelp = 0;
    if (tested > 0) {
      for (const sId of Object.keys(studentSkillMap)) {
        const stStat = studentSkillMap[sId][tag];
        if (stStat && stStat.tested > 0) {
          const studentAcc = (stStat.firstTryCorrect / stStat.tested) * 100;
          if (studentAcc < 70) {
            studentsNeedingHelp++;
          }
        }
      }
    }

    let status: 'good' | 'needs_remediation' | 'no_data' = 'no_data';
    if (tested === 0) {
      status = 'no_data';
    } else if (firstAccuracy! >= 70) {
      status = 'good';
    } else {
      status = 'needs_remediation';
    }

    const detail: RemediationSkillDetail = {
      skillTag: tag,
      label: SKILL_LABELS[tag] || tag,
      testedCount: tested,
      firstTryCorrectCount: firstCorrect,
      finalCorrectCount: finalCorrect,
      firstTryAccuracy: firstAccuracy,
      finalAccuracy: finalAccuracy,
      progressPercentagePoints: progressPoints,
      studentsNeedingHelp,
      status
    };

    allSkillsList.push(detail);
    if (status === 'good') goodSkills.push(detail);
    else if (status === 'needs_remediation') weakSkills.push(detail);
    else untestedSkills.push(detail);
  }

  // 7. Find top questions with highest first-try error rate
  const highErrorQuestions: RemediationQuestionInsight[] = Object.entries(questionErrorTracker)
    .filter(([_, q]) => q.testedCount >= 1 && q.firstTryIncorrectCount > 0)
    .map(([qId, q]) => ({
      questionId: qId,
      prompt: q.prompt,
      skillTag: q.skillTag,
      skillLabel: SKILL_LABELS[q.skillTag] || q.skillTag,
      testedCount: q.testedCount,
      incorrectCount: q.firstTryIncorrectCount,
      incorrectPercentage: Math.round((q.firstTryIncorrectCount / q.testedCount) * 100)
    }))
    .sort((a, b) => b.incorrectPercentage - a.incorrectPercentage)
    .slice(0, 3);

  const avgFirstTry = totalClassQuestions > 0 ? Math.round((totalClassFirstTry / totalClassQuestions) * 100) : 0;
  const avgFinal = totalClassQuestions > 0 ? Math.round((totalClassFinal / totalClassQuestions) * 100) : 0;
  const avgProgress = Math.max(0, avgFinal - avgFirstTry);

  // 8. MULTI-DIMENSIONAL SCOPE COMPUTATIONS
  // Build student groups (Học sinh cần hỗ trợ vs Nhóm phát triển)
  const supportGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }> = [];
  const growthGroup: Array<{ studentId: string; studentCode: string; displayAlias: string; avgAccuracy: number; reason: string }> = [];

  studentsSnap.docs.forEach((doc) => {
    const sId = doc.id;
    const meta = studentMap[sId] || { studentCode: 'HS', displayAlias: 'Học sinh' };
    const stat = studentTotalTracker[sId];
    if (!stat || stat.totalQuestions === 0) {
      supportGroup.push({
        studentId: sId,
        studentCode: meta.studentCode,
        displayAlias: meta.displayAlias,
        avgAccuracy: 0,
        reason: 'Chưa tham gia làm bài đọc hiểu'
      });
      return;
    }

    const acc = Math.round((stat.totalFirstTry / stat.totalQuestions) * 100);
    // Find weak skills for this student
    const studentWeakSkillNames: string[] = [];
    if (studentSkillMap[sId]) {
      Object.entries(studentSkillMap[sId]).forEach(([tagStr, sk]) => {
        if (sk.tested > 0 && Math.round((sk.firstTryCorrect / sk.tested) * 100) < 70) {
          studentWeakSkillNames.push(SKILL_LABELS[tagStr as SkillTag] || tagStr);
        }
      });
    }

    if (acc < 70 || studentWeakSkillNames.length > 0) {
      supportGroup.push({
        studentId: sId,
        studentCode: meta.studentCode,
        displayAlias: meta.displayAlias,
        avgAccuracy: acc,
        reason: studentWeakSkillNames.length > 0
          ? `Cần củng cố: ${studentWeakSkillNames.join(', ')}`
          : `Tỷ lệ đúng lần đầu ${acc}% (< 70%)`
      });
    } else {
      growthGroup.push({
        studentId: sId,
        studentCode: meta.studentCode,
        displayAlias: meta.displayAlias,
        avgAccuracy: acc,
        reason: `Đạt tốt: Nền tảng đọc hiểu vững (${acc}%)`
      });
    }
  });

  // Build Individual Student Profile if scope === 'tung_hoc_sinh'
  let studentProfile: any = undefined;
  if (activeScope === 'tung_hoc_sinh') {
    const effStudentId = targetStudentId || Object.keys(studentTotalTracker)[0] || studentsSnap.docs[0]?.id;
    if (effStudentId) {
      const meta = studentMap[effStudentId] || { studentCode: 'HS', displayAlias: 'Học sinh' };
      const stat = studentTotalTracker[effStudentId];
      const strongSkills: string[] = [];
      const weakSkillsStudent: string[] = [];

      if (studentSkillMap[effStudentId]) {
        Object.entries(studentSkillMap[effStudentId]).forEach(([tagStr, sk]) => {
          if (sk.tested > 0) {
            const acc = Math.round((sk.firstTryCorrect / sk.tested) * 100);
            const label = SKILL_LABELS[tagStr as SkillTag] || tagStr;
            if (acc >= 70) strongSkills.push(`${label} (${acc}%)`);
            else weakSkillsStudent.push(`${label} (${acc}%)`);
          }
        });
      }

      studentProfile = {
        studentId: effStudentId,
        studentCode: meta.studentCode,
        displayAlias: meta.displayAlias,
        totalAttempts: stat?.totalAttempts || 0,
        firstTryAvg: stat && stat.totalQuestions > 0 ? Math.round((stat.totalFirstTry / stat.totalQuestions) * 100) : 0,
        finalAvg: stat && stat.totalQuestions > 0 ? Math.round((stat.totalFinal / stat.totalQuestions) * 100) : 0,
        progressDelta: stat && stat.totalQuestions > 0 ? Math.max(0, Math.round(((stat.totalFinal - stat.totalFirstTry) / stat.totalQuestions) * 100)) : 0,
        strongSkills,
        weakSkills: weakSkillsStudent,
        recentAttempts: stat?.attempts || []
      };
    }
  }

  // Construct Scope Summary Information
  let scopeSummary = {
    scopeName: typeof ANALYSIS_SCOPE_LABELS[activeScope] === 'string' ? ANALYSIS_SCOPE_LABELS[activeScope] : ((ANALYSIS_SCOPE_LABELS[activeScope] as any)?.label || 'Toàn lớp'),
    targetName: 'Toàn bộ học sinh',
    targetDescription: `Lớp ${classData.name} · Sĩ số ${totalStudents} học sinh`,
    totalAttempts: filteredAttemptDocs.length,
    totalStudents: participatedCount,
    avgScore: avgFirstTry,
    progressDelta: avgProgress,
    detailBadge: `${completionRate}% tham gia`
  };

  if (activeScope === 'tung_hoc_sinh' && studentProfile) {
    scopeSummary = {
      scopeName: 'Từng học sinh',
      targetName: studentProfile.displayAlias,
      targetDescription: `Mã HS: ${studentProfile.studentCode} · Lớp ${classData.name}`,
      totalAttempts: studentProfile.totalAttempts,
      totalStudents: 1,
      avgScore: studentProfile.firstTryAvg,
      progressDelta: studentProfile.progressDelta,
      detailBadge: studentProfile.totalAttempts > 0 ? `${studentProfile.totalAttempts} bài đã làm` : 'Chưa đủ dữ liệu'
    };
  } else if (activeScope === 'nhom_hoc_sinh') {
    scopeSummary = {
      scopeName: 'Nhóm học sinh',
      targetName: `Phân hóa 2 nhóm (${supportGroup.length} cần hỗ trợ · ${growthGroup.length} phát triển)`,
      targetDescription: `Lọc theo ngưỡng 70% chuẩn GDPT 2018`,
      totalAttempts: filteredAttemptDocs.length,
      totalStudents: totalStudents,
      avgScore: avgFirstTry,
      progressDelta: avgProgress,
      detailBadge: `${supportGroup.length} HS cần trợ giúp`
    };
  } else if (activeScope === 'bai_doc_va_dot_giao') {
    const selectedAssignment = effAssignmentId ? assignmentMap[effAssignmentId] : assignmentsSnap.docs[0]?.data();
    const lesson = selectedAssignment ? lessonMetaMap[selectedAssignment.lessonId] : undefined;
    scopeSummary = {
      scopeName: 'Từng bài đọc & đợt giao',
      targetName: lesson?.title || 'Đợt giao bài đọc',
      targetDescription: `Chủ đề: ${lesson?.topic || 'Tiếng Việt'} · ${filteredAttemptDocs.length} lượt hoàn thành`,
      totalAttempts: filteredAttemptDocs.length,
      totalStudents: participatedCount,
      avgScore: avgFirstTry,
      progressDelta: avgProgress,
      detailBadge: `Đúng lần đầu: ${avgFirstTry}%`
    };
  } else if (activeScope === 'tung_ky_nang') {
    const effSkill = (targetSkill as SkillTag) || weakSkills[0]?.skillTag || 'thong_tin_truc_tiep';
    const skDetail = allSkillsList.find((s) => s.skillTag === effSkill);
    scopeSummary = {
      scopeName: 'Từng kỹ năng đọc hiểu',
      targetName: SKILL_LABELS[effSkill] || effSkill,
      targetDescription: `Chuẩn năng lực GDPT 2018: ${skDetail?.studentsNeedingHelp || 0} học sinh cần hỗ trợ thêm`,
      totalAttempts: filteredAttemptDocs.length,
      totalStudents: skDetail?.testedCount || 0,
      avgScore: skDetail?.firstTryAccuracy ?? 0,
      progressDelta: skDetail?.progressPercentagePoints ?? 0,
      detailBadge: skDetail?.status === 'good' ? 'Đạt chuẩn (≥70%)' : 'Cần củng cố (<70%)'
    };
  } else if (activeScope === 'tung_cau_hoi') {
    scopeSummary = {
      scopeName: 'Từng câu hỏi & dạng bài',
      targetName: highErrorQuestions.length > 0 ? `Câu sai nhiều: "${highErrorQuestions[0].prompt.slice(0, 40)}..."` : 'Phân tích các dạng câu hỏi',
      targetDescription: `Thống kê lỗi trắc nghiệm, đúng/sai, sắp xếp`,
      totalAttempts: filteredAttemptDocs.length,
      totalStudents: participatedCount,
      avgScore: avgFirstTry,
      progressDelta: avgProgress,
      detailBadge: highErrorQuestions.length > 0 ? `Sai nhiều nhất ${highErrorQuestions[0].incorrectPercentage}%` : 'Đang theo dõi'
    };
  } else if (activeScope === 'tien_bo') {
    scopeSummary = {
      scopeName: 'Tiến bộ qua các lần luyện',
      targetName: `Tăng trưởng +${avgProgress} điểm phần trăm sau gợi ý`,
      targetDescription: `Hiệu quả phản hồi từng bước từ ${avgFirstTry}% lên ${avgFinal}%`,
      totalAttempts: filteredAttemptDocs.length,
      totalStudents: participatedCount,
      avgScore: avgFinal,
      progressDelta: avgProgress,
      detailBadge: `+${avgProgress} điểm pp`
    };
  }

  // 9. Find most representative source lesson for grounded pedagogical activities
  const sampleLessonId = filteredAttemptDocs[0]?.data()?.lessonId || assignmentsSnap.docs[0]?.data()?.lessonId;
  const sourceLessonDoc = sampleLessonId ? lessonMetaMap[sampleLessonId] : undefined;

  // 10. Package pure Firestore Statistics (Scoped appropriately to individual student vs whole class)
  let effSkillsList = allSkillsList;
  let effGoodSkills = goodSkills;
  let effWeakSkills = weakSkills;
  let effUntestedSkills = untestedSkills;

  if (activeScope === 'tung_hoc_sinh' && studentProfile) {
    const effStudentId = studentProfile.studentId;
    const sMap = studentSkillMap[effStudentId] || {};
    const sSkills: RemediationSkillDetail[] = [];
    const sGood: RemediationSkillDetail[] = [];
    const sWeak: RemediationSkillDetail[] = [];
    const sUntested: RemediationSkillDetail[] = [];

    const skillTags: SkillTag[] = [
      'thong_tin_truc_tiep',
      'tu_trong_ngu_canh',
      'noi_dung_chinh',
      'sap_xep_trinh_tu',
      'lien_he_van_dung'
    ];

    for (const tag of skillTags) {
      const st = sMap[tag] || { tested: 0, firstTryCorrect: 0, finalCorrect: 0 };
      const tested = st.tested;
      const firstCorrect = st.firstTryCorrect;
      const finalCorrect = st.finalCorrect;
      const firstAcc = tested > 0 ? Math.round((firstCorrect / tested) * 100) : null;
      const finalAcc = tested > 0 ? Math.round((finalCorrect / tested) * 100) : null;
      const prog = firstAcc !== null && finalAcc !== null ? Math.max(0, finalAcc - firstAcc) : null;

      let status: 'good' | 'needs_remediation' | 'no_data' = 'no_data';
      if (tested === 0) status = 'no_data';
      else if (firstAcc! >= 70) status = 'good';
      else status = 'needs_remediation';

      const sDetail: RemediationSkillDetail = {
        skillTag: tag,
        label: SKILL_LABELS[tag] || tag,
        testedCount: tested,
        firstTryCorrectCount: firstCorrect,
        finalCorrectCount: finalCorrect,
        firstTryAccuracy: firstAcc,
        finalAccuracy: finalAcc,
        progressPercentagePoints: prog,
        studentsNeedingHelp: status === 'needs_remediation' ? 1 : 0,
        status
      };

      sSkills.push(sDetail);
      if (status === 'good') sGood.push(sDetail);
      else if (status === 'needs_remediation') sWeak.push(sDetail);
      else sUntested.push(sDetail);
    }

    effSkillsList = sSkills;
    effGoodSkills = sGood;
    effWeakSkills = sWeak;
    effUntestedSkills = sUntested;
  }

  const isIndividualStudent = activeScope === 'tung_hoc_sinh' && !!studentProfile;

  const statistics: RemediationClassStatistics = {
    classId,
    className: classData.name,
    grade: classData.grade,
    academicYear: classData.academicYear || '2026-2027',
    semester: semester || 'all',
    totalStudents: isIndividualStudent ? 1 : totalStudents,
    participatedStudents: isIndividualStudent ? (studentProfile.totalAttempts > 0 ? 1 : 0) : participatedCount,
    notParticipatedStudents: isIndividualStudent ? (studentProfile.totalAttempts > 0 ? 0 : 1) : notParticipatedCount,
    completionRate: isIndividualStudent ? (studentProfile.totalAttempts > 0 ? 100 : 0) : completionRate,
    totalAttempts: isIndividualStudent ? studentProfile.totalAttempts : filteredAttemptDocs.length,
    assignedLessonsCount: assignmentsSnap.size,
    avgFirstTryAccuracy: isIndividualStudent ? studentProfile.firstTryAvg : avgFirstTry,
    avgFinalAccuracy: isIndividualStudent ? studentProfile.finalAvg : avgFinal,
    avgProgressPoints: isIndividualStudent ? studentProfile.progressDelta : avgProgress,
    skills: effSkillsList,
    goodSkills: effGoodSkills,
    weakSkills: effWeakSkills,
    untestedSkills: effUntestedSkills,
    highErrorQuestions: isIndividualStudent ? [] : highErrorQuestions,
    updatedAt: Date.now()
  };

  // 11. Call AI with actual calculated statistics & rich multi-dimensional scope
  const aiResult = await generateRemediationWithAI({
    className: classData.name,
    grade: classData.grade,
    academicYear: classData.academicYear,
    semester: semester || 'all',
    scope: activeScope,
    scopeSummary,
    studentProfile,
    studentGroups: { supportGroup, growthGroup },
    totalStudents,
    participatedStudents: participatedCount,
    avgAccuracyFirstTry: avgFirstTry,
    weakSkills: weakSkills.map((w) => ({
      skillTag: w.skillTag,
      label: w.label,
      accuracyFirstTry: w.firstTryAccuracy ?? 0,
      studentsNeedingHelp: w.studentsNeedingHelp
    })),
    goodSkills: goodSkills.map((g) => ({
      skillTag: g.skillTag,
      label: g.label,
      accuracyFirstTry: g.firstTryAccuracy ?? 0
    })),
    highErrorQuestions,
    sourceLesson: sourceLessonDoc
      ? {
          id: sourceLessonDoc.id,
          title: sourceLessonDoc.title,
          topic: sourceLessonDoc.topic,
          passage: sourceLessonDoc.passage,
          vocabulary: sourceLessonDoc.vocabulary
        }
      : undefined
  });

  return {
    ...aiResult,
    scope: activeScope,
    scopeSummary,
    studentProfile,
    studentGroups: { supportGroup, growthGroup },
    statistics
  };
});

// ==========================================
// 16. EXPORT TEACHER DATA (CSV UTF-8 BOM & JSON)
// ==========================================
// 16. EXPORT TEACHER DATA (CSV, JSON & SUMMARY METRICS)
// ==========================================
export const exportTeacherData = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { classId, academicYear, grade, semester } = data || {};

  const rawClassDocs = await db.collection('classes').where('teacherUid', '==', teacherUid).get();
  const classDocs = rawClassDocs.docs.filter((d) => {
    const c = d.data();
    if (classId && d.id !== classId && c.id !== classId) return false;
    if (academicYear && academicYear !== 'all' && (c.academicYear || '2026-2027') !== academicYear) return false;
    if (grade && grade !== 'all' && Number(c.grade) !== Number(grade)) return false;
    return true;
  });
  const classMap: Record<string, any> = {};
  rawClassDocs.docs.forEach((d) => {
    classMap[d.id] = d.data();
    if (d.data().id) classMap[d.data().id] = d.data();
  });
  const allowedClassIds = new Set(classDocs.map((d) => d.id));
  classDocs.forEach((d) => {
    if (d.data().id) allowedClassIds.add(d.data().id);
  });

  const [studentsSnap, lessonsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').where('teacherUid', '==', teacherUid).get(),
    db.collection('attempts').where('teacherUid', '==', teacherUid).where('status', '==', 'completed').get()
  ]);

  const studentMap: Record<string, any> = {};
  studentsSnap.docs.forEach((d) => (studentMap[d.id] = d.data()));

  const assignmentMap: Record<string, any> = {};
  assignmentsSnap.docs.forEach((d) => (assignmentMap[d.id] = { id: d.id, ...d.data() }));

  const lessonMap: Record<string, string> = {};
  const lessonSemesterMap: Record<string, number> = {};
  lessonsSnap.docs.forEach((d) => {
    const lData = d.data();
    lessonMap[d.id] = lData?.title || d.id;
    lessonSemesterMap[d.id] = Number(lData?.semester || 1);
  });

  // Filter assignments within allowed classes & semester
  const filteredAssignments = assignmentsSnap.docs.filter((d) => {
    const a = d.data();
    if (!allowedClassIds.has(a.classId)) return false;
    if (semester && semester !== 'all') {
      const s = Number(a.semester || lessonSemesterMap[a.lessonId] || 1);
      if (s !== Number(semester)) return false;
    }
    return true;
  });

  // Filter completed attempts within allowed classes & semester
  // REQUIREMENT 4: NEVER use student's current class to replace historical class!
  const filteredAttempts = attemptsSnap.docs.filter((d) => {
    const att = d.data();
    const assign = assignmentMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    if (!historicalClassId || !allowedClassIds.has(historicalClassId)) return false;
    if (semester && semester !== 'all') {
      const s = Number(att.semester || assign?.semester || lessonSemesterMap[att.lessonId] || 1);
      if (s !== Number(semester)) return false;
    }
    return true;
  });

  // Total students in scope (Sĩ số)
  const studentsInScope = studentsSnap.docs.filter((d) => allowedClassIds.has(d.data().classId));
  const totalStudentsInScope = studentsInScope.length;

  // Formula injection defense (CWE-1236)
  function sanitizeCsv(val: any): string {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  // Generate CSV with UTF-8 BOM (\uFEFF) for Excel compatibility
  let csv = '\uFEFFMã học sinh,Biệt danh,Lớp,Khối,Năm học,Học kỳ,Bài được giao,Lượt làm,Số câu hỏi,Đúng lần đầu,Đúng sau gợi ý,Điểm lần đầu (thang 10),Điểm sau gợi ý (thang 10),Tiến bộ (+câu / +% pp),Số sao,Thời gian hoàn thành,Kiểm toán niên khóa\n';

  const exportRecords: any[] = [];

  filteredAttempts.forEach((doc) => {
    const att = doc.data();
    const assign = assignmentMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    const st = studentMap[att.studentId] || {};
    const cl = classMap[historicalClassId] || {};
    const lessonTitle = lessonMap[att.lessonId] || assign?.lessonTitle || att.lessonId || 'N/A';
    const lSemester = Number(att.semester || assign?.semester || lessonSemesterMap[att.lessonId] || 1);
    const totalQ = att.totalQuestions || 5;
    const firstTry = att.firstTryCorrectCount || 0;
    const finalVal = att.finalCorrectCount || 0;
    const progress = Math.max(0, finalVal - firstTry);
    const progressPP = Number(((progress / totalQ) * 100).toFixed(1));
    const firstScore = Number(((firstTry / totalQ) * 10).toFixed(1));
    const finalScore = Number(((finalVal / totalQ) * 10).toFixed(1));
    const progressLabel = progress > 0 ? `+${progress} câu (+${progressPP}% pp)` : '0 câu';

    // Timestamp & Vietnam timezone normalization
    let completedTs: number | null = null;
    if (typeof att.completedAt === 'number') {
      completedTs = att.completedAt;
    } else if (att.completedAt && (att.completedAt as any)._seconds) {
      completedTs = (att.completedAt as any)._seconds * 1000;
    } else if (typeof att.startedAt === 'number') {
      completedTs = att.startedAt;
    }

    const completedFormattedVN = formatVietnamDateTime(completedTs);
    const completedDateOnly = formatVietnamDate(completedTs);

    // Academic Year Audit: Infer actual academic year from completion timestamp
    const inferred = getAcademicYearFromTimestamp(completedTs);
    const recordedYear = att.academicYear || assign?.academicYear || cl.academicYear || '2026-2027';
    const isDateAnomalous = Boolean(completedTs && inferred.academicYear !== recordedYear);
    const anomalyReason = isDateAnomalous
      ? `Lớp ghi năm học "${recordedYear}", nhưng ngày làm bài thực tế là ${completedFormattedVN} (thuộc niên khóa ${inferred.academicYear} - ${inferred.semesterLabel})`
      : 'Hợp lệ';

    const row = [
      sanitizeCsv(st.studentCode || 'N/A'),
      sanitizeCsv(st.displayAlias || 'Ẩn danh'),
      sanitizeCsv(cl.name || 'N/A'),
      sanitizeCsv(cl.grade ? `Khối ${cl.grade}` : 'N/A'),
      sanitizeCsv(recordedYear),
      sanitizeCsv(lSemester === 2 ? 'Học kỳ II' : 'Học kỳ I'),
      sanitizeCsv(lessonTitle),
      att.attemptNumber || 1,
      totalQ,
      `${firstTry}/${totalQ}`,
      `${finalVal}/${totalQ}`,
      firstScore,
      finalScore,
      sanitizeCsv(progressLabel),
      att.starsEarned || 0,
      sanitizeCsv(completedFormattedVN),
      sanitizeCsv(isDateAnomalous ? `[BẤT THƯỜNG] ${anomalyReason}` : 'Hợp lệ')
    ];

    csv += row.join(',') + '\n';

    exportRecords.push({
      attemptId: doc.id,
      studentCode: st.studentCode || 'N/A',
      displayAlias: st.displayAlias || 'Ẩn danh',
      classId: historicalClassId,
      className: cl.name || 'N/A',
      grade: cl.grade || null,
      academicYear: recordedYear,
      isDateAnomalous,
      anomalyReason: isDateAnomalous ? anomalyReason : null,
      inferredAcademicYear: inferred.academicYear,
      inferredSemester: inferred.semester,
      semester: lSemester,
      semesterLabel: lSemester === 2 ? 'Học kỳ II' : 'Học kỳ I',
      lessonId: att.lessonId,
      lessonTitle,
      attemptNumber: att.attemptNumber || 1,
      totalQuestions: totalQ,
      firstTryCorrectCount: firstTry,
      finalCorrectCount: finalVal,
      progressCount: progress,
      progressPercentagePoints: progressPP,
      firstTryScore: firstScore,
      finalScore: finalScore,
      score: firstScore, // Điểm luyện tập chính thang 10
      scorePercentage: Math.round((firstTry / totalQ) * 100),
      finalScorePercentage: Math.round((finalVal / totalQ) * 100),
      starsEarned: att.starsEarned || 0,
      completedAt: completedTs || Date.now(),
      completedAtFormatted: completedFormattedVN,
      completedDateOnly
    });
  });

  // Calculate 5 competencies directly from Firestore responses
  const skillAccumulator: Record<
    SkillTag,
    { label: string; tested: number; firstTryCorrect: number; finalCorrect: number; firstTryPct: number; finalPct: number; progressPct: number }
  > = {
    thong_tin_truc_tiep: { label: SKILL_LABELS.thong_tin_truc_tiep, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    tu_trong_ngu_canh: { label: SKILL_LABELS.tu_trong_ngu_canh, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    noi_dung_chinh: { label: SKILL_LABELS.noi_dung_chinh, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    sap_xep_trinh_tu: { label: SKILL_LABELS.sap_xep_trinh_tu, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 },
    lien_he_van_dung: { label: SKILL_LABELS.lien_he_van_dung, tested: 0, firstTryCorrect: 0, finalCorrect: 0, firstTryPct: 0, finalPct: 0, progressPct: 0 }
  };

  await Promise.all(
    filteredAttempts.map(async (attDoc) => {
      const respSnap = await attDoc.ref.collection('responses').get();
      respSnap.forEach((rDoc) => {
        const r = rDoc.data();
        const skill = r.skillTag as SkillTag;
        if (skill && skillAccumulator[skill]) {
          skillAccumulator[skill].tested++;
          if (r.firstTryCorrect) skillAccumulator[skill].firstTryCorrect++;
          if (r.finalCorrect) skillAccumulator[skill].finalCorrect++;
        }
      });
    })
  );

  Object.keys(skillAccumulator).forEach((k) => {
    const sk = skillAccumulator[k as SkillTag];
    if (sk.tested > 0) {
      sk.firstTryPct = Math.round((sk.firstTryCorrect / sk.tested) * 100);
      sk.finalPct = Math.round((sk.finalCorrect / sk.tested) * 100);
      sk.progressPct = Math.max(0, sk.finalPct - sk.firstTryPct);
    }
  });

  const participatedStudentCodes = new Set(exportRecords.map((r) => r.studentCode).filter((c) => c !== 'N/A'));
  const participatedCount = participatedStudentCodes.size;
  const notParticipatedCount = Math.max(0, totalStudentsInScope - participatedCount);
  const completionRate = totalStudentsInScope > 0 ? Math.round((participatedCount / totalStudentsInScope) * 100) : 0;

  const totalQuestionsSum = exportRecords.reduce((sum, r) => sum + (r.totalQuestions || 5), 0);
  const totalFirstTrySum = exportRecords.reduce((sum, r) => sum + (r.firstTryCorrectCount || 0), 0);
  const totalFinalSum = exportRecords.reduce((sum, r) => sum + (r.finalCorrectCount || 0), 0);

  const avgFirstTry = totalQuestionsSum > 0
    ? Math.round((totalFirstTrySum / totalQuestionsSum) * 100)
    : 0;
  const avgFinal = totalQuestionsSum > 0
    ? Math.round((totalFinalSum / totalQuestionsSum) * 100)
    : 0;
  const avgFirstTryScore = totalQuestionsSum > 0
    ? Number(((totalFirstTrySum / totalQuestionsSum) * 10).toFixed(1))
    : 0;
  const avgFinalScore = totalQuestionsSum > 0
    ? Number(((totalFinalSum / totalQuestionsSum) * 10).toFixed(1))
    : 0;
  const progressDelta = Math.max(0, avgFinal - avgFirstTry); // Điểm phần trăm (percentage points)

  const anomalousDateCount = exportRecords.filter((r) => r.isDateAnomalous).length;
  const validDateCount = exportRecords.length - anomalousDateCount;

  return {
    success: true,
    csv,
    records: exportRecords,
    totalRecords: exportRecords.length,
    summary: {
      totalStudents: totalStudentsInScope, // Sĩ số
      participatedStudents: participatedCount, // Học sinh tham gia
      notParticipatedStudents: notParticipatedCount, // Chưa tham gia
      assignedLessonsCount: filteredAssignments.length, // Bài đã giao
      totalAttempts: exportRecords.length, // Lượt làm bài
      completionRate, // Tỷ lệ hoàn thành (%)
      totalQuestionsSum,
      totalFirstTrySum,
      totalFinalSum,
      avgFirstTryAccuracy: avgFirstTry,
      avgFinalAccuracy: avgFinal,
      avgFirstTryScore,
      avgFinalScore,
      progressDelta,
      anomalousDateCount,
      validDateCount,
      auditStatus: anomalousDateCount > 0 ? 'anomalous_dates_detected' : 'all_dates_valid',
      auditNote: anomalousDateCount > 0
        ? `Cảnh báo kiểm toán: Phát hiện ${anomalousDateCount} lượt làm bài có ngày hoàn thành lệch so với năm học của lớp.`
        : 'Kiểm toán ngày làm bài: 100% hợp lệ và nhất quán với niên khóa.',
      skillsBreakdown: skillAccumulator
    },
    jsonData: JSON.stringify(exportRecords, null, 2)
  };
});

// ==========================================
// 17. SEED DATABASE (INITIALIZE 6 SAMPLE LESSONS)
// ==========================================
export const seedDatabase = functions.https.onCall(async (data, context) => {
  const teacherUid = context.auth?.uid || 'seed_teacher_uid';
  const now = Date.now();

  const batch = db.batch();

  for (const lesson of SEED_LESSONS) {
    const lessonRef = db.collection('lessons').doc(lesson.id);
    const versionRef = lessonRef.collection('versions').doc(`${lesson.id}-v1`);
    const keyRef = db.collection('privateAnswerKeys').doc(`${lesson.id}-v1`);

    const publicQuestions: any[] = [];
    const privateAnswers: Record<string, QuestionAnswerDetail> = {};

    for (const q of lesson.questions) {
      publicQuestions.push({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options || undefined,
        statement: q.statement || undefined,
        items: q.items || undefined,
        skillTag: q.skillTag,
        difficulty: q.difficulty,
        relatedPassagePart: q.relatedPassagePart || ''
      });

      privateAnswers[q.id] = {
        correctAnswer: q.answer,
        hint: q.hint,
        explanation: q.explanation
      };
    }

    const skillTags = Array.from(new Set(lesson.questions.map((q) => q.skillTag)));

    // Lesson doc
    batch.set(
      lessonRef,
      {
        id: lesson.id,
        teacherUid,
        title: lesson.title,
        topic: lesson.topic,
        grade: lesson.grade,
        status: 'published',
        currentVersionId: `${lesson.id}-v1`,
        updatedAt: now,
        createdAt: now
      },
      { merge: true }
    );

    // Version doc (public questions, no answers)
    batch.set(
      versionRef,
      {
        versionId: `${lesson.id}-v1`,
        lessonId: lesson.id,
        versionNumber: 1,
        passage: lesson.passage,
        vocabulary: lesson.vocabulary,
        publicQuestions,
        grade: lesson.grade,
        topic: lesson.topic,
        title: lesson.title,
        skillTags,
        publishedAt: now,
        createdAt: now
      },
      { merge: true }
    );

    // Isolated Private Answer Key
    batch.set(
      keyRef,
      {
        versionId: `${lesson.id}-v1`,
        lessonId: lesson.id,
        answers: privateAnswers,
        createdAt: now
      },
      { merge: true }
    );
  }

  // Also seed verified curriculum framework
  for (const node of VERIFIED_CURRICULUM_NODES) {
    const nodeRef = db.collection('curriculumNodes').doc(node.id);
    batch.set(nodeRef, node, { merge: true });
  }

  await batch.commit();

  return {
    success: true,
    message: `Đã khởi tạo thành công ${SEED_LESSONS.length} bài học mẫu và ${VERIFIED_CURRICULUM_NODES.length} mục khung chương trình GDPT vào Firestore.`
  };
});

// ==========================================
// 18. BOOTSTRAP ADMIN ROLE (PRIVILEGED BACKEND PROCESS)
// ==========================================
export const bootstrapAdminRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập để khởi tạo quyền Quản trị.');
  }

  // Prevent anonymous accounts from claiming admin role
  if (context.auth.token.firebase?.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Tài khoản ẩn danh của học sinh không thể nhận quyền Quản trị.');
  }

  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const adminSecret = data?.adminSecret;
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);
  const uid = context.auth.uid;
  const email = context.auth.token.email || '';
  const displayName = data?.displayName || email.split('@')[0] || 'Quản trị viên';

  // Security check: Must supply correct admin bootstrap secret (never allow hardcoded secret in production)
  if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Mã bảo mật Quản trị viên (adminSecret) không chính xác hoặc chưa được cấu hình Secret trên môi trường máy chủ.'
    );
  }

  await db.collection('users').doc(uid).set(
    {
      role: 'admin',
      status: 'active',
      displayName,
      email,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    },
    { merge: true }
  );

  await auth.setCustomUserClaims(uid, { role: 'admin' });

  return {
    success: true,
    message: `Đã cấp quyền Quản trị viên (Admin) thành công cho tài khoản ${email || uid}.`
  };
});

// ==========================================
// 19. ADMIN OVERVIEW METRICS
// ==========================================
export const getAdminOverview = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);

  const [usersSnap, classesSnap, studentsSnap, lessonsSnap, attemptsSnap, currSnap, aySnap] = await Promise.all([
    db.collection('users').get(),
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('attempts').get(),
    db.collection('curriculumNodes').get(),
    db.collection('academicYears').get()
  ]);

  let totalTeachers = 0;
  let activeTeachers = 0;

  usersSnap.forEach((d) => {
    const u = d.data();
    if (u.role === 'teacher') {
      totalTeachers++;
      if (u.status !== 'suspended') activeTeachers++;
    }
  });

  const aiStatus = checkAIConfig();

  const curriculumCoverage: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  currSnap.forEach((d) => {
    const g = Number(d.data().grade);
    if (curriculumCoverage[g] !== undefined) {
      curriculumCoverage[g]++;
    }
  });

  // Calculate dynamic academic years and unique students per year
  const configuredYears = new Map<string, any>();
  aySnap.forEach((d) => {
    configuredYears.set(d.id, d.data());
  });

  // Collect all unique years from classes as well
  const allYearsSet = new Set<string>(configuredYears.keys());
  const classToYear = new Map<string, string>();

  classesSnap.forEach((d) => {
    const c = d.data();
    const yr = c.academicYear || '2026-2027';
    allYearsSet.add(yr);
    classToYear.set(d.id, yr);
  });

  // Calculate unique students across entire system (guaranteed no double counting)
  const allUniqueStudentIds = new Set<string>();
  const yearStudentsMap = new Map<string, Set<string>>();
  allYearsSet.forEach((yr) => yearStudentsMap.set(yr, new Set<string>()));

  studentsSnap.forEach((d) => {
    allUniqueStudentIds.add(d.id);
    const s = d.data();
    const yr = classToYear.get(s.classId);
    if (yr && yearStudentsMap.has(yr)) {
      yearStudentsMap.get(yr)!.add(d.id);
    }
  });

  const academicYearsList = Array.from(allYearsSet).sort((a, b) => b.localeCompare(a));

  const yearBreakdown = academicYearsList.map((yr) => {
    let totalYrClasses = 0;
    let activeYrClasses = 0;
    classesSnap.forEach((d) => {
      const c = d.data();
      if ((c.academicYear || '2026-2027') === yr) {
        totalYrClasses++;
        if (c.status !== 'archived') activeYrClasses++;
      }
    });

    return {
      academicYear: yr,
      totalClasses: totalYrClasses,
      activeClasses: activeYrClasses,
      totalStudents: yearStudentsMap.get(yr)?.size || 0
    };
  });

  return {
    totalTeachers,
    activeTeachers,
    totalClasses: classesSnap.size,
    totalStudents: allUniqueStudentIds.size,
    totalLessons: lessonsSnap.size,
    totalAttempts: attemptsSnap.size,
    aiServiceStatus: aiStatus,
    curriculumCoverage,
    academicYearsList,
    yearBreakdown
  };
});

// ==========================================
// 20. LIST TEACHERS (ADMIN ONLY)
// ==========================================
export const listTeachers = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);

  const [usersSnap, classesSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'teacher').get(),
    db.collection('classes').get()
  ]);

  const teacherClassCount: Record<string, number> = {};
  classesSnap.forEach((d) => {
    const tId = d.data().teacherUid;
    teacherClassCount[tId] = (teacherClassCount[tId] || 0) + 1;
  });

  const teachers = usersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email || 'Chưa có email',
      displayName: data.displayName || 'Giáo viên',
      status: data.status || 'active',
      classCount: teacherClassCount[doc.id] || 0,
      createdAt: data.createdAt || Date.now()
    };
  });

  return { teachers };
});

// ==========================================
// 21. UPDATE USER / TEACHER STATUS (ADMIN ONLY)
// ==========================================
export const updateUserStatus = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { targetUid, status, role, displayName, phoneNumber } = data || {};
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp UID người dùng.');
  }

  // Prevent admin from suspending or archiving themselves
  if (targetUid === context.auth!.uid && (status === 'suspended' || status === 'archived')) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Quản trị viên không thể tự khóa hoặc tự lưu trữ tài khoản của chính mình.'
    );
  }

  const updates: any = { updatedAt: Date.now() };
  if (status && ['active', 'suspended', 'archived', 'pending_approval'].includes(status)) {
    updates.status = status;
  }
  if (role && ['teacher', 'admin'].includes(role)) {
    updates.role = role;
    await auth.setCustomUserClaims(targetUid, { role });
  }
  if (displayName && String(displayName).trim()) {
    updates.displayName = String(displayName).trim();
    try {
      await auth.updateUser(targetUid, { displayName: updates.displayName });
    } catch {}
  }
  if (phoneNumber !== undefined) {
    updates.phoneNumber = String(phoneNumber).trim();
  }

  await db.collection('users').doc(targetUid).set(updates, { merge: true });

  return {
    success: true,
    message: `Đã cập nhật thông tin tài khoản ${targetUid} thành công.`
  };
});

// ==========================================
// 21B. ADMIN DELETE TEACHER (DEPENDENCY AWARE & ATOMIC)
// ==========================================
export const adminDeleteTeacher = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { teacherUid, force } = data || {};
  if (!teacherUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp teacherUid.');
  }

  // Prevent admin from deleting themselves
  if (teacherUid === context.auth!.uid) {
    throw new functions.https.HttpsError('failed-precondition', 'Bạn không thể tự xóa tài khoản quản trị của chính mình.');
  }

  // Check if target is admin and if it's the last admin
  const targetUserDoc = await db.collection('users').doc(teacherUid).get();
  if (targetUserDoc.exists && targetUserDoc.data()?.role === 'admin') {
    const adminCountSnap = await db.collection('users').where('role', '==', 'admin').get();
    if (adminCountSnap.size <= 1) {
      throw new functions.https.HttpsError('failed-precondition', 'Không thể xóa tài khoản Quản trị viên duy nhất của hệ thống.');
    }
  }

  // Check dependencies: classes and lessons
  const [classesSnap, lessonsSnap] = await Promise.all([
    db.collection('classes').where('teacherUid', '==', teacherUid).get(),
    db.collection('lessons').where('teacherUid', '==', teacherUid).get()
  ]);

  const classCount = classesSnap.size;
  const lessonCount = lessonsSnap.size;

  if ((classCount > 0 || lessonCount > 0) && !force) {
    return {
      success: false,
      hasDependencies: true,
      classCount,
      lessonCount,
      message: `Giáo viên này đang phụ trách ${classCount} lớp học và có ${lessonCount} bài học. Bạn nên chuyển giao lớp hoặc chọn "Lưu trữ tài khoản" thay vì xóa vĩnh viễn.`
    };
  }

  // Proceed with deletion across Firestore and Firebase Auth
  const batch = db.batch();
  batch.delete(db.collection('users').doc(teacherUid));
  batch.delete(db.collection('accountSecrets').doc(teacherUid));

  const targetData = targetUserDoc.data();
  if (targetData?.username) {
    batch.delete(db.collection('usernames').doc(targetData.username.toLowerCase()));
  }

  await batch.commit();

  try {
    await auth.deleteUser(teacherUid);
  } catch (err: any) {
    console.warn('Could not delete user from Firebase Auth:', err.message);
  }

  return {
    success: true,
    hasDependencies: false,
    message: `Đã xóa vĩnh viễn tài khoản giáo viên ${targetData?.displayName || teacherUid}.`
  };
});

// ==========================================
// 21C. ADMIN BATCH UPDATE TEACHERS
// ==========================================
export const adminBatchUpdateTeachers = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { teacherUids, action, force } = data || {};

  if (!Array.isArray(teacherUids) || teacherUids.length === 0 || !['lock', 'unlock', 'archive', 'delete'].includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'Dữ liệu thao tác hàng loạt không hợp lệ.');
  }

  let successCount = 0;
  let skippedSelfCount = 0;
  let dependencyProtectedCount = 0;
  const details: string[] = [];

  for (const tUid of teacherUids) {
    if (tUid === context.auth!.uid) {
      skippedSelfCount++;
      details.push('Bỏ qua tài khoản Quản trị đang đăng nhập.');
      continue;
    }

    if (action === 'delete') {
      const [classesSnap, lessonsSnap] = await Promise.all([
        db.collection('classes').where('teacherUid', '==', tUid).get(),
        db.collection('lessons').where('teacherUid', '==', tUid).get()
      ]);

      if ((classesSnap.size > 0 || lessonsSnap.size > 0) && !force) {
        // Protect dependencies: archive instead of hard delete
        await db.collection('users').doc(tUid).set({ status: 'archived', updatedAt: Date.now() }, { merge: true });
        dependencyProtectedCount++;
        details.push(`UID ${tUid} có ${classesSnap.size} lớp / ${lessonsSnap.size} bài -> đã chuyển sang Lưu trữ để bảo vệ dữ liệu.`);
      } else {
        const batch = db.batch();
        batch.delete(db.collection('users').doc(tUid));
        batch.delete(db.collection('accountSecrets').doc(tUid));
        const uDoc = await db.collection('users').doc(tUid).get();
        if (uDoc.data()?.username) {
          batch.delete(db.collection('usernames').doc(uDoc.data()!.username.toLowerCase()));
        }
        await batch.commit();
        try {
          await auth.deleteUser(tUid);
        } catch {}
        successCount++;
      }
    } else {
      const newStatus = action === 'lock' ? 'suspended' : action === 'archive' ? 'archived' : 'active';
      await db.collection('users').doc(tUid).set({ status: newStatus, updatedAt: Date.now() }, { merge: true });
      successCount++;
    }
  }

  return {
    success: true,
    action,
    successCount,
    skippedSelfCount,
    dependencyProtectedCount,
    details
  };
});

// ==========================================
// 22. LIST ALL CLASSES ACROSS SCHOOL (ADMIN ONLY)
// ==========================================
export const listAllClassesAdmin = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);

  const [classesSnap, usersSnap, studentsSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('users').get(),
    db.collection('students').get()
  ]);

  const teacherMap: Record<string, string> = {};
  usersSnap.forEach((d) => {
    teacherMap[d.id] = d.data().displayName || d.data().username || d.data().email || 'Giáo viên';
  });

  const studentCountMap: Record<string, number> = {};
  studentsSnap.forEach((d) => {
    const cId = d.data().classId;
    if (cId) {
      studentCountMap[cId] = (studentCountMap[cId] || 0) + 1;
    }
  });

  const classes = classesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      grade: data.grade,
      classCode: data.classCode,
      academicYear: data.academicYear || '2026-2027',
      status: data.status || 'active',
      studentCount: data.studentCount !== undefined && data.studentCount > 0 
        ? data.studentCount 
        : (studentCountMap[doc.id] || 0),
      teacherUid: data.teacherUid,
      teacherName: teacherMap[data.teacherUid] || 'Giáo viên phụ trách',
      updatedAt: data.updatedAt || data.createdAt || Date.now(),
      createdAt: data.createdAt || Date.now()
    };
  });

  return { classes };
});

// ==========================================
// 23. GET CURRICULUM FRAMEWORK (ALL AUTH USERS)
// ==========================================
export const getCurriculumFramework = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập.');
  }

  const grade = data?.grade ? Number(data.grade) : null;
  let q: FirebaseFirestore.Query = db.collection('curriculumNodes');
  if (grade) {
    q = q.where('grade', '==', grade);
  }

  const snap = await q.get();

  // If empty, auto-seed with verified GDPT 2018 nodes
  if (snap.empty) {
    const batch = db.batch();
    for (const node of VERIFIED_CURRICULUM_NODES) {
      batch.set(db.collection('curriculumNodes').doc(node.id), node);
    }
    await batch.commit();

    return {
      nodes: grade ? VERIFIED_CURRICULUM_NODES.filter((n) => n.grade === grade) : VERIFIED_CURRICULUM_NODES,
      source: 'pre_verified_seed'
    };
  }

  const nodes = snap.docs.map((d) => d.data());
  return { nodes, source: 'firestore' };
});

// ==========================================
// 24. SAVE CURRICULUM NODE (ADMIN ONLY)
// ==========================================
export const saveCurriculumNode = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const node = data?.node;
  const parsed = CurriculumNodeSchema.safeParse(node);
  if (!parsed.success) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Dữ liệu khung chương trình chưa hợp lệ: ' + parsed.error.issues.map((i) => i.message).join('; ')
    );
  }

  const docRef = db.collection('curriculumNodes').doc(parsed.data.id);
  await docRef.set({ ...parsed.data, createdAt: Date.now() }, { merge: true });

  return { success: true, node: parsed.data };
});

// ==========================================
// 25. ADMIN RESET TEACHER PASSWORD (ADMIN ONLY)
// ==========================================
export const adminResetTeacherPassword = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const targetUid = data?.targetUid || data?.uid || data?.teacherUid;
  const newPassword = data?.newPassword;

  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp UID người dùng.');
  }

  const userRecord = await auth.getUser(targetUid);
  const email = userRecord.email;

  let resetLink = '';
  if (email) {
    try {
      resetLink = await auth.generatePasswordResetLink(email);
    } catch (e) {
      console.warn('Could not generate reset link:', e);
    }
  }

  if (newPassword && String(newPassword).length >= 6) {
    await auth.updateUser(targetUid, {
      password: String(newPassword)
    });

    // Also update salted hash in accountSecrets
    const salt = generateSalt();
    const passwordHash = hashPassword(String(newPassword), salt);
    await db.collection('accountSecrets').doc(targetUid).set({
      uid: targetUid,
      salt,
      passwordHash,
      updatedAt: Date.now()
    }, { merge: true });

    return {
      success: true,
      resetLink,
      message: `Đã cập nhật mật khẩu mới cho tài khoản ${userRecord.displayName || email}.`
    };
  }

  return {
    success: true,
    resetLink,
    message: `Đã tạo liên kết đặt lại mật khẩu an toàn Firebase cho giáo viên ${email}.`
  };
});

// ==========================================
// 26. INIT DEMO ACCOUNTS (LOCAL EMULATOR ONLY - IDEMPOTENT)
// ==========================================
export const initDemoAccounts = functions.https.onCall(async (_data, _context) => {
  // STRICT PRODUCTION PROTECTION
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  if (!isEmulator) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      '[BẢO VỆ MÁY CHỦ PRODUCTION]: Chức năng khởi tạo tài khoản demo yếu chỉ được phép chạy trên Firebase Emulator cục bộ.'
    );
  }

  const now = Date.now();
  const batch = db.batch();

  // 1. ADMIN DEMO: username = admin, password = admin
  const adminUid = 'admin_demo_account';
  const adminEmail = 'admin@emytv.local';
  try {
    await auth.getUser(adminUid);
    await auth.updateUser(adminUid, { email: adminEmail, displayName: 'Quản Trị Viên Hệ Thống' });
  } catch {
    await auth.createUser({ uid: adminUid, email: adminEmail, displayName: 'Quản Trị Viên Hệ Thống' });
  }
  await auth.setCustomUserClaims(adminUid, { role: 'admin' });

  const adminSalt = generateSalt();
  const adminHash = hashPassword('admin', adminSalt);
  batch.set(db.collection('accountSecrets').doc(adminUid), {
    uid: adminUid,
    salt: adminSalt,
    passwordHash: adminHash,
    updatedAt: now
  }, { merge: true });

  batch.set(db.collection('users').doc(adminUid), {
    uid: adminUid,
    username: 'admin',
    displayName: 'Quản Trị Viên Hệ Thống',
    role: 'admin',
    status: 'active',
    internalEmail: adminEmail,
    createdAt: now
  }, { merge: true });

  batch.set(db.collection('usernames').doc('admin'), {
    username: 'admin',
    uid: adminUid,
    role: 'admin',
    internalEmail: adminEmail,
    updatedAt: now
  }, { merge: true });

  // 2. GIÁO VIÊN DEMO: username = giaovien01, password = GV123456
  const teacherUid = 'teacher_demo_account';
  const teacherEmail = 'giaovien01@emytv.local';
  try {
    await auth.getUser(teacherUid);
    await auth.updateUser(teacherUid, { email: teacherEmail, password: 'GV123456', displayName: 'Cô Nguyễn Thị Lan' });
  } catch {
    await auth.createUser({ uid: teacherUid, email: teacherEmail, password: 'GV123456', displayName: 'Cô Nguyễn Thị Lan' });
  }
  await auth.setCustomUserClaims(teacherUid, { role: 'teacher' });

  const teacherSalt = generateSalt();
  const teacherHash = hashPassword('GV123456', teacherSalt);
  batch.set(db.collection('accountSecrets').doc(teacherUid), {
    uid: teacherUid,
    salt: teacherSalt,
    passwordHash: teacherHash,
    updatedAt: now
  }, { merge: true });

  batch.set(db.collection('users').doc(teacherUid), {
    uid: teacherUid,
    username: 'giaovien01',
    displayName: 'Cô Nguyễn Thị Lan',
    role: 'teacher',
    status: 'active',
    internalEmail: teacherEmail,
    createdAt: now
  }, { merge: true });

  batch.set(db.collection('usernames').doc('giaovien01'), {
    username: 'giaovien01',
    uid: teacherUid,
    role: 'teacher',
    internalEmail: teacherEmail,
    updatedAt: now
  }, { merge: true });

  // Create or verify sample class for giaovien01
  const classId = 'class_demo_lop2a';
  batch.set(db.collection('classes').doc(classId), {
    id: classId,
    name: 'Lớp 2A Mẫu',
    grade: 2,
    classCode: 'LOP2A01',
    academicYear: '2026-2027',
    teacherUid: teacherUid,
    status: 'active',
    studentCount: 1,
    createdAt: now
  }, { merge: true });

  // 3. HỌC SINH DEMO: username = HS001, password = HS123456
  const studentId = 'student_demo_hs001';
  batch.set(db.collection('students').doc(studentId), {
    id: studentId,
    studentCode: 'HS001',
    username: 'HS001',
    displayAlias: 'Em Nguyễn An Nhiên',
    classId: classId,
    status: 'active',
    createdAt: now
  }, { merge: true });

  const studentSalt = generateSalt();
  const studentHash = hashPassword('HS123456', studentSalt);
  batch.set(db.collection('studentSecrets').doc(studentId), {
    studentId: studentId,
    salt: studentSalt,
    accessCodeHash: studentHash,
    rotatedAt: now
  }, { merge: true });

  batch.set(db.collection('usernames').doc('hs001'), {
    username: 'hs001',
    uid: studentId,
    role: 'student',
    studentId: studentId,
    updatedAt: now
  }, { merge: true });

  await batch.commit();

  return {
    success: true,
    message: 'Đã khởi tạo thành công bộ tài khoản demo cố định (admin, giaovien01, HS001).'
  };
});

// ==========================================
// 27. UNIFIED ACCOUNT LOGIN (NO GMAIL REQUIRED)
// ==========================================
export const accountLogin = functions.https.onCall(async (data, _context) => {
  const { username, password } = data || {};
  if (!username || !password) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Vui lòng nhập đầy đủ Tên đăng nhập / Mã học sinh và Mật khẩu.'
    );
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();
  const lowerUser = cleanUser.toLowerCase();

  // 1. Check usernames collection
  const usernameDoc = await db.collection('usernames').doc(lowerUser).get();
  
  // 2. If not found in usernames, check students collection by studentCode
  if (!usernameDoc.exists) {
    const studentQuery = await db.collection('students')
      .where('studentCode', '==', cleanUser.toUpperCase())
      .limit(1)
      .get();

    if (!studentQuery.empty) {
      const sDoc = studentQuery.docs[0];
      const sData = sDoc.data();
      const sId = sDoc.id;

      if (sData.status === 'suspended') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Tài khoản học sinh này đang bị tạm khóa. Vui lòng liên hệ Thầy/Cô giáo để được hỗ trợ.'
        );
      }

      const secretDoc = await db.collection('studentSecrets').doc(sId).get();
      if (!secretDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Hồ sơ bảo mật học sinh chưa được khởi tạo.');
      }
      const secret = secretDoc.data()!;
      if (!verifyPassword(cleanPass, secret.salt, secret.accessCodeHash)) {
        throw new functions.https.HttpsError('permission-denied', 'Mật khẩu học sinh không chính xác.');
      }

      const authUid = `student_${sId}`;
      const token = await auth.createCustomToken(authUid, {
        role: 'student',
        studentId: sId,
        classId: sData.classId
      });

      await db.collection('studentSessions').doc(authUid).set({
        studentId: sId,
        classId: sData.classId,
        displayAlias: sData.displayAlias,
        validUntil: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: Date.now()
      });

      // Look up class to include className and grade
      let className = '';
      let grade = sData.grade || 2;
      let academicYear = sData.academicYear || '2026-2027';
      if (sData.classId) {
        const cDoc = await db.collection('classes').doc(sData.classId).get();
        if (cDoc.exists) {
          const cData = cDoc.data()!;
          className = cData.name || '';
          grade = cData.grade || grade;
          academicYear = cData.academicYear || academicYear;
        }
      }

      const sProfile = {
        id: sId,
        studentCode: sData.studentCode,
        displayAlias: sData.displayAlias,
        classId: sData.classId,
        className,
        grade,
        academicYear
      };

      return {
        success: true,
        token,
        role: 'student',
        student: sProfile,
        studentProfile: sProfile
      };
    }

    throw new functions.https.HttpsError(
      'not-found',
      'Tên đăng nhập hoặc Mã học sinh không tồn tại trong hệ thống.'
    );
  }

  const uMap = usernameDoc.data()!;

  // 3. If role is student
  if (uMap.role === 'student') {
    const sId = uMap.studentId || uMap.uid;
    const sDoc = await db.collection('students').doc(sId).get();
    if (!sDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Không tìm thấy hồ sơ học sinh.');
    }
    const sData = sDoc.data()!;
    if (sData.status === 'suspended') {
      throw new functions.https.HttpsError('permission-denied', 'Tài khoản học sinh đang bị tạm khóa.');
    }
    const secretDoc = await db.collection('studentSecrets').doc(sId).get();
    if (!secretDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Hồ sơ bảo mật học sinh không tồn tại.');
    }
    const secret = secretDoc.data()!;
    if (!verifyPassword(cleanPass, secret.salt, secret.accessCodeHash)) {
      throw new functions.https.HttpsError('permission-denied', 'Mật khẩu học sinh không chính xác.');
    }

    const authUid = `student_${sId}`;
    const token = await auth.createCustomToken(authUid, {
      role: 'student',
      studentId: sId,
      classId: sData.classId
    });

    await db.collection('studentSessions').doc(authUid).set({
      studentId: sId,
      classId: sData.classId,
      displayAlias: sData.displayAlias,
      validUntil: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: Date.now()
    });

    // Look up class to include className and grade
    let className = '';
    let grade = sData.grade || 2;
    let academicYear = sData.academicYear || '2026-2027';
    if (sData.classId) {
      const cDoc = await db.collection('classes').doc(sData.classId).get();
      if (cDoc.exists) {
        const cData = cDoc.data()!;
        className = cData.name || '';
        grade = cData.grade || grade;
        academicYear = cData.academicYear || academicYear;
      }
    }

    const sProfile = {
      id: sId,
      studentCode: sData.studentCode,
      displayAlias: sData.displayAlias,
      classId: sData.classId,
      className,
      grade,
      academicYear
    };

    return {
      success: true,
      token,
      role: 'student',
      student: sProfile,
      studentProfile: sProfile
    };
  }

  // 4. Role is teacher or admin
  const userDoc = await db.collection('users').doc(uMap.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Hồ sơ người dùng không tồn tại.');
  }
  const userData = userDoc.data()!;

  if (userData.role === 'teacher' && userData.status === 'pending_approval') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Tài khoản Giáo viên đang chờ Quản trị viên xét duyệt. Vui lòng liên hệ Admin để được phê duyệt.'
    );
  }

  if (userData.status === 'suspended') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Quản trị viên hệ thống.'
    );
  }

  // Verify password via accountSecrets
  const secretDoc = await db.collection('accountSecrets').doc(uMap.uid).get();
  let passwordOk = false;

  if (secretDoc.exists) {
    const s = secretDoc.data()!;
    passwordOk = verifyPassword(cleanPass, s.salt, s.passwordHash);
  }

  if (!passwordOk) {
    // STRICT PRODUCTION GUARD: Demo fallback is ONLY allowed in local emulator and strictly non-production
    const isEmulator = (process.env.FUNCTIONS_EMULATOR === 'true' || Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)) && process.env.NODE_ENV !== 'production';
    if (isEmulator) {
      if (lowerUser === 'admin' && cleanPass === 'admin') {
        passwordOk = true;
      } else if (lowerUser === 'giaovien01' && cleanPass === 'GV123456') {
        passwordOk = true;
      }
    }
  }

  if (!passwordOk) {
    throw new functions.https.HttpsError('permission-denied', 'Mật khẩu không chính xác.');
  }

  // Generate secure custom token for Auth session
  const token = await auth.createCustomToken(uMap.uid, {
    role: userData.role
  });

  return {
    success: true,
    token,
    role: userData.role,
    user: {
      uid: uMap.uid,
      username: userData.username || cleanUser,
      displayName: userData.displayName || 'Người dùng',
      role: userData.role,
      status: userData.status
    }
  };
});

// ==========================================
// 28. TEACHER REGISTRATION (WITH USERNAME)
// ==========================================
export const registerTeacherAccount = functions.https.onCall(async (data, _context) => {
  const { username, displayName, password } = data || {};

  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanName = String(displayName || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanUser || !/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Tên đăng nhập phải từ 3 đến 30 ký tự và chỉ chứa chữ cái, số hoặc dấu gạch dưới.'
    );
  }

  if (!cleanName || cleanName.length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng nhập Họ và tên giáo viên (tối thiểu 2 ký tự).');
  }

  if (!cleanPass || cleanPass.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu phải có tối thiểu 6 ký tự.');
  }

  // Check unique username
  const existingDoc = await db.collection('usernames').doc(cleanUser).get();
  if (existingDoc.exists) {
    throw new functions.https.HttpsError(
      'already-exists',
      `Tên đăng nhập "${cleanUser}" đã có người sử dụng. Vui lòng chọn tên đăng nhập khác.`
    );
  }

  const internalEmail = `${cleanUser}@emytv.local`;
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: internalEmail,
      password: cleanPass,
      displayName: cleanName
    });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(internalEmail);
    } else {
      throw new functions.https.HttpsError('internal', `Không thể tạo tài khoản xác thực: ${err.message}`);
    }
  }

  const uid = userRecord.uid;
  const now = Date.now();

  // Save salted password
  const salt = generateSalt();
  const passwordHash = hashPassword(cleanPass, salt);
  await db.collection('accountSecrets').doc(uid).set({
    uid,
    salt,
    passwordHash,
    createdAt: now
  });

  // User profile with status pending_approval
  await db.collection('users').doc(uid).set({
    uid,
    username: cleanUser,
    displayName: cleanName,
    role: 'teacher',
    status: 'pending_approval',
    internalEmail,
    createdAt: now
  });

  // Unique username mapping
  await db.collection('usernames').doc(cleanUser).set({
    username: cleanUser,
    uid,
    role: 'teacher',
    internalEmail,
    createdAt: now
  });

  return {
    success: true,
    message: 'Đăng ký tài khoản Giáo viên thành công! Tài khoản đang chờ Quản trị viên xét duyệt để kích hoạt.'
  };
});

// ==========================================
// 29. ADMIN APPROVE TEACHER
// ==========================================
export const adminApproveTeacher = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);
  const { teacherUid } = data || {};

  if (!teacherUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Thiếu UID giáo viên cần phê duyệt.');
  }

  await db.collection('users').doc(teacherUid).set({
    status: 'active',
    approvedAt: Date.now(),
    approvedBy: context.auth!.uid
  }, { merge: true });

  await auth.setCustomUserClaims(teacherUid, { role: 'teacher' });

  return {
    success: true,
    message: 'Đã phê duyệt và kích hoạt tài khoản Giáo viên thành công.'
  };
});

// ==========================================
// 30. CHANGE ACCOUNT PASSWORD (ADMIN OR TEACHER)
// ==========================================
export const changeAccountPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Yêu cầu đăng nhập.');
  }

  const oldPassword = data?.oldPassword || data?.currentPassword;
  const newPassword = data?.newPassword;
  const uid = context.auth.uid;

  if (!oldPassword || !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.');
  }

  if (String(newPassword).length < 4) {
    throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu mới phải có tối thiểu 4 ký tự.');
  }

  const secretDoc = await db.collection('accountSecrets').doc(uid).get();
  if (secretDoc.exists) {
    const s = secretDoc.data()!;
    if (!verifyPassword(String(oldPassword), s.salt, s.passwordHash)) {
      throw new functions.https.HttpsError('permission-denied', 'Mật khẩu cũ không chính xác.');
    }
  }

  // Update password in accountSecrets
  const newSalt = generateSalt();
  const newHash = hashPassword(String(newPassword), newSalt);
  await db.collection('accountSecrets').doc(uid).set({
    uid,
    salt: newSalt,
    passwordHash: newHash,
    updatedAt: Date.now()
  }, { merge: true });

  // Update in Firebase Auth if length >= 6
  if (String(newPassword).length >= 6) {
    try {
      await auth.updateUser(uid, { password: String(newPassword) });
    } catch (err: any) {
      console.warn('Could not update Firebase Auth password directly:', err.message);
    }
  }

  return {
    success: true,
    message: 'Đổi mật khẩu thành công.'
  };
});

// ==========================================
// 31. STUDENT CHANGE PASSWORD (SELF-SERVICE)
// ==========================================
export const studentChangePassword = functions.https.onCall(async (data, context) => {
  const session = await requireStudentSession(context);
  const oldPassword = data?.oldPassword || data?.currentPassword;
  const newPassword = data?.newPassword;

  if (!oldPassword || !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.');
  }

  if (String(newPassword).length < 4) {
    throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu mới phải có tối thiểu 4 ký tự.');
  }

  const secretDoc = await db.collection('studentSecrets').doc(session.studentId).get();
  if (!secretDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy hồ sơ bảo mật của học sinh.');
  }

  const secret = secretDoc.data()!;
  if (!verifyPassword(String(oldPassword), secret.salt, secret.accessCodeHash)) {
    throw new functions.https.HttpsError('permission-denied', 'Mật khẩu hiện tại không chính xác.');
  }

  const newSalt = generateSalt();
  const newHash = hashAccessCode(String(newPassword), newSalt);
  await db.collection('studentSecrets').doc(session.studentId).set({
    salt: newSalt,
    accessCodeHash: newHash,
    rotatedAt: Date.now()
  }, { merge: true });

  return {
    success: true,
    message: 'Học sinh đổi mật khẩu thành công.'
  };
});

// ==========================================
// 32. TEACHER RESET STUDENT PASSWORD
// ==========================================
export const teacherResetStudentPassword = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { studentId, newPassword } = data || {};

  if (!studentId || !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp ID học sinh và Mật khẩu mới.');
  }

  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy học sinh.');
  }

  const sData = studentDoc.data()!;
  // Verify teacher owns the student's class (or is admin)
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  const isOwner = classDoc.exists && classDoc.data()?.teacherUid === teacherUid;
  const isAdmin = context.auth?.token.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn chỉ có thể đặt lại mật khẩu cho học sinh thuộc lớp của mình.');
  }

  const newSalt = generateSalt();
  const newHash = hashAccessCode(String(newPassword), newSalt);
  await db.collection('studentSecrets').doc(studentId).set({
    salt: newSalt,
    accessCodeHash: newHash,
    rotatedAt: Date.now()
  }, { merge: true });

  return {
    success: true,
    message: `Đã đặt lại mật khẩu thành công cho học sinh "${sData.displayAlias}" (${sData.studentCode || ''}).`
  };
});

// ==========================================
// 33. ACADEMIC YEAR MANAGEMENT (ADMIN ONLY)
// ==========================================
export const listAcademicYears = functions.https.onCall(async (_data, context) => {
  await requireAdmin(context);

  const [aySnap, classesSnap, studentsSnap] = await Promise.all([
    db.collection('academicYears').get(),
    db.collection('classes').get(),
    db.collection('students').get()
  ]);

  const configuredYears = new Map<string, any>();
  aySnap.forEach((d) => {
    configuredYears.set(d.id, { id: d.id, ...d.data() });
  });

  const allYearsSet = new Set<string>(configuredYears.keys());
  const classToYear = new Map<string, string>();
  classesSnap.forEach((d) => {
    const yr = d.data().academicYear || '2026-2027';
    allYearsSet.add(yr);
    classToYear.set(d.id, yr);
  });

  const yearStudentsMap = new Map<string, Set<string>>();
  allYearsSet.forEach((yr) => yearStudentsMap.set(yr, new Set<string>()));
  studentsSnap.forEach((d) => {
    const yr = classToYear.get(d.data().classId);
    if (yr && yearStudentsMap.has(yr)) {
      yearStudentsMap.get(yr)!.add(d.id);
    }
  });

  // Find which year is current
  let currentYearCode = '2026-2027';
  for (const [code, data] of configuredYears.entries()) {
    if (data.isCurrent) {
      currentYearCode = code;
      break;
    }
  }

  const parseStartYear = (code: string): number => {
    const match = code.match(/^(\d{4})/);
    return match ? parseInt(match[1], 10) : 2026;
  };
  const currentStartYear = parseStartYear(currentYearCode);

  const items = Array.from(allYearsSet)
    .sort((a, b) => b.localeCompare(a))
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
        totalStudents: yearStudentsMap.get(code)?.size || 0,
        canDelete: totalClasses === 0,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: existing?.updatedAt || Date.now()
      };
    });

  return { academicYears: items };
});

export const createAcademicYear = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { code, name, description, startDate, endDate, isCurrent } = data || {};
  if (!code || typeof code !== 'string' || !/^\d{4}-\d{4}$/.test(code.trim())) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Mã năm học không hợp lệ. Định dạng yêu cầu là YYYY-YYYY (ví dụ: 2028-2029).'
    );
  }

  const cleanCode = code.trim();
  const docRef = db.collection('academicYears').doc(cleanCode);
  const existing = await docRef.get();
  if (existing.exists) {
    throw new functions.https.HttpsError('already-exists', `Năm học ${cleanCode} đã tồn tại trong hệ thống.`);
  }

  if (isCurrent) {
    const allAy = await db.collection('academicYears').get();
    const batch = db.batch();
    allAy.forEach((d) => {
      if (d.data().isCurrent) {
        batch.update(d.ref, { isCurrent: false, updatedAt: Date.now() });
      }
    });
    await batch.commit();
  }

  const newRecord = {
    code: cleanCode,
    name: (name && String(name).trim()) || `Năm học ${cleanCode}`,
    description: (description && String(description).trim()) || '',
    startDate: startDate || '',
    endDate: endDate || '',
    isCurrent: Boolean(isCurrent),
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await docRef.set(newRecord);

  return { success: true, academicYear: { id: cleanCode, ...newRecord } };
});

export const updateAcademicYear = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { code, name, description, startDate, endDate, status } = data || {};
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã năm học cần sửa.');
  }

  const cleanCode = code.trim();
  const docRef = db.collection('academicYears').doc(cleanCode);
  const docSnap = await docRef.get();

  const updates: Record<string, any> = {
    updatedAt: Date.now()
  };

  if (name !== undefined) updates.name = String(name).trim();
  if (description !== undefined) updates.description = String(description).trim();
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (status !== undefined && (status === 'active' || status === 'archived')) {
    if (status === 'archived' && docSnap.exists && docSnap.data()?.isCurrent) {
      throw new functions.https.HttpsError('failed-precondition', 'Không thể lưu trữ năm học đang là hiện tại!');
    }
    updates.status = status;
  }

  if (docSnap.exists) {
    await docRef.update(updates);
  } else {
    await docRef.set({
      code: cleanCode,
      name: updates.name || `Năm học ${cleanCode}`,
      description: updates.description || '',
      startDate: updates.startDate || '',
      endDate: updates.endDate || '',
      isCurrent: cleanCode === '2026-2027',
      status: updates.status || 'active',
      createdAt: Date.now(),
      ...updates
    });
  }

  return { success: true, message: `Đã cập nhật thông tin năm học ${cleanCode}.` };
});

export const setCurrentAcademicYear = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { code } = data || {};
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã năm học.');
  }

  const cleanCode = code.trim();
  const allAy = await db.collection('academicYears').get();
  const batch = db.batch();

  let targetFound = false;
  allAy.forEach((d) => {
    if (d.id === cleanCode) {
      targetFound = true;
      batch.update(d.ref, { isCurrent: true, status: 'active', updatedAt: Date.now() });
    } else if (d.data().isCurrent) {
      batch.update(d.ref, { isCurrent: false, updatedAt: Date.now() });
    }
  });

  if (!targetFound) {
    const targetRef = db.collection('academicYears').doc(cleanCode);
    batch.set(targetRef, {
      code: cleanCode,
      name: `Năm học ${cleanCode}`,
      isCurrent: true,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  await batch.commit();

  return { success: true, message: `Đã đặt năm học ${cleanCode} làm năm học hiện tại.` };
});

export const toggleArchiveAcademicYear = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { code, status } = data || {};
  if (!code || (status !== 'active' && status !== 'archived')) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã năm học và trạng thái hợp lệ.');
  }

  const cleanCode = code.trim();
  const docRef = db.collection('academicYears').doc(cleanCode);
  const docSnap = await docRef.get();

  if (status === 'archived') {
    const isCurrent = docSnap.exists ? docSnap.data()?.isCurrent : cleanCode === '2026-2027';
    if (isCurrent) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Không thể lưu trữ năm học đang là hiện tại! Vui lòng chọn năm học khác làm hiện tại trước.'
      );
    }
  }

  if (docSnap.exists) {
    await docRef.update({ status, updatedAt: Date.now() });
  } else {
    await docRef.set({
      code: cleanCode,
      name: `Năm học ${cleanCode}`,
      isCurrent: false,
      status,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  return {
    success: true,
    message: status === 'archived' ? `Đã lưu trữ niên khóa ${cleanCode}.` : `Đã khôi phục niên khóa ${cleanCode}.`
  };
});

export const deleteAcademicYear = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const { code } = data || {};
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã năm học cần xóa.');
  }

  const cleanCode = code.trim();

  // Check if any classes belong to this academic year
  const classesUsingYear = await db.collection('classes').where('academicYear', '==', cleanCode).get();
  if (!classesUsingYear.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Không thể xóa năm học ${cleanCode} vì đang có ${classesUsingYear.size} lớp học trực thuộc! Hãy chuyển lớp sang năm học khác hoặc xóa lớp trước khi xóa năm học.`
    );
  }

  const docRef = db.collection('academicYears').doc(cleanCode);
  const docSnap = await docRef.get();
  if (docSnap.exists && docSnap.data()?.isCurrent) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Không thể xóa năm học ${cleanCode} vì đang được đặt làm năm học hiện tại!`
    );
  }

  if (docSnap.exists) {
    await docRef.delete();
  }

  return { success: true, message: `Đã xóa thành công năm học ${cleanCode}.` };
});

// ==========================================
// 34. UPDATE LESSON SCOPE (SHARED VS SPECIFIC YEAR)
// ==========================================
export const updateLessonScope = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { lessonId, academicYearScope, academicYear } = data || {};

  if (!lessonId) {
    throw new functions.https.HttpsError('invalid-argument', 'Vui lòng cung cấp mã bài đọc.');
  }

  const lessonRef = db.collection('lessons').doc(lessonId);
  const lessonDoc = await lessonRef.get();
  if (!lessonDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Bài đọc không tồn tại.');
  }

  const lData = lessonDoc.data()!;
  if (lData.teacherUid !== teacherUid && context.auth?.token.role !== 'admin' && lData.teacherUid !== 'system') {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền chỉnh sửa bài đọc này.');
  }

  const scope = academicYearScope === 'specific' ? 'specific' : 'shared';
  const cleanYear = scope === 'specific' ? (academicYear ? String(academicYear).trim() : '2026-2027') : null;

  await lessonRef.update({
    academicYearScope: scope,
    academicYear: cleanYear,
    updatedAt: Date.now()
  });

  return {
    success: true,
    message: scope === 'shared'
      ? 'Đã chuyển bài đọc vào Kho học liệu dùng chung nhiều năm học.'
      : `Đã gắn bài đọc vào năm học ${cleanYear}.`
  };
});

// ==========================================
// 35. CURRICULUM PROGRESS & WEEK ADVANCEMENT (ADMIN / TEACHER)
// ==========================================
export const getCurriculumProgress = functions.https.onCall(async (_data, context) => {
  const docSnap = await db.collection('systemSettings').doc('curriculumProgress').get();
  if (docSnap.exists) {
    return { success: true, progress: docSnap.data() };
  }
  const defaultProgress = {
    currentAcademicYear: '2026-2027',
    currentSemester: 1,
    currentWeek: 7,
    maxWeeks: 35,
    allowEarlyAccess: true,
    notes: 'Tiến độ chuẩn hóa năm học 2026–2027: Tuần 7 (Học kỳ I)',
    updatedAt: Date.now(),
    updatedBy: 'system'
  };
  await db.collection('systemSettings').doc('curriculumProgress').set(defaultProgress);
  return { success: true, progress: defaultProgress };
});

export const updateCurriculumProgress = functions.https.onCall(async (data, context) => {
  const { uid } = await requireTeacherOrAdmin(context);
  const { currentWeek, currentSemester, currentAcademicYear, allowEarlyAccess, notes } = data || {};

  const weekNum = Number(currentWeek);
  if (isNaN(weekNum) || weekNum < 1 || weekNum > 35) {
    throw new functions.https.HttpsError('invalid-argument', 'Tuần học phải nằm trong khoảng từ 1 đến 35.');
  }

  const updates: Record<string, any> = {
    currentWeek: weekNum,
    updatedAt: Date.now(),
    updatedBy: uid
  };

  if (currentSemester === 1 || currentSemester === 2) {
    updates.currentSemester = currentSemester;
  }
  if (currentAcademicYear && typeof currentAcademicYear === 'string') {
    updates.currentAcademicYear = currentAcademicYear.trim();
  }
  if (allowEarlyAccess !== undefined) {
    updates.allowEarlyAccess = Boolean(allowEarlyAccess);
  }
  if (notes !== undefined) {
    updates.notes = String(notes).trim();
  }

  const docRef = db.collection('systemSettings').doc('curriculumProgress');
  await docRef.set(updates, { merge: true });

  // When week advances, automatically activate paused assignments up to new week
  const pausedAssignments = await db.collection('assignments')
    .where('status', '==', 'paused')
    .get();

  const batch = db.batch();
  let activatedCount = 0;
  pausedAssignments.forEach((doc) => {
    const aData = doc.data();
    if (aData.week && aData.week <= weekNum) {
      batch.update(doc.ref, { status: 'active', updatedAt: Date.now() });
      activatedCount++;
    }
  });
  if (activatedCount > 0) {
    await batch.commit();
  }

  const newSnap = await docRef.get();
  return {
    success: true,
    progress: newSnap.data(),
    activatedAssignmentsCount: activatedCount,
    message: `Đã cập nhật tiến độ năm học thành công: Tuần ${weekNum} (Đã tự động mở ${activatedCount} bài giao).`
  };
});

// ==========================================
// 27. REMEDIATION ACTIVITIES LIFECYCLE (PHẦN 2 & 3: LƯU NHÁP, DUYỆT, QUẢN LÝ)
// ==========================================

export const saveRemediationActivity = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);

  const {
    id,
    activityType,
    title,
    targetAudience,
    targetSkill,
    skillObjective,
    sourceLessonId,
    sourceLessonTitle,
    sourceQuestionId,
    durationMinutes,
    materialsNeeded,
    teacherSteps,
    contentPayload,
    evaluationCriteria,
    academicYear,
    grade,
    classId,
    className,
    scope,
    status
  } = data || {};

  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle.length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'Tên hoạt động phải có tối thiểu 3 ký tự.');
  }

  const activityId = id && String(id).trim().length > 0
    ? String(id).trim()
    : `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const activityRef = db.collection('remediationActivities').doc(activityId);
  const existingDoc = await activityRef.get();

  const now = Date.now();
  if (existingDoc.exists) {
    const existing = existingDoc.data()!;
    if (existing.teacherId !== teacherUid && existing.teacherUid !== teacherUid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Bạn không có quyền chỉnh sửa hoạt động của giáo viên khác.'
      );
    }
  }

  // Lấy tên giáo viên hiển thị
  let teacherName = 'Giáo viên';
  try {
    const userSnap = await db.collection('users').doc(teacherUid).get();
    if (userSnap.exists && userSnap.data()?.displayName) {
      teacherName = userSnap.data()?.displayName;
    }
  } catch (err) {
    // Ignore error
  }

  const isApproved = status === 'approved';

  const activityRecord: RemediationActivity = {
    id: activityId,
    teacherId: teacherUid,
    teacherUid: teacherUid,
    teacherName: existingDoc.data()?.teacherName || teacherName,
    academicYear: academicYear || existingDoc.data()?.academicYear || '2026-2027',
    grade: Number(grade) || existingDoc.data()?.grade || 2,
    classId: classId || existingDoc.data()?.classId || '',
    className: className || existingDoc.data()?.className || '',
    scope: scope || existingDoc.data()?.scope || 'toan_lop',
    activityType: activityType || existingDoc.data()?.activityType || 'truy_tim_nghia_tu',
    title: cleanTitle,
    targetAudience: targetAudience || existingDoc.data()?.targetAudience || 'Toàn lớp',
    targetSkill: targetSkill || existingDoc.data()?.targetSkill || 'thong_tin_truc_tiep',
    skillObjective: String(skillObjective || existingDoc.data()?.skillObjective || '').trim(),
    sourceLessonId: sourceLessonId || existingDoc.data()?.sourceLessonId || '',
    sourceLessonTitle: sourceLessonTitle || existingDoc.data()?.sourceLessonTitle || '',
    sourceQuestionId: sourceQuestionId || existingDoc.data()?.sourceQuestionId || '',
    durationMinutes: Number(durationMinutes) || existingDoc.data()?.durationMinutes || 10,
    materialsNeeded: Array.isArray(materialsNeeded) ? materialsNeeded : (existingDoc.data()?.materialsNeeded || []),
    teacherSteps: Array.isArray(teacherSteps) ? teacherSteps : (existingDoc.data()?.teacherSteps || []),
    contentPayload: contentPayload || existingDoc.data()?.contentPayload || { instructions: '' },
    evaluationCriteria: String(evaluationCriteria || existingDoc.data()?.evaluationCriteria || '').trim(),
    status: isApproved ? 'approved' : 'draft',
    approvedAt: isApproved ? (existingDoc.data()?.approvedAt || now) : null,
    approvedBy: isApproved ? (existingDoc.data()?.approvedBy || teacherName) : null,
    createdAt: existingDoc.exists ? (existingDoc.data()?.createdAt || now) : now,
    updatedAt: now
  };

  await activityRef.set(activityRecord, { merge: true });

  return {
    success: true,
    activity: activityRecord,
    message: isApproved
      ? `Đã lưu và cập nhật hoạt động đã duyệt "${cleanTitle}".`
      : `Đã lưu thành công bản nháp "${cleanTitle}".`
  };
});

export const approveRemediationActivity = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);

  const { activityId, updatedData } = data || {};
  if (!activityId || typeof activityId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Mã hoạt động (activityId) không hợp lệ.');
  }

  const activityRef = db.collection('remediationActivities').doc(activityId);
  const existingDoc = await activityRef.get();

  let teacherName = 'Giáo viên';
  try {
    const userSnap = await db.collection('users').doc(teacherUid).get();
    if (userSnap.exists && userSnap.data()?.displayName) {
      teacherName = userSnap.data()?.displayName;
    }
  } catch (err) {
    // Ignore error
  }

  const now = Date.now();
  let baseData: any = {};

  if (existingDoc.exists) {
    const existing = existingDoc.data()!;
    if (existing.teacherId !== teacherUid && existing.teacherUid !== teacherUid) {
      throw new functions.https.HttpsError('permission-denied', 'Bạn chỉ có thể phê duyệt hoạt động do mình quản lý.');
    }
    baseData = existing;
  } else if (!updatedData || typeof updatedData !== 'object') {
    throw new functions.https.HttpsError('not-found', 'Không tìm thấy hoạt động cần duyệt trong hệ thống.');
  }

  const merged = { ...baseData, ...(updatedData || {}) };

  // Validation điều kiện duyệt bắt buộc
  const cleanTitle = String(merged.title || '').trim();
  if (!cleanTitle || cleanTitle.length < 3) {
    throw new functions.https.HttpsError('failed-precondition', 'Tên hoạt động cần tối thiểu 3 ký tự để phê duyệt.');
  }
  const cleanObjective = String(merged.skillObjective || merged.description || '').trim();
  if (!cleanObjective || cleanObjective.length < 5) {
    throw new functions.https.HttpsError('failed-precondition', 'Mục tiêu GDPT 2018 cần tối thiểu 5 ký tự để phê duyệt.');
  }
  const teacherSteps = Array.isArray(merged.teacherSteps)
    ? merged.teacherSteps.filter((s: any) => String(s || '').trim().length > 0)
    : [];
  if (teacherSteps.length === 0) {
    throw new functions.https.HttpsError('failed-precondition', 'Cần tối thiểu 1 bước tổ chức sư phạm trước khi phê duyệt.');
  }

  const approvedRecord: RemediationActivity = {
    ...merged,
    id: activityId,
    teacherId: teacherUid,
    teacherUid: teacherUid,
    teacherName: merged.teacherName || teacherName,
    title: cleanTitle,
    skillObjective: cleanObjective,
    teacherSteps,
    materialsNeeded: Array.isArray(merged.materialsNeeded) ? merged.materialsNeeded : [],
    contentPayload: merged.contentPayload || { instructions: '' },
    evaluationCriteria: String(merged.evaluationCriteria || '').trim(),
    status: 'approved',
    approvedAt: merged.approvedAt || now,
    approvedBy: merged.approvedBy || teacherName,
    createdAt: baseData.createdAt || merged.createdAt || now,
    updatedAt: now
  };

  await activityRef.set(approvedRecord, { merge: true });

  return {
    success: true,
    activity: approvedRecord,
    activityId,
    status: 'approved',
    approvedAt: approvedRecord.approvedAt,
    approvedBy: approvedRecord.approvedBy,
    message: `Đã phê duyệt hoạt động "${cleanTitle}" thành công. Sẵn sàng đưa vào Kho tư liệu đã duyệt.`
  };
});

export const listRemediationActivities = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { classId, academicYear, grade, activityType, status } = data || {};

  const snap = await db.collection('remediationActivities').get();
  const activities: RemediationActivity[] = [];

  snap.forEach((doc) => {
    const act = doc.data() as RemediationActivity & { teacherUid?: string };
    const isOwner = act.teacherId === teacherUid || act.teacherUid === teacherUid;
    if (!isOwner) return;

    if (classId && classId !== 'all' && act.classId && act.classId !== classId) {
      return;
    }
    if (academicYear && academicYear !== 'all' && act.academicYear && act.academicYear !== academicYear) {
      return;
    }
    if (grade && grade !== 'all' && act.grade && Number(act.grade) !== Number(grade)) {
      return;
    }
    if (activityType && activityType !== 'all' && act.activityType !== activityType) {
      return;
    }
    if (status && status !== 'all' && act.status !== status) {
      return;
    }

    activities.push({
      ...act,
      id: doc.id
    } as RemediationActivity);
  });

  activities.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

  return {
    success: true,
    activities,
    count: activities.length
  };
});

export const deleteRemediationActivity = functions.https.onCall(async (data, context) => {
  const teacherUid = await requireTeacher(context);
  const { activityId } = data || {};

  if (!activityId) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã hoạt động không hợp lệ.');
  }

  const activityRef = db.collection('remediationActivities').doc(activityId);
  const docSnap = await activityRef.get();

  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Hoạt động không tồn tại.');
  }

  const actData = docSnap.data()!;
  if (actData.teacherId !== teacherUid && actData.teacherUid !== teacherUid) {
    throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền xóa hoạt động này.');
  }

  await activityRef.delete();

  return {
    success: true,
    activityId,
    message: 'Đã xóa hoạt động thành công.'
  };
});




