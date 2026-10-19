import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';

export interface StudentProfile {
  id: string;
  displayAlias: string;
  studentCode?: string;
  classId: string;
  className?: string;
  grade?: number;
}

interface AuthContextType {
  user: User | null;
  isTeacher: boolean;
  isAdmin: boolean;
  studentSession: StudentProfile | null;
  loading: boolean;
  loginWithAccount: (username: string, pass: string) => Promise<{ role: string; displayName?: string; studentProfile?: StudentProfile }>;
  loginTeacher: (identifier: string, pass: string) => Promise<void>;
  registerTeacher: (username: string, pass: string, name: string) => Promise<void>;
  loginAdmin: (identifier: string, pass: string, adminSecret?: string) => Promise<void>;
  bootstrapRole: () => Promise<string>;
  setStudentSessionData: (student: StudentProfile | null) => void;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPass: string, newPass: string) => Promise<void>;
  studentChangePassword: (currentPass: string, newPass: string) => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STUDENT_STORAGE_KEY = 'emytv_student_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isTeacher, setIsTeacher] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [studentSession, setStudentSession] = useState<StudentProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STUDENT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Check teacher/admin status in Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          const role = docSnap.exists() ? docSnap.data()?.role : null;
          if (role === 'admin') {
            setIsAdmin(true);
            setIsTeacher(true);
          } else if (role === 'teacher') {
            setIsTeacher(true);
            setIsAdmin(false);
          } else {
            // Check ID token claims
            const idTokenResult = await currentUser.getIdTokenResult(true);
            const claimRole = idTokenResult.claims.role;
            setIsAdmin(claimRole === 'admin');
            setIsTeacher(claimRole === 'teacher' || claimRole === 'admin');
          }
        } catch (e) {
          console.warn('Could not fetch user role:', e);
          setIsTeacher(false);
          setIsAdmin(false);
        }
      } else {
        setIsTeacher(false);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithAccount = async (username: string, pass: string) => {
    setLoading(true);
    try {
      const accountLoginFn = httpsCallable(functions, 'accountLogin');
      const res: any = await accountLoginFn({ username: username.trim(), password: pass });
      if (!res.data || !res.data.token) {
        throw new Error('Đăng nhập không thành công, vui lòng thử lại.');
      }

      await signInWithCustomToken(auth, res.data.token);

      if (res.data.role === 'admin') {
        setIsAdmin(true);
        setIsTeacher(true);
        setStudentSessionData(null);
      } else if (res.data.role === 'teacher') {
        setIsTeacher(true);
        setIsAdmin(false);
        setStudentSessionData(null);
      } else if (res.data.role === 'student') {
        setIsTeacher(false);
        setIsAdmin(false);
        if (res.data.studentProfile) {
          setStudentSessionData(res.data.studentProfile);
        }
      }

      return res.data;
    } finally {
      setLoading(false);
    }
  };

  const loginTeacher = async (identifier: string, pass: string) => {
    setLoading(true);
    try {
      const cleanId = identifier.trim();
      if (!cleanId.includes('@')) {
        // Log in via username
        await loginWithAccount(cleanId, pass);
        return;
      }

      // Fallback for legacy email login
      const res = await signInWithEmailAndPassword(auth, cleanId, pass);
      const userDocRef = doc(db, 'users', res.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists() || docSnap.data()?.role !== 'teacher') {
        const bootstrap = httpsCallable(functions, 'bootstrapTeacherRole');
        await bootstrap();
        setIsTeacher(true);
      } else {
        setIsTeacher(true);
      }
      setStudentSessionData(null);
    } finally {
      setLoading(false);
    }
  };

  const loginAdmin = async (identifier: string, pass: string, adminSecret?: string) => {
    setLoading(true);
    try {
      const cleanId = identifier.trim();
      if (!cleanId.includes('@')) {
        // Log in via username
        await loginWithAccount(cleanId, pass);
        return;
      }

      // Legacy email login
      const res = await signInWithEmailAndPassword(auth, cleanId, pass);
      const userDocRef = doc(db, 'users', res.user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists() || docSnap.data()?.role !== 'admin') {
        const bootstrap = httpsCallable(functions, 'bootstrapAdminRole');
        await bootstrap({ adminSecret, displayName: 'Quản trị viên' });
        setIsAdmin(true);
        setIsTeacher(true);
      } else {
        setIsAdmin(true);
        setIsTeacher(true);
      }
      setStudentSessionData(null);
    } finally {
      setLoading(false);
    }
  };

  const registerTeacher = async (username: string, pass: string, name: string) => {
    setLoading(true);
    try {
      const cleanUsername = username.trim();
      const registerFn = httpsCallable(functions, 'registerTeacherAccount');
      await registerFn({
        username: cleanUsername,
        password: pass,
        displayName: name.trim()
      });
      // Do not auto-login because teacher is pending approval by admin
    } finally {
      setLoading(false);
    }
  };

  const bootstrapRole = async (): Promise<string> => {
    const bootstrap = httpsCallable(functions, 'bootstrapTeacherRole');
    const res: any = await bootstrap();
    setIsTeacher(true);
    return res.data?.message || 'Thành công';
  };

  const setStudentSessionData = (student: StudentProfile | null) => {
    setStudentSession(student);
    if (student) {
      localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(student));
    } else {
      localStorage.removeItem(STUDENT_STORAGE_KEY);
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!email || !email.includes('@')) {
      throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
    }
    await sendPasswordResetEmail(auth, email.trim());
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!auth.currentUser) {
      throw new Error('Bạn chưa đăng nhập.');
    }
    if (!newPass || newPass.length < 6) {
      throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
    }

    // Call Cloud Function to update PBKDF2 hash and auth password
    const changeFn = httpsCallable(functions, 'changeAccountPassword');
    const res: any = await changeFn({
      currentPassword: currentPass,
      newPassword: newPass
    });

    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Đổi mật khẩu thất bại.');
    }
  };

  const studentChangePassword = async (currentPass: string, newPass: string) => {
    if (!studentSession) {
      throw new Error('Phiên học sinh không hợp lệ.');
    }
    if (!newPass || newPass.length < 6) {
      throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
    }

    const changeFn = httpsCallable(functions, 'studentChangePassword');
    const res: any = await changeFn({
      currentPassword: currentPass,
      newPassword: newPass
    });

    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Đổi mật khẩu học sinh thất bại.');
    }
  };

  const updateDisplayName = async (newName: string) => {
    if (!auth.currentUser) throw new Error('Bạn chưa đăng nhập.');
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Họ và tên không được để trống.');

    await updateProfile(auth.currentUser, { displayName: trimmed });
    await setDoc(
      doc(db, 'users', auth.currentUser.uid),
      { displayName: trimmed, updatedAt: Date.now() },
      { merge: true }
    );
  };

  const logout = async () => {
    await signOut(auth);
    setStudentSessionData(null);
    setIsTeacher(false);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isTeacher,
        isAdmin,
        studentSession,
        loading,
        loginWithAccount,
        loginTeacher,
        registerTeacher,
        loginAdmin,
        bootstrapRole,
        setStudentSessionData,
        logout,
        sendPasswordReset,
        changePassword,
        studentChangePassword,
        updateDisplayName
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
