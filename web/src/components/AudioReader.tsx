import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Pause, Play, AlertCircle, Headphones, RotateCcw, Music, Sparkles } from 'lucide-react';
import { AudioMetadata } from '@emytv/shared';

interface AudioReaderProps {
  text: string;
  title?: string;
  audioUrl?: string;
  audioMetadata?: AudioMetadata;
}

export const AudioReader: React.FC<AudioReaderProps> = ({ text, title, audioUrl, audioMetadata }) => {
  // --- States for Native MP3/WAV audio ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [audioError, setAudioError] = useState(false);

  // Identify whether the audio is AI Gemini, AI Piper, or Teacher uploaded
  const getAudioSourceInfo = () => {
    const meta = audioMetadata;
    const url = (audioUrl || '').toLowerCase();

    if (meta?.engine === 'gemini_tts' || url.includes('gemini_tts') || url.includes('aoede') || url.includes('puck')) {
      const isMale = meta?.voiceId === 'Puck' || url.includes('puck') || url.includes('male');
      return {
        type: 'ai_gemini',
        badge: 'Gemini AI TTS',
        label: `Giọng đọc mẫu AI (Trực tuyến · ${isMale ? 'Thầy giáo Puck' : 'Cô giáo Aoede'})`,
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300'
      };
    }
    if (meta?.engine === 'piper_tts' || url.includes('piper') || url.includes('vais1000')) {
      return {
        type: 'ai_piper',
        badge: 'Piper AI TTS',
        label: 'Giọng đọc mẫu AI (Ngoại tuyến · vi_VN-vais1000)',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300'
      };
    }
    if (meta?.engine === 'teacher_upload' || url.includes('teacher') || url.includes('upload') || url.includes('test_audio') || url.includes('uat_audio')) {
      return {
        type: 'teacher_upload',
        badge: 'Giáo viên tải lên',
        label: 'Bản thu âm giáo viên tải lên (Đã duyệt)',
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-300'
      };
    }
    return {
      type: 'approved_voice',
      badge: 'Bản thu chuẩn',
      label: 'Giọng đọc mẫu (Bản thu MP3/WAV giáo viên duyệt)',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300'
    };
  };

  const audioSource = getAudioSourceInfo();

  // --- States for SpeechSynthesis vi-VN fallback ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState<number>(0.85); // Gentle reading speed for grades 2-3
  const [hasSupport, setHasSupport] = useState<boolean>(true);
  const [viVoice, setViVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [checkedVoices, setCheckedVoices] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isVietnameseVoice = (v: SpeechSynthesisVoice): boolean => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-');
    const name = (v.name || '').toLowerCase();
    return (
      lang === 'vi' ||
      lang.startsWith('vi-') ||
      name.includes('vietnam') ||
      name.includes('tiếng việt') ||
      name.includes('vietnamese')
    );
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setHasSupport(false);
      setCheckedVoices(true);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const foundVoice = voices.find(isVietnameseVoice) || null;
      setViVoice(foundVoice);
      if (voices.length > 0) {
        setCheckedVoices(true);
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const timer = setTimeout(() => {
      loadVoices();
      setCheckedVoices(true);
    }, 500);

    return () => {
      clearTimeout(timer);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Cancel speech when passage changes
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
    }
  }, [text, title, audioUrl]);

  // Handle Play for Audio File (MP3/WAV)
  const handleToggleAudioFile = () => {
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      // Stop speech synthesis if running
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setIsPaused(false);
      }
      audioRef.current.play().then(() => {
        setIsAudioPlaying(true);
      }).catch((e: any) => console.warn('Audio play error:', e));
    }
  };

  const handleSeekAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setAudioCurrentTime(time);
  };

  const handleChangePlaybackRate = (newRate: number) => {
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle SpeechSynthesis Play
  const handlePlayTTS = () => {
    if (!('speechSynthesis' in window) || !viVoice) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();

    const fullContent = title ? `${title}. ${text}` : text;
    const utterance = new SpeechSynthesisUtterance(fullContent);
    utterance.voice = viVoice;
    utterance.lang = viVoice.lang || 'vi-VN';
    utterance.rate = rate;
    utterance.pitch = 1.05;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePauseTTS = () => {
    if ('speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStopTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  // --- RENDER 1: Dedicated MP3/WAV Teacher-Approved Audio Player ---
  if (audioUrl) {
    if (audioError) {
      return (
        <div className="flex items-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Tệp âm thanh đọc mẫu đang được cập nhật. Em hãy tự luyện đọc bài theo từng đoạn văn nhé!</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 p-3.5 bg-gradient-to-r from-sky-50 to-emerald-50 border-2 border-emerald-200 rounded-2xl shadow-sm">
        <audio
          ref={audioRef}
          src={audioUrl}
          onError={() => {
            setAudioError(true);
            setIsAudioPlaying(false);
          }}
          onTimeUpdate={() => {
            if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setAudioDuration(audioRef.current.duration);
              setAudioError(false);
            }
          }}
          onEnded={() => {
            setIsAudioPlaying(false);
            setAudioCurrentTime(0);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <Headphones className="w-4 h-4" />
            </span>
            <span className="text-xs font-black text-slate-800">
              {audioSource.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border shadow-xs ${audioSource.badgeColor}`}>
              {audioSource.badge}
            </span>
          </div>

          {/* Speed selector for audio file (0.75x, 1.0x, 1.25x) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold">
            <span className="text-[11px] text-slate-400">Tốc độ:</span>
            {[0.75, 1.0, 1.25].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleChangePlaybackRate(r)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  playbackRate === r
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>

        {/* Player controls bar */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleToggleAudioFile}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow transition active:scale-95 text-xs sm:text-sm"
          >
            {isAudioPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Nghe cô đọc</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = 0;
                setAudioCurrentTime(0);
              }
            }}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition"
            title="Nghe lại từ đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Progress scrubber */}
          <input
            type="range"
            min={0}
            max={audioDuration || 100}
            value={audioCurrentTime}
            onChange={handleSeekAudio}
            className="flex-1 accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
          />

          <span className="text-xs font-mono font-bold text-slate-600 shrink-0">
            {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
          </span>
        </div>
      </div>
    );
  }

  // --- RENDER 2: Browser SpeechSynthesis vi-VN ---
  if (!hasSupport) {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
        <span>Trình duyệt hiện tại chưa hỗ trợ đọc mẫu bằng giọng nói. Em hãy tự đọc bài nhé!</span>
      </div>
    );
  }

  // Device does not have a native Vietnamese voice installed
  // STRICT: Do NOT fallback to English/system voice to read Vietnamese!
  if (checkedVoices && !viVoice) {
    return (
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs md:text-sm">
        <Headphones className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Thiết bị chưa có giọng đọc tiếng Việt.</span>
          <span className="ml-1 text-amber-800 font-medium">
            Em vẫn có thể đọc bài trực tiếp hoặc nhờ cô giáo hỗ trợ nhé!
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-sky-50 border border-sky-200 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2">
        {!isPlaying ? (
          <button
            onClick={handlePlayTTS}
            disabled={!viVoice}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow transition active:scale-95 text-sm md:text-base disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isPaused ? 'Tiếp tục nghe' : 'Nghe đọc mẫu (Tiếng Việt)'}</span>
          </button>
        ) : (
          <button
            onClick={handlePauseTTS}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow transition active:scale-95 text-sm md:text-base"
          >
            <Pause className="w-4 h-4" />
            <span>Tạm dừng</span>
          </button>
        )}

        {(isPlaying || isPaused) && (
          <button
            onClick={handleStopTTS}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition text-sm"
          >
            <VolumeX className="w-4 h-4" />
            <span>Dừng hẳn</span>
          </button>
        )}
      </div>

      {/* Speed control */}
      {viVoice && (
        <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-slate-600 ml-auto">
          <Volume2 className="w-4 h-4 text-sky-600" />
          <span>Tốc độ:</span>
          <button
            onClick={() => {
              setRate(0.75);
              if (isPlaying) handlePlayTTS();
            }}
            className={`px-2.5 py-1 rounded-lg transition ${
              rate === 0.75 ? 'bg-sky-600 text-white font-bold' : 'bg-white text-slate-600 border'
            }`}
          >
            Chậm
          </button>
          <button
            onClick={() => {
              setRate(0.85);
              if (isPlaying) handlePlayTTS();
            }}
            className={`px-2.5 py-1 rounded-lg transition ${
              rate === 0.85 ? 'bg-sky-600 text-white font-bold' : 'bg-white text-slate-600 border'
            }`}
          >
            Vừa
          </button>
        </div>
      )}
    </div>
  );
};
