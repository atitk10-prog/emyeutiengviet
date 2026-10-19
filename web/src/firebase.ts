import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoDummyKeyForEmulatorUsageOnly123',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'em-yeu-tieng-viet-demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'em-yeu-tieng-viet-demo',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'em-yeu-tieng-viet-demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456'
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect to Local Firebase Emulators when configured
// In development, default to emulator unless explicitly disabled with 'false'.
// In production, NEVER connect to emulator unless explicitly set to 'true'.
const useEmulator = import.meta.env.DEV
  ? import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false'
  : import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
const emulatorHost = import.meta.env.VITE_FIREBASE_EMULATOR_HOST || 'localhost';

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
