/**
 * EM YÊU TIẾNG VIỆT - CLIENT API ADAPTER
 * Bridges between Local Firebase Emulator (httpsCallable) and Online Vercel Functions (/api/*)
 * Provides 100% backward compatibility for all existing UI components
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';

// Migrated actions in Phase 2B.1 (/api/auth)
export const MIGRATED_AUTH_ACTIONS = new Set<string>([
  'accountLogin',
  'registerTeacherAccount',
  'changeAccountPassword',
  'studentChangePassword',
  'teacherResetStudentPassword',
  'adminResetTeacherPassword',
  'joinClass',
  'bootstrapTeacherRole',
  'bootstrapAdminRole',
  'bootstrapAdminAccount'
]);

// Migrated actions in Phase 2B.2 (/api/classrooms)
export const MIGRATED_CLASSROOM_ACTIONS = new Set<string>([
  'createClassroom',
  'updateClassroom',
  'archiveClassroom',
  'deleteClassroom',
  'checkClassCode'
]);

// Migrated actions in Phase 2B.2 (/api/students)
export const MIGRATED_STUDENT_ACTIONS = new Set<string>([
  'createStudentAccess',
  'rotateStudentAccess',
  'updateStudentInfo',
  'toggleStudentStatus',
  'deleteStudent',
  'batchUpdateStudents',
  'transferStudentClass',
  'batchCreateStudents'
]);

export interface ApiCallableResponse<T = any> {
  data: T;
}

export class AppApiError extends Error {
  public code: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'AppApiError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppApiError.prototype);
  }
}

/**
 * Determine whether to route through Vercel Serverless Functions (/api/*)
 * In production (online): defaults to Vercel APIs unless explicitly forcing emulator.
 * In development: defaults to Firebase Emulator unless VITE_USE_VERCEL_API=true.
 */
export function isVercelApiMode(): boolean {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  if (metaEnv.VITE_USE_VERCEL_API === 'true') {
    return true;
  }
  if (!metaEnv.DEV && metaEnv.VITE_USE_FIREBASE_EMULATOR !== 'true') {
    return true;
  }
  return false;
}

/**
 * Direct API Call with automatic route resolution, token injection, and error formatting
 */
export async function callApi<TRes = any, TReq = any>(
  action: string,
  payload?: TReq
): Promise<TRes> {
  const useVercel = isVercelApiMode();

  // If in Vercel mode, check which migrated endpoint handles this action
  if (useVercel) {
    if (MIGRATED_AUTH_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/auth', action, payload);
    }
    if (MIGRATED_CLASSROOM_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/classrooms', action, payload);
    }
    if (MIGRATED_STUDENT_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/students', action, payload);
    }
  }

  // Otherwise delegate directly to Firebase callable (Emulator or Cloud Functions)
  try {
    const callable = httpsCallable<TReq, TRes>(functions, action);
    const res = await callable(payload);
    return res.data;
  } catch (err: any) {
    // Standardize Firebase Functions error into AppApiError
    const code = err?.code || 'internal';
    const message = err?.message || 'Đã có lỗi xảy ra khi xử lý yêu cầu.';
    throw new AppApiError(code, message, err?.details);
  }
}

/**
 * Factory creating a callable function with signature `(data?: TReq) => Promise<{ data: TRes }>`
 * Exactly matches Firebase `httpsCallable` signature to avoid rewriting UI components.
 */
export function createCallable<TReq = any, TRes = any>(
  action: string
): (payload?: TReq) => Promise<ApiCallableResponse<TRes>> {
  return async (payload?: TReq): Promise<ApiCallableResponse<TRes>> => {
    const result = await callApi<TRes, TReq>(action, payload);
    return { data: result };
  };
}

/**
 * Internal handler for Vercel Serverless Function endpoints (/api/*)
 */
async function invokeVercelEndpoint<TRes = any, TReq = any>(
  endpoint: string,
  action: string,
  payload?: TReq
): Promise<TRes> {
  // Check online status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AppApiError(
      'unavailable',
      'Mất kết nối mạng. Vui lòng kiểm tra lại đường truyền internet.'
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Attach Firebase ID Token if logged in
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    } catch (e) {
      console.warn('[ApiClient]: Could not retrieve auth token', e);
    }
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action,
        data: payload || {}
      })
    });
  } catch (netErr: any) {
    throw new AppApiError(
      'unavailable',
      'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại sau ít phút.'
    );
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new AppApiError(
      'internal',
      `Máy chủ phản hồi không đúng định dạng (${response.status} ${response.statusText}).`
    );
  }

  if (!response.ok || !body.success) {
    const errObj = body?.error;
    const code = errObj?.code || `http-${response.status}`;
    const message =
      errObj?.message || 'Yêu cầu không thể thực hiện được. Vui lòng thử lại.';

    if (response.status === 401) {
      throw new AppApiError('unauthenticated', message, errObj?.details);
    }
    if (response.status === 403) {
      throw new AppApiError('permission-denied', message, errObj?.details);
    }
    if (response.status === 429) {
      throw new AppApiError('resource-exhausted', message, errObj?.details);
    }

    throw new AppApiError(code, message, errObj?.details);
  }

  return body.data as TRes;
}
