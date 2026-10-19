import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Lock,
  User,
  LogIn,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Eye,
  EyeOff,
  HelpCircle
} from 'lucide-react';

export const TeacherLogin: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { loginTeacher, registerTeacher, user, isTeacher } = useAuth();
  const navigate = useNavigate();

  // If already logged in as teacher, redirect to dashboard
  React.useEffect(() => {
    if (user && isTeacher) {
      navigate('/teacher/dashboard');
    }
  }, [user, isTeacher, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessNotice(null);

    try {
      if (isRegister) {
        if (!displayName.trim()) {
          setError('Vui lòng nhập Họ và tên giáo viên.');
          setLoading(false);
          return;
        }
        await registerTeacher(username.trim(), password, displayName.trim());
        setSuccessNotice(
          'Đăng ký tài khoản giáo viên thành công! Tài khoản đang ở trạng thái "Chờ Quản trị viên duyệt". Vui lòng liên hệ Admin nhà trường để kích hoạt.'
        );
        setIsRegister(false);
        setPassword('');
      } else {
        await loginTeacher(username.trim(), password);
        navigate('/teacher/dashboard');
      }
    } catch (err: any) {
      console.error('Teacher auth error:', err);
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Demo Login for Emulator
  const handleQuickEmulatorLogin = async () => {
    setUsername('giaovien01');
    setPassword('GV123456');
    setLoading(true);
    setError(null);
    setSuccessNotice(null);
    try {
      await loginTeacher('giaovien01', 'GV123456');
      navigate('/teacher/dashboard');
    } catch (err: any) {
      setError('Lỗi đăng nhập nhanh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border-2 border-slate-200 p-6 sm:p-8 relative">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chủ</span>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            Cổng Thông Tin Giáo Viên
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Hệ thống quản lý học liệu và theo dõi năng lực đọc hiểu
          </p>
        </div>

        {/* 1-Click Quick Demo Login Button (Only shown in Local Emulator / Dev mode) */}
        {import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false' && (
          <div className="mb-6 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center">
            <p className="text-xs font-bold text-emerald-900 mb-2">
              Tài khoản Demo Emulator: <strong>giaovien01</strong> / <strong>GV123456</strong>
            </p>
            <button
              type="button"
              onClick={handleQuickEmulatorLogin}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>1-Click Đăng nhập Giáo viên Mẫu (giaovien01)</span>
            </button>
          </div>
        )}

        {/* Success Notice */}
        {successNotice && (
          <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs font-semibold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed">{successNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs font-semibold animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Họ và tên giáo viên
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Cô Nguyễn Thị Lan"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm font-semibold transition"
                  required={isRegister}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="giaovien01"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm font-semibold transition"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Mật khẩu (tối thiểu 6 ký tự)
              </label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-xl text-sm font-semibold transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-base rounded-xl shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            <span>{loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký tài khoản giáo viên' : 'Đăng nhập giáo viên'}</span>
          </button>
        </form>

        {/* Toggle Register / Login */}
        <div className="mt-6 text-center text-xs font-semibold text-slate-500">
          {isRegister ? (
            <span>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                className="text-emerald-700 font-bold hover:underline"
              >
                Đăng nhập ngay
              </button>
            </span>
          ) : (
            <span>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                className="text-emerald-700 font-bold hover:underline"
              >
                Đăng ký tài khoản mới
              </button>
            </span>
          )}
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
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Quên Mật Khẩu Giáo Viên?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Nếu thầy cô quên mật khẩu, vui lòng liên hệ <strong>Quản trị viên (Admin) nhà trường</strong>. Admin có thể trực tiếp đặt lại mật khẩu mới cho thầy cô tại Bảng Điều Hành Quản Trị.
            </p>
            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
            >
              Đã hiểu
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
