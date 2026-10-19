import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { callApi } from '../services/apiClient';
import { ShieldCheck, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft, Sparkles, HelpCircle, KeyRound, CheckCircle2 } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Bootstrap Admin Modal States
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [bootstrapUsername, setBootstrapUsername] = useState('admin');
  const [bootstrapPassword, setBootstrapPassword] = useState('');
  const [bootstrapConfirmPassword, setBootstrapConfirmPassword] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapSuccess, setBootstrapSuccess] = useState<string | null>(null);
  const [hasExistingAdmin, setHasExistingAdmin] = useState<boolean | null>(null);

  const handleOpenBootstrapModal = async () => {
    setShowBootstrapModal(true);
    setBootstrapError(null);
    setBootstrapSuccess(null);
    setBootstrapPassword('');
    setBootstrapConfirmPassword('');
    try {
      const res: any = await callApi('bootstrapAdminAccount', { actionType: 'check' });
      if (res?.success) {
        setHasExistingAdmin(Boolean(res.hasAdmin));
        if (res.adminUsername) {
          setBootstrapUsername(res.adminUsername);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleBootstrapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bootstrapSecret.trim()) {
      setBootstrapError('Vui lòng nhập Mã bí mật hệ thống ADMIN_BOOTSTRAP_SECRET.');
      return;
    }
    if (
      bootstrapPassword.length < 8 ||
      !/\d/.test(bootstrapPassword) ||
      !/[a-zA-Z]/.test(bootstrapPassword)
    ) {
      setBootstrapError('Mật khẩu Admin phải có tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số.');
      return;
    }
    if (bootstrapPassword !== bootstrapConfirmPassword) {
      setBootstrapError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBootstrapLoading(true);
    setBootstrapError(null);
    setBootstrapSuccess(null);

    try {
      const cleanUser = (bootstrapUsername.trim() || 'admin').toLowerCase();
      const res: any = await callApi('bootstrapAdminAccount', {
        actionType: 'setup',
        adminSecret: bootstrapSecret.trim(),
        username: cleanUser,
        password: bootstrapPassword,
        displayName: 'Quản Trị Viên Hệ Thống'
      });

      if (res?.success) {
        setBootstrapSuccess(res.message || 'Thiết lập tài khoản Quản trị viên thành công!');
        setUsername(cleanUser);
        setPassword(bootstrapPassword);
        setTimeout(async () => {
          setShowBootstrapModal(false);
          try {
            await loginAdmin(cleanUser, bootstrapPassword);
            navigate('/admin/dashboard');
          } catch {
            // let user click login button
          }
        }, 1500);
      }
    } catch (err: any) {
      setBootstrapError(err.message || 'Lỗi thiết lập Quản trị viên.');
    } finally {
      setBootstrapLoading(false);
    }
  };

  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập Tên đăng nhập và Mật khẩu.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await loginAdmin(username.trim(), password);
      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Admin login error:', err);
      let msg = 'Đăng nhập Quản trị thất bại.';
      if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setUsername('admin');
    setPassword('admin');
    setIsLoading(true);
    setError(null);
    try {
      await loginAdmin('admin', 'admin');
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Lỗi đăng nhập tài khoản demo admin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-700 relative overflow-hidden">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500" />

        <div className="text-center mb-6 pt-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-100 text-emerald-800 mb-3 shadow-inner">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            CỔNG QUẢN TRỊ VIÊN
          </h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Hệ thống Quản lý Học liệu & Đọc hiểu — EM YÊU TIẾNG VIỆT
          </p>
        </div>

        {/* 1-Click Demo Login in Emulator / Dev */}
        {import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false' && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <div className="text-[11px] font-bold text-emerald-900 mb-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tài khoản Demo Emulator: <strong>admin</strong> / <strong>admin</strong></span>
            </div>
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>1-Click Đăng nhập Admin Mẫu</span>
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tên đăng nhập Quản trị
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Mật khẩu Quản trị
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-[11px] font-bold text-emerald-600 hover:underline"
              >
                Quên mật khẩu?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang xác thực quyền Admin...
              </span>
            ) : (
              <>
                <span>Đăng nhập Bảng Quản Trị</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 text-center border-t border-slate-100">
          <button
            type="button"
            onClick={handleOpenBootstrapModal}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center justify-center gap-1.5 mx-auto"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Khởi tạo / Đặt lại mật khẩu Quản trị viên</span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
          <Link to="/teacher/login" className="hover:text-sky-600 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Cổng Giáo viên
          </Link>
          <Link to="/" className="hover:text-emerald-600">
            Trang chủ
          </Link>
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
            <h3 className="text-lg font-black text-slate-900">Quên Mật Khẩu Quản Trị?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tài khoản Quản trị viên thuộc cấp quyền đặc biệt. Nếu quên mật khẩu, vui lòng liên hệ Ban Giám hiệu hoặc bộ phận Kỹ thuật Hệ thống để được cấp lại mật khẩu an toàn.
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

      {/* Bootstrap / Reset Admin Modal */}
      {showBootstrapModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !bootstrapLoading) setShowBootstrapModal(false);
          }}
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(90dvh,650px)] overflow-y-auto overscroll-contain">
            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {hasExistingAdmin ? 'Đặt Lại Mật Khẩu Quản Trị Viên' : 'Khởi Tạo Quản Trị Viên Đầu Tiên'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {hasExistingAdmin
                  ? 'Cập nhật mật khẩu mới an toàn cho tài khoản Admin đã có trên Cloud.'
                  : 'Thiết lập tài khoản Quản trị viên duy nhất trên Firebase Cloud.'}
              </p>
            </div>

            {bootstrapError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <div className="flex-1 leading-relaxed">{bootstrapError}</div>
              </div>
            )}

            {bootstrapSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                <div className="flex-1 leading-relaxed">{bootstrapSuccess}</div>
              </div>
            )}

            <form onSubmit={handleBootstrapSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã bí mật hệ thống (ADMIN_BOOTSTRAP_SECRET)
                </label>
                <input
                  type="password"
                  required
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                  placeholder="Mã bí mật cấu hình trên Vercel"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên đăng nhập Admin
                </label>
                <input
                  type="text"
                  required
                  value={bootstrapUsername}
                  onChange={(e) => setBootstrapUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu Admin mới (tối thiểu 8 ký tự, gồm chữ và số)
                </label>
                <input
                  type="password"
                  required
                  value={bootstrapPassword}
                  onChange={(e) => setBootstrapPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận lại mật khẩu Admin
                </label>
                <input
                  type="password"
                  required
                  value={bootstrapConfirmPassword}
                  onChange={(e) => setBootstrapConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  disabled={bootstrapLoading}
                  onClick={() => setShowBootstrapModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={bootstrapLoading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                >
                  {bootstrapLoading ? 'Đang xử lý...' : hasExistingAdmin ? 'Cập nhật mật khẩu' : 'Khởi tạo Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
