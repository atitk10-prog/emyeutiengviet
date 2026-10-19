import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MascotBird } from '../components/MascotBird';
import {
  BookOpen,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  RotateCcw,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  User,
  Volume2,
  X
} from 'lucide-react';

export const StudentLibrary: React.FC = () => {
  const { studentSession, studentChangePassword, setStudentSessionData } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Student Self-Service Change Password State
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passMessage, setPassMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleStudentChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPass) {
      setPassMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }
    if (newPass.length < 6) {
      setPassMessage({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }
    if (newPass !== confirmPass) {
      setPassMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    setChangingPass(true);
    setPassMessage(null);
    try {
      await studentChangePassword(currentPass, newPass);
      setPassMessage({ type: 'success', text: 'Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới nhé.' });
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      setPassMessage({ type: 'error', text: err.message || 'Đổi mật khẩu thất bại.' });
    } finally {
      setChangingPass(false);
    }
  };

  useEffect(() => {
    if (!studentSession) {
      navigate('/student/join');
      return;
    }

    const fetchLibrary = async () => {
      setLoading(true);
      setError(null);
      try {
        const getLib = httpsCallable(functions, 'getStudentLibrary');
        const res: any = await getLib();
        if (res.data?.success) {
          setAssignments(res.data.assignments || []);
          // Seamless real-time sync of class and profile upon page load/reload (Phần C)
          if (res.data?.student) {
            setStudentSessionData(res.data.student);
          }
        }
      } catch (err: any) {
        console.error('Error fetching student library:', err);
        setError(err.message || 'Không thể tải danh sách bài đọc.');
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [studentSession?.id]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Top Welcome Banner (Phần B.2 & B.3: Compact mobile banner) */}
      <div className="bg-gradient-to-r from-sky-400 via-primary-500 to-indigo-500 rounded-2xl sm:rounded-3xl p-4 sm:p-7 text-white shadow-lg mb-6 sm:mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-white/20 rounded-full text-[11px] sm:text-xs font-bold mb-1.5 sm:mb-2 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
              <span>Góc Đọc Sách Của Em</span>
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black tracking-tight">
              Chào bạn {studentSession?.displayAlias || 'nhỏ'}!
            </h1>
            <p className="text-sky-100 text-xs sm:text-base font-semibold mt-0.5 sm:mt-1">
              Hôm nay chúng mình cùng khám phá câu chuyện thú vị nào nhé!
            </p>

            {/* Student Code Badge & Self-Service Change Password */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="px-2.5 py-1 bg-white/20 rounded-xl text-xs font-black font-mono border border-white/20">
                Mã học sinh: {studentSession?.studentCode || 'HS'}
              </span>
              <span className="px-2.5 py-1 bg-white/20 rounded-xl text-xs font-bold border border-white/20">
                {studentSession?.className || (studentSession?.grade ? `Khối ${studentSession.grade}` : 'Lớp học')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassModal(true);
                  setPassMessage(null);
                }}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer min-h-[30px]"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Đổi mật khẩu</span>
              </button>
            </div>
          </div>

          <div className="hidden sm:block shrink-0">
            <MascotBird mood="reading" size="sm" />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse">
              <div className="h-6 bg-slate-200 rounded-lg w-3/4 mb-4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2 mb-6"></div>
              <div className="h-10 bg-slate-200 rounded-2xl"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && assignments.length === 0 && (
        <div className="bg-white rounded-3xl p-10 text-center border-2 border-dashed border-sky-200 max-w-lg mx-auto">
          <MascotBird mood="thinking" size="md" className="mb-4" />
          <h3 className="text-xl font-black text-slate-800 mb-2">
            Chưa có bài đọc nào được giao!
          </h3>
          <p className="text-sm text-slate-500 font-semibold mb-6">
            Cô giáo đang chuẩn bị những câu chuyện thật hay cho lớp mình. Em hãy quay lại sau nhé!
          </p>
        </div>
      )}

      {/* Assignments Grid */}
      {!loading && assignments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((item) => {
            const status = item.statusText || (item.isCompleted ? (item.canAttempt ? 'completed' : 'max_reached') : 'not_started');
            const attemptsCount = item.attemptsCount || 0;
            const maxAttempts = item.maxAttempts || 3;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-md border-2 border-sky-100 hover:border-sky-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Badge & Topic */}
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 bg-sky-100 text-sky-800 font-black text-xs rounded-full">
                        Khối Lớp {item.grade}
                      </span>
                      {item.week && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
                          Tuần {item.week}
                        </span>
                      )}
                      {(item.hasAudio || item.audioUrl) && (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full flex items-center gap-1 border border-emerald-200">
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Có giọng đọc</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-400 truncate max-w-[140px]" title={item.topic}>
                      {item.topic}
                    </span>
                  </div>

                  {/* Title (Phần B.4 & B.5: Tiêu đề bài đọc thực tế nổi bật) */}
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mb-2 sm:mb-3 leading-snug line-clamp-2" title={item.lessonTitle || item.title}>
                    {item.lessonTitle || item.title || 'Bài đọc'}
                  </h3>

                  {/* Status Badge & Stars */}
                  <div className="space-y-2 mb-6">
                    {status === 'in_progress' ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span>Đang làm dở (Lượt {attemptsCount + 1}/{maxAttempts})</span>
                      </div>
                    ) : status === 'max_reached' ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 mb-1.5">
                          <CheckCircle2 className="w-4 h-4 text-slate-500" />
                          <span>Đã dùng hết {maxAttempts}/{maxAttempts} lượt</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-4 h-4 ${
                                starIdx <= (item.bestStars || 0)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-amber-600 ml-1">
                            {item.bestStars} sao
                          </span>
                        </div>
                      </div>
                    ) : status === 'completed' ? (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 mb-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Đã hoàn thành ({attemptsCount}/{maxAttempts} lượt)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((starIdx) => (
                            <Star
                              key={starIdx}
                              className={`w-4 h-4 ${
                                starIdx <= (item.bestStars || 0)
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-amber-600 ml-1">
                            {item.bestStars} sao
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Clock className="w-4 h-4 text-sky-500" />
                        <span>Chưa làm bài (0/{maxAttempts} lượt)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {item.status === 'paused' ? (
                    <div className="w-full py-3.5 px-4 bg-slate-100 text-slate-500 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-slate-200 text-center">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Chưa đến tuần học (Chờ mở theo tiến độ)</span>
                    </div>
                  ) : (
                    <>
                      {status === 'in_progress' && (
                        <button
                          onClick={() => navigate(`/student/mission/${item.id}`)}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-2xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Tiếp tục bài đang làm</span>
                          <ArrowRight className="w-4 h-4 ml-auto" />
                        </button>
                      )}

                      {status === 'max_reached' && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            Em đã dùng hết {maxAttempts} lượt. Em vẫn có thể xem lại bài; hãy hỏi cô nếu muốn được giao thêm lượt nhé!
                          </p>
                          {item.latestCompletedAttemptId && (
                            <button
                              onClick={() => navigate(`/student/review/${item.latestCompletedAttemptId}`)}
                              className="w-full py-3 px-4 bg-sky-50 hover:bg-sky-100 text-sky-800 border-2 border-sky-200 font-extrabold text-sm rounded-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <BookOpen className="w-4 h-4 text-sky-600" />
                              <span>Xem lại bài đã làm</span>
                            </button>
                          )}
                        </div>
                      )}

                      {status === 'completed' && (
                        <div className="space-y-2">
                          <button
                            onClick={() => navigate(`/student/mission/${item.id}`)}
                            className="w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 font-black text-sm rounded-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Luyện tập lại (còn {maxAttempts - attemptsCount} lượt)</span>
                          </button>

                          {item.latestCompletedAttemptId && (
                            <button
                              onClick={() => navigate(`/student/review/${item.latestCompletedAttemptId}`)}
                              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                              <span>Xem lại kết quả & giải thích</span>
                            </button>
                          )}
                        </div>
                      )}

                      {status === 'not_started' && (
                        <button
                          onClick={() => navigate(`/student/mission/${item.id}`)}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-400 to-primary-600 hover:from-sky-500 hover:to-primary-700 text-white font-black text-sm rounded-2xl shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Bắt đầu đọc bài</span>
                          <ArrowRight className="w-4 h-4 ml-auto" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Student Self-Service Change Password Modal */}
      {showChangePassModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 md:p-6 flex min-h-full items-center justify-center overscroll-contain animate-fade-in"
          onClick={() => setShowChangePassModal(false)}
        >
          <div
            className="relative bg-white rounded-3xl p-5 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,600px)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-slate-900">Đổi Mật Khẩu Cá Nhân</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePassModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="overflow-y-auto flex-1 pt-3 space-y-3.5 text-left overscroll-contain">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Học sinh: <strong className="text-slate-800">{studentSession?.displayAlias}</strong> (Mã: {studentSession?.studentCode || 'HS001'})
              </p>

              {passMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    passMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passMessage.text}
                </div>
              )}

              <form onSubmit={handleStudentChangePassword} className="space-y-3 text-left">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu hiện tại:</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mật khẩu mới (tối thiểu 6 ký tự):</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nhập lại mật khẩu mới:</label>
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowChangePassModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={changingPass}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-xl text-xs transition disabled:opacity-50"
                  >
                    {changingPass ? 'Đang lưu...' : 'Lưu mật khẩu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
