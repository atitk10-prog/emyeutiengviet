import React from 'react';
import { Link } from 'react-router-dom';
import { MascotBird } from '../components/MascotBird';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Sparkles,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  Headphones,
  CheckCircle2,
  GraduationCap,
  BookOpenCheck,
  Lightbulb,
  Layers
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { studentSession, isTeacher } = useAuth();

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col justify-between">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-14 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Headlines & Call to Action */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-sky-100 text-sky-800 rounded-full font-bold text-xs md:text-sm">
              <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Ứng dụng AI nâng cao năng lực đọc hiểu Tiếng Việt Lớp 2–3</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tight">
              Mỗi ngày một câu chuyện,{' '}
              <span className="bg-gradient-to-r from-primary-600 via-sky-500 to-amber-500 bg-clip-text text-transparent">
                mỗi ngày thêm yêu tiếng Việt
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Không gian đọc sách tương tác vui nhộn, hấp dẫn dành riêng cho học sinh tiểu học. Giúp các em mở rộng vốn từ, rèn luyện kỹ năng đọc hiểu và phát triển tư duy ngôn ngữ một cách tự nhiên.
            </p>

            {/* Role Gateway Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-xl mx-auto lg:mx-0">
              {/* Student Card */}
              <Link
                to={studentSession ? '/student/library' : '/student/join'}
                className="group p-5 bg-gradient-to-br from-sky-500 to-primary-600 rounded-3xl text-white shadow-lg shadow-sky-500/20 hover:shadow-xl hover:shadow-sky-500/30 transition-all transform hover:-translate-y-1 text-left flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm">
                    <GraduationCap className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-black">Em là Học sinh</h2>
                  <p className="text-sky-100 text-xs font-semibold mt-1">
                    Nhập mã lớp và mã riêng để vào đọc sách và thử thách.
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-between font-bold text-xs md:text-sm bg-white/15 px-3.5 py-2.5 rounded-xl group-hover:bg-white/25 transition">
                  <span>{studentSession ? 'Vào góc đọc sách' : 'Bắt đầu học ngay'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Teacher Card */}
              <Link
                to={isTeacher ? '/teacher/dashboard' : '/teacher/login'}
                className="group p-5 bg-white border-2 border-slate-200 rounded-3xl text-slate-800 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all transform hover:-translate-y-1 text-left flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                    <BookOpenCheck className="w-7 h-7 text-emerald-700" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Tôi là Giáo viên</h2>
                  <p className="text-slate-500 text-xs font-semibold mt-1">
                    Quản lý lớp, tạo bài AI chuẩn sư phạm, theo dõi tiến bộ.
                  </p>
                </div>
                <div className="mt-5 flex items-center justify-between font-bold text-xs md:text-sm text-emerald-700 bg-emerald-50 px-3.5 py-2.5 rounded-xl group-hover:bg-emerald-100 transition">
                  <span>{isTeacher ? 'Vào bảng điều khiển' : 'Đăng nhập giáo viên'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>

            {/* Admin entry link */}
            <div className="pt-2 text-center lg:text-left">
              <span className="text-xs font-semibold text-slate-500">
                Thầy cô Ban giám hiệu / Quản trị viên nhà trường?{' '}
                <Link
                  to="/admin/login"
                  className="font-extrabold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đăng nhập Cổng Quản Trị &rarr;</span>
                </Link>
              </span>
            </div>
          </div>

          {/* Right Column: Mascot & Key Highlights */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative">
              {/* Soft background glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-sky-200/70 to-amber-200/60 rounded-full blur-2xl transform scale-110 pointer-events-none"></div>

              {/* Mascot Bird */}
              <div className="relative z-10 flex flex-col items-center">
                <MascotBird
                  mood="happy"
                  speech="Chào bạn nhỏ! Cùng tớ khám phá những câu chuyện kỳ thú nhé!"
                  size="lg"
                />
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2 p-3 bg-white/90 rounded-2xl border border-sky-100 shadow-sm">
                <Headphones className="w-4 h-4 text-sky-500 shrink-0" />
                <span>Giọng đọc mẫu chuẩn</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/90 rounded-2xl border border-sky-100 shadow-sm">
                <BrainCircuit className="w-4 h-4 text-amber-500 shrink-0" />
                <span>AI tạo bài chuẩn mực</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/90 rounded-2xl border border-sky-100 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Gợi ý sư phạm tức thời</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/90 rounded-2xl border border-sky-100 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-primary-500 shrink-0" />
                <span>Bảo mật đáp án máy chủ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Reading Experience Journey */}
      <section className="bg-gradient-to-b from-sky-50/50 to-white py-12 md:py-16 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black text-sky-600 uppercase tracking-widest bg-sky-100 px-3 py-1 rounded-full">
              Quy Trình Sư Phạm
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">
              Hành Trình 3 Bước Rèn Luyện Đọc Hiểu
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-2">
              Được thiết kế khoa học, trực quan, hỗ trợ từng bước giúp học sinh tiểu học tự tin chinh phục từng bài đọc.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-sky-600" />
                </div>
                <div className="text-xs font-black text-sky-600 uppercase tracking-wider">Bước 1</div>
                <h4 className="text-lg font-black text-slate-900 mt-1">Chọn câu chuyện kỳ thú</h4>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
                  Kho bài đọc phong phú phân loại theo Khối 2 và 3, chủ đề gần gũi như thiên nhiên, tình cảm gia đình, bạn bè và trường lớp.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] font-bold text-sky-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Nội dung đã được duyệt sư phạm</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                  <Headphones className="w-6 h-6 text-amber-600" />
                </div>
                <div className="text-xs font-black text-amber-600 uppercase tracking-wider">Bước 2</div>
                <h4 className="text-lg font-black text-slate-900 mt-1">Đọc và khám phá từ mới</h4>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
                  Học sinh luyện đọc diễn cảm, bấm nghe giọng đọc mẫu và tra cứu giải nghĩa từ khó một chạm kèm ví dụ trực quan.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Tùy chỉnh cỡ chữ & giọng đọc mẫu</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                  <Layers className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="text-xs font-black text-emerald-600 uppercase tracking-wider">Bước 3</div>
                <h4 className="text-lg font-black text-slate-900 mt-1">Vượt thử thách & Nhận gợi ý</h4>
                <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed">
                  Thực hiện 3 dạng câu hỏi tương tác: Trắc nghiệm, Đúng/Sai, Sắp xếp sự việc. Nhận gợi ý sư phạm khi trả lời chưa chính xác.
                </p>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tích lũy sao vàng & tổng kết tiến bộ</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-6 text-center text-xs text-slate-500 font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>EM YÊU TIẾNG VIỆT © 2026 · Đề tài nghiên cứu ứng dụng AI trong giáo dục tiểu học</span>
          <span className="text-slate-400">Dữ liệu lưu trữ an toàn trên Google Firebase Firestore</span>
        </div>
      </footer>
    </div>
  );
};
