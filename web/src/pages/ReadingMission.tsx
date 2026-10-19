import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { AudioReader } from '../components/AudioReader';
import { VocabularyModal } from '../components/VocabularyModal';
import { QuestionCard } from '../components/QuestionCard';
import { MascotBird } from '../components/MascotBird';
import {
  LessonVersion,
  VocabularyItem,
  PublicQuestion,
  SubmitAnswerResponse
} from '@emytv/shared';
import {
  BookOpen,
  ArrowLeft,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ArrowRight,
  Volume2,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '../utils/soundEffects';

export const ReadingMission: React.FC = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { studentSession } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [lessonVersion, setLessonVersion] = useState<LessonVersion | null>(null);

  // Reading phase: 'reading' (passage) | 'challenges' (single-question game)
  const [phase, setPhase] = useState<'reading' | 'challenges'>('reading');

  // Single question presentation index
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);

  // Font size control for primary readers: 'base' | 'lg' | 'xl' | '2xl'
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl' | '2xl'>('xl');

  // Selected vocabulary word for popup
  const [activeVocab, setActiveVocab] = useState<VocabularyItem | null>(null);

  // Recorded responses for questions: map questionId -> response
  const [responsesMap, setResponsesMap] = useState<Record<string, any>>({});
  const [finishing, setFinishing] = useState(false);
  const [showPassageSide, setShowPassageSide] = useState(false);

  // Sound preference state
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  useEffect(() => {
    if (!studentSession) {
      navigate('/student/join');
      return;
    }

    if (!assignmentId) return;

    const initMission = async () => {
      setLoading(true);
      setError(null);
      try {
        const startFunc = httpsCallable(functions, 'startAttempt');
        const res: any = await startFunc({ assignmentId });

        setAttemptId(res.data.attemptId);
        setAssignment(res.data.assignment);
        setLessonVersion(res.data.lessonVersion);

        // If resumed attempt with existing responses, restore them
        if (res.data.existingResponses && Object.keys(res.data.existingResponses).length > 0) {
          setResponsesMap(res.data.existingResponses);

          // Find first unanswered question
          const questions = res.data.lessonVersion?.publicQuestions || [];
          const answeredKeys = Object.keys(res.data.existingResponses);
          const firstUnanswered = questions.findIndex(
            (q: PublicQuestion) =>
              !answeredKeys.includes(q.id) ||
              (!res.data.existingResponses[q.id].firstTryCorrect &&
                res.data.existingResponses[q.id].retryAnswer === undefined)
          );

          if (firstUnanswered !== -1) {
            setCurrentQuestionIdx(firstUnanswered);
          }
          setPhase('challenges');
        }
      } catch (err: any) {
        console.error('Error starting attempt:', err);
        setError(err.message || 'Không thể bắt đầu lượt làm bài.');
      } finally {
        setLoading(false);
      }
    };

    initMission();
  }, [assignmentId, studentSession]);

  const handleToggleSound = () => {
    const nextVal = !soundOn;
    setSoundOn(nextVal);
    setSoundEnabled(nextVal);
  };

  const handleAnswerSubmit = async (
    questionId: string,
    answer: any,
    subPhase: 'first_try' | 'retry',
    isFirstTry: boolean
  ): Promise<SubmitAnswerResponse> => {
    if (!attemptId) throw new Error('Chưa có mã lượt làm bài.');

    const submitFunc = httpsCallable(functions, 'submitAnswer');
    const res: any = await submitFunc({
      attemptId,
      questionId,
      answer,
      phase: subPhase,
      requestId: `${attemptId}_${questionId}_${subPhase}_${Date.now()}`
    });

    // Record response in local state
    setResponsesMap((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [subPhase === 'first_try' ? 'firstAnswer' : 'retryAnswer']: answer,
        finalCorrect: res.data.correct,
        firstTryCorrect: isFirstTry ? res.data.correct : prev[questionId]?.firstTryCorrect,
        hintSent: res.data.hint,
        explanationSent: res.data.explanation,
        correctAnswerSent: res.data.correctAnswer
      }
    }));

    return res.data;
  };

  const handleNextQuestion = () => {
    const total = (lessonVersion?.publicQuestions || []).length;
    if (currentQuestionIdx < total - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleFinishAttempt = async () => {
    if (!attemptId || finishing) return;

    setFinishing(true);
    try {
      const finishFunc = httpsCallable(functions, 'finishAttempt');
      const res: any = await finishFunc({
        attemptId,
        idempotencyKey: `finish_${attemptId}`
      });

      if (res.data?.success) {
        navigate(`/student/completed/${attemptId}`, {
          state: {
            attempt: res.data.attempt,
            lessonVersion
          }
        });
      }
    } catch (err: any) {
      alert('Lỗi khi chốt bài nộp: ' + err.message);
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-4">
        <MascotBird mood="reading" speech="Đang mở trang sách cho em nhé..." size="md" />
        <div className="mt-4 text-sky-800 font-bold animate-pulse text-sm">
          Đang tải nội dung bài đọc...
        </div>
      </div>
    );
  }

  if (error || !lessonVersion) {
    return (
      <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-3xl shadow-lg border border-rose-200 text-center animate-fade-in">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-black text-slate-800 mb-2">Thông báo bài học</h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {error || 'Bài học không tìm thấy.'}
        </p>
        <button
          onClick={() => navigate('/student/library')}
          className="px-6 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl transition cursor-pointer"
        >
          Quay lại danh sách bài
        </button>
      </div>
    );
  }

  const fontClasses = {
    base: 'text-base leading-relaxed',
    lg: 'text-lg md:text-xl leading-loose',
    xl: 'text-xl md:text-2xl leading-loose',
    '2xl': 'text-2xl md:text-3xl leading-loose'
  };

  // Helper to render passage with clickable vocabulary
  const renderPassageWithVocabulary = (passage: string, vocab: VocabularyItem[]) => {
    if (!vocab || vocab.length === 0) {
      return <p className="whitespace-pre-line">{passage}</p>;
    }

    const words = vocab.map((v) => v.word.trim()).filter(Boolean);
    if (words.length === 0) return <p className="whitespace-pre-line">{passage}</p>;

    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = passage.split(regex);

    return (
      <p className="whitespace-pre-line">
        {parts.map((part, idx) => {
          const matchedItem = vocab.find((v) => v.word.toLowerCase() === part.toLowerCase());
          if (matchedItem) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveVocab(matchedItem)}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black rounded-lg border-b-2 border-amber-400 transition transform hover:scale-105 active:scale-95 cursor-pointer underline decoration-amber-400 decoration-wavy"
                title="Bấm để xem giải nghĩa từ"
              >
                <span>{part}</span>
                <Sparkles className="w-3 h-3 text-amber-500 inline shrink-0" />
              </button>
            );
          }
          return <span key={idx}>{part}</span>;
        })}
      </p>
    );
  };

  const publicQuestions = lessonVersion.publicQuestions || [];
  const totalQuestions = publicQuestions.length;
  const currentQuestion = publicQuestions[currentQuestionIdx];
  const answeredQuestionsCount = Object.keys(responsesMap).filter(
    (k) => responsesMap[k]?.firstTryCorrect || responsesMap[k]?.retryAnswer !== undefined
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Bar: Back, Phase Switcher & Sound Toggle */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button
          onClick={() => navigate('/student/library')}
          className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-slate-500 hover:text-sky-600 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về thư viện</span>
        </button>

        {/* Phase Toggle & Sound */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              soundOn
                ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
            }`}
            title={soundOn ? 'Đang bật âm thanh (Bấm để tắt)' : 'Đang tắt âm thanh (Bấm để bật)'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Phase Switcher */}
          <div className="flex items-center gap-1 bg-sky-100/70 p-1 rounded-2xl">
            <button
              onClick={() => setPhase('reading')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs md:text-sm transition cursor-pointer ${
                phase === 'reading' ? 'bg-white text-sky-950 shadow-sm' : 'text-sky-700 hover:text-sky-950'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>1. Đọc bài</span>
            </button>
            <button
              onClick={() => setPhase('challenges')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs md:text-sm transition cursor-pointer ${
                phase === 'challenges' ? 'bg-white text-sky-950 shadow-sm' : 'text-sky-700 hover:text-sky-950'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>2. Thử thách ({answeredQuestionsCount}/{totalQuestions})</span>
            </button>
          </div>
        </div>
      </div>

      {/* PHASE 1: PASSAGE READING */}
      {phase === 'reading' && (
        <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border-2 border-sky-100 animate-fade-in">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-6">
            <span className="px-3.5 py-1 bg-sky-100 text-sky-800 font-extrabold text-xs rounded-full uppercase tracking-wider">
              Lớp {lessonVersion.grade} · {lessonVersion.topic}
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mt-2.5 mb-2">
              {lessonVersion.title}
            </h1>
          </div>

          {/* Audio & Font size controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
            <AudioReader
              text={lessonVersion.passage}
              title={lessonVersion.title}
              audioUrl={lessonVersion.audioUrl || assignment?.audioUrl}
              audioMetadata={lessonVersion.audioMetadata || assignment?.audioMetadata}
            />

            {/* Font size picker */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 shrink-0">
              <Sliders className="w-4 h-4 text-slate-400" />
              <span>Cỡ chữ:</span>
              {(['base', 'lg', 'xl', '2xl'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`w-7 h-7 rounded-lg font-black transition cursor-pointer ${
                    fontSize === s ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s === 'base' ? 'A' : s === 'lg' ? 'A+' : s === 'xl' ? 'A++' : 'A+++'}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Passage Body */}
          <div
            className={`font-semibold text-slate-800 ${fontClasses[fontSize]} bg-amber-50/20 p-6 md:p-8 rounded-2xl border border-amber-100/50 mb-8 select-text`}
          >
            {renderPassageWithVocabulary(lessonVersion.passage, lessonVersion.vocabulary)}
          </div>

          {/* Vocabulary hint */}
          {lessonVersion.vocabulary && lessonVersion.vocabulary.length > 0 && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs md:text-sm text-amber-900 font-bold">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
              <span>Mẹo nhỏ: Bấm vào những từ màu vàng có gợn sóng để xem cô giải thích nghĩa từ khó nhé!</span>
            </div>
          )}

          {/* Ready to challenge button */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                setPhase('challenges');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-8 py-4 bg-gradient-to-r from-amber-400 via-primary-500 to-sky-600 hover:from-amber-500 hover:to-sky-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-95 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Em đã đọc xong – Bắt đầu thử thách!</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: QUESTIONS & STEP-BY-STEP COMPREHENSION CHALLENGES */}
      {phase === 'challenges' && (
        <div className="space-y-4 animate-fade-in">
          {/* Progress Bar & Passage Reread Drawer Header */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-sky-100 flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
                <span>Câu {currentQuestionIdx + 1} / {totalQuestions}</span>
                <span>{Math.round(((currentQuestionIdx + 1) / totalQuestions) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-400 to-primary-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentQuestionIdx + 1) / totalQuestions) * 100}%` }}
                />
              </div>
            </div>

            {/* Quick Passage Reread Toggle Button */}
            <button
              onClick={() => setShowPassageSide(!showPassageSide)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold rounded-xl text-xs md:text-sm border border-amber-200 transition shrink-0 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-600" />
              <span>{showPassageSide ? 'Đóng bài đọc' : 'Xem lại bài đọc'}</span>
            </button>
          </div>

          {/* Quick Passage Accordion (Does NOT reset question state!) */}
          {showPassageSide && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 shadow-md animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  Bài đọc: {lessonVersion.title}
                </span>
                <button
                  onClick={() => setShowPassageSide(false)}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Thu gọn
                </button>
              </div>
              <div className="font-medium text-slate-800 text-sm md:text-base leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto pr-2">
                {renderPassageWithVocabulary(lessonVersion.passage, lessonVersion.vocabulary)}
              </div>
            </div>
          )}

          {/* Single Question Card */}
          {currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              index={currentQuestionIdx}
              total={totalQuestions}
              attemptId={attemptId!}
              onAnswerSubmitted={handleAnswerSubmit}
              existingResponse={responsesMap[currentQuestion.id]}
              onNextQuestion={handleNextQuestion}
              isLastQuestion={currentQuestionIdx === totalQuestions - 1}
              onFinishMission={handleFinishAttempt}
            />
          )}

          {/* Stepper Dots for Quick Navigation to Answered Questions */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {publicQuestions.map((q, idx) => {
              const resp = responsesMap[q.id];
              const isAnswered = Boolean(resp?.firstTryCorrect || resp?.retryAnswer !== undefined);
              const isCurrent = idx === currentQuestionIdx;

              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-8 h-8 rounded-full font-black text-xs transition cursor-pointer flex items-center justify-center ${
                    isCurrent
                      ? 'bg-primary-600 text-white ring-4 ring-primary-200'
                      : isAnswered
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                  title={`Câu ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vocabulary Modal Popup */}
      <VocabularyModal item={activeVocab} onClose={() => setActiveVocab(null)} />
    </div>
  );
};
