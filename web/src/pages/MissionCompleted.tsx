import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { MascotBird } from '../components/MascotBird';
import { Star, Award, BookOpen, ArrowRight, RotateCcw, CheckCircle2, Sparkles } from 'lucide-react';

export const MissionCompleted: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const attempt = location.state?.attempt;
  const lessonVersion = location.state?.lessonVersion;

  useEffect(() => {
    // Launch celebratory confetti for primary school kids
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignore if confetti not supported
    }
  }, []);

  const stars = attempt?.starsEarned || 2;
  const firstTryCount = attempt?.firstTryCorrectCount ?? 0;
  const finalCount = attempt?.finalCorrectCount ?? 0;
  const total = attempt?.totalQuestions ?? 5;
  const fixedAfterHint = Math.max(0, finalCount - firstTryCount);
  const primaryScore = attempt?.primaryScore ?? Number(((firstTryCount / total) * 10).toFixed(1));
  const finalScore = attempt?.finalScore ?? Number(((finalCount / total) * 10).toFixed(1));
  const progressPP = Number(((fixedAfterHint / total) * 100).toFixed(1));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl border-4 border-amber-300 relative overflow-hidden">
        {/* Mascot */}
        <MascotBird
          mood="celebrating"
          speech="Chúc mừng em! Em đã làm bài rất chăm chỉ và xuất sắc!"
          size="lg"
          className="mb-4"
        />

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2">
          Thử Thách Hoàn Thành!
        </h1>
        <p className="text-sm sm:text-base font-bold text-slate-500 mb-6">
          {lessonVersion?.title || 'Bài đọc hiểu'}
        </p>

        {/* Big Glowing Stars Display */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[1, 2, 3].map((starIdx) => (
            <div
              key={starIdx}
              className={`transform transition-all duration-500 ${
                starIdx <= stars ? 'scale-110 animate-gentle-bounce' : 'opacity-30'
              }`}
            >
              <Star
                className={`w-14 h-14 sm:w-16 sm:h-16 ${
                  starIdx <= stars
                    ? 'text-amber-400 fill-amber-400 drop-shadow-lg'
                    : 'text-slate-300'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Score Tag */}
        <div className="inline-flex flex-col sm:flex-row items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-100 to-sky-100 border border-amber-200 rounded-2xl sm:rounded-full font-black text-slate-800 mb-8">
          <span className="text-base sm:text-lg">Điểm chính: <strong className="text-emerald-700 font-black text-xl">{primaryScore}/10</strong> · Sau gợi ý: <strong className="text-sky-700 font-black text-xl">{finalScore}/10</strong></span>
          <span className="flex items-center gap-1 text-sm bg-white/80 px-2.5 py-0.5 rounded-full border border-amber-300">
            <span>{stars} Sao Vàng</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400 inline" />
          </span>
        </div>

        {/* Pedagogical Breakdown Cards */}
        <div className="grid grid-cols-2 gap-4 text-left mb-8">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2 font-black text-emerald-800 text-sm mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đúng ngay lần đầu</span>
            </div>
            <div className="text-2xl font-black text-emerald-950">
              {firstTryCount} / {total} câu
            </div>
            <p className="text-xs text-emerald-700 font-semibold mt-1">
              Điểm luyện tập chính: {primaryScore}/10
            </p>
          </div>

          <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl">
            <div className="flex items-center gap-2 font-black text-sky-800 text-sm mb-1">
              <Sparkles className="w-4 h-4 text-sky-600" />
              <span>Sửa đúng sau gợi ý</span>
            </div>
            <div className="text-2xl font-black text-sky-950">
              +{fixedAfterHint} câu
            </div>
            <p className="text-xs text-sky-700 font-semibold mt-1">
              Tiến bộ: +{progressPP}% pp (Đạt {finalScore}/10)
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate('/student/library')}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-sky-500 to-primary-600 hover:from-sky-600 hover:to-primary-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
          >
            <BookOpen className="w-5 h-5" />
            <span>Về góc đọc sách</span>
          </button>
        </div>
      </div>
    </div>
  );
};
