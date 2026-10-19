/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Common Types & Request/Response Envelopes
 */

export interface VercelApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body: any;
  query: Record<string, string | string[] | undefined>;
  socket?: {
    remoteAddress?: string;
  };
}

export interface VercelApiResponse {
  status: (statusCode: number) => VercelApiResponse;
  json: (body: any) => void;
  send: (body: any) => void;
  setHeader: (name: string, value: string | string[]) => void;
}

export type UserRole = 'admin' | 'teacher' | 'student';

export interface ApiResponseSuccess<T = any> {
  success: true;
  data: T;
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T = any> = ApiResponseSuccess<T> | ApiResponseError;

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(statusCode: number, code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface StudentSession {
  authUid: string;
  studentId: string;
  classId: string;
  displayAlias: string;
  validUntil: number;
  revokedAt?: number;
  createdAt: number;
}

export interface AuthUserProfile {
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'pending_approval' | 'suspended';
  email?: string;
}

export interface StudentAuthProfile {
  id: string;
  studentCode?: string;
  displayAlias: string;
  classId: string;
  className?: string;
  grade?: number;
  academicYear?: string;
}
