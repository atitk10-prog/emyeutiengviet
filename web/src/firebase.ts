import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

// Connect to Local Firebase Emulators when configured
// In development, default to emulator unless explicitly disabled with 'false'.
// In production, NEVER connect to emulator unless explicitly set to 'true'.
const useEmulator = metaEnv.DEV
  ? metaEnv.VITE_USE_FIREBASE_EMULATOR !== 'false'
  : metaEnv.VITE_USE_FIREBASE_EMULATOR === 'true';

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || (useEmulator ? 'AIzaSyDemoDummyKeyForEmulatorUsageOnly123' : 'AIzaSyDhx3ubazUjmaaNdhmXSD3uDhVD1s0fHCk'),
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || (useEmulator ? 'em-yeu-tieng-viet-demo.firebaseapp.com' : 'emyeutiengviet-prod.firebaseapp.com'),
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || (useEmulator ? 'em-yeu-tieng-viet-demo' : 'emyeutiengviet-prod'),
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || (useEmulator ? 'em-yeu-tieng-viet-demo.appspot.com' : 'emyeutiengviet-prod.firebasestorage.app'),
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || (useEmulator ? '1234567890' : '662875205963'),
  appId: metaEnv.VITE_FIREBASE_APP_ID || (useEmulator ? '1:1234567890:web:abcdef123456' : '1:662875205963:web:cf79da18f2186cf1e8b8ce')
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
const emulatorHost = metaEnv.VITE_FIREBASE_EMULATOR_HOST || 'localhost';

// Prevent multiple emulator attachments during hot-module reload
let isEmulatorConnected = false;

if (useEmulator && !isEmulatorConnected) {
  try {
    // Only connect if not connected already
    if (!(auth as any)._emulatorConfig) {
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    }
    // Check if firestore emulator is already connected
    if (!(db as any)._settings?.host?.includes('8080')) {
      connectFirestoreEmulator(db, emulatorHost, 8080);
    }
    // Check functions emulator
    if (!(functions as any)._customUrl) {
      connectFunctionsEmulator(functions, emulatorHost, 5001);
    }
    isEmulatorConnected = true;
    console.log('[Firebase] Đã kết nối thành công với Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001)');
  } catch (err: any) {
    // Ignore already connected warnings during HMR
    console.info('[Firebase Emulator Info]:', err.message);
  }
}

export default app;
