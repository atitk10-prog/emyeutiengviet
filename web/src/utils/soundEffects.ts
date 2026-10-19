// Web Audio API Sound Effects for EM YEU TIENG VIET
// Completely offline, zero external dependencies, child-friendly audio cues.

const SOUND_STORAGE_KEY = 'emytv_sound_enabled';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage errors
  }
}

// Preloaded HTML5 Audio objects for instant, zero-latency playback
let correctAudio: HTMLAudioElement | null = null;
let incorrectAudio: HTMLAudioElement | null = null;

function getAudioElements() {
  if (typeof window === 'undefined') return { correct: null, incorrect: null };
  if (!correctAudio) {
    correctAudio = new Audio('/audio/correct.wav');
    correctAudio.volume = 0.35; // Gentle, child-friendly volume
  }
  if (!incorrectAudio) {
    incorrectAudio = new Audio('/audio/incorrect.wav');
    incorrectAudio.volume = 0.25; // Soft volume, non-intrusive
  }
  return { correct: correctAudio, incorrect: incorrectAudio };
}

/**
 * Play a cheerful, gentle chime for correct answers (C5 -> E5 -> G5)
 */
export function playCorrectSound(): void {
  if (!isSoundEnabled()) return;

  const { correct } = getAudioElements();
  if (correct) {
    try {
      correct.currentTime = 0;
      correct.play().catch(() => {
        // Fallback to Web Audio synthesis if HTML5 audio is blocked
        playSynthesizedCorrect();
      });
      return;
    } catch {
      // Fallback
    }
  }

  playSynthesizedCorrect();
}

function playSynthesizedCorrect(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note 1: C5 (523.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    // Note 2: G5 (783.99 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.14, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.38);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}

/**
 * Play a soft, gentle tone for incorrect answers encouraging another try (D4 -> B3)
 */
export function playWrongSound(): void {
  if (!isSoundEnabled()) return;

  const { incorrect } = getAudioElements();
  if (incorrect) {
    try {
      incorrect.currentTime = 0;
      incorrect.play().catch(() => {
        // Fallback to Web Audio synthesis if HTML5 audio is blocked
        playSynthesizedWrong();
      });
      return;
    } catch {
      // Fallback
    }
  }

  playSynthesizedWrong();
}

function playSynthesizedWrong(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Note: Soft slide
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(246.94, now); // B3
    osc.frequency.linearRampToValueAtTime(196.00, now + 0.22); // G3
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch (err) {
    console.warn('Audio playback error:', err);
  }
}
