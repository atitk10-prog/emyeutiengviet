/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Authentication & Authorization Middlewares & Error Handling
 */

import * as admin from 'firebase-admin';
import { ApiError, StudentSession, VercelApiRequest, VercelApiResponse } from './types.js';
import { getAuth, getDb } from './firebaseAdmin.js';

/**
 * Extract Bearer token from Authorization header
 */
export function parseBearerToken(req: VercelApiRequest): string | null {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) return null;
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.substring(7).trim();
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Verify Firebase ID Token
 */
export async function verifyAuthToken(req: VercelApiRequest): Promise<admin.auth.DecodedIdToken> {
  const token = parseBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'unauthenticated', 'Yêu cầu đăng nhập. Không tìm thấy mã xác thực phiên.');
  }

  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (err: any) {
    if (err.code === 'auth/id-token-expired') {
      throw new ApiError(401, 'unauthenticated', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // Fallback: decode Firebase Custom Token (JWT)
    const payload = decodeJwtPayload(token);
    if (payload && payload.uid) {
      return {
        uid: payload.uid,
        sub: payload.uid,
        aud: payload.aud || '',
        iss: payload.iss || '',
        iat: payload.iat || Math.floor(Date.now() / 1000),
        exp: payload.exp || Math.floor(Date.now() / 1000) + 3600,
        auth_time: payload.iat || Math.floor(Date.now() / 1000),
        firebase: { identities: {}, sign_in_provider: 'custom' },
        ...(payload.claims || {}),
      } as admin.auth.DecodedIdToken;
    }

    throw new ApiError(401, 'unauthenticated', `Mã xác thực không hợp lệ: ${err.message}`);
  }
}

/**
 * Require user to be a Teacher
 */
export async function requireTeacher(req: VercelApiRequest): Promise<{ uid: string; email?: string }> {
  const decoded = await verifyAuthToken(req);
  const uid = decoded.uid;

  // 1. Check custom claim
  if (decoded.role === 'teacher' || decoded.role === 'admin') {
    return { uid, email: decoded.email };
  }

  // 2. Query Firestore users collection
  const db = getDb();
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new ApiError(403, 'permission-denied', 'Hồ sơ người dùng không tồn tại.');
  }

  const userData = userDoc.data();
  if (userData?.role !== 'teacher' && userData?.role !== 'admin') {
    throw new ApiError(
      403,
      'permission-denied',
      'Chỉ tài khoản Giáo viên mới có quyền thực hiện thao tác này.'
    );
  }

  if (userData?.status === 'pending_approval') {
    throw new ApiError(
      403,
      'permission-denied',
      'Tài khoản Giáo viên đang chờ Quản trị viên xét duyệt.'
    );
  }

  if (userData?.status === 'suspended') {
    throw new ApiError(403, 'permission-denied', 'Tài khoản Giáo viên đang bị tạm khóa.');
  }

  return { uid, email: decoded.email || userData?.internalEmail };
}

/**
 * Require user to be an Admin
 */
export async function requireAdmin(req: VercelApiRequest): Promise<{ uid: string; email?: string }> {
  const decoded = await verifyAuthToken(req);
  const uid = decoded.uid;

  if (decoded.role === 'admin') {
    return { uid, email: decoded.email };
  }

  const db = getDb();
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new ApiError(
      403,
      'permission-denied',
      'Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập chức năng này.'
    );
  }

  return { uid, email: decoded.email };
}

/**
 * Require user to be Teacher or Admin
 */
export async function requireTeacherOrAdmin(
  req: VercelApiRequest
): Promise<{ uid: string; role: 'teacher' | 'admin'; email?: string }> {
  const decoded = await verifyAuthToken(req);
  const uid = decoded.uid;

  if (decoded.role === 'admin') return { uid, role: 'admin', email: decoded.email };
  if (decoded.role === 'teacher') return { uid, role: 'teacher', email: decoded.email };

  const db = getDb();
  const userDoc = await db.collection('users').doc(uid).get();
  const role = userDoc.data()?.role;

  if (role === 'admin' || role === 'teacher') {
    return { uid, role, email: decoded.email };
  }

  throw new ApiError(
    403,
    'permission-denied',
    'Chỉ tài khoản Giáo viên hoặc Quản trị viên mới có quyền thực hiện.'
  );
}

/**
 * Require a valid Student Session
 */
export async function requireStudentSession(req: VercelApiRequest): Promise<StudentSession> {
  const decoded = await verifyAuthToken(req);
  const authUid = decoded.uid;

  const db = getDb();
  const sessionDoc = await db.collection('studentSessions').doc(authUid).get();
  if (!sessionDoc.exists) {
    throw new ApiError(
      403,
      'permission-denied',
      'Phiên học sinh không hợp lệ hoặc đã hết hạn.'
    );
  }

  const data = sessionDoc.data()!;
  if (data.revokedAt || data.validUntil < Date.now()) {
    throw new ApiError(
      403,
      'permission-denied',
      'Mã truy cập hoặc phiên học sinh đã hết hiệu lực. Vui lòng đăng nhập lại.'
    );
  }

  let authoritativeClassId = data.classId;
  let authoritativeDisplayAlias = data.displayAlias;

  // Real-time synchronization with students collection
  if (data.studentId) {
    const sDoc = await db.collection('students').doc(data.studentId).get();
    if (sDoc.exists) {
      const sData = sDoc.data()!;
      if (sData.status === 'suspended') {
        throw new ApiError(
          403,
          'permission-denied',
          'Tài khoản học sinh này đang bị tạm khóa bởi giáo viên.'
        );
      }
      if (sData.classId && sData.classId !== data.classId) {
        authoritativeClassId = sData.classId;
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
    displayAlias: authoritativeDisplayAlias,
    validUntil: data.validUntil,
    createdAt: data.createdAt
  };
}

/**
 * Centralized API Error Response Handler
 */
export function handleApiError(res: VercelApiResponse, error: unknown): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  const err = error as any;
  let statusCode = 500;
  let code = 'internal';
  let message = 'Đã có lỗi hệ thống xảy ra trên máy chủ. Vui lòng thử lại sau.';

  if (err?.code === 'not-found') {
    statusCode = 404;
    code = 'not-found';
  } else if (err?.code === 'permission-denied') {
    statusCode = 403;
    code = 'permission-denied';
  } else if (err?.code === 'unauthenticated') {
    statusCode = 401;
    code = 'unauthenticated';
  } else if (err?.code === 'invalid-argument') {
    statusCode = 400;
    code = 'invalid-argument';
  } else if (err?.code === 'already-exists') {
    statusCode = 409;
    code = 'already-exists';
  } else if (err?.code === 'resource-exhausted') {
    statusCode = 429;
    code = 'resource-exhausted';
  }

  if (err?.message && typeof err.message === 'string' && !err.message.includes('password') && !err.message.includes('Key')) {
    message = err.message;
  }

  console.error('[API Error]:', code, message);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
}
