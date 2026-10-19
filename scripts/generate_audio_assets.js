const fs = require('fs');
const path = require('path');

// Helper to write valid 16-bit PCM WAV
function createWavBuffer(sampleRate, samples) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples (float -1.0 to 1.0 clamped to int16)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }

  return buffer;
}

// 1. Generate Friendly Correct Sound Effect (Chime C5 -> E5 -> G5, warm decay)
function generateCorrectSfx() {
  const sampleRate = 44100;
  const duration = 0.55;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 523.25, start: 0.0, end: 0.4 },  // C5
    { freq: 659.25, start: 0.1, end: 0.45 }, // E5
    { freq: 783.99, start: 0.2, end: 0.55 }  // G5
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (const n of notes) {
      if (t >= n.start && t < n.end) {
        const nt = t - n.start;
        const env = Math.exp(-nt * 8) * Math.sin(Math.min(1, nt * 40) * Math.PI * 0.5);
        s += env * 0.25 * Math.sin(2 * Math.PI * n.freq * nt);
        s += env * 0.08 * Math.sin(4 * Math.PI * n.freq * nt); // overtone
      }
    }
    samples[i] = s;
  }

  return createWavBuffer(sampleRate, samples);
}

// 2. Generate Gentle Incorrect Sound Effect (Soft woodblock tone D4 -> B3, not harsh)
function generateIncorrectSfx() {
  const sampleRate = 44100;
  const duration = 0.35;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 293.66, start: 0.0, end: 0.18 }, // D4
    { freq: 246.94, start: 0.12, end: 0.32 } // B3
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (const n of notes) {
      if (t >= n.start && t < n.end) {
        const nt = t - n.start;
        const env = Math.exp(-nt * 14) * Math.sin(Math.min(1, nt * 50) * Math.PI * 0.5);
        // Soft rounded sine wave with warm low harmonic
        s += env * 0.22 * Math.sin(2 * Math.PI * n.freq * nt);
        s += env * 0.05 * Math.sin(2 * Math.PI * (n.freq * 0.5) * nt);
      }
    }
    samples[i] = s;
  }

  return createWavBuffer(sampleRate, samples);
}

// 3. Generate Speech Formant Synthesis Samples (for comparison demonstration)
function generateSpeechSample(type) {
  const sampleRate = type === 'piper' ? 16000 : type === 'vieneu' ? 24000 : 44100;
  const duration = 4.2; // ~4 seconds speech phrase
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  // Formant frequencies for Vietnamese vowels /o/, /i/, /a/, /u/
  const pitchBase = type === 'piper' ? 150 : type === 'vieneu' ? 190 : 210;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Cadence / syllable cadence
    const syllableRate = type === 'piper' ? 4.5 : type === 'vieneu' ? 3.8 : 3.2; // Teacher reads slower for Grade 2
    const syllablePhase = (t * syllableRate) % 1.0;
    const syllEnv = Math.sin(syllablePhase * Math.PI);
    
    // Pitch inflection
    let pitchMod = pitchBase;
    if (type === 'piper') {
      // Flat pitch, mechanical
      pitchMod = pitchBase + Math.sin(t * 1.5) * 5;
    } else if (type === 'vieneu') {
      // Neural pitch curve with tone inflection
      pitchMod = pitchBase + Math.sin(t * 5.0) * 25 + Math.cos(t * 2.0) * 15;
    } else {
      // Human teacher warm expressive contour
      pitchMod = pitchBase + Math.sin(t * 3.5) * 35 + Math.sin(t * 8.0) * 10;
    }

    if (syllEnv > 0.05 && t < 3.8) {
      const f1 = 500 + Math.sin(t * 4) * 200;
      const f2 = 1500 + Math.cos(t * 3) * 300;
      const f3 = 2500;

      let v = 0;
      v += Math.sin(2 * Math.PI * pitchMod * t) * 0.4;
      v += Math.sin(2 * Math.PI * f1 * t) * 0.25;
      v += Math.sin(2 * Math.PI * f2 * t) * 0.15;
      v += Math.sin(2 * Math.PI * f3 * t) * 0.08;

      // Add gentle breathiness for teacher recording
      if (type === 'teacher') {
        const noise = (Math.random() - 0.5) * 0.03;
        v += noise;
      }

      samples[i] = v * syllEnv * 0.5;
    } else {
      samples[i] = 0;
    }
  }

  return createWavBuffer(sampleRate, samples);
}

// Generate all files
const outDir = path.join(__dirname, '../web/public/audio');
const samplesDir = path.join(outDir, 'samples');
fs.mkdirSync(samplesDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'correct.wav'), generateCorrectSfx());
fs.writeFileSync(path.join(outDir, 'incorrect.wav'), generateIncorrectSfx());

fs.writeFileSync(path.join(samplesDir, 'audio_sample_1_piper_vais.wav'), generateSpeechSample('piper'));
fs.writeFileSync(path.join(samplesDir, 'audio_sample_2_vieneu_neural.wav'), generateSpeechSample('vieneu'));
fs.writeFileSync(path.join(samplesDir, 'audio_sample_3_teacher_recording.wav'), generateSpeechSample('teacher'));

console.log('✅ Generated audio assets successfully:');
console.log(' - web/public/audio/correct.wav');
console.log(' - web/public/audio/incorrect.wav');
console.log(' - web/public/audio/samples/audio_sample_1_piper_vais.wav');
console.log(' - web/public/audio/samples/audio_sample_2_vieneu_neural.wav');
console.log(' - web/public/audio/samples/audio_sample_3_teacher_recording.wav');
