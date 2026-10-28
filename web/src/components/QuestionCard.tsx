import React, { useState, useEffect } from 'react';
import {
  PublicQuestion,
  SubmitAnswerResponse,
  SKILL_LABELS,
  DIFFICULTY_LABELS,
  QUESTION_TYPE_LABELS,
  cleanOptionText,
  normalizeMcqAnswerToIndex
} from '@emytv/shared';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Lightbulb,
  Send,
  ArrowRight,
  Check,
  AlertTriangle,
  Link2,
  X,
  GripVertical,
  Edit3
} from 'lucide-react';
import { playCorrectSound, playWrongSound } from '../utils/soundEffects';

interface QuestionCardProps {
  question: PublicQuestion;
  index: number;
  total: number;
  attemptId: string;
  onAnswerSubmitted: (
    questionId: string,
    answer: any,
    phase: 'first_try' | 'retry',
    isFirstTry: boolean
  ) => Promise<SubmitAnswerResponse>;
  existingResponse?: any;
  onNextQuestion: () => void;
  isLastQuestion: boolean;
  onFinishMission: () => void;
  onSkipQuestion?: (questionId: string) => void;
}

// Distinctive color themes for matching pairs
const PAIR_COLORS = [
  { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-800', badge: 'bg-sky-500' },
  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', badge: 'bg-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', badge: 'bg-emerald-500' },
  { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800', badge: 'bg-purple-500' },
  { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-800', badge: 'bg-rose-500' }
];

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  total,
  attemptId,
  onAnswerSubmitted,
  existingResponse,
  onNextQuestion,
  isLastQuestion,
  onFinishMission,
  onSkipQuestion
}) => {
  // Gate 3: Check if question is corrupted
  const isCorrupted =
    (question.type === 'sequence' && (!question.items || question.items.length < 2)) ||
    (question.type === 'multiple_choice' && (!question.options || question.options.length < 2)) ||
    (question.type === 'matching' && (!question.leftItems || question.leftItems.length < 2 || !question.rightItems || question.rightItems.length < 2)) ||
    (question.type === 'fill_blank' && !question.prompt && !question.blankContext);

  // Current user selection
  const [selectedAnswer, setSelectedAnswer] = useState<any>(() => {
    if (existingResponse) {
      return existingResponse.retryAnswer !== undefined
        ? existingResponse.retryAnswer
        : existingResponse.firstAnswer;
    }
    if (question.type === 'sequence') {
      return [...(question.items || [])];
    }
    if (question.type === 'matching') {
      return {};
    }
    if (question.type === 'fill_blank') {
      return '';
    }
    return null;
  });

  // State for tap-to-match & touch interaction (Matching question)
  const [activeLeftItem, setActiveLeftItem] = useState<string | null>(null);
  const [activeRightItem, setActiveRightItem] = useState<string | null>(null);
  const [shuffledRightItems, setShuffledRightItems] = useState<string[]>(() => {
    if (question.type === 'matching' && question.rightItems && question.rightItems.length > 1) {
      return [...question.rightItems.slice(1), question.rightItems[0]];
    }
    return question.rightItems || [];
  });

  // Drag and drop state for Sequence
  const [draggedSeqIdx, setDraggedSeqIdx] = useState<number | null>(null);

  const [phase, setPhase] = useState<'first_try' | 'retry'>(() => {
    if (existingResponse) {
      if (existingResponse.firstTryCorrect || existingResponse.retryAnswer !== undefined) {
        return 'retry'; // Completed
      }
      return 'retry'; // Allowed retry
    }
    return 'first_try';
  });

  const [result, setResult] = useState<SubmitAnswerResponse | null>(() => {
    if (existingResponse) {
      return {
        correct: existingResponse.finalCorrect,
        isFirstTry: !existingResponse.retryAnswer,
        canRetry: !existingResponse.firstTryCorrect && existingResponse.retryAnswer === undefined,
        hint: existingResponse.hintSent,
        explanation: existingResponse.explanationSent,
        correctAnswer: existingResponse.correctAnswerSent
      };
    }
    return null;
  });

  const [submitting, setSubmitting] = useState(false);
  const [showHintBox, setShowHintBox] = useState(false);

  // Sync state if question or existingResponse changes
  useEffect(() => {
    if (existingResponse) {
      setSelectedAnswer(
        existingResponse.retryAnswer !== undefined
          ? existingResponse.retryAnswer
          : existingResponse.firstAnswer
      );
      setResult({
        correct: existingResponse.finalCorrect,
        isFirstTry: !existingResponse.retryAnswer,
        canRetry: !existingResponse.firstTryCorrect && existingResponse.retryAnswer === undefined,
        hint: existingResponse.hintSent,
        explanation: existingResponse.explanationSent,
        correctAnswer: existingResponse.correctAnswerSent
      });
      if (existingResponse.hintSent && !existingResponse.firstTryCorrect && existingResponse.retryAnswer === undefined) {
        setShowHintBox(true);
        setPhase('retry');
      } else {
        setShowHintBox(false);
      }
    } else {
      setSelectedAnswer(
        question.type === 'sequence'
          ? [...(question.items || [])]
          : question.type === 'matching'
          ? {}
          : question.type === 'fill_blank'
          ? ''
          : null
      );
      setPhase('first_try');
      setResult(null);
      setShowHintBox(false);
      setActiveLeftItem(null);
      setActiveRightItem(null);
      if (question.type === 'matching' && question.rightItems && question.rightItems.length > 1) {
        setShuffledRightItems([...question.rightItems.slice(1), question.rightItems[0]]);
      } else {
        setShuffledRightItems(question.rightItems || []);
      }
    }
  }, [question.id, existingResponse]);

  // Validation: whether student has made a valid selection
  const hasValidSelection = (): boolean => {
    if (question.type === 'multiple_choice') {
      return typeof selectedAnswer === 'string' && selectedAnswer.trim().length > 0;
    }
    if (question.type === 'true_false') {
      return typeof selectedAnswer === 'boolean';
    }
    if (question.type === 'sequence') {
      return Array.isArray(selectedAnswer) && selectedAnswer.length === (question.items?.length || 3);
    }
    if (question.type === 'matching') {
      const leftCount = question.leftItems?.length || 0;
      if (!selectedAnswer || typeof selectedAnswer !== 'object') return false;
      return leftCount > 0 && Object.keys(selectedAnswer).length === leftCount;
    }
    if (question.type === 'fill_blank') {
      return typeof selectedAnswer === 'string' && selectedAnswer.trim().length > 0;
    }
    return selectedAnswer !== null && selectedAnswer !== undefined;
  };

  const isCompleted: boolean = Boolean(
    result && (!result.canRetry || (phase === 'retry' && result.explanation !== undefined && !result.canRetry))
  );

  const handleSubmit = async () => {
    if (!hasValidSelection() || submitting || isCompleted) return;

    setSubmitting(true);
    try {
      const response = await onAnswerSubmitted(
        question.id,
        selectedAnswer,
        phase,
        phase === 'first_try'
      );
      setResult(response);

      if (response.correct) {
        playCorrectSound();
        setShowHintBox(false);
      } else if (response.canRetry) {
        playWrongSound();
        setShowHintBox(true);
        setPhase('retry');
      } else {
        playWrongSound();
        setShowHintBox(false);
      }
    } catch (err: any) {
      alert('Có lỗi khi gửi bài chấm: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Move item in sequence via buttons
  const moveSequenceItem = (fromIndex: number, toIndex: number) => {
    if (isCompleted || (result && !result.canRetry)) return;
    const items = [...selectedAnswer];
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    setSelectedAnswer(items);
  };

  // Drag and drop for sequence
  const handleSeqDragStart = (idx: number) => {
    if (isCompleted) return;
    setDraggedSeqIdx(idx);
  };

  const handleSeqDrop = (targetIdx: number) => {
    if (isCompleted || draggedSeqIdx === null || draggedSeqIdx === targetIdx) return;
    moveSequenceItem(draggedSeqIdx, targetIdx);
    setDraggedSeqIdx(null);
  };

  // Matching handler: pair a left item with a right item
  const handlePairItems = (left: string, right: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    const current = { ...(selectedAnswer || {}) };
    // Clear any previous pair involving this left or right item to prevent duplicates
    Object.keys(current).forEach((k) => {
      if (k === left || current[k] === right) {
        delete current[k];
      }
    });
    current[left] = right;
    setSelectedAnswer(current);
    setActiveLeftItem(null);
    setActiveRightItem(null);
  };

  // Unpair a matching pair by left item
  const handleUnpairLeft = (left: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    const current = { ...(selectedAnswer || {}) };
    delete current[left];
    setSelectedAnswer(current);
  };

  // Unpair a matching pair by right item
  const handleUnpairRight = (right: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    const current = { ...(selectedAnswer || {}) };
    Object.keys(current).forEach((k) => {
      if (current[k] === right) delete current[k];
    });
    setSelectedAnswer(current);
  };

  // Reset all matching pairs
  const handleResetMatching = () => {
    if (isCompleted || (result && !result.canRetry)) return;
    setSelectedAnswer({});
    setActiveLeftItem(null);
    setActiveRightItem(null);
  };

  // Tap-to-match handler for Left item
  const handleTapLeft = (leftText: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    if (activeRightItem) {
      handlePairItems(leftText, activeRightItem);
    } else {
      setActiveLeftItem(activeLeftItem === leftText ? null : leftText);
      setActiveRightItem(null);
    }
  };

  // Tap-to-match handler for Right item
  const handleTapRight = (rightText: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    if (activeLeftItem) {
      handlePairItems(activeLeftItem, rightText);
    } else {
      setActiveRightItem(activeRightItem === rightText ? null : rightText);
      setActiveLeftItem(null);
    }
  };

  // Touch drag end handler for mobile devices
  const handleTouchEndMatching = (e: React.TouchEvent, sourceSide: 'left' | 'right', sourceText: string) => {
    if (isCompleted || (result && !result.canRetry)) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCard = elem?.closest('[data-matching-card]');
    if (targetCard) {
      const targetSide = targetCard.getAttribute('data-side');
      const targetText = targetCard.getAttribute('data-text');
      if (targetSide && targetText && targetSide !== sourceSide) {
        if (sourceSide === 'left') {
          handlePairItems(sourceText, targetText);
        } else {
          handlePairItems(targetText, sourceText);
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-md border-2 border-sky-100 transition-all flex flex-col justify-between min-h-[480px]">
      <div>
        {/* Question Header & Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-primary-100 text-primary-800 text-xs md:text-sm font-extrabold rounded-full">
              Nhiệm vụ {index + 1} / {total}
            </span>
            <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-lg">
              {QUESTION_TYPE_LABELS[question.type] || 'Đọc hiểu'}
            </span>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg">
              {SKILL_LABELS[question.skillTag] || question.skillTag}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            Mức độ: {DIFFICULTY_LABELS[question.difficulty]}
          </span>
        </div>

        {/* Prompt */}
        <h3 className="text-lg md:text-xl font-black text-slate-800 mb-5 leading-relaxed">
          {question.prompt}
        </h3>

        {/* Context quote if present */}
        {question.relatedPassagePart && (
          <div className="mb-5 p-3.5 bg-slate-50 border-l-4 border-sky-400 rounded-r-xl text-xs md:text-sm text-slate-600 italic">
            "{question.relatedPassagePart}"
          </div>
        )}

        {/* 1. Multiple Choice (A/B/C) */}
        {question.type === 'multiple_choice' && question.options && (
          <div className="grid grid-cols-1 gap-3 mb-6">
            {question.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              const cleanOpt = cleanOptionText(opt);
              const isSelected = selectedAnswer === letter;
              const correctIdx = result?.correctAnswer !== undefined ? normalizeMcqAnswerToIndex(result.correctAnswer, question.options) : null;
              const isCorrectAnswer = correctIdx !== null ? correctIdx === i : result?.correctAnswer === letter;

              let buttonStyle = 'bg-white border-2 border-slate-200 text-slate-700 hover:border-sky-400 hover:bg-sky-50/50';
              let badgeStyle = 'bg-slate-100 text-slate-700';

              if (isSelected) {
                buttonStyle = 'bg-sky-50 border-2 border-primary-500 text-primary-900 shadow-sm';
                badgeStyle = 'bg-primary-500 text-white';
              }

              if (isCompleted) {
                if (isCorrectAnswer) {
                  buttonStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold';
                  badgeStyle = 'bg-emerald-500 text-white';
                } else if (isSelected && !result?.correct) {
                  buttonStyle = 'bg-rose-50 border-rose-400 text-rose-900 opacity-80';
                  badgeStyle = 'bg-rose-500 text-white';
                }
              }

              return (
                <button
                  key={letter}
                  type="button"
                  disabled={isCompleted || submitting}
                  onClick={() => setSelectedAnswer(letter)}
                  className={`flex items-center gap-4 p-3.5 md:p-4 rounded-2xl text-left transition-all active:scale-[0.99] cursor-pointer ${buttonStyle}`}
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 transition-colors ${badgeStyle}`}
                  >
                    {letter}
                  </span>
                  <span className="font-semibold text-base md:text-lg flex-1">
                    {cleanOpt}
                  </span>
                  {isCompleted && isCorrectAnswer && (
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  )}
                  {isCompleted && isSelected && !result?.correct && (
                    <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 2. True / False */}
        {question.type === 'true_false' && (
          <div className="space-y-4 mb-6">
            {question.statement && (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl text-base md:text-lg font-bold text-slate-800 text-center">
                "{question.statement}"
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                disabled={isCompleted || submitting}
                onClick={() => setSelectedAnswer(true)}
                className={`p-4 md:p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 font-black text-lg transition active:scale-95 cursor-pointer ${
                  selectedAnswer === true
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-md ring-2 ring-emerald-300'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30'
                } ${isCompleted && result?.correctAnswer === true ? 'bg-emerald-100 border-emerald-600' : ''}`}
              >
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                <span>ĐÚNG</span>
              </button>

              <button
                type="button"
                disabled={isCompleted || submitting}
                onClick={() => setSelectedAnswer(false)}
                className={`p-4 md:p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 font-black text-lg transition active:scale-95 cursor-pointer ${
                  selectedAnswer === false
                    ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-md ring-2 ring-rose-300'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:bg-rose-50/30'
                } ${isCompleted && result?.correctAnswer === false ? 'bg-rose-100 border-rose-600' : ''}`}
              >
                <XCircle className="w-7 h-7 text-rose-500" />
                <span>SAI</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Sequence (Drag & Drop + Up/Down Buttons) */}
        {question.type === 'sequence' && !isCorrupted && Array.isArray(selectedAnswer) && (
          <div className="space-y-3 mb-6">
            <p className="text-xs md:text-sm font-semibold text-slate-500 italic flex items-center gap-1.5">
              <GripVertical className="w-4 h-4 text-sky-500" />
              <span>Kéo thả để đổi thứ tự, hoặc dùng các nút mũi tên Lên / Xuống:</span>
            </p>
            {selectedAnswer.map((item: string, idx: number) => (
              <div
                key={idx}
                draggable={!isCompleted}
                onDragStart={() => handleSeqDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleSeqDrop(idx)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition ${
                  draggedSeqIdx === idx
                    ? 'opacity-40 border-dashed border-primary-500'
                    : isCompleted
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-white border-sky-200 hover:border-sky-400 shadow-sm cursor-grab active:cursor-grabbing'
                }`}
              >
                <GripVertical className="w-4 h-4 text-slate-300 shrink-0 hidden md:block" />
                <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 font-black text-sm flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-sm md:text-base flex-1 text-slate-800">
                  {item}
                </span>

                {!isCompleted && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || submitting}
                      onClick={() => moveSequenceItem(idx, idx - 1)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Di chuyển lên"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === selectedAnswer.length - 1 || submitting}
                      onClick={() => moveSequenceItem(idx, idx + 1)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-sky-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Di chuyển xuống"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 4. Matching (Ghép đôi kéo thả + chạm/click để ghép) */}
        {question.type === 'matching' && !isCorrupted && question.leftItems && question.rightItems && (
          <div className="space-y-4 mb-6">
            <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-2xl flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs md:text-sm text-sky-900 font-semibold">
                <Link2 className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Kéo thả hoặc chạm chọn từ <strong>Cột A</strong> rồi chọn ô tương ứng ở <strong>Cột B</strong> để ghép đôi:</span>
              </div>
              {!isCompleted && selectedAnswer && Object.keys(selectedAnswer).length > 0 && (
                <button
                  type="button"
                  onClick={handleResetMatching}
                  className="px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Làm lại tất cả cặp</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column (Cột A) */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Cột A (Từ ngữ / Sự việc)
                </span>
                {question.leftItems.map((leftText, lIdx) => {
                  const pairedRight = selectedAnswer?.[leftText];
                  const isPaired = Boolean(pairedRight);
                  const isActive = activeLeftItem === leftText;
                  const isTargetForRight = Boolean(activeRightItem);
                  const colorTheme = isPaired ? PAIR_COLORS[lIdx % PAIR_COLORS.length] : null;

                  return (
                    <div
                      key={lIdx}
                      data-matching-card="true"
                      data-side="left"
                      data-text={leftText}
                      draggable={!isCompleted}
                      onDragStart={(e) => {
                        if (isCompleted) return;
                        e.dataTransfer.setData('text/plain', leftText);
                        setActiveLeftItem(leftText);
                        setActiveRightItem(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isCompleted) return;
                        const right = e.dataTransfer.getData('text/plain') || activeRightItem;
                        if (right) handlePairItems(leftText, right);
                      }}
                      onTouchEnd={(e) => handleTouchEndMatching(e, 'left', leftText)}
                      onClick={() => handleTapLeft(leftText)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative select-none ${
                        isActive
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-300 shadow-md'
                          : isTargetForRight
                          ? 'bg-purple-50/60 border-purple-300 hover:border-purple-500 animate-pulse'
                          : isPaired
                          ? `${colorTheme?.bg} ${colorTheme?.border} shadow-sm`
                          : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${isPaired ? `${colorTheme?.badge} text-white` : 'bg-slate-200 text-slate-700'}`}>
                            {lIdx + 1}
                          </span>
                          <span className="font-bold text-sm md:text-base text-slate-800">
                            {cleanOptionText(leftText)}
                          </span>
                        </div>
                        {isPaired && !isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnpairLeft(leftText);
                            }}
                            className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Hủy cặp này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {isPaired && (
                        <div className="mt-2 text-xs font-semibold text-slate-600 bg-white/80 p-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 truncate">
                          <Link2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                          <span className="truncate">Nối với: <strong>{cleanOptionText(pairedRight)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Column (Cột B) */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Cột B (Nghĩa / Nội dung)
                </span>
                {(shuffledRightItems.length > 0 ? shuffledRightItems : question.rightItems).map((rightText, rIdx) => {
                  const pairedLeft = selectedAnswer
                    ? Object.keys(selectedAnswer).find((k) => selectedAnswer[k] === rightText)
                    : null;
                  const isPaired = Boolean(pairedLeft);
                  const isActive = activeRightItem === rightText;
                  const isTargetForLeft = Boolean(activeLeftItem);
                  const lIdx = pairedLeft ? question.leftItems?.indexOf(pairedLeft) ?? -1 : -1;
                  const colorTheme = isPaired && lIdx >= 0 ? PAIR_COLORS[lIdx % PAIR_COLORS.length] : null;

                  return (
                    <div
                      key={rIdx}
                      data-matching-card="true"
                      data-side="right"
                      data-text={rightText}
                      draggable={!isCompleted}
                      onDragStart={(e) => {
                        if (isCompleted) return;
                        e.dataTransfer.setData('text/plain', rightText);
                        setActiveRightItem(rightText);
                        setActiveLeftItem(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isCompleted) return;
                        const left = e.dataTransfer.getData('text/plain') || activeLeftItem;
                        if (left) handlePairItems(left, rightText);
                      }}
                      onTouchEnd={(e) => handleTouchEndMatching(e, 'right', rightText)}
                      onClick={() => handleTapRight(rightText)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative select-none ${
                        isActive
                          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-300 shadow-md'
                          : isTargetForLeft
                          ? 'bg-amber-50/60 border-amber-300 hover:border-amber-500 animate-pulse'
                          : isPaired
                          ? `${colorTheme?.bg} ${colorTheme?.border} shadow-sm`
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 flex-1">
                          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${isPaired ? `${colorTheme?.badge} text-white` : 'bg-slate-100 text-slate-600'}`}>
                            {String.fromCharCode(65 + rIdx)}
                          </span>
                          <span className="font-semibold text-sm md:text-base text-slate-800 flex-1">
                            {cleanOptionText(rightText)}
                          </span>
                        </div>
                        {isPaired && !isCompleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnpairRight(rightText);
                            }}
                            className="p-1 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Hủy cặp này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {isPaired && pairedLeft && (
                        <div className="mt-2 text-xs font-semibold text-slate-600 bg-white/80 p-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 truncate">
                          <Link2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                          <span className="truncate">Nối từ: <strong>{cleanOptionText(pairedLeft)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. Fill in the Blank (Điền khuyết ngắn) */}
        {question.type === 'fill_blank' && !isCorrupted && (
          <div className="space-y-4 mb-6">
            {question.blankContext && (
              <div className="p-4 bg-sky-50/80 border-2 border-sky-200 rounded-2xl text-base md:text-lg font-bold text-slate-800 leading-relaxed">
                {question.blankContext}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Nhập câu trả lời của em:
              </label>
              <div className="relative">
                <input
                  type="text"
                  disabled={isCompleted || submitting}
                  value={selectedAnswer || ''}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Nhập 1-2 từ ngữ thích hợp vào đây..."
                  className={`w-full p-4 rounded-2xl border-2 text-base md:text-lg font-bold outline-none transition-all shadow-sm ${
                    isCompleted
                      ? result?.correct
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900'
                        : 'border-rose-400 bg-rose-50/60 text-rose-900'
                      : 'border-sky-300 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 bg-white text-slate-800'
                  }`}
                />
                <Edit3 className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Gate 3: Corrupted Question Safe Fallback */}
        {isCorrupted && (
          <div className="p-4 md:p-5 bg-amber-50 border-2 border-amber-300 rounded-3xl mb-6 shadow-sm animate-fade-in">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm md:text-base mb-1.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Nội dung câu hỏi đang được cập nhật</span>
            </div>
            <p className="text-xs md:text-sm text-amber-800 font-medium leading-relaxed mb-4">
              Câu hỏi này đang được giáo viên cập nhật dữ liệu. Em hãy bấm nút <strong>"Bỏ qua câu này"</strong> bên dưới để tiếp tục bài làm mà không bị tính sai điểm nhé!
            </p>
            <button
              type="button"
              onClick={() => onSkipQuestion ? onSkipQuestion(question.id) : (isLastQuestion ? onFinishMission() : onNextQuestion())}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs md:text-sm shadow transition cursor-pointer"
            >
              <span>Bỏ qua câu này (không trừ điểm)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pedagogical Hint Box (Displayed when 1st attempt fails) */}
        {showHintBox && result?.hint && (
          <div className="mb-5 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl animate-fade-in">
            <div className="flex items-center gap-2 text-amber-800 font-extrabold text-sm md:text-base mb-1">
              <Lightbulb className="w-5 h-5 text-amber-500 fill-amber-400" />
              <span>Gợi ý sư phạm giúp em:</span>
            </div>
            <p className="text-amber-950 font-semibold text-sm md:text-base leading-relaxed">
              {result.hint}
            </p>
            <div className="mt-2.5 text-xs text-amber-700 font-bold flex items-center gap-1.5">
              <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Em hãy suy nghĩ kỹ, chọn lại đáp án và bấm nút "Em thử lại lần nữa" nhé!</span>
            </div>
          </div>
        )}

        {/* Final Explanation & Result Banner */}
        {result && isCompleted && (
          <div
            className={`mb-5 p-4 rounded-2xl border-2 animate-fade-in ${
              result.correct
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-base mb-1">
              {result.correct ? (
                <>
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span className="text-emerald-700">
                    {result.isFirstTry ? 'Tuyệt vời! Em trả lời đúng ngay lần đầu!' : 'Rất tốt! Em đã sửa đúng sau gợi ý!'}
                  </span>
                </>
              ) : (
                <>
                  <HelpCircle className="w-5 h-5 text-rose-600" />
                  <span className="text-rose-700">Chưa chính xác. Em cùng xem giải thích nhé:</span>
                </>
              )}
            </div>

            {result.explanation && (
              <p className="text-sm md:text-base font-medium mt-1 leading-relaxed opacity-90">
                {result.explanation}
              </p>
            )}

            {/* Display correct answer for fill_blank or matching if incorrect */}
            {!result.correct && result.correctAnswer && (
              <div className="mt-2.5 pt-2 border-t border-rose-200/60 text-xs md:text-sm font-bold text-rose-900">
                <span>Đáp án đúng của bài: </span>
                <span className="underline">
                  {typeof result.correctAnswer === 'object'
                    ? JSON.stringify(result.correctAnswer)
                    : String(result.correctAnswer)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer Buttons (Sticky / Clear) */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
        {/* Status indicator on left */}
        <div className="text-xs font-bold text-slate-500">
          {isCorrupted
            ? 'Câu hỏi đang cập nhật dữ liệu'
            : isCompleted
            ? 'Đã hoàn thành câu này'
            : !hasValidSelection()
            ? (question.type === 'multiple_choice'
                ? 'Em hãy chọn một đáp án.'
                : question.type === 'true_false'
                ? 'Em hãy chọn Đúng hoặc Sai.'
                : question.type === 'sequence'
                ? 'Em hãy sắp xếp các sự việc theo đúng trình tự.'
                : question.type === 'matching'
                ? 'Em hãy ghép nối tất cả các cặp tương ứng.'
                : question.type === 'fill_blank'
                ? 'Em hãy điền từ vào chỗ trống.'
                : 'Vui lòng chọn câu trả lời')
            : phase === 'retry'
            ? 'Được thử lại 1 lần sau gợi ý'
            : (question.type === 'sequence'
                ? 'Đã sắp xếp thứ tự'
                : question.type === 'matching'
                ? 'Đã ghép đôi các cặp'
                : question.type === 'fill_blank'
                ? 'Đã nhập câu trả lời'
                : 'Đã chọn đáp án')}
        </div>

        {/* Action button on right */}
        <div>
          {isCorrupted ? (
            <button
              type="button"
              onClick={() => onSkipQuestion ? onSkipQuestion(question.id) : (isLastQuestion ? onFinishMission() : onNextQuestion())}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 text-sm md:text-base cursor-pointer"
            >
              <span>{isLastQuestion ? 'Hoàn thành bài' : 'Bỏ qua câu này →'}</span>
            </button>
          ) : !isCompleted ? (
            phase === 'retry' ? (
              <button
                type="button"
                disabled={submitting || !hasValidSelection()}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 disabled:opacity-40 text-sm md:text-base cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCcw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                <span>{submitting ? 'Đang chấm...' : 'Em thử lại lần nữa'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || !hasValidSelection()}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 disabled:opacity-40 text-sm md:text-base cursor-pointer disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang chấm...' : 'Kiểm tra đáp án'}</span>
              </button>
            )
          ) : isLastQuestion ? (
            <button
              type="button"
              onClick={onFinishMission}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 text-sm md:text-base animate-pulse cursor-pointer"
            >
              <Check className="w-5 h-5" />
              <span>Hoàn thành bài & Nhận sao</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onNextQuestion}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-500 to-primary-600 hover:from-sky-600 hover:to-primary-700 text-white font-black rounded-2xl shadow-md transition active:scale-95 text-sm md:text-base cursor-pointer"
            >
              <span>Câu tiếp theo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
