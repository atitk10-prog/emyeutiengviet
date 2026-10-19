import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { MascotBird } from '../components/MascotBird';
import { VocabularyModal } from '../components/VocabularyModal';
import { AudioReader } from '../components/AudioReader';
import {
  LessonVersion,
  PublicQuestion,
  SKILL_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS
} from '@emytv/shared';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Star,
  BookOpen,
  Eye,
  Sparkles,
  HelpCircle,
  RotateCcw,
  Clock,
  AlertCircle
} from 'lucide-react';

export const StudentReview: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { studentSession } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState<any>(null);
  const [lessonVersion, setLessonVersion] = useState<LessonVersion | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [answerKey, setAnswerKey] = useState<Record<string, any> | null>(null);

  const [showPassage, setShowPassage] = useState(false);
  const [activeVocab, setActiveVocab] = useState<any>(null);

  useEffect(() => {
    if (!studentSession) {
      navigate('/student/join');
      return;
    }

    if (!attemptId) return;

    const fetchReviewData = async () => {
      setLoading(true);
      setError(null);
      try {
        const getReview = httpsCallable(functions, 'getAttemptReview');
        const res: any = await getReview({ attemptId });

        if (res.data?.success) {
          setAttempt(res.data.attempt);
          setLessonVersion(res.data.lessonVersion);
          setResponses(res.data.responses || {});
          setAnswerKey(res.data.answerKey || null);
        } else {
          setError('Không thể tải bài làm để xem lại.');
        }
      } catch (err: any) {
        console.error('Error fetching review:', err);
        setError(err.message || 'Không thể xem lại bài làm.');
      } finally {
        setLoading(false);
      }
    };

    fetchReviewData();
  }, [attemptId, studentSession]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4">
        <MascotBird mood="reading" speech="Đang mở lại bài làm cho em xem nhé..." size="md" />
        <div className="mt-4 text-sky-800 font-bold animate-pulse text-sm">
          Đang tải kết quả bài làm...
        </div>
      </div>
    );
  }

  if (error || !attempt || !lessonVersion) {
    return (
      <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-3xl shadow-lg border border-rose-200 text-center animate-fade-in">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-black text-slate-800 mb-2">Không thể xem lại bài làm</h3>
        <p className="text-sm text-slate-600 mb-6">{error || 'Không tìm thấy thông tin lượt làm bài.'}</p>
        <button
          onClick={() => navigate('/student/library')}
          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition cursor-pointer"
        >
          Quay lại thư viện bài đọc
        </button>
      </div>
    );
  }

  const questions = lessonVersion.publicQuestions || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/student/library')}
          className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-sky-600 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về thư viện bài đọc</span>
        </button>
      </div>

      {/* Summary Score Banner */}
      <div className="bg-gradient-to-r from-sky-500 via-primary-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-xs font-bold mb-2 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Xem Lại Bài Đã Hoàn Thành · Chế độ ôn tập</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black">
              {lessonVersion.title}
            </h1>
            <p className="text-sky-100 text-xs sm:text-sm font-semibold mt-1">
              Khối Lớp {lessonVersion.grade} · Chủ đề: {lessonVersion.topic}
            </p>
          </div>

          {/* Stars & Score badge */}
          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0">
            <div className="flex items-center justify-center gap-1 mb-1">
              {[1, 2, 3].map((s) => (
                <Star
                  key={s}
                  className={`w-6 h-6 ${
                    s <= (attempt.starsEarned || 0)
                      ? 'text-amber-300 fill-amber-300'
                      : 'text-white/40'
                  }`}
                />
              ))}
            </div>
            <div className="text-2xl font-black text-amber-300">
              {attempt.primaryScore ?? Number((((attempt.firstTryCorrectCount || 0) / (attempt.totalQuestions || 5)) * 10).toFixed(1))} / 10
            </div>
            <div className="text-[11px] text-sky-100 font-bold">
              Đúng lần đầu: {attempt.firstTryCorrectCount || 0}/{attempt.totalQuestions || 5} câu
            </div>
            <div className="text-[10px] text-emerald-200 font-bold mt-0.5">
              Sau gợi ý: {attempt.finalCorrectCount || 0}/{attempt.totalQuestions || 5} ({attempt.finalCorrectCount > attempt.firstTryCorrectCount ? `+${attempt.finalCorrectCount - attempt.firstTryCorrectCount} câu` : '0 câu'})
            </div>
          </div>
        </div>
      </div>

      {/* Reread Passage Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowPassage(!showPassage)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold rounded-2xl border border-amber-200 transition cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span>{showPassage ? 'Đóng bài đọc' : 'Xem lại nội dung bài đọc'}</span>
        </button>

        {showPassage && (
          <div className="mt-4 p-6 bg-white rounded-3xl border-2 border-amber-200 shadow-md animate-fade-in space-y-4">
            <h3 className="font-black text-slate-900 text-lg">{lessonVersion.title}</h3>
            <AudioReader
              text={lessonVersion.passage}
              title={lessonVersion.title}
              audioUrl={lessonVersion.audioUrl || (attempt as any)?.audioUrl}
              audioMetadata={lessonVersion.audioMetadata}
            />
            <p className="font-medium text-slate-800 text-base leading-relaxed whitespace-pre-line pt-2">
              {lessonVersion.passage}
            </p>
          </div>
        )}
      </div>

      {/* Review Each Question */}
      <div className="space-y-6 mb-8">
        {questions.map((q: PublicQuestion, idx: number) => {
          const resp = responses[q.id];
          const isFirstCorrect = resp?.firstTryCorrect;
          const isFinalCorrect = resp?.finalCorrect;
          const keyDetail = answerKey ? answerKey[q.id] : null;
          const correctAnswer = keyDetail?.correctAnswer ?? resp?.correctAnswerSent;
          const explanation = keyDetail?.explanation ?? resp?.explanationSent;

          return (
            <div
              key={q.id}
              className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border-2 transition ${
                isFinalCorrect
                  ? 'border-emerald-100 hover:border-emerald-200'
                  : 'border-rose-100 hover:border-rose-200'
              }`}
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-black rounded-full">
                    Câu {idx + 1} / {questions.length}
                  </span>
                  <span className="px-2.5 py-0.5 bg-sky-100 text-sky-800 text-xs font-bold rounded-lg">
                    {QUESTION_TYPE_LABELS[q.type] || 'Trắc nghiệm'}
                  </span>
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
                    {SKILL_LABELS[q.skillTag] || q.skillTag}
                  </span>
                </div>

                {isFinalCorrect ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {isFirstCorrect ? 'Đúng ngay lần 1' : 'Đúng sau gợi ý'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    Chưa chính xác
                  </span>
                )}
              </div>

              {/* Prompt */}
              <h4 className="text-base md:text-lg font-black text-slate-900 mb-4 leading-relaxed">
                {q.prompt}
              </h4>

              {/* Context if any */}
              {q.relatedPassagePart && (
                <div className="mb-4 p-3 bg-slate-50 border-l-4 border-sky-400 rounded-r-xl text-xs md:text-sm text-slate-600 italic">
                  "{q.relatedPassagePart}"
                </div>
              )}

              {/* Multiple Choice Review */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="space-y-2.5 mb-4">
                  {q.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isChosen = resp?.firstAnswer === letter || resp?.retryAnswer === letter;
                    const isCorrect = correctAnswer === letter;

                    let rowStyle = 'bg-slate-50 border border-slate-200 text-slate-700';
                    if (isCorrect) {
                      rowStyle = 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold';
                    } else if (isChosen && !isFinalCorrect) {
                      rowStyle = 'bg-rose-50 border-2 border-rose-400 text-rose-950';
                    }

                    return (
                      <div
                        key={letter}
                        className={`flex items-center gap-3 p-3 rounded-2xl text-sm ${rowStyle}`}
                      >
                        <span className="w-7 h-7 rounded-lg bg-white/80 font-black flex items-center justify-center shrink-0 text-xs border">
                          {letter}
                        </span>
                        <span className="flex-1 font-medium">{opt}</span>
                        {isCorrect && (
                          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                            Đáp án đúng
                          </span>
                        )}
                        {isChosen && !isCorrect && (
                          <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full shrink-0">
                            Em đã chọn
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* True/False Review */}
              {q.type === 'true_false' && (
                <div className="p-3 bg-slate-50 rounded-2xl mb-4 text-sm font-semibold space-y-1">
                  <div>
                    Em đã chọn:{' '}
                    <span className="font-black text-primary-700">
                      {resp?.firstAnswer === true || resp?.retryAnswer === true ? 'ĐÚNG' : 'SAI'}
                    </span>
                  </div>
                  <div>
                    Đáp án đúng:{' '}
                    <span className="font-black text-emerald-700">
                      {correctAnswer === true ? 'ĐÚNG' : 'SAI'}
                    </span>
                  </div>
                </div>
              )}

              {/* Sequence Review */}
              {q.type === 'sequence' && (
                <div className="space-y-2 mb-4 text-sm">
                  <div className="font-bold text-slate-500 text-xs uppercase">
                    Thứ tự chính xác:
                  </div>
                  {Array.isArray(correctAnswer || q.items) &&
                    (correctAnswer || q.items).map((item: string, sIdx: number) => (
                      <div
                        key={sIdx}
                        className="flex items-center gap-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl"
                      >
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {sIdx + 1}
                        </span>
                        <span className="font-medium text-emerald-950">{item}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Pedagogical Explanation */}
              {explanation && (
                <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl text-xs md:text-sm text-sky-950 font-medium leading-relaxed">
                  <span className="font-bold text-sky-800">Giải thích: </span>
                  {explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <button
          onClick={() => navigate('/student/library')}
          className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-2xl transition cursor-pointer"
        >
          Quay lại thư viện bài đọc
        </button>
      </div>

      <VocabularyModal item={activeVocab} onClose={() => setActiveVocab(null)} />
    </div>
  );
};
