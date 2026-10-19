/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Firebase Admin SDK Initializer
 * Supports both Cloud (Vercel) with Service Account and Local Firebase Emulator
 */

import * as admin from 'firebase-admin';
import { ApiError } from './types.js';

let isInitialized = false;

export function isLocalEmulator(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (Boolean(process.env.FIRESTORE_EMULATOR_HOST) ||
      Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) ||
      process.env.FUNCTIONS_EMULATOR === 'true')
  );
}

export function initFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0 && isInitialized) {
    return admin.apps[0]!;
  }

  // 1. Local Emulator Suite detection
  if (isLocalEmulator()) {
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'em-yeu-tieng-viet-demo'
      });
    }
    const db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    isInitialized = true;
    return admin.apps[0]!;
  }

  // 2. Production / Cloud Vercel Environment
  // Check for FIREBASE_SERVICE_ACCOUNT_KEY (JSON string or Base64 encoded JSON)
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountRaw) {
    try {
      let parsed: any;
      if (serviceAccountRaw.trim().startsWith('{')) {
        parsed = JSON.parse(serviceAccountRaw);
      } else {
        const decoded = Buffer.from(serviceAccountRaw, 'base64').toString('utf-8');
        parsed = JSON.parse(decoded);
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID
        });
      }
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      isInitialized = true;
      return admin.apps[0]!;
    } catch (err: any) {
      console.error('[Firebase Admin Init Error]: Malformed FIREBASE_SERVICE_ACCOUNT_KEY', err.message);
      throw new ApiError(
        500,
        'internal',
        `Lỗi cấu hình Firebase Service Account trên máy chủ: ${err.message}`
      );
    }
  }

  // 3. Check individual credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (projectId && clientEmail && privateKey) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey
          }),
          projectId
        });
      }
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      isInitialized = true;
      return admin.apps[0]!;
    } catch (err: any) {
      console.error('[Firebase Admin Init Error]: Invalid individual credentials', err.message);
      throw new ApiError(
        500,
        'internal',
        `Lỗi xác thực Firebase qua biến môi trường: ${err.message}`
      );
    }
  }

  // 4. Default Application Credentials (GCP runtime if available)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp();
      }
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      isInitialized = true;
      return admin.apps[0]!;
    } catch (err: any) {
      console.error('[Firebase Admin Init Error]: GOOGLE_APPLICATION_CREDENTIALS failed', err.message);
    }
  }

  // 5. Missing server-side credentials in production: Safe explicit error for administrator
  throw new ApiError(
    500,
    'failed-precondition',
    '[EMYTV Cloud Admin]: Chưa cấu hình Firebase Service Account trên môi trường Cloud Vercel. ' +
      'Vui lòng thêm biến môi trường FIREBASE_SERVICE_ACCOUNT_KEY trong Vercel Project Settings.'
  );
}

export function getDb(): admin.firestore.Firestore {
  initFirebaseAdmin();
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  initFirebaseAdmin();
  return admin.auth();
}

export { admin };
