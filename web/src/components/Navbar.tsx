import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, User, LogOut, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import { ProfileModal } from './ProfileModal';

export const Navbar: React.FC = () => {
  const { user, isTeacher, isAdmin, studentSession, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isEmulator = import.meta.env.DEV
    ? import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false'
    : import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-sky-100 sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-sky-400 to-primary-500 flex items-center justify-center shadow-sm sm:shadow-md group-hover:scale-105 transition-transform overflow-hidden p-1 sm:p-1.5 shrink-0">
              <img src="/assets/app-logo.svg" alt="Em Yêu Tiếng Việt" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="text-sm sm:text-lg md:text-xl font-black tracking-tight whitespace-nowrap bg-gradient-to-r from-primary-600 to-sky-700 bg-clip-text text-transparent block">
                EM YÊU TIẾNG VIỆT
              </span>
              <p className="hidden md:block text-[11px] font-bold text-slate-500 tracking-tight">
                Mỗi ngày một câu chuyện – Mỗi ngày thêm yêu tiếng Việt
              </p>
            </div>
          </Link>

          {/* Right Section: Badges & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            {/* Emulator Mode Tag */}
            {isEmulator && (
              <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Firebase Emulator
              </span>
            )}

            {/* If Student is logged in */}
            {studentSession && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-sky-50 border border-sky-200 py-1 px-2 sm:py-1.5 sm:px-3 rounded-xl sm:rounded-2xl shrink-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-[11px] sm:text-xs shrink-0">
                  {studentSession.displayAlias.charAt(0)}
                </div>
                <div className="text-left text-xs min-w-0">
                  <div className="font-extrabold text-sky-950 flex items-center gap-1">
                    <span className="truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[140px] block" title={studentSession.displayAlias}>
                      {studentSession.displayAlias}
                    </span>
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0 hidden xs:inline" />
                  </div>
                  <div className="text-[10px] text-sky-700 font-semibold truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[140px]">
                    {studentSession.className || (studentSession.grade ? `Khối ${studentSession.grade}` : 'Học sinh')}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-1 sm:ml-2 text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-white/60 transition shrink-0 cursor-pointer"
                  title="Đăng xuất / Đổi bạn khác"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* If Admin is logged in */}
            {user && isAdmin && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 py-1 px-2 sm:px-3 rounded-2xl text-white shadow-sm">
                <Link
                  to="/admin/dashboard"
                  className="flex items-center gap-2 hover:opacity-90 transition"
                  title="Vào Bảng Quản Trị"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div className="hidden sm:block text-left text-xs">
                    <div className="font-bold truncate max-w-[120px] text-slate-200">
                      {user.displayName || user.email?.split('@')[0]}
                    </div>
                    <div className="text-[10px] text-emerald-400 font-extrabold uppercase">
                      Quản trị viên
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowProfile(true)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  title="Thông tin cá nhân & Đổi mật khẩu"
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* If Teacher is logged in (and not already shown as admin) */}
            {user && isTeacher && !isAdmin && (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 py-1 px-2 sm:px-3 rounded-2xl">
                <Link
                  to="/teacher/dashboard"
                  className="flex items-center gap-2 hover:opacity-90 transition"
                  title="Vào Bảng Giáo Viên"
                >
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                  <div className="hidden sm:block text-left text-xs">
                    <div className="font-bold text-emerald-950 truncate max-w-[120px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-extrabold uppercase">
                      Giáo viên
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowProfile(true)}
                  className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition"
                  title="Thông tin cá nhân & Đổi mật khẩu"
                >
                  <User className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-emerald-100 rounded-lg transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* If neither logged in */}
            {!studentSession && !user && (
              <div className="flex items-center gap-2">
                <Link
                  to="/student/join"
                  className="px-3.5 py-2 bg-primary-500 hover:bg-primary-600 text-white font-extrabold rounded-xl text-xs md:text-sm shadow-sm transition active:scale-95"
                >
                  Vào lớp học
                </Link>
                <Link
                  to="/teacher/login"
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs md:text-sm transition"
                >
                  Giáo viên
                </Link>
                <Link
                  to="/admin/login"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs md:text-sm transition flex items-center gap-1.5"
                  title="Cổng Quản trị viên"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline">Quản trị</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </header>
  );
};
