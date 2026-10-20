/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Authentication API Group: /api/auth
 *
 * Implements 9 Core Auth Operations with OWASP-Compliant PBKDF2 (600,000 iterations)
 * & 3-Layer Serverless Rate Limiter (Quota & Abuse Protected):
 * 1. accountLogin (supports transparent rehashing to OWASP standard)
 * 2. registerTeacherAccount
 * 3. changeAccountPassword
 * 4. studentChangePassword
 * 5. teacherResetStudentPassword
 * 6. adminResetTeacherPassword
 * 7. joinClass
 * 8. bootstrapTeacherRole
 * 9. bootstrapAdminRole
 */

import type * as admin from 'firebase-admin';
import { getAuth, getDb, isLocalEmulator } from './_helpers/firebaseAdmin.js';
import {
  CURRENT_HASH_VERSION,
  OWASP_PBKDF2_ITERATIONS,
  createAccessCodeHashRecord,
  createPasswordHashRecord,
  generateAccessCode,
  generateSalt,
  hashAccessCode,
  hashPassword,
  needsRehash,
  verifyAccessCode,
  verifyPassword
} from './_helpers/crypto.js';
import {
  clearAuthSuccess,
  enforceAuthRateLimit,
  getClientIp,
  recordAuthFailure
} from './_helpers/rateLimiter.js';
import {
  handleApiError,
  requireAdmin,
  requireStudentSession,
  requireTeacherOrAdmin,
  verifyAuthToken
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
      case 'accountLogin':
        result = await handleAccountLogin(req, data);
        break;

      case 'registerTeacherAccount':
        result = await handleRegisterTeacherAccount(data);
        break;

      case 'changeAccountPassword':
        result = await handleChangeAccountPassword(req, data);
        break;

      case 'studentChangePassword':
        result = await handleStudentChangePassword(req, data);
        break;

      case 'teacherResetStudentPassword':
        result = await handleTeacherResetStudentPassword(req, data);
        break;

      case 'adminResetTeacherPassword':
        result = await handleAdminResetTeacherPassword(req, data);
        break;

      case 'joinClass':
        result = await handleJoinClass(req, data);
        break;

      case 'bootstrapTeacherRole':
        result = await handleBootstrapTeacherRole(req, data);
        break;

      case 'bootstrapAdminRole':
        result = await handleBootstrapAdminRole(req, data);
        break;

      case 'bootstrapAdminAccount':
        result = await handleBootstrapAdminAccount(req, data);
        break;

      default:
        throw new ApiError(
          400,
          'invalid-argument',
          `Hành động xác thực "${action}" không được hỗ trợ hoặc chưa được phân quyền.`
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
// 1. UNIFIED ACCOUNT LOGIN (WITH TRANSPARENT REHASHING)
// ==========================================
async function handleAccountLogin(req: VercelApiRequest, data: any) {
  const { username, password } = data || {};
  if (!username || !password) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Vui lòng nhập đầy đủ Tên đăng nhập / Mã học sinh và Mật khẩu.'
    );
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();
  const lowerUser = cleanUser.toLowerCase();

  // 1. Enforce dual rate limits (Account + IP) with zero PII in keys & burst protection
  const { accountKey, ipKey } = await enforceAuthRateLimit(req, lowerUser);

  const db = getDb();
  const auth = getAuth();

  // 2. Look up usernames collection
  const usernameDoc = await db.collection('usernames').doc(lowerUser).get();

  // 3. Fallback to students collection by studentCode if not in usernames
  if (!usernameDoc.exists) {
    const studentQuery = await db
      .collection('students')
      .where('studentCode', '==', cleanUser.toUpperCase())
      .limit(1)
      .get();

    if (!studentQuery.empty) {
      const sDoc = studentQuery.docs[0];
      const sData = sDoc.data();
      const sId = sDoc.id;

      if (sData.status === 'suspended') {
        throw new ApiError(
          403,
          'permission-denied',
          'Tài khoản học sinh này đang bị tạm khóa. Vui lòng liên hệ Thầy/Cô giáo để được hỗ trợ.'
        );
      }

      const secretRef = db.collection('studentSecrets').doc(sId);
      const secretDoc = await secretRef.get();
      if (!secretDoc.exists) {
        throw new ApiError(
          403,
          'permission-denied',
          'Hồ sơ bảo mật học sinh chưa được khởi tạo.'
        );
      }

      const secret = secretDoc.data()!;
      const storedIterations = Number(secret.iterations) || (secret.version === 2 ? 600000 : 10000);
      const isMatch = verifyPassword(cleanPass, secret.salt, secret.accessCodeHash, storedIterations);

      if (!isMatch) {
        await recordAuthFailure(accountKey, ipKey);
        // Anti-enumeration: Generic message
        throw new ApiError(
          401,
          'permission-denied',
          'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
        );
      }

      // Success: clear rate limits
      await clearAuthSuccess(accountKey, ipKey);

      // Transparent Rehash to Version 2 (OWASP 600k iterations) if legacy
      if (needsRehash(secret.version, storedIterations)) {
        const upgraded = createAccessCodeHashRecord(cleanPass);
        await secretRef.set(
          {
            version: upgraded.version,
            algorithm: upgraded.algorithm,
            iterations: upgraded.iterations,
            salt: upgraded.salt,
            accessCodeHash: upgraded.passwordHash,
            upgradedAt: Date.now()
          },
          { merge: true }
        ).catch((e) => console.warn('[Auto-Rehash Student]: Non-fatal upgrade failed', e.message));
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

    // Account not found -> record failure, generic message
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      401,
      'permission-denied',
      'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
    );
  }

  const uMap = usernameDoc.data()!;

  // 4. Role is student
  if (uMap.role === 'student') {
    const sId = uMap.studentId || uMap.uid;
    const sDoc = await db.collection('students').doc(sId).get();
    if (!sDoc.exists) {
      await recordAuthFailure(accountKey, ipKey);
      throw new ApiError(
        401,
        'permission-denied',
        'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      );
    }

    const sData = sDoc.data()!;
    if (sData.status === 'suspended') {
      throw new ApiError(403, 'permission-denied', 'Tài khoản học sinh đang bị tạm khóa.');
    }

    const secretRef = db.collection('studentSecrets').doc(sId);
    const secretDoc = await secretRef.get();
    if (!secretDoc.exists) {
      throw new ApiError(403, 'permission-denied', 'Hồ sơ bảo mật học sinh không tồn tại.');
    }

    const secret = secretDoc.data()!;
    const storedIterations = Number(secret.iterations) || (secret.version === 2 ? 600000 : 10000);
    const isMatch = verifyPassword(cleanPass, secret.salt, secret.accessCodeHash, storedIterations);

    if (!isMatch) {
      await recordAuthFailure(accountKey, ipKey);
      throw new ApiError(
        401,
        'permission-denied',
        'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
      );
    }

    await clearAuthSuccess(accountKey, ipKey);

    // Transparent Rehash to Version 2
    if (needsRehash(secret.version, storedIterations)) {
      const upgraded = createAccessCodeHashRecord(cleanPass);
      await secretRef.set(
        {
          version: upgraded.version,
          algorithm: upgraded.algorithm,
          iterations: upgraded.iterations,
          salt: upgraded.salt,
          accessCodeHash: upgraded.passwordHash,
          upgradedAt: Date.now()
        },
        { merge: true }
      ).catch((e) => console.warn('[Auto-Rehash Student]: Non-fatal upgrade failed', e.message));
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

  // 5. Role is teacher or admin
  const userDoc = await db.collection('users').doc(uMap.uid).get();
  if (!userDoc.exists) {
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      401,
      'permission-denied',
      'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
    );
  }
  const userData = userDoc.data()!;

  if (userData.role === 'teacher' && userData.status === 'pending_approval') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản Giáo viên đang chờ Quản trị viên xét duyệt. Vui lòng liên hệ Admin để được phê duyệt.'
    );
  }

  if (userData.status === 'suspended') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản đã bị tạm khóa. Vui lòng liên hệ Quản trị viên hệ thống.'
    );
  }

  // Verify password via accountSecrets
  const secretRef = db.collection('accountSecrets').doc(uMap.uid);
  const secretDoc = await secretRef.get();
  let passwordOk = false;
  let storedIterations = 10000;
  let storedVersion = 1;

  if (secretDoc.exists) {
    const s = secretDoc.data()!;
    storedVersion = s.version || 1;
    storedIterations = Number(s.iterations) || (storedVersion === 2 ? 600000 : 10000);
    passwordOk = verifyPassword(cleanPass, s.salt, s.passwordHash, storedIterations);
  }

  // STRICT SECURITY CHECK:
  // Fallback demo passwords (admin/admin, giaovien01/GV123456) are ONLY allowed
  // when explicitly running on Local Firebase Emulator and strictly NOT production!
  if (!passwordOk && isLocalEmulator() && process.env.NODE_ENV !== 'production') {
    if (lowerUser === 'admin' && cleanPass === 'admin') {
      passwordOk = true;
    } else if (lowerUser === 'giaovien01' && cleanPass === 'GV123456') {
      passwordOk = true;
    }
  }

  if (!passwordOk) {
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      401,
      'permission-denied',
      'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
    );
  }

  await clearAuthSuccess(accountKey, ipKey);

  // Transparent Rehash to Version 2 (OWASP 600k iterations) upon successful login
  if (needsRehash(storedVersion, storedIterations) && secretDoc.exists) {
    const upgraded = createPasswordHashRecord(cleanPass);
    await secretRef.set(
      {
        version: upgraded.version,
        algorithm: upgraded.algorithm,
        iterations: upgraded.iterations,
        salt: upgraded.salt,
        passwordHash: upgraded.passwordHash,
        upgradedAt: Date.now()
      },
      { merge: true }
    ).catch((e) => console.warn('[Auto-Rehash User]: Non-fatal upgrade failed', e.message));
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
}

// ==========================================
// 2. TEACHER REGISTRATION (WITH OWASP V2 HASH)
// ==========================================
async function handleRegisterTeacherAccount(data: any) {
  const { username, displayName, password } = data || {};

  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanName = String(displayName || '').trim();
  const cleanPass = String(password || '').trim();

  if (!cleanUser || !/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Tên đăng nhập phải từ 3 đến 30 ký tự và chỉ chứa chữ cái, số hoặc dấu gạch dưới.'
    );
  }

  if (!cleanName || cleanName.length < 2) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Vui lòng nhập Họ và tên giáo viên (tối thiểu 2 ký tự).'
    );
  }

  if (!cleanPass || cleanPass.length < 6) {
    throw new ApiError(400, 'invalid-argument', 'Mật khẩu phải có tối thiểu 6 ký tự.');
  }

  const db = getDb();
  const auth = getAuth();

  // Check unique username
  const existingDoc = await db.collection('usernames').doc(cleanUser).get();
  if (existingDoc.exists) {
    throw new ApiError(
      409,
      'already-exists',
      `Tên đăng nhập "${cleanUser}" đã có người sử dụng. Vui lòng chọn tên đăng nhập khác.`
    );
  }

  const internalEmail = `${cleanUser}@emytv.local`;
  let userRecord: admin.auth.UserRecord;
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
      throw new ApiError(500, 'internal', `Không thể tạo tài khoản xác thực: ${err.message}`);
    }
  }

  const uid = userRecord.uid;
  const now = Date.now();

  // Save Version 2 OWASP hash record
  const secretRecord = createPasswordHashRecord(cleanPass);
  await db.collection('accountSecrets').doc(uid).set({
    uid,
    ...secretRecord
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
    message:
      'Đăng ký tài khoản Giáo viên thành công! Tài khoản đang chờ Quản trị viên xét duyệt để kích hoạt.'
  };
}

// ==========================================
// 3. CHANGE ACCOUNT PASSWORD (ADMIN OR TEACHER - OWASP V2)
// ==========================================
async function handleChangeAccountPassword(req: VercelApiRequest, data: any) {
  const decoded = await verifyAuthToken(req);
  const uid = decoded.uid;

  const oldPassword = data?.oldPassword || data?.currentPassword;
  const newPassword = data?.newPassword;

  if (!oldPassword || !newPassword) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.'
    );
  }

  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'invalid-argument', 'Mật khẩu mới phải có tối thiểu 6 ký tự.');
  }

  const db = getDb();
  const auth = getAuth();

  const secretDoc = await db.collection('accountSecrets').doc(uid).get();
  if (secretDoc.exists) {
    const s = secretDoc.data()!;
    const storedIterations = Number(s.iterations) || (s.version === 2 ? 600000 : 10000);
    if (!verifyPassword(String(oldPassword), s.salt, s.passwordHash, storedIterations)) {
      throw new ApiError(403, 'permission-denied', 'Mật khẩu cũ không chính xác.');
    }
  }

  // Update password with Version 2 OWASP 600k hash
  const secretRecord = createPasswordHashRecord(String(newPassword));
  await db.collection('accountSecrets').doc(uid).set(
    {
      uid,
      ...secretRecord,
      updatedAt: Date.now()
    },
    { merge: true }
  );

  // Update in Firebase Auth
  try {
    await auth.updateUser(uid, { password: String(newPassword) });
  } catch (err: any) {
    console.warn('Could not update Firebase Auth password directly:', err.message);
  }

  return {
    success: true,
    message: 'Đổi mật khẩu thành công.'
  };
}

// ==========================================
// 4. STUDENT CHANGE PASSWORD (OWASP V2)
// ==========================================
async function handleStudentChangePassword(req: VercelApiRequest, data: any) {
  const session = await requireStudentSession(req);
  const oldPassword = data?.oldPassword || data?.currentPassword;
  const newPassword = data?.newPassword;

  if (!oldPassword || !newPassword) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.'
    );
  }

  if (String(newPassword).length < 4) {
    throw new ApiError(400, 'invalid-argument', 'Mật khẩu mới phải có tối thiểu 4 ký tự.');
  }

  const db = getDb();
  const secretDoc = await db.collection('studentSecrets').doc(session.studentId).get();
  if (!secretDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy hồ sơ bảo mật của học sinh.');
  }

  const secret = secretDoc.data()!;
  const storedIterations = Number(secret.iterations) || (secret.version === 2 ? 600000 : 10000);
  if (!verifyPassword(String(oldPassword), secret.salt, secret.accessCodeHash, storedIterations)) {
    throw new ApiError(403, 'permission-denied', 'Mật khẩu hiện tại không chính xác.');
  }

  // Update with Version 2 OWASP 600k hash
  const secretRecord = createAccessCodeHashRecord(String(newPassword));
  await db.collection('studentSecrets').doc(session.studentId).set(
    {
      version: secretRecord.version,
      algorithm: secretRecord.algorithm,
      iterations: secretRecord.iterations,
      salt: secretRecord.salt,
      accessCodeHash: secretRecord.passwordHash,
      rotatedAt: Date.now()
    },
    { merge: true }
  );

  return {
    success: true,
    message: 'Học sinh đổi mật khẩu thành công.'
  };
}

// ==========================================
// 5. TEACHER RESET STUDENT PASSWORD (OWASP V2)
// ==========================================
async function handleTeacherResetStudentPassword(req: VercelApiRequest, data: any) {
  const { uid: callerUid, role } = await requireTeacherOrAdmin(req);
  const { studentId, newPassword } = data || {};

  if (!studentId || !newPassword) {
    throw new ApiError(
      400,
      'invalid-argument',
      'Vui lòng cung cấp ID học sinh và Mật khẩu mới.'
    );
  }

  const db = getDb();
  const studentDoc = await db.collection('students').doc(studentId).get();
  if (!studentDoc.exists) {
    throw new ApiError(404, 'not-found', 'Không tìm thấy học sinh.');
  }

  const sData = studentDoc.data()!;
  const classDoc = await db.collection('classes').doc(sData.classId).get();
  const isOwner = classDoc.exists && classDoc.data()?.teacherUid === callerUid;
  const isAdmin = role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ApiError(
      403,
      'permission-denied',
      'Bạn chỉ có thể đặt lại mật khẩu cho học sinh thuộc lớp của mình.'
    );
  }

  const secretRecord = createAccessCodeHashRecord(String(newPassword));
  await db.collection('studentSecrets').doc(studentId).set(
    {
      version: secretRecord.version,
      algorithm: secretRecord.algorithm,
      iterations: secretRecord.iterations,
      salt: secretRecord.salt,
      accessCodeHash: secretRecord.passwordHash,
      rotatedAt: Date.now()
    },
    { merge: true }
  );

  return {
    success: true,
    message: `Đã đặt lại mật khẩu thành công cho học sinh "${sData.displayAlias}" (${sData.studentCode || ''}).`
  };
}

// ==========================================
// 6. ADMIN RESET TEACHER PASSWORD (OWASP V2)
// ==========================================
async function handleAdminResetTeacherPassword(req: VercelApiRequest, data: any) {
  await requireAdmin(req);
  const targetUid = data?.targetUid || data?.uid || data?.teacherUid;
  const newPassword = data?.newPassword;

  if (!targetUid) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng cung cấp UID người dùng.');
  }

  const auth = getAuth();
  const db = getDb();

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

    const secretRecord = createPasswordHashRecord(String(newPassword));
    await db.collection('accountSecrets').doc(targetUid).set(
      {
        uid: targetUid,
        ...secretRecord,
        updatedAt: Date.now()
      },
      { merge: true }
    );

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
}

// ==========================================
// 7. JOIN CLASS (STUDENT PIN AUTH)
// ==========================================
async function handleJoinClass(req: VercelApiRequest, data: any) {
  const { classCode, accessCode } = data || {};
  if (!classCode || !accessCode) {
    throw new ApiError(400, 'invalid-argument', 'Vui lòng nhập đầy đủ Mã lớp và Mã học sinh.');
  }

  const cleanClassCode = String(classCode).trim().toUpperCase();
  const cleanAccessCode = String(accessCode).trim().toUpperCase();

  // Dual rate limit with privacy-preserving keys
  const { accountKey, ipKey } = await enforceAuthRateLimit(
    req,
    `pin_${cleanClassCode}_${cleanAccessCode}`
  );

  const db = getDb();
  const auth = getAuth();

  // Find class
  const classSnap = await db
    .collection('classes')
    .where('classCode', '==', cleanClassCode)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (classSnap.empty) {
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      404,
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
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      404,
      'not-found',
      'Lớp học chưa có danh sách học sinh. Vui lòng liên hệ giáo viên.'
    );
  }

  // Check if student accidentally entered studentCode (e.g. HS2A-01) instead of secret PIN
  const matchedStudentCodeDoc = studentsSnap.docs.find((d) => {
    const s = d.data();
    return s.studentCode && s.studentCode.trim().toUpperCase() === cleanAccessCode;
  });

  if (matchedStudentCodeDoc) {
    throw new ApiError(
      400,
      'invalid-argument',
      `Bạn đang nhập Mã học sinh (${cleanAccessCode}). Vui lòng nhập đúng Mã PIN cá nhân do thầy cô cung cấp.`
    );
  }

  let matchedStudent: any = null;

  for (const sDoc of studentsSnap.docs) {
    const sId = sDoc.id;
    const secretDoc = await db.collection('studentSecrets').doc(sId).get();
    if (!secretDoc.exists) continue;

    const secret = secretDoc.data()!;
    const storedIterations = Number(secret.iterations) || (secret.version === 2 ? 600000 : 10000);

    if (
      verifyAccessCode(cleanAccessCode, secret.salt, secret.accessCodeHash, storedIterations) ||
      verifyPassword(String(accessCode).trim(), secret.salt, secret.accessCodeHash, storedIterations)
    ) {
      matchedStudent = { id: sId, ...sDoc.data() };

      // Transparent Rehash to Version 2 if needed
      if (needsRehash(secret.version, storedIterations)) {
        const upgraded = createAccessCodeHashRecord(cleanAccessCode);
        await secretDoc.ref.set(
          {
            version: upgraded.version,
            algorithm: upgraded.algorithm,
            iterations: upgraded.iterations,
            salt: upgraded.salt,
            accessCodeHash: upgraded.passwordHash,
            upgradedAt: Date.now()
          },
          { merge: true }
        ).catch((e) => console.warn('[Auto-Rehash PIN]: Non-fatal upgrade failed', e.message));
      }
      break;
    }
  }

  if (!matchedStudent) {
    await recordAuthFailure(accountKey, ipKey);
    throw new ApiError(
      403,
      'permission-denied',
      'Mã PIN không đúng hoặc đã bị đổi. Vui lòng kiểm tra lại.'
    );
  }

  if (matchedStudent.status === 'suspended') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản học sinh này đang bị tạm khóa bởi giáo viên.'
    );
  }

  await clearAuthSuccess(accountKey, ipKey);

  // Generate student auth session
  let authUid = `student_${matchedStudent.id}`;
  const customToken = await auth.createCustomToken(authUid, {
    role: 'student',
    classId,
    studentId: matchedStudent.id
  });

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
}

// ==========================================
// 8. BOOTSTRAP TEACHER ROLE
// ==========================================
async function handleBootstrapTeacherRole(req: VercelApiRequest, data: any) {
  const decoded = await verifyAuthToken(req);

  if (decoded.firebase?.sign_in_provider === 'anonymous') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản ẩn danh của học sinh không thể nhận quyền Giáo viên.'
    );
  }

  const uid = decoded.uid;
  const email = decoded.email || '';
  const displayName = decoded.name || email.split('@')[0] || 'Giáo viên';

  const isEmulator = isLocalEmulator();
  const adminSecret = data?.adminSecret;
  const expectedSecret =
    process.env.ADMIN_BOOTSTRAP_SECRET ||
    (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);

  const emailAllowlist = (process.env.TEACHER_EMAIL_ALLOWLIST || '')
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  const isCallerAdmin = decoded.role === 'admin';
  const isAllowedBySecret = Boolean(
    expectedSecret && adminSecret && adminSecret === expectedSecret
  );
  const isAllowedByAllowlist = Boolean(
    email &&
      (emailAllowlist.includes(email.toLowerCase()) || email.endsWith('@emytv.edu.vn')) &&
      (isEmulator || decoded.email_verified === true)
  );

  if (!isCallerAdmin && !isAllowedBySecret && !isAllowedByAllowlist) {
    throw new ApiError(
      403,
      'permission-denied',
      'Thao tác tự cấp quyền Giáo viên bị từ chối. Vui lòng liên hệ Quản trị viên để được phê duyệt tài khoản.'
    );
  }

  const db = getDb();
  const auth = getAuth();

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

  await auth.setCustomUserClaims(uid, { role: 'teacher' });

  return {
    success: true,
    message: `Đã cấp quyền Giáo viên thành công cho tài khoản ${email}.`
  };
}

// ==========================================
// 9. BOOTSTRAP ADMIN ROLE
// ==========================================
async function handleBootstrapAdminRole(req: VercelApiRequest, data: any) {
  const decoded = await verifyAuthToken(req);

  if (decoded.firebase?.sign_in_provider === 'anonymous') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản ẩn danh của học sinh không thể nhận quyền Quản trị.'
    );
  }

  const isEmulator = isLocalEmulator();
  const adminSecret = data?.adminSecret;
  const expectedSecret =
    process.env.ADMIN_BOOTSTRAP_SECRET ||
    (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);

  const uid = decoded.uid;
  const email = decoded.email || '';
  const displayName = data?.displayName || email.split('@')[0] || 'Quản trị viên';

  // Strict check: must supply correct adminSecret configured in server environment
  if (!expectedSecret || !adminSecret || adminSecret !== expectedSecret) {
    throw new ApiError(
      403,
      'permission-denied',
      'Mã bảo mật Quản trị viên (adminSecret) không chính xác hoặc chưa được cấu hình Secret trên môi trường máy chủ.'
    );
  }

  const db = getDb();
  const auth = getAuth();

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
}

// ==========================================
// 10. BOOTSTRAP / RESET ADMIN ACCOUNT
// ==========================================
async function handleBootstrapAdminAccount(req: VercelApiRequest, data: any) {
  const { actionType, adminSecret, username, password, displayName } = data || {};

  const db = getDb();
  const auth = getAuth();

  // 1. ActionType: 'check' -> Kiểm tra trạng thái tài khoản Admin hiện có
  if (actionType === 'check') {
    const [adminUsersSnap, adminUsernameDoc] = await Promise.all([
      db.collection('users').where('role', '==', 'admin').limit(1).get(),
      db.collection('usernames').doc('admin').get()
    ]);

    const hasAdmin = !adminUsersSnap.empty || adminUsernameDoc.exists;
    let existingAdminUsername = '';
    if (adminUsernameDoc.exists) {
      existingAdminUsername = 'admin';
    } else if (!adminUsersSnap.empty) {
      existingAdminUsername = adminUsersSnap.docs[0].data().username || adminUsersSnap.docs[0].id;
    }

    return {
      success: true,
      hasAdmin,
      adminUsername: existingAdminUsername || null
    };
  }

  // 2. ActionType: 'setup' -> Khởi tạo hoặc đặt lại mật khẩu Admin
  const isEmulator = isLocalEmulator();
  const expectedSecret =
    process.env.ADMIN_BOOTSTRAP_SECRET ||
    (isEmulator ? 'EMYTV_ADMIN_SECRET_2026' : undefined);

  if (!expectedSecret) {
    throw new ApiError(
      500,
      'failed-precondition',
      'Máy chủ chưa được cấu hình biến môi trường ADMIN_BOOTSTRAP_SECRET. Vui lòng cấu hình trên Vercel.'
    );
  }

  // Yêu cầu adminSecret chính xác
  const inputSecret = String(adminSecret || '').trim();
  const targetSecret = String(expectedSecret).trim();

  if (!inputSecret || inputSecret !== targetSecret) {
    await recordAuthFailure('rate_limit_admin_bootstrap', 'ip_admin_bootstrap');
    throw new ApiError(
      403,
      'permission-denied',
      'Mã bảo mật Quản trị viên (adminSecret) không chính xác.'
    );
  }

  const cleanUser = String(username || 'admin').trim().toLowerCase();
  const cleanPass = String(password || '').trim();
  const cleanName = String(displayName || 'Quản Trị Viên Hệ Thống').trim();

  if (!cleanUser || cleanUser.length < 3) {
    throw new ApiError(400, 'invalid-argument', 'Tên đăng nhập Admin phải có tối thiểu 3 ký tự.');
  }

  if (!cleanPass || cleanPass.length < 8) {
    throw new ApiError(400, 'invalid-argument', 'Mật khẩu Admin phải có tối thiểu 8 ký tự để đảm bảo an toàn.');
  }

  const hasNumber = /\d/.test(cleanPass);
  const hasLetter = /[a-zA-Z]/.test(cleanPass);
  if (!hasNumber || !hasLetter) {
    throw new ApiError(400, 'invalid-argument', 'Mật khẩu Admin phải bao gồm cả chữ và số.');
  }

  const now = Date.now();
  const internalEmail = `${cleanUser}@emytv.local`;

  // Kiểm tra tài khoản admin hiện tại trong usernames hoặc users
  const existingUsernameDoc = await db.collection('usernames').doc(cleanUser).get();
  let adminUid = existingUsernameDoc.exists ? existingUsernameDoc.data()?.uid : null;

  if (!adminUid) {
    // Kiểm tra xem đã có admin nào khác tên không
    const otherAdmins = await db.collection('users').where('role', '==', 'admin').limit(1).get();
    if (!otherAdmins.empty && otherAdmins.docs[0].data().username !== cleanUser) {
      const existingName = otherAdmins.docs[0].data().username || 'khác';
      throw new ApiError(
        409,
        'already-exists',
        `Hệ thống đã có tài khoản Quản trị viên tồn tại (tên đăng nhập: "${existingName}"). Mỗi trường chỉ duy trì 1 tài khoản Admin chính.`
      );
    }
  }

  // Đồng bộ Firebase Auth
  if (adminUid) {
    try {
      await auth.updateUser(adminUid, {
        password: cleanPass,
        displayName: cleanName,
        email: internalEmail
      });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        const newRecord = await auth.createUser({
          uid: adminUid,
          email: internalEmail,
          password: cleanPass,
          displayName: cleanName
        });
        adminUid = newRecord.uid;
      }
    }
  } else {
    try {
      const existingAuthUser = await auth.getUserByEmail(internalEmail);
      adminUid = existingAuthUser.uid;
      await auth.updateUser(adminUid, {
        password: cleanPass,
        displayName: cleanName
      });
    } catch {
      const newRecord = await auth.createUser({
        email: internalEmail,
        password: cleanPass,
        displayName: cleanName
      });
      adminUid = newRecord.uid;
    }
  }

  // Set custom claims: role admin
  await auth.setCustomUserClaims(adminUid, { role: 'admin' });

  // Tạo OWASP Version 2 PBKDF2 hash (600,000 vòng)
  const secretRecord = createPasswordHashRecord(cleanPass);

  const batch = db.batch();

  // 1. accountSecrets
  batch.set(
    db.collection('accountSecrets').doc(adminUid),
    {
      uid: adminUid,
      ...secretRecord,
      updatedAt: now
    },
    { merge: true }
  );

  // 2. users
  batch.set(
    db.collection('users').doc(adminUid),
    {
      uid: adminUid,
      username: cleanUser,
      displayName: cleanName,
      role: 'admin',
      status: 'active',
      internalEmail,
      updatedAt: now,
      createdAt: existingUsernameDoc.exists ? (existingUsernameDoc.data()?.createdAt || now) : now
    },
    { merge: true }
  );

  // 3. usernames
  batch.set(
    db.collection('usernames').doc(cleanUser),
    {
      username: cleanUser,
      uid: adminUid,
      role: 'admin',
      internalEmail,
      updatedAt: now,
      createdAt: existingUsernameDoc.exists ? (existingUsernameDoc.data()?.createdAt || now) : now
    },
    { merge: true }
  );

  await batch.commit();

  return {
    success: true,
    isUpdate: existingUsernameDoc.exists,
    username: cleanUser,
    message: existingUsernameDoc.exists
      ? `Đã cập nhật mật khẩu mới an toàn cho tài khoản Quản trị viên "${cleanUser}" thành công!`
      : `Đã khởi tạo tài khoản Quản trị viên "${cleanUser}" thành công!`
  };
}
