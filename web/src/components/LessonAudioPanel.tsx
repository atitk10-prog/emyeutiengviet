import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  RefreshCw,
  Check,
  AlertCircle,
  Headphones,
  Trash2,
  AlertTriangle,
  Cpu,
  Wifi,
  WifiOff,
  Volume2,
  BookOpen,
  ExternalLink,
  Copy,
  CheckCircle2,
  ZoomIn,
  X,
  Globe,
  FileAudio
} from 'lucide-react';
import { AudioMetadata, Grade } from '@emytv/shared';
import { httpsCallable } from '../services/apiClient';
import { functions } from '../firebase';

export function computePassageHash(text: string): string {
  if (!text) return '';
  const clean = text.trim().replace(/\s+/g, ' ').toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

interface LessonAudioPanelProps {
  passage: string;
  title: string;
  grade: Grade;
  lessonId?: string | null;
  audioUrl?: string;
  audioMetadata?: AudioMetadata;
  onAudioApproved: (url: string, metadata: AudioMetadata) => void;
  onAudioDeleted: () => void;
  onOpenVoiceSurveyModal?: () => void;
  autoTriggerGenerate?: boolean;
  onAutoTriggerFinished?: () => void;
}

export const LessonAudioPanel: React.FC<LessonAudioPanelProps> = ({
  passage,
  title,
  grade,
  lessonId,
  audioUrl,
  audioMetadata,
  onAudioApproved,
  onAudioDeleted,
  onOpenVoiceSurveyModal,
  autoTriggerGenerate = false,
  onAutoTriggerFinished
}) => {
  // Engine / Tab selection: 'gemini_tts' | 'piper_tts' | 'teacher_upload' | 'aistudio_guide'
  const [selectedEngine, setSelectedEngine] = useState<'gemini_tts' | 'piper_tts' | 'teacher_upload' | 'aistudio_guide'>('gemini_tts');

  // AI Studio Guide language toggle: 'vi' | 'en'
  const [guideLang, setGuideLang] = useState<'vi' | 'en'>('vi');

  // Image zoom modal state
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string; desc: string } | null>(null);

  // Copy feedback states
  const [copiedPassage, setCopiedPassage] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Engine status check from backend
  const [engineStatus, setEngineStatus] = useState<{
    gemini?: { available: boolean; reason?: string };
    piper?: { available: boolean; reason?: string };
  }>({});

  // Gemini parameters
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>('female');
  const [readingStyle, setReadingStyle] = useState<'standard' | 'expressive_slow' | 'storytelling'>(
    grade === 2 ? 'expressive_slow' : 'storytelling'
  );

  // Piper parameters
  const [piperSpeed, setPiperSpeed] = useState<number>(grade === 2 ? 1.25 : 1.0);

  const [generatingAI, setGeneratingAI] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Freshly generated AI audio waiting for teacher preview & approval
  const [previewAudio, setPreviewAudio] = useState<{
    url: string;
    metadata: AudioMetadata;
    passageHash: string;
  } | null>(null);
  const [approving, setApproving] = useState(false);

  // Content Hash synchronization tracking
  const [attachedPassageHash, setAttachedPassageHash] = useState<string>(() => {
    return (audioMetadata as any)?.passageHash || (audioUrl ? computePassageHash(passage) : '');
  });

  const requestPassageHashRef = useRef<string>('');
  const hasAutoTriggeredRef = useRef<boolean>(false);

  // Style Prompt Strings (VI & EN)
  const STYLE_PROMPT_VI =
    'Đọc nguyên văn bài đọc bằng tiếng Việt tự nhiên, giọng giáo viên tiểu học ấm áp, rõ chữ, thân thiện. Giữ tốc độ hơi chậm và đều từ đầu đến cuối, không bất ngờ tăng tốc. Ngắt nghỉ tự nhiên theo dấu câu, phát âm rõ dấu thanh, không nuốt chữ. Giữ âm lượng đồng đều và nhấn nhẹ các câu quan trọng; không thêm lời giới thiệu, không thêm từ, không thay đổi nội dung, không có nhạc nền hoặc hiệu ứng âm thanh.';

  const STYLE_PROMPT_EN =
    'Read the Vietnamese passage exactly as written in a warm, natural, clear primary-school teacher voice. Maintain a consistent, slightly slow pace throughout without sudden speed changes. Pronounce Vietnamese tones accurately, articulate every word, pause naturally at punctuation, and use gentle emphasis. Keep volume steady. Do not add, omit, or change any words. No introductions, music, or sound effects.';

  // Check TTS Engine availability on mount
  useEffect(() => {
    let isMounted = true;
    const fetchTtsStatus = async () => {
      try {
        const checkFunc = httpsCallable(functions, 'checkTtsAvailability');
        const res: any = await checkFunc();
        if (isMounted && res.data) {
          setEngineStatus(res.data);
          // If Gemini has no API key but Piper is available, smartly suggest Piper
          if (!res.data.gemini?.available && res.data.piper?.available) {
            setSelectedEngine('piper_tts');
          }
        }
      } catch (e) {
        // Fallback default
      }
    };
    fetchTtsStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update style default when grade changes
  useEffect(() => {
    if (grade === 2) {
      setReadingStyle('expressive_slow');
      setPiperSpeed(1.25);
    } else {
      setReadingStyle('storytelling');
      setPiperSpeed(1.0);
    }
  }, [grade]);

  // Sync attachedPassageHash if audioMetadata changes
  useEffect(() => {
    if ((audioMetadata as any)?.passageHash) {
      setAttachedPassageHash((audioMetadata as any).passageHash);
    } else if (audioUrl && !attachedPassageHash && passage) {
      setAttachedPassageHash(computePassageHash(passage));
    }
  }, [audioUrl, audioMetadata]);

  // Auto trigger generator if requested (e.g., from AI prompt checkbox)
  useEffect(() => {
    if (autoTriggerGenerate && !hasAutoTriggeredRef.current && passage && passage.trim().length >= 20) {
      hasAutoTriggeredRef.current = true;
      handleGenerateAIAudio().finally(() => {
        if (onAutoTriggerFinished) onAutoTriggerFinished();
      });
    }
  }, [autoTriggerGenerate, passage]);

  // Check if current passage has changed compared to attached audio
  const currentPassageHash = computePassageHash(passage);
  const isPassageDirty = !!audioUrl && !!attachedPassageHash && attachedPassageHash !== currentPassageHash;

  // Clipboard copy helpers
  const handleCopyPassage = async () => {
    if (!passage || passage.trim().length === 0) {
      setStatusMsg({ type: 'warning', text: 'Chưa có nội dung bài đọc để sao chép.' });
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(passage.trim());
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = passage.trim();
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPassage(true);
      setTimeout(() => setCopiedPassage(false), 2500);
      setStatusMsg({ type: 'success', text: 'Đã sao chép chính xác nội dung bài đọc vào clipboard!' });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Không thể sao chép tự động. Hãy bôi đen và nhấn Ctrl+C.' });
    }
  };

  const handleCopyStylePrompt = async () => {
    const textToCopy = guideLang === 'en' ? STYLE_PROMPT_EN : STYLE_PROMPT_VI;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
      setStatusMsg({
        type: 'success',
        text: `Đã sao chép chỉ dẫn phong cách đọc (${guideLang === 'en' ? 'English' : 'Tiếng Việt'})!`
      });
    } catch (e) {
      setStatusMsg({ type: 'error', text: 'Không thể sao chép chỉ dẫn phong cách.' });
    }
  };

  // Handle AI TTS Generation (Gemini or Piper)
  const handleGenerateAIAudio = async (targetEngine?: 'gemini_tts' | 'piper_tts') => {
    if (!passage || passage.trim().length < 20) {
      setStatusMsg({
        type: 'warning',
        text: 'Vui lòng có ít nhất 20 ký tự bài đọc trước khi tạo giọng đọc AI.'
      });
      return;
    }

    const currentHash = computePassageHash(passage);
    requestPassageHashRef.current = currentHash;
    setGeneratingAI(true);
    setStatusMsg(null);

    const engineToUse = targetEngine || (selectedEngine === 'piper_tts' ? 'piper_tts' : 'gemini_tts');

    try {
      const genFunc = httpsCallable(functions, 'generateLessonAudioWithAI');
      const res: any = await genFunc({
        passage: passage.trim(),
        title: title ? String(title).trim() : undefined,
        grade,
        engine: engineToUse,
        voiceGender,
        readingStyle,
        lengthScale: piperSpeed,
        lessonId: lessonId || 'new_lesson'
      });

      if (res.data?.success) {
        // Guard against race condition: user typed while AI was synthesizing
        if (computePassageHash(passage) !== requestPassageHashRef.current) {
          setStatusMsg({
            type: 'warning',
            text: 'Nội dung bài đọc đã bị sửa đổi trong lúc AI đang tạo âm thanh. Bản âm thanh cũ không được áp dụng tự động để tránh lệch lời.'
          });
          return;
        }

        const metadata: AudioMetadata = {
          ...res.data.metadata,
          ...( { passageHash: currentHash } as any )
        };

        setPreviewAudio({
          url: res.data.audioUrl,
          metadata,
          passageHash: currentHash
        });

        const engineLabel = engineToUse === 'piper_tts' ? 'Piper AI (Ngoại Tuyến)' : 'Gemini AI (Trực Tuyến)';
        setStatusMsg({
          type: 'success',
          text: `${engineLabel} đã tổng hợp giọng đọc tiếng Việt thành công (~${res.data.durationSeconds}s, mô hình ${res.data.model})! Hãy bấm nghe thử và phê duyệt bên dưới.`
        });
      } else {
        throw new Error(res.data?.message || 'Không thể tạo âm thanh AI');
      }
    } catch (err: any) {
      console.error('AI TTS error:', err);
      const isQuota = err.message && (err.message.includes('429') || err.message.includes('Quota'));
      const msg = isQuota
        ? 'Hạn mức dịch vụ Gemini TTS tạm thời bị giới hạn (Quota/Rate limit 429). Bạn có thể chuyển sang dùng Piper AI Ngoại Tuyến hoặc tự tạo qua Google AI Studio.'
        : 'Lỗi khi tạo giọng đọc AI: ' + (err.message || 'Không thể kết nối máy chủ.');
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setGeneratingAI(false);
    }
  };

  // Handle Approve AI Audio
  const handleApproveAIAudio = async () => {
    if (!previewAudio) return;
    setApproving(true);
    try {
      if (lessonId) {
        const approveFunc = httpsCallable(functions, 'approveLessonAudio');
        await approveFunc({
          lessonId,
          metadata: previewAudio.metadata
        });
      }

      setAttachedPassageHash(previewAudio.passageHash);
      onAudioApproved(previewAudio.url, previewAudio.metadata);
      setPreviewAudio(null);
      setStatusMsg({
        type: 'success',
        text: 'Đã phê duyệt và lưu giọng đọc AI tiếng Việt vào bài học thành công!'
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Lỗi phê duyệt âm thanh: ' + err.message });
    } finally {
      setApproving(false);
    }
  };

  // Handle Teacher File Upload (Max 15MB MP3/M4A, 30MB WAV)
  const handleUploadFile = async (file: File) => {
    setStatusMsg(null);
    const fileNameLower = file.name.toLowerCase();
    const isWav = fileNameLower.endsWith('.wav') || file.type.includes('wav');
    const isMp3OrM4a =
      fileNameLower.endsWith('.mp3') ||
      fileNameLower.endsWith('.m4a') ||
      file.type.includes('mpeg') ||
      file.type.includes('mp3') ||
      file.type.includes('m4a');

    if (!isWav && !isMp3OrM4a) {
      setStatusMsg({
        type: 'error',
        text: 'Định dạng tệp không hợp lệ. Vui lòng chọn tệp âm thanh định dạng MP3, M4A hoặc WAV.'
      });
      return;
    }

    const maxBytes = isWav ? 30 * 1024 * 1024 : 15 * 1024 * 1024;
    const limitMb = isWav ? 30 : 15;
    if (file.size > maxBytes) {
      setStatusMsg({
        type: 'error',
        text: `Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)} MB) vượt quá giới hạn cho phép (${limitMb} MB cho định dạng ${isWav ? 'WAV' : 'MP3/M4A'}).`
      });
      return;
    }

    setUploadingAudio(true);
    try {
      let durationSec: number | undefined = undefined;
      try {
        const objectUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(objectUrl);
        await new Promise<void>((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSec = Math.round(tempAudio.duration);
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          tempAudio.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve();
          };
          setTimeout(resolve, 2000);
        });
      } catch (e) {
        console.warn('Duration detect error:', e);
      }

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const uploadFunc = httpsCallable(functions, 'uploadLessonAudio');
      const res: any = await uploadFunc({
        fileName: file.name,
        fileBase64: base64Data,
        mimeType: file.type || (isWav ? 'audio/wav' : 'audio/mpeg'),
        sizeBytes: file.size,
        durationSeconds: durationSec,
        voiceType: 'teacher_voice',
        lessonId: lessonId || 'new_lesson'
      });

      if (res.data?.success) {
        const currentHash = computePassageHash(passage);
        const metadata: AudioMetadata = {
          ...res.data.metadata,
          ...( { passageHash: currentHash } as any )
        };
        setAttachedPassageHash(currentHash);
        onAudioApproved(res.data.downloadUrl, metadata);
        setStatusMsg({
          type: 'success',
          text: `Đã tải lên tệp "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) thành công và lưu bền vững vào bài học!`
        });
      } else {
        throw new Error(res.data?.message || 'Tải lên không thành công');
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Lỗi tải lên tệp âm thanh: ' + err.message });
    } finally {
      setUploadingAudio(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gradient-to-r from-sky-50 via-indigo-50/50 to-emerald-50/50 rounded-3xl border-2 border-sky-200/90 space-y-4 sm:space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-200/60">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <h4 className="text-base font-black text-slate-900">
              Giọng Đọc Tiếng Việt Bài Đọc (AI TTS & Giáo Viên Thu Âm)
            </h4>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Hỗ trợ Gemini AI trực tuyến, Piper AI ngoại tuyến (100% offline), tải tệp giáo viên thu âm và hướng dẫn tự tạo qua Google AI Studio.
          </p>
        </div>
        {onOpenVoiceSurveyModal && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenVoiceSurveyModal}
              className="px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-800 border border-sky-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Headphones className="w-3.5 h-3.5 text-sky-600" />
              <span>Khảo sát 3 giọng đọc</span>
            </button>
          </div>
        )}
      </div>

      {/* Status Alert Message */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in ${
            statusMsg.type === 'success'
              ? 'bg-emerald-100/90 text-emerald-950 border border-emerald-300'
              : statusMsg.type === 'warning'
              ? 'bg-amber-100 text-amber-950 border border-amber-300'
              : 'bg-rose-100 text-rose-900 border border-rose-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : statusMsg.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Dirty Warning Banner if Passage Changed After Audio Was Attached */}
      {isPassageDirty && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 font-bold animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Nội dung bài đọc đã thay đổi so với bản thu âm hiện tại. Vui lòng bấm &ldquo;Đồng bộ ngay&rdquo; bên dưới để tạo lại giọng đọc chuẩn khớp câu chữ.
            </span>
          </div>
          <button
            type="button"
            disabled={generatingAI}
            onClick={() => handleGenerateAIAudio()}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shrink-0 transition cursor-pointer self-start sm:self-auto"
          >
            Đồng bộ ngay
          </button>
        </div>
      )}

      {/* 4 UNIFIED MODE SELECTOR CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* TAB 1: GEMINI AI (ONLINE) */}
        <button
          type="button"
          onClick={() => setSelectedEngine('gemini_tts')}
          className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
            selectedEngine === 'gemini_tts'
              ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-200'
              : 'bg-white/70 border-slate-200 hover:bg-white hover:border-indigo-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-black text-slate-900">Gemini AI</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Wifi className="w-3 h-3 text-indigo-500" />
                <span>Trực Tuyến</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium line-clamp-2">
              Giọng đọc biểu cảm cao qua Google Cloud (Aoede / Puck, 24kHz).
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-indigo-700 font-semibold font-mono">
            <span>gemini-3.8-flash-lite-tts</span>
            {engineStatus.gemini?.available === false && (
              <span className="text-amber-600 font-sans font-bold">Chưa có API key</span>
            )}
          </div>
        </button>

        {/* TAB 2: PIPER AI (OFFLINE) */}
        <button
          type="button"
          onClick={() => setSelectedEngine('piper_tts')}
          className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
            selectedEngine === 'piper_tts'
              ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-200'
              : 'bg-white/70 border-slate-200 hover:bg-white hover:border-emerald-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black text-slate-900">Piper AI</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <WifiOff className="w-3 h-3 text-emerald-600" />
                <span>Ngoại Tuyến 100%</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium line-clamp-2">
              Mô hình VAIS chạy trực tiếp CPU máy tính, chuẩn 6 thanh điệu, không cần Internet.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-800 font-semibold font-mono">
            <span>vi_VN-vais1000-medium</span>
            <span className="text-emerald-700 font-sans font-bold">Sẵn sàng CPU</span>
          </div>
        </button>

        {/* TAB 3: TEACHER UPLOAD */}
        <button
          type="button"
          onClick={() => setSelectedEngine('teacher_upload')}
          className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
            selectedEngine === 'teacher_upload'
              ? 'bg-white border-sky-500 shadow-md ring-2 ring-sky-200'
              : 'bg-white/70 border-slate-200 hover:bg-white hover:border-sky-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-black text-slate-900">Giáo Viên Thu Âm</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                Tệp Thật
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium line-clamp-2">
              Tải lên tệp ghi âm giọng đọc của thầy cô (MP3/M4A 15MB, WAV 30MB).
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-sky-700 font-semibold font-mono">
            <span>persistent_storage/audio</span>
            <span className="text-sky-800 font-sans font-bold">Lưu bền vững</span>
          </div>
        </button>

        {/* TAB 4: GOOGLE AI STUDIO GUIDE */}
        <button
          type="button"
          onClick={() => setSelectedEngine('aistudio_guide')}
          className={`p-3.5 rounded-2xl border-2 text-left transition flex flex-col justify-between cursor-pointer ${
            selectedEngine === 'aistudio_guide'
              ? 'bg-white border-purple-500 shadow-md ring-2 ring-purple-200'
              : 'bg-white/70 border-slate-200 hover:bg-white hover:border-purple-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-black text-slate-900">Google AI Studio</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                6 Bước
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium line-clamp-2">
              Hướng dẫn tự tạo giọng đọc studio miễn phí, kèm công cụ sao chép và 9 ảnh thật.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-purple-700 font-semibold font-mono">
            <span>Song ngữ VI / EN</span>
            <span className="text-purple-800 font-sans font-bold">Trợ giúp ↗</span>
          </div>
        </button>
      </div>

      {/* DETAIL CONTROLS FOR SELECTED TAB */}

      {/* 1. GEMINI AI TTS */}
      {selectedEngine === 'gemini_tts' && (
        <div className="p-4 bg-white/95 rounded-2xl border border-indigo-200 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Cấu hình Gemini AI TTS (Trực Tuyến)</span>
            </span>
            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
              gemini-3.8-flash-lite-tts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giọng đọc AI:</label>
              <div className="flex gap-2">
                <label
                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    voiceGender === 'female'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="voiceGenderSelection"
                    value="female"
                    checked={voiceGender === 'female'}
                    onChange={() => setVoiceGender('female')}
                    className="hidden"
                  />
                  <span>👩 Giọng Nữ (Cô giáo · Aoede)</span>
                </label>
                <label
                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    voiceGender === 'male'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="voiceGenderSelection"
                    value="male"
                    checked={voiceGender === 'male'}
                    onChange={() => setVoiceGender('male')}
                    className="hidden"
                  />
                  <span>👨 Giọng Nam (Thầy giáo · Puck)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phong cách sư phạm:</label>
              <select
                value={readingStyle}
                onChange={(e) => setReadingStyle(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="expressive_slow">Chậm rãi, ngắt nghỉ kỹ theo dấu câu (Chuẩn Khối 2)</option>
                <option value="storytelling">Giọng kể chuyện diễn cảm, lôi cuốn (Chuẩn Khối 3)</option>
                <option value="standard">Chuẩn mực tự nhiên, phát âm rõ 6 thanh điệu</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={generatingAI}
              onClick={() => handleGenerateAIAudio('gemini_tts')}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{generatingAI ? 'Đang tổng hợp giọng nói Gemini...' : 'Tạo Giọng Đọc Gemini AI (Trực Tuyến)'}</span>
            </button>
            <span className="text-[11px] text-slate-500">
              * Yêu cầu kết nối Internet và khóa API Gemini hợp lệ.
            </span>
          </div>
        </div>
      )}

      {/* 2. PIPER AI TTS */}
      {selectedEngine === 'piper_tts' && (
        <div className="p-4 bg-white/95 rounded-2xl border border-emerald-300 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>Cấu hình Piper AI TTS (Ngoại Tuyến 100%)</span>
            </span>
            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-mono border border-emerald-200">
              vi_VN-vais1000-medium · 22.05kHz
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tốc độ đọc sư phạm:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPiperSpeed(1.25)}
                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    piperSpeed === 1.25
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🐢 Chậm rãi (1.25x · Khối 2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPiperSpeed(1.0)}
                  className={`flex-1 p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    piperSpeed === 1.0
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>🐇 Chuẩn (1.0x · Khối 3)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mô hình giọng nói nơ-ron:</label>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-between">
                <span>Giọng nữ miền Bắc (VAIS 1000 câu)</span>
                <span className="text-[10px] font-bold text-emerald-700 font-mono">63.2 MB · CPU</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={generatingAI}
              onClick={() => handleGenerateAIAudio('piper_tts')}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-4 h-4 text-emerald-200" />
              <span>{generatingAI ? 'Đang tổng hợp giọng nói Piper...' : 'Tạo Giọng Đọc Piper AI (Ngoại Tuyến)'}</span>
            </button>
            <span className="text-[11px] text-slate-500">
              * Chạy hoàn toàn ngoại tuyến trên máy tính, 0% chi phí API, tốc độ tạo ~0.2s/câu.
            </span>
          </div>
        </div>
      )}

      {/* 3. TEACHER UPLOAD (NO QUICK SAMPLE BUTTONS) */}
      {selectedEngine === 'teacher_upload' && (
        <div className="p-4 bg-white/95 rounded-2xl border border-sky-200 space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-sky-600" />
                <span>Tải Lên Tệp Thu Âm Giáo Viên</span>
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Hỗ trợ định dạng MP3, M4A (tối đa 15 MB) hoặc WAV (tối đa 30 MB).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEngine('aistudio_guide')}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
              <span>Xem hướng dẫn Google AI Studio</span>
            </button>
          </div>

          <div className="p-4 bg-sky-50/60 rounded-2xl border border-dashed border-sky-300 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600">
              <FileAudio className="w-6 h-6" />
            </div>

            <div>
              <label
                className={`px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-xl shadow transition active:scale-95 inline-flex items-center gap-2 cursor-pointer ${
                  uploadingAudio ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>{uploadingAudio ? 'Đang tải lên...' : 'Chọn tệp âm thanh tải lên'}</span>
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/mp4"
                  className="hidden"
                  disabled={uploadingAudio}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                Tệp được lưu trữ nhị phân bền vững trên máy chủ, chỉ lưu siêu dữ liệu trên Firestore (không lưu Base64).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. GOOGLE AI STUDIO GUIDE TAB */}
      {selectedEngine === 'aistudio_guide' && (
        <div className="p-4 sm:p-5 bg-white/95 rounded-2xl border border-purple-200 space-y-4 animate-fade-in">
          {/* Guide Sub-Header with Language Toggle & Quick Action Buttons */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-purple-100">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 text-[10px] font-black rounded uppercase">
                  Hướng Dẫn Chi Tiết
                </span>
                <h5 className="text-sm font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Tạo Giọng Đọc Miễn Phí Với Google AI Studio'
                    : 'Generate Speech with Google AI Studio'}
                </h5>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {guideLang === 'vi'
                  ? 'Quy trình 6 bước sử dụng Google AI Studio (Generate Speech), kèm công cụ sao chép và 9 ảnh minh họa.'
                  : '6-step guide to generate speech using Google AI Studio, with one-click copy tools and 9 illustrations.'}
              </p>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngôn ngữ:</span>
              </span>
              <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex">
                <button
                  type="button"
                  onClick={() => setGuideLang('vi')}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    guideLang === 'vi'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tiếng Việt
                </button>
                <button
                  type="button"
                  onClick={() => setGuideLang('en')}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg transition cursor-pointer ${
                    guideLang === 'en'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 rounded-2xl border border-purple-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Button 1: Open Google AI Studio */}
              <a
                href="https://aistudio.google.com/generate-speech"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{guideLang === 'vi' ? 'Mở Google AI Studio' : 'Open Google AI Studio'}</span>
              </a>

              {/* Button 2: Copy Passage */}
              <button
                type="button"
                onClick={handleCopyPassage}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Sao chép chính xác bài đọc đang soạn để dán vào ô Transcript của AI Studio"
              >
                {copiedPassage ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-purple-600" />
                )}
                <span>{copiedPassage ? 'Đã sao chép bài đọc!' : (guideLang === 'vi' ? 'Sao chép bài đọc' : 'Copy Passage')}</span>
              </button>

              {/* Button 3: Copy Style Prompt */}
              <button
                type="button"
                onClick={handleCopyStylePrompt}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Sao chép chỉ dẫn phong cách đọc (Style Prompt) để dán vào ô Style Description của AI Studio"
              >
                {copiedPrompt ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{copiedPrompt ? 'Đã sao chép Style!' : (guideLang === 'vi' ? 'Sao chép gợi ý giọng đọc' : 'Copy Style Prompt')}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEngine('teacher_upload')}
              className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-900 font-black text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-sky-700" />
              <span>{guideLang === 'vi' ? 'Đã có file? Bấm để tải lên' : 'Have file? Click to upload'}</span>
            </button>
          </div>

          {/* CRITICAL WARNING BANNER */}
          <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-2.5 text-xs text-amber-950 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {guideLang === 'vi'
                ? 'LƯU Ý QUAN TRỌNG: Chỉ dán nội dung bài đọc vào ô Transcript. KHÔNG dán câu chỉ dẫn phong cách (Style Prompt) vào transcript để tránh AI đọc to cả lời chỉ dẫn!'
                : 'IMPORTANT: Paste only the lesson passage into the Transcript box. Do NOT paste the style instructions into the transcript, or the AI will read them out loud!'}
            </span>
          </div>

          {/* 6 DETAILED STEPS */}
          <div className="space-y-4 pt-1">
            {/* STEP 1 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 1 — Mở Google AI Studio (Open Google AI Studio)'
                    : 'Step 1 — Open Google AI Studio'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Truy cập trang web{' '}
                    <a
                      href="https://aistudio.google.com/generate-speech"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 font-bold underline inline-flex items-center gap-0.5"
                    >
                      <span>aistudio.google.com/generate-speech</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    trong trình duyệt Chrome và đăng nhập bằng tài khoản Google. Chọn mục{' '}
                    <strong className="text-slate-800">Turn text into natural-sounding speech</strong> (Chuyển văn bản thành giọng nói tự nhiên) và nhấn{' '}
                    <strong className="text-slate-800">Create new dialog</strong> (Tạo đoạn thoại mới).
                  </>
                ) : (
                  <>
                    Go to{' '}
                    <a
                      href="https://aistudio.google.com/generate-speech"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 font-bold underline inline-flex items-center gap-0.5"
                    >
                      <span>aistudio.google.com/generate-speech</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and sign in with your Google account. Select{' '}
                    <strong className="text-slate-800">Turn text into natural-sounding speech</strong> and click{' '}
                    <strong className="text-slate-800">Create new dialog</strong>.
                  </>
                )}
              </p>
              <div className="pl-8 pt-1">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/01_aistudio_home.png',
                      title: 'Bước 1: Giao diện trang chủ Google AI Studio Generate Speech',
                      desc: 'Màn hình bắt đầu tạo đoạn thoại mới (Create new dialog).'
                    })
                  }
                  className="group relative max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/01_aistudio_home.png"
                    alt="AI Studio Home"
                    className="w-full h-auto object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Phóng to ảnh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 2 — Tùy chọn chuyển giao diện sang tiếng Việt (Optional Chrome translation)'
                    : 'Step 2 — Optional Chrome translation'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Nếu muốn giao diện tiếng Việt, tại góc phải thanh địa chỉ Chrome, nhấp biểu tượng{' '}
                    <strong className="text-slate-800">Google Dịch / Translate</strong> nếu hiện, chọn{' '}
                    <strong className="text-slate-800">Tiếng Việt</strong> (hoặc mở menu Chrome ⋮ → Dịch). Bạn có thể đổi lại Tiếng Anh bất cứ lúc nào.
                    <br />
                    <span className="text-amber-800 font-bold">
                      * Lưu ý: Dịch giao diện bằng Chrome không thay đổi ngôn ngữ phát âm của mô hình. Nội dung văn bản tiếng Việt mới quyết định phát âm tiếng Việt.
                    </span>
                  </>
                ) : (
                  <>
                    If desired, click the Chrome Translate icon in the address bar or Chrome menu ⋮ and choose{' '}
                    <strong className="text-slate-800">Vietnamese</strong>. You can switch back to English at any time.
                    <br />
                    <span className="text-amber-800 font-bold">
                      * Note: Translating the browser UI does NOT change the synthesis language. The Vietnamese text in the transcript determines the pronunciation.
                    </span>
                  </>
                )}
              </p>
              <div className="pl-8 pt-1">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/03_chrome_translate.png',
                      title: 'Bước 2: Tùy chọn chuyển ngôn ngữ giao diện bằng Google Dịch trong Chrome',
                      desc: 'Dịch các nhãn nút và cài đặt sang tiếng Việt để tiện theo dõi.'
                    })
                  }
                  className="group relative max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/03_chrome_translate.png"
                    alt="Chrome Translate"
                    className="w-full h-auto object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Phóng to ảnh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 3 — Chọn một người đọc / một đoạn thoại (Use a single narrator)'
                    : 'Step 3 — Use a single narrator'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Xóa các ví dụ tiếng Anh mặc định, chỉ để <strong className="text-slate-800">Speaker 1 (Người nói 1)</strong> và một khối thoại duy nhất. Nhấn nút{' '}
                    <strong className="text-purple-700">&ldquo;Sao chép bài đọc&rdquo;</strong> ở trên, rồi dán vào ô{' '}
                    <strong className="text-slate-800">Transcript</strong> của AI Studio.
                  </>
                ) : (
                  <>
                    Delete default English examples, keeping only <strong className="text-slate-800">Speaker 1</strong> and a single speech block. Click{' '}
                    <strong className="text-purple-700">&ldquo;Copy Passage&rdquo;</strong> above and paste it into the AI Studio{' '}
                    <strong className="text-slate-800">Transcript</strong> box.
                  </>
                )}
              </p>
              <div className="pl-8 pt-1 flex flex-wrap items-center gap-3">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/04_dialog_editor.png',
                      title: 'Bước 3: Màn hình biên tập đoạn thoại trong AI Studio',
                      desc: 'Dán bài đọc vào ô Transcript của Speaker 1.'
                    })
                  }
                  className="group relative max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/04_dialog_editor.png"
                    alt="Dialog Editor"
                    className="w-full h-auto object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Phóng to ảnh</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyPassage}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs rounded-xl border border-purple-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5 text-purple-600" />
                  <span>{guideLang === 'vi' ? 'Sao chép bài đọc ngay' : 'Copy passage now'}</span>
                </button>
              </div>
            </div>

            {/* STEP 4 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  4
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 4 — Chọn giọng đọc và phong cách (Choose voice and style)'
                    : 'Step 4 — Choose voice and style'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Vào <strong className="text-slate-800">Speaker settings</strong> (Cài đặt giọng nói) → Chọn <strong className="text-slate-800">Voice</strong> (Giọng nói), nghe thử bằng nút ▶. Chọn <strong className="text-slate-800">Style</strong> là <strong className="text-slate-800">Narration</strong> hoặc <strong className="text-slate-800">Friendly</strong>.
                    <br />
                    Bấm <strong className="text-purple-700">&ldquo;Sao chép gợi ý giọng đọc&rdquo;</strong> và dán vào phần Style Description (nếu giao diện hỗ trợ).
                  </>
                ) : (
                  <>
                    Go to <strong className="text-slate-800">Speaker settings</strong> → Select <strong className="text-slate-800">Voice</strong>, test audio with ▶. Choose style as <strong className="text-slate-800">Narration</strong> or <strong className="text-slate-800">Friendly</strong>.
                    <br />
                    Click <strong className="text-purple-700">&ldquo;Copy Style Prompt&rdquo;</strong> and paste into the style description field if available.
                  </>
                )}
              </p>

              {/* Style Prompt Display Box */}
              <div className="pl-8 pt-1">
                <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs text-slate-700 leading-relaxed font-mono relative">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-[11px] font-sans font-bold text-purple-900">
                    <span>{guideLang === 'vi' ? 'Nội dung Style Prompt:' : 'Style Prompt content:'}</span>
                    <button
                      type="button"
                      onClick={handleCopyStylePrompt}
                      className="text-purple-700 hover:text-purple-900 underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{guideLang === 'vi' ? 'Sao chép đoạn này' : 'Copy this'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] font-sans italic text-slate-800">
                    &ldquo;{guideLang === 'en' ? STYLE_PROMPT_EN : STYLE_PROMPT_VI}&rdquo;
                  </p>
                </div>
              </div>

              {/* Step 4 Image Gallery (4 images) */}
              <div className="pl-8 pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/05_voice_selection.png',
                      title: 'Bước 4.1: Danh sách giọng đọc trong Speaker Settings',
                      desc: 'Chọn giọng nói và bấm ▶ để nghe thử ngữ điệu.'
                    })
                  }
                  className="group relative rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/05_voice_selection.png"
                    alt="Voice Selection"
                    className="w-full h-24 sm:h-28 object-cover group-hover:scale-102 transition duration-300"
                  />
                  <span className="block text-[10px] font-bold text-center py-1 bg-white text-slate-700 border-t border-slate-200 truncate px-1">
                    05: Chọn giọng
                  </span>
                </div>

                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/07_expression_options.png',
                      title: 'Bước 4.2: Tùy chọn biểu cảm & phong cách',
                      desc: 'Lựa chọn Narration hoặc Friendly cho học sinh tiểu học.'
                    })
                  }
                  className="group relative rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/07_expression_options.png"
                    alt="Expression Options"
                    className="w-full h-24 sm:h-28 object-cover group-hover:scale-102 transition duration-300"
                  />
                  <span className="block text-[10px] font-bold text-center py-1 bg-white text-slate-700 border-t border-slate-200 truncate px-1">
                    07: Biểu cảm
                  </span>
                </div>

                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/08_style_vietnamese.png',
                      title: 'Bước 4.3: Hướng dẫn phong cách (Tiếng Việt)',
                      desc: 'Giao diện phong cách sau khi chuyển ngôn ngữ tiếng Việt.'
                    })
                  }
                  className="group relative rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/08_style_vietnamese.png"
                    alt="Style Vietnamese"
                    className="w-full h-24 sm:h-28 object-cover group-hover:scale-102 transition duration-300"
                  />
                  <span className="block text-[10px] font-bold text-center py-1 bg-white text-slate-700 border-t border-slate-200 truncate px-1">
                    08: Phong cách (VI)
                  </span>
                </div>

                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/09_style_english.png',
                      title: 'Bước 4.4: Hướng dẫn phong cách (Tiếng Anh)',
                      desc: 'Giao diện Style Prompt nguyên bản tiếng Anh.'
                    })
                  }
                  className="group relative rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/09_style_english.png"
                    alt="Style English"
                    className="w-full h-24 sm:h-28 object-cover group-hover:scale-102 transition duration-300"
                  />
                  <span className="block text-[10px] font-bold text-center py-1 bg-white text-slate-700 border-t border-slate-200 truncate px-1">
                    09: Phong cách (EN)
                  </span>
                </div>
              </div>
            </div>

            {/* STEP 5 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  5
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 5 — Chạy, nghe kiểm tra, tải xuống (Generate, review, download)'
                    : 'Step 5 — Generate, review, and download'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Nhấn nút <strong className="text-slate-800">Run</strong> (hoặc <strong className="text-slate-800">Run Ctrl ↵</strong> / <strong className="text-slate-800">Chạy</strong> ở góc dưới bên phải). Nghe kiểm tra qua thanh phát: phát âm đúng từng từ, không nuốt chữ, đúng 6 thanh điệu tiếng Việt. Sau đó bấm nút <strong className="text-slate-800">Tải xuống (icon mũi tên ↓)</strong> ở thanh phát để lưu tệp âm thanh (WAV/MP3) về máy tính.
                  </>
                ) : (
                  <>
                    Click <strong className="text-slate-800">Run</strong> (bottom right). Listen and verify pronunciation, natural pacing, and proper Vietnamese tones. Click the <strong className="text-slate-800">Download icon (↓)</strong> on the player bar to save the audio file (WAV/MP3) to your computer.
                  </>
                )}
              </p>
              <div className="pl-8 pt-1">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/06_run_and_download.png',
                      title: 'Bước 5: Nút Run tạo giọng và biểu tượng tải xuống (Download)',
                      desc: 'Bấm nút Run và biểu tượng tải xuống mũi tên ↓.'
                    })
                  }
                  className="group relative max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/06_run_and_download.png"
                    alt="Run and Download"
                    className="w-full h-auto object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Phóng to ảnh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 6 */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  6
                </span>
                <h6 className="text-xs font-black text-slate-900">
                  {guideLang === 'vi'
                    ? 'Bước 6 — Gắn âm thanh vào bài đọc EM YÊU TIẾNG VIỆT (Upload to the lesson)'
                    : 'Step 6 — Upload audio to the lesson'}
                </h6>
              </div>
              <p className="text-xs text-slate-600 font-medium pl-8 leading-relaxed">
                {guideLang === 'vi' ? (
                  <>
                    Quay lại thẻ <strong className="text-sky-700">Giáo Viên Thu Âm</strong> bên cạnh → Nhấn{' '}
                    <strong className="text-slate-800">Chọn tệp âm thanh tải lên</strong> → Chọn tệp vừa tải về từ AI Studio (MP3/M4A ≤ 15MB, WAV ≤ 30MB) → Nghe thử trực tiếp → Bấm{' '}
                    <strong className="text-emerald-700">Phê duyệt & Lưu vào bài học</strong>.
                  </>
                ) : (
                  <>
                    Switch to the <strong className="text-sky-700">Teacher Upload</strong> tab → Click{' '}
                    <strong className="text-slate-800">Choose audio file to upload</strong> → Select the downloaded file (MP3/M4A ≤ 15MB, WAV ≤ 30MB) → Preview in the player → Click{' '}
                    <strong className="text-emerald-700">Approve & Save to lesson</strong>.
                  </>
                )}
              </p>
              <div className="pl-8 pt-1 flex flex-wrap items-center gap-3">
                <div
                  onClick={() =>
                    setZoomedImage({
                      url: '/images/aistudio_guide/02_current_upload_panel.png',
                      title: 'Bước 6: Giao diện tải lên tệp âm thanh trong EM YÊU TIẾNG VIỆT',
                      desc: 'Chọn tệp âm thanh và phê duyệt lưu vào bài học.'
                    })
                  }
                  className="group relative max-w-sm rounded-xl overflow-hidden border border-slate-300 shadow-sm cursor-pointer hover:border-purple-500 transition"
                >
                  <img
                    src="/images/aistudio_guide/02_current_upload_panel.png"
                    alt="Upload Panel"
                    className="w-full h-auto object-cover group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                    <ZoomIn className="w-4 h-4" />
                    <span>Phóng to ảnh</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedEngine('teacher_upload')}
                  className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>{guideLang === 'vi' ? 'Chuyển sang mục Tải Lên Tệp' : 'Go to Upload Panel'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED AI AUDIO PREVIEW BOX (WHEN FRESHLY GENERATED) */}
      {previewAudio && (
        <div className="p-4 bg-indigo-50/90 rounded-2xl border-2 border-indigo-300 space-y-3 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-black text-indigo-950">
                Bản nghe thử giọng đọc {previewAudio.metadata.engine === 'piper_tts' ? 'Piper AI (Ngoại Tuyến)' : 'Gemini AI (Trực Tuyến)'} vừa tạo (~{previewAudio.metadata.durationSeconds || previewAudio.metadata.duration}s · Định dạng WAV)
              </span>
            </div>
            <span className="text-[11px] font-bold text-indigo-700">
              Chờ phê duyệt lưu vào bài
            </span>
          </div>

          <audio controls src={previewAudio.url} className="w-full h-9" />

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={approving}
              onClick={handleApproveAIAudio}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{approving ? 'Đang lưu...' : 'Phê Duyệt & Lưu Vào Bài Học'}</span>
            </button>
            <button
              type="button"
              disabled={generatingAI}
              onClick={() => handleGenerateAIAudio()}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo lại</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewAudio(null)}
              className="px-3 py-2 bg-transparent hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Hủy bản thử này
            </button>
          </div>
        </div>
      )}

      {/* UNIFIED CURRENT ATTACHED AUDIO DISPLAY */}
      {audioUrl ? (
        <div className="p-4 bg-white rounded-2xl border border-sky-200 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase ${
                    audioMetadata?.engine === 'gemini_tts' || audioMetadata?.voiceType === 'gemini_tts'
                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                      : audioMetadata?.engine === 'piper_tts' || audioMetadata?.voiceType === 'piper_tts'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : audioMetadata?.engine === 'teacher_upload' || audioMetadata?.voiceType === 'teacher_voice'
                      ? 'bg-sky-100 text-sky-900 border border-sky-200'
                      : 'bg-purple-100 text-purple-800'
                  }`}
                >
                  {audioMetadata?.engine === 'gemini_tts' || audioMetadata?.voiceType === 'gemini_tts'
                    ? 'AI Gemini TTS (Trực Tuyến)'
                    : audioMetadata?.engine === 'piper_tts' || audioMetadata?.voiceType === 'piper_tts'
                    ? 'Piper AI TTS (Ngoại Tuyến)'
                    : audioMetadata?.engine === 'teacher_upload' || audioMetadata?.voiceType === 'teacher_voice'
                    ? 'Giáo viên thu âm'
                    : 'Mẫu VieNeu-TTS'}
                </span>
                <span className="text-xs font-black text-slate-900 truncate max-w-[280px]">
                  {audioMetadata?.fileName || 'Tệp âm thanh bài đọc'}
                </span>
                {audioMetadata?.model && (
                  <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                    {audioMetadata.model}
                  </span>
                )}
                {audioMetadata?.voiceId && (
                  <span className="text-[10px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                    Giọng: {audioMetadata.voiceId}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-semibold mt-1">
                {(audioMetadata?.sizeBytes || audioMetadata?.size) && (
                  <span>
                    Dung lượng: {(((audioMetadata.sizeBytes || audioMetadata.size)!) / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
                {(audioMetadata?.durationSeconds || audioMetadata?.duration) && (
                  <span>
                    Thời lượng: ~{audioMetadata.durationSeconds || audioMetadata.duration} giây
                  </span>
                )}
                {audioMetadata?.storagePath && (
                  <span className="text-slate-400 font-mono text-[10px]">
                    [{audioMetadata.storagePath}]
                  </span>
                )}
                <span className="text-emerald-700 font-bold">
                  ✓ Đã lưu bền vững trong kho lưu trữ (Không lưu Base64 trong Firestore)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Đổi tệp</span>
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={onAudioDeleted}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xóa</span>
              </button>
            </div>
          </div>

          <audio controls src={audioUrl} className="w-full h-9 rounded-lg" />
        </div>
      ) : (
        <div className="p-3 bg-white/70 border border-dashed border-sky-300 rounded-xl text-center text-xs text-slate-500 font-medium">
          Bài đọc hiện tại chưa gắn tệp âm thanh. Khi xuất bản, học sinh có thể nghe qua giọng đọc tiếng Việt của thiết bị (nếu có hỗ trợ) hoặc tự luyện đọc.
        </div>
      )}

      {/* FULLSCREEN IMAGE ZOOM MODAL */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden shadow-2xl flex flex-col relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h5 className="text-xs sm:text-sm font-black text-slate-900">{zoomedImage.title}</h5>
                <p className="text-[11px] text-slate-500 font-medium">{zoomedImage.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Image Area */}
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950/5">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
