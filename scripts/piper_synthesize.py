"""
Piper TTS synthesis wrapper script for EM YÊU TIẾNG VIỆT
Takes input text, model path, length_scale, and output WAV path.
Outputs JSON metadata to stdout.
"""

import os
import sys
import argparse
import json
import time
import wave

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def find_default_model():
    candidates = [
        r"F:\piper_models\vi_VN-vais1000-medium.onnx",
        os.path.join(os.path.dirname(__file__), "..", "scratch", "tts-eval", "models", "vi_VN-vais1000-medium.onnx"),
        os.path.join(os.path.dirname(__file__), "..", "piper_models", "vi_VN-vais1000-medium.onnx"),
        "scratch/tts-eval/models/vi_VN-vais1000-medium.onnx"
    ]
    for c in candidates:
        abs_c = os.path.abspath(c)
        if os.path.exists(abs_c):
            return abs_c
    return None

def main():
    parser = argparse.ArgumentParser(description="EM YÊU TIẾNG VIỆT Piper TTS Synthesizer")
    parser.add_argument("--text", type=str, help="Text to synthesize")
    parser.add_argument("--text-file", type=str, help="Path to UTF-8 text or JSON file")
    parser.add_argument("--output", type=str, required=True, help="Path to output WAV file")
    parser.add_argument("--length-scale", type=float, default=1.0, help="Reading speed scale (1.0 = normal, 1.25 = slower)")
    parser.add_argument("--model", type=str, default=None, help="Path to ONNX model file")
    parser.add_argument("--config", type=str, default=None, help="Path to ONNX JSON config file")

    args = parser.parse_args()

    # 1. Determine model path
    model_path = args.model
    if not model_path:
        model_path = find_default_model()

    if not model_path or not os.path.exists(model_path):
        result = {
            "success": False,
            "error": f"Không tìm thấy tệp mô hình Piper tiếng Việt (.onnx). Vui lòng kiểm tra F:\\piper_models hoặc scratch\\tts-eval\\models."
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    # 2. Determine config path
    config_path = args.config
    if not config_path:
        default_config = model_path + ".json"
        if os.path.exists(default_config):
            config_path = default_config

    # 3. Read input text
    text = ""
    if args.text_file and os.path.exists(args.text_file):
        with open(args.text_file, "r", encoding="utf-8") as f:
            content = f.read()
            try:
                data = json.loads(content)
                if isinstance(data, dict) and "text" in data:
                    text = data["text"]
                else:
                    text = content
            except Exception:
                text = content
    elif args.text:
        text = args.text
    else:
        # Read from stdin if available
        if not sys.stdin.isatty():
            text = sys.stdin.read()

    text = text.strip()
    if not text:
        result = {
            "success": False,
            "error": "Văn bản bài đọc rỗng, không thể tổng hợp giọng đọc."
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    # 4. Check destination directory
    out_dir = os.path.dirname(os.path.abspath(args.output))
    if not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)

    # 5. Synthesize using piper
    try:
        from piper.voice import PiperVoice
        from piper.config import SynthesisConfig

        t0 = time.time()
        voice = PiperVoice.load(model_path, config_path, use_cuda=False)
        load_time = time.time() - t0

        cfg = SynthesisConfig(length_scale=args.length_scale)

        t_synth = time.time()
        with wave.open(args.output, "wb") as wf:
            voice.synthesize_wav(text, wf, syn_config=cfg)
        synth_elapsed = time.time() - t_synth

        # Read WAV attributes
        with wave.open(args.output, "rb") as wf:
            n_channels = wf.getnchannels()
            framerate = wf.getframerate()
            n_frames = wf.getnframes()
            duration_sec = n_frames / float(framerate)

        file_size = os.path.getsize(args.output)
        model_name = os.path.basename(model_path).replace(".onnx", "")

        result = {
            "success": True,
            "outputFile": os.path.abspath(args.output).replace("\\", "/"),
            "durationSeconds": round(duration_sec, 2),
            "sampleRate": framerate,
            "channels": n_channels,
            "sizeBytes": file_size,
            "model": model_name,
            "voiceId": "vi_VN-vais1000",
            "lengthScale": args.length_scale,
            "loadTimeSeconds": round(load_time, 3),
            "synthTimeSeconds": round(synth_elapsed, 3),
            "rtf": round(synth_elapsed / duration_sec, 3) if duration_sec > 0 else 0
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)

    except Exception as e:
        result = {
            "success": False,
            "error": f"Lỗi khi thực thi Piper TTS: {str(e)}"
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
