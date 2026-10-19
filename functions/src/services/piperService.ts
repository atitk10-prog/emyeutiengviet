import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';

export interface GeneratePiperSpeechOptions {
  text: string;
  title?: string;
  grade?: number;
  lengthScale?: number;
  readingStyle?: 'standard' | 'expressive_slow' | 'storytelling';
}

export interface GeneratedPiperSpeechResult {
  audioBuffer: Buffer;
  durationSeconds: number;
  mimeType: string;
  model: string;
  voiceId: string;
}

export class PiperService {
  /**
   * Resolve Python executable capable of running Piper TTS.
   */
  public static getPythonExecutable(): string | null {
    if (process.env.PIPER_PYTHON_PATH && fs.existsSync(process.env.PIPER_PYTHON_PATH)) {
      return process.env.PIPER_PYTHON_PATH;
    }

    const candidates = [
      path.resolve(__dirname, '../../../scratch/tts-eval/venv/Scripts/python.exe'),
      path.resolve(__dirname, '../../../../scratch/tts-eval/venv/Scripts/python.exe'),
      'python'
    ];

    for (const c of candidates) {
      if (c === 'python') return 'python';
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return null;
  }

  /**
   * Resolve Piper ONNX model path.
   */
  public static getModelPath(): string | null {
    if (process.env.PIPER_MODEL_PATH && fs.existsSync(process.env.PIPER_MODEL_PATH)) {
      return process.env.PIPER_MODEL_PATH;
    }

    const candidates = [
      'F:\\piper_models\\vi_VN-vais1000-medium.onnx',
      path.resolve(__dirname, '../../../scratch/tts-eval/models/vi_VN-vais1000-medium.onnx'),
      path.resolve(__dirname, '../../../piper_models/vi_VN-vais1000-medium.onnx')
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }

    return null;
  }

  /**
   * Check if Piper TTS service is available.
   */
  public static isAvailable(): { available: boolean; reason?: string } {
    const pythonExe = this.getPythonExecutable();
    if (!pythonExe) {
      return {
        available: false,
        reason: 'Chưa phát hiện môi trường thực thi Python cho Piper TTS.'
      };
    }

    const modelPath = this.getModelPath();
    if (!modelPath) {
      return {
        available: false,
        reason: 'Không tìm thấy tệp mô hình tiếng Việt vi_VN-vais1000-medium.onnx.'
      };
    }

    const scriptPath = path.resolve(__dirname, '../../../scripts/piper_synthesize.py');
    if (!fs.existsSync(scriptPath)) {
      return {
        available: false,
        reason: 'Thiếu tệp script scripts/piper_synthesize.py.'
      };
    }

    return { available: true };
  }

  /**
   * Synthesize Vietnamese speech offline using Piper TTS.
   */
  public static async generateSpeech(
    options: GeneratePiperSpeechOptions
  ): Promise<GeneratedPiperSpeechResult> {
    const check = this.isAvailable();
    if (!check.available) {
      throw new Error(check.reason || 'Dịch vụ Piper TTS ngoại tuyến không khả dụng.');
    }

    const pythonExe = this.getPythonExecutable()!;
    const modelPath = this.getModelPath()!;
    const scriptPath = path.resolve(__dirname, '../../../scripts/piper_synthesize.py');

    // Synthesize strictly the passage text (starts directly from the first sentence in ~1-2s)
    const fullText = (options.text || '').trim();
    if (fullText.length < 20) {
      throw new Error('Văn bản bài đọc quá ngắn để tạo giọng đọc AI (tối thiểu 20 ký tự).');
    }

    // Determine length scale: if grade 2 or expressive_slow, default to 1.20 - 1.25 for pedagogical clarity
    let lengthScale = options.lengthScale;
    if (typeof lengthScale !== 'number') {
      if (options.readingStyle === 'expressive_slow' || options.grade === 2) {
        lengthScale = 1.20;
      } else {
        lengthScale = 1.0;
      }
    }

    // Temporary scratch directory for generation
    const tempDir = path.resolve(__dirname, '../../../scratch/tts-eval/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempId = `piper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempInputJson = path.join(tempDir, `${tempId}_input.json`);
    const tempOutputWav = path.join(tempDir, `${tempId}_out.wav`);

    // Write input JSON to avoid shell escaping issues with Vietnamese UTF-8
    fs.writeFileSync(tempInputJson, JSON.stringify({ text: fullText }), 'utf8');

    try {
      const args = [
        scriptPath,
        '--text-file', tempInputJson,
        '--output', tempOutputWav,
        '--model', modelPath,
        '--length-scale', String(lengthScale)
      ];

      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          pythonExe,
          args,
          {
            timeout: 35000,
            maxBuffer: 5 * 1024 * 1024,
            windowsHide: true,
            encoding: 'utf8'
          },
          (err, stdoutData, stderrData) => {
            if (err) {
              const errMsg = stderrData || stdoutData || err.message;
              return reject(new Error(`Thực thi Piper thất bại: ${errMsg}`));
            }
            resolve(stdoutData);
          }
        );
      });

      let parsed: any;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch (jsonErr) {
        throw new Error(`Phản hồi từ Piper CLI không hợp lệ: ${stdout}`);
      }

      if (!parsed.success) {
        throw new Error(parsed.error || 'Piper TTS không thể tạo tệp âm thanh.');
      }

      if (!fs.existsSync(tempOutputWav)) {
        throw new Error('Tệp âm thanh WAV đầu ra của Piper không tồn tại.');
      }

      const audioBuffer = fs.readFileSync(tempOutputWav);

      return {
        audioBuffer,
        durationSeconds: parsed.durationSeconds || Math.round(audioBuffer.length / (22050 * 2)),
        mimeType: 'audio/wav',
        model: parsed.model || 'vi_VN-vais1000-medium',
        voiceId: 'vi_VN-vais1000'
      };
    } finally {
      // Clean up temp files
      if (fs.existsSync(tempInputJson)) {
        try { fs.unlinkSync(tempInputJson); } catch (_) {}
      }
      if (fs.existsSync(tempOutputWav)) {
        try { fs.unlinkSync(tempOutputWav); } catch (_) {}
      }
    }
  }
}
