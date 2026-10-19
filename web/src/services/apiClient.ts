/**
 * EM YÊU TIẾNG VIỆT - CLIENT API ADAPTER
 * Bridges between Local Firebase Emulator (httpsCallable) and Online Vercel Functions (/api/*)
 * Provides 100% backward compatibility for all existing UI components
 */

import { httpsCallable as firebaseHttpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';

// Migrated actions in /api/auth
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

// Migrated actions in /api/classrooms
export const MIGRATED_CLASSROOM_ACTIONS = new Set<string>([
  'createClassroom',
  'updateClassroom',
  'archiveClassroom',
  'deleteClassroom',
  'checkClassCode'
]);

// Migrated actions in /api/students
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

// Migrated actions in /api/lessons
export const MIGRATED_LESSON_ACTIONS = new Set<string>([
  'getTeacherLessons',
  'getLessonDetail',
  'saveLessonDraft',
  'publishLesson',
  'archiveLesson',
  'deleteDraftLesson',
  'updateLessonScope',
  'assignLesson',
  'getAIStatus',
  'testAIConnection'
]);

// Migrated actions in /api/attempts
export const MIGRATED_ATTEMPT_ACTIONS = new Set<string>([
  'getStudentLibrary',
  'startAttempt',
  'submitAnswer',
  'finishAttempt',
  'getAttemptReview'
]);

// Migrated actions in /api/analytics
export const MIGRATED_ANALYTICS_ACTIONS = new Set<string>([
  'getTeacherAnalytics',
  'exportTeacherData',
  'suggestRemediation',
  'listRemediationActivities',
  'saveRemediationActivity',
  'approveRemediationActivity',
  'deleteRemediationActivity'
]);

// Migrated actions in /api/admin
export const MIGRATED_ADMIN_ACTIONS = new Set<string>([
  'getAdminOverview',
  'listTeachers',
  'listAllClassesAdmin',
  'getCurriculumFramework',
  'listAcademicYears',
  'approveTeacherAccount',
  'toggleTeacherStatus'
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
    if (MIGRATED_LESSON_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/lessons', action, payload);
    }
    if (MIGRATED_ATTEMPT_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/attempts', action, payload);
    }
    if (MIGRATED_ANALYTICS_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/analytics', action, payload);
    }
    if (MIGRATED_ADMIN_ACTIONS.has(action)) {
      return invokeVercelEndpoint<TRes, TReq>('/api/admin', action, payload);
    }
  }

  // Otherwise delegate directly to Firebase callable (Emulator or Cloud Functions)
  try {
    const callable = firebaseHttpsCallable<TReq, TRes>(functions, action);
    const res = await callable(payload);
    return res.data;
  } catch (err: any) {
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
 * Drop-in replacement for Firebase `httpsCallable(functions, action)`
 * Enables components to switch from Firebase Cloud Functions to Vercel APIs transparently.
 */
export function httpsCallable<TReq = any, TRes = any>(
  _functions: any,
  action: string
): (payload?: TReq) => Promise<ApiCallableResponse<TRes>> {
  return createCallable<TReq, TRes>(action);
}

/**
 * Internal handler for Vercel Serverless Function endpoints (/api/*)
 */
async function invokeVercelEndpoint<TRes = any, TReq = any>(
  endpoint: string,
  action: string,
  payload?: TReq
): Promise<TRes> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  // Inject current Firebase user ID token if available
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
  } catch (tokenErr) {
    console.warn('[ApiClient] Failed to acquire current user ID token:', tokenErr);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, data: payload })
  });

  let responseBody: any;
  try {
    responseBody = await response.json();
  } catch (jsonErr) {
    throw new AppApiError(
      'internal',
      `Máy chủ phản hồi định dạng không hợp lệ (${response.status}).`
    );
  }

  if (!response.ok || !responseBody.success) {
    const errorData = responseBody.error || {};
    const code = errorData.code || 'unknown';
    const message = errorData.message || `Lỗi máy chủ (${response.status})`;
    throw new AppApiError(code, message, errorData.details);
  }

  return responseBody.data as TRes;
}
