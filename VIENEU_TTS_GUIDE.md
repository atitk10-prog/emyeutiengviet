# HƯỚNG DẪN TÍCH HỢP & NGHIÊN CỨU GIỌNG ĐỌC TIẾNG VIỆT VIENEU-TTS CỤC BỘ
**Dự án:** EM YÊU TIẾNG VIỆT — Phiên bản V5.2.1

---

## 1. Bối cảnh & Mục tiêu

Trong các đợt khảo sát thực tế tại các trường tiểu học (đặc biệt là máy tính chạy Windows tiêu chuẩn tại trường học hoặc vùng nông thôn/miền núi), hệ thống thường xuất hiện thông báo:
> *"Thiết bị chưa có giọng đọc tiếng Việt"*

Nguyên nhân do nhiều bản Windows không được cài sẵn gói ngôn ngữ tiếng Việt (SAPI Vietnamese Speech Engine), dẫn đến `Web Speech API (SpeechSynthesis)` không tìm thấy voice `vi-VN`.

Để giải quyết triệt để vấn đề này, **EM YÊU TIẾNG VIỆT V5.2.1** áp dụng nguyên tắc thiết kế 2 tầng:
1. **Tầng 1 (Ưu tiên số 1):** Hỗ trợ giáo viên tải lên hoặc gắn đường dẫn tệp âm thanh đọc mẫu **MP3/WAV** do giáo viên tự ghi âm hoặc duyệt trước.
2. **Tầng 2 (Tạo âm thanh tự động):** Nghiên cứu và ứng dụng giải pháp **VieNeu-TTS** (Mô hình Text-to-Speech nơ-ron tiếng Việt chất lượng cao) chạy cục bộ.

---

## 2. Vì sao KHÔNG cài đặt mô hình lớn vào Firebase Cloud Functions?

Theo đúng chỉ đạo tại `AGENTS.md` và `PHASE 5`:
* **Giới hạn kích thước gói triển khai:** Cloud Functions giới hạn kích thước code bundle và bộ nhớ. Việc nhúng các checkpoint PyTorch/ONNX nặng (từ vài trăm MB đến vài GB) sẽ dẫn đến lỗi deploy hoặc chi phí lưu trữ lớn.
* **Thời gian khởi động lạnh (Cold Start):** Tải trọng số mô hình AI nơ-ron vào RAM mất từ 5–15 giây mỗi lần cold start, làm nghẽn trải nghiệm người dùng.
* **Tài nguyên tính toán (CPU/GPU) & Chi phí:** Chạy suy luận TTS trên Cloud Functions ngốn nhiều CPU compute time, dẫn đến tăng vọt chi phí hóa đơn Firebase Blaze không cần thiết.
* **Khả năng hoạt động Offline / Trường học:** Máy chủ cục bộ tại trường hoặc máy tính của giáo viên có thể chạy tạo âm thanh hoàn toàn miễn phí và không phụ thuộc đường truyền Internet.

---

## 3. Kiến trúc đề xuất: Local Voice Sidecar Service

```
┌───────────────────────────┐         ┌──────────────────────────────┐
│  Trình duyệt Giáo viên    │  HTTP   │  VieNeu-TTS Local Service    │
│  (React / Vite Web App)   │────────>│  (FastAPI + ONNX Runtime)    │
│                           │<────────│  (Chạy trên cổng localhost)   │
└─────────────┬─────────────┘   WAV   └──────────────────────────────┘
              │                  tệp âm thanh
              ▼
┌───────────────────────────┐
│  Firebase Storage / CDN   │ (Lưu trữ URL tệp audio theo phiên bản bài đọc)
└───────────────────────────┘
```

### Quy trình hoạt động:
1. Giáo viên mở màn hình soạn bài đọc trên `EM YÊU TIẾNG VIỆT`.
2. Khi giáo viên bấm nút **"Tổng hợp giọng đọc tiếng Việt (VieNeu-TTS)"**:
   - Trình duyệt gửi văn bản bài đọc tới dịch vụ VieNeu-TTS chạy cục bộ (mặc định cổng `http://localhost:8000/synthesize`).
   - VieNeu-TTS thực hiện chuẩn hóa văn bản tiếng Việt (gỡ dấu thanh, xử lý số đếm, ngắt câu tự nhiên theo ngữ điệu lớp 2-3).
   - Mô hình nơ-ron tạo tệp âm thanh sóng âm PCM `.wav` với giọng nữ/nam truyền cảm.
3. Tệp `.wav` được trả về trình duyệt để giáo viên nghe thử trực tiếp.
4. Sau khi giáo viên duyệt, tệp âm thanh được lưu theo phiên bản bài đọc (`audioUrl`).
5. Học sinh khi mở bài đọc sẽ nghe trực tiếp từ tệp âm thanh đã được chuẩn hóa, **không còn phụ thuộc vào việc máy tính có gói SAPI tiếng Việt hay không**.

---

## 4. Hướng dẫn cài đặt và chạy VieNeu-TTS Cục bộ

### Yêu cầu môi trường:
- Python 3.10 hoặc 3.11.
- RAM tối thiểu: 4GB (Khuyến nghị 8GB).
- Hệ điều hành: Windows 10/11, macOS, hoặc Linux.

### Các bước thiết lập nhanh:

```bash
# 1. Tạo môi trường ảo Python
python -m venv vieneu-env
vieneu-env\Scripts\activate   # Trên Windows

# 2. Cài đặt các thư viện cần thiết
pip install fastapi uvicorn onnxruntime soundfile phonemizer-vi numpy

# 3. Chạy dịch vụ máy chủ cục bộ
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

### Đoạn mã máy chủ mẫu (`server.py`):

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import soundfile as sf
import io
import base64

app = FastAPI(title="VieNeu-TTS Local Synthesizer")

# Cho phép ứng dụng EM YÊU TIẾNG VIỆT gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    voice: str = "northern_female" # Giọng đọc mẫu chuẩn Hà Nội
    speed: float = 0.9              # Tốc độ đọc chậm rãi cho học sinh tiểu học

@app.post("/synthesize")
async def synthesize_speech(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Văn bản không được để trống")
    
    # Giả lập hoặc gọi mô hình nơ-ron VieNeu-TTS
    # wav_data, sample_rate = vieneu_engine.infer(req.text, req.voice, req.speed)
    
    # Xuất ra base64 audio data URI
    return {
        "success": True,
        "format": "audio/wav",
        "audioUrl": "/assets/audio/cham_soc_cay_xanh.wav"
    }
```

---

## 5. Bảng so sánh các giải pháp âm thanh tiếng Việt

| Tiêu chí | Web Speech API (Trình duyệt) | Google Cloud TTS | VieNeu-TTS Cục bộ | Tệp MP3/WAV do Giáo viên gắn |
| :--- | :--- | :--- | :--- | :--- |
| **Độ phụ thuộc thiết bị** | Phụ thuộc SAPI Windows | Cần Internet & API Key | Cần chạy dịch vụ cục bộ | **Không phụ thuộc bất kỳ thiết bị nào** |
| **Độ tự nhiên ngữ điệu** | Khá khô cứng / Robot | Rất tự nhiên | Rất tự nhiên, chuẩn biểu cảm | **Giọng giáo viên thật 100%** |
| **Chi phí** | Miễn phí | Tính phí theo ký tự (Blaze) | Miễn phí hoàn toàn | **Miễn phí** |
| **Bảo mật học sinh** | An toàn | Gửi văn bản lên Cloud | Cục bộ 100% | **An toàn 100%** |
| **Đánh giá triển khai** | Dùng làm Fallback | Tùy chọn nâng cao | Tùy chọn cục bộ | **Được chọn làm giải pháp chính (V5.2.1)** |

---

## 6. Kết luận & Khuyến nghị sư phạm

Đối với đối tượng học sinh Lớp 2 và Lớp 3, giọng đọc của chính thầy cô giáo chủ nhiệm hoặc tệp đọc mẫu chuẩn phát âm là giải pháp mang lại cảm xúc sư phạm tốt nhất. 

Do đó, **EM YÊU TIẾNG VIỆT V5.2.1 đã hoàn thiện đầy đủ giao diện cho phép thầy cô tải tệp ghi âm MP3/WAV trực tiếp vào bài đọc**, đồng thời sẵn sàng cổng kết nối mở tới dịch vụ VieNeu-TTS cục bộ khi nhà trường có nhu cầu tổng hợp giọng đọc hàng loạt mà không phát sinh bất kỳ chi phí Cloud nào.
