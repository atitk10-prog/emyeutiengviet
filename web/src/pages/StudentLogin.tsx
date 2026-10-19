import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth, functions } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MascotBird } from '../components/MascotBird';
import {
  LogIn,
  KeyRound,
  School,
  AlertCircle,
  ArrowLeft,
  User,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const StudentLogin: React.FC = () => {
  const [loginMode, setLoginMode] = useState<'account' | 'pin'>('account');
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Legacy PIN mode states
  const [classCode, setClassCode] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { loginWithAccount, setStudentSessionData } = useAuth();
  const navigate = useNavigate();

  const handleAccountLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !password.trim()) {
      setError('Vui lòng nhập Tên đăng nhập / Mã học sinh và Mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (auth.currentUser && !auth.currentUser.uid.startsWith('student_')) {
        await signOut(auth);
      }

      const res = await loginWithAccount(studentCode.trim(), password);
      if (res.role === 'student') {
        navigate('/student/library');
      } else {
        setError('Tài khoản này không phải là học sinh.');
      }
    } catch (err: any) {
      console.error('Student account login error:', err);
      setError(err.message || 'Mã học sinh hoặc mật khẩu không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setStudentCode('HS001');
    setPassword('HS123456');
    setLoading(true);
    setError(null);
    try {
      if (auth.currentUser && !auth.currentUser.uid.startsWith('student_')) {
        await signOut(auth);
      }
      const res = await loginWithAccount('HS001', 'HS123456');
      if (res.role === 'student') {
        navigate('/student/library');
      }
    } catch (err: any) {
      setError('Lỗi đăng nhập học sinh demo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim() || !accessCode.trim()) {
      setError('Vui lòng nhập đầy đủ Mã lớp và Mã PIN cá nhân.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (auth.currentUser && !auth.currentUser.uid.startsWith('student_')) {
        await signOut(auth);
      }

      const joinFunc = httpsCallable(functions, 'joinClass');
      const result: any = await joinFunc({
        classCode: classCode.trim().toUpperCase(),
        accessCode: accessCode.trim().toUpperCase()
      });

      if (result.data?.success) {
        if (result.data.token) {
          await signInWithCustomToken(auth, result.data.token);
        }
        setStudentSessionData(result.data.student);
        navigate('/student/library');
      } else {
        setError('Không thể tham gia lớp học. Vui lòng kiểm tra lại thông tin.');
      }
    } catch (err: any) {
      console.error('Join error:', err);
      setError(err.message || 'Mã lớp hoặc mã PIN không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border-2 border-sky-100 p-6 sm:p-8 relative">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chủ</span>
        </button>

        {/* Mascot & Title */}
        <div className="text-center mb-6">
          <MascotBird
            mood="encouraging"
            speech="Nhập mã học sinh và mật khẩu của em để vào góc đọc sách nào!"
            size="md"
            className="mb-2"
          />
          <h2 className="text-2xl font-black text-slate-900 mt-2">
            Vào Lớp Học Của Em
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Mỗi ngày một câu chuyện — Mỗi ngày thêm yêu tiếng Việt
          </p>
        </div>

        {/* 1-Click Demo in Emulator */}
        {import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false' && (
          <div className="mb-6 p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-center">
            <p className="text-xs font-bold text-sky-900 mb-2">
              Tài khoản Demo Emulator: <strong>HS001</strong> / <strong>HS123456</strong>
            </p>
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>1-Click Đăng nhập Học sinh Mẫu (HS001)</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs md:text-sm animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}

        {/* Primary Form: Username & Password */}
        {loginMode === 'account' ? (
          <form onSubmit={handleAccountLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên đăng nhập / Mã học sinh
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="VD: HS001"
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl text-base font-black tracking-wider uppercase transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-bold text-sky-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl text-base font-bold transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-primary-600 hover:from-sky-600 hover:to-primary-700 text-white font-extrabold text-base rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Đang vào lớp...' : 'Đăng nhập vào lớp'}</span>
            </button>
          </form>
        ) : (
          /* Secondary Form: Class Code & Access PIN */
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mã Lớp Học (classCode)
              </label>
              <div className="relative">
                <School className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={10}
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  placeholder="VD: MXK4FH"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl text-base font-black tracking-widest uppercase transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mã PIN Cá Nhân
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={10}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="VD: 123456"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl text-base font-black tracking-widest uppercase transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-primary-600 hover:from-sky-600 hover:to-primary-700 text-white font-extrabold text-base rounded-2xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Đang kiểm tra...' : 'Vào Lớp Bằng Mã PIN'}</span>
            </button>
          </form>
        )}

        {/* Toggle Mode */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setLoginMode(loginMode === 'account' ? 'pin' : 'account');
              setError(null);
            }}
            className="text-xs font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
          >
            <span>{loginMode === 'account' ? 'Hoặc vào bằng Mã Lớp & Mã PIN' : 'Hoặc đăng nhập bằng Mã học sinh & Mật khẩu'}</span>
            {loginMode === 'account' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForgotModal(false);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-y-auto overscroll-contain">
            <div className="w-12 h-12 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Em Quên Mật Khẩu?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nếu em quên mật khẩu, đừng lo lắng nhé! Em hãy báo với <strong>thầy cô giáo chủ nhiệm</strong> hoặc <strong>cô giáo dạy Tiếng Việt</strong>. Thầy cô sẽ đặt lại mật khẩu mới cho em ngay tại lớp học!
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition"
            >
              Em đã hiểu rồi!
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
