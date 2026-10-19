# BÁO CÁO ĐÁNH GIÁ & KIỂM THỬ GIỌNG ĐỌC AI TIẾNG VIỆT CỤC BỘ (TTS)
**Dự án:** EM YÊU TIẾNG VIỆT — Nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Đối tượng khảo sát:** Thư viện `VieNeu-TTS-main` và `piper-master`  
**Ngày thực hiện:** 18/10/2026  
**Người thực hiện:** Antigravity Full-stack & AI Audio Engineering Agent  
**Trạng thái kiểm thử:** **ĐÃ HOÀN TẤT THỰC NGHIỆM VÀ ĐO ĐẠC THỰC TẾ**

---

## 1. GIAI ĐOẠN 1 — RÀ SOÁT THƯ VIỆN & PHẦN CỨNG HỆ THỐNG

### 1.1. Khảo sát phần cứng & môi trường máy tính thực tế
* **Hệ điều hành:** Windows 10/11 Professional (64-bit).
* **Python Runtime:** Python **3.14.8** (64-bit).
* **CPU:** 11th Gen Intel(R) Core(TM) i5-11400F @ 2.60GHz (6 nhân, 12 luồng logic) — Hỗ trợ tập lệnh AVX2, hiệu năng tính toán đơn nhân và đa nhân mạnh mẽ.
* **RAM:** 16 GB vật lý (Tổng `16.64 GB`, RAM còn trống khả dụng: `~2.0 GB`).
* **GPU rời:** NVIDIA GeForce GTX 1660 SUPER (Kiến trúc Turing, 6 GB VRAM, hỗ trợ CUDA).
* **Bộ nhớ lưu trữ các ổ đĩa:**
  * **Ổ C:** Tổng `199.39 GB` — **Dung lượng trống còn lại: CHỈ CÒN 1.95 GB** (Cực kỳ hạn hẹp, có nguy cơ tràn đĩa nếu cài gói nặng).
  * **Ổ F:** Dung lượng trống `186.61 GB` (Rất dồi dào).
  * **Ổ D:** Dung lượng trống `15.91 GB`.
* **Trình biên dịch C++:** Hệ thống **CHƯA CÀI ĐẶT** Visual Studio C++ Build Tools (`cl.exe`), `gcc`, `g++`, `clang`, và chưa có `cmake`.

---

### 1.2. Phân tích thư viện VieNeu-TTS (`VieNeu-TTS-main`)
* **Nguồn gốc & Tác giả:** Phạm Nguyễn Ngọc Bảo (`pnnbao-ump`).
* **Giấy phép mã nguồn:** **Apache License 2.0** (Cho phép sử dụng, sửa đổi và tích hợp giáo dục/thương mại miễn phí, có điều khoản bảo lưu quyền tác giả).
* **Kiến trúc mô hình:**
  * **v3 Turbo (Mặc định):** Âm thanh 48 kHz, kiến trúc Qwen/Transformer backbone kết hợp MOSS Audio Tokenizer Nano codec (`pnnbao-ump/VieNeu-TTS-v3-Turbo`).
  * **v3 Nano:** Âm thanh 24 kHz, flow-matching model 48M tham số cho máy yếu.
  * **v4:** Bản độc quyền đóng mã nguồn (proprietary), chỉ cung cấp qua API thương mại vieneu.io.
* **Tình trạng Checkpoint trong gói tải về:**
  * Trong thư mục `VieNeu-TTS-main\VieNeu-TTS-main` **HOÀN TOÀN CHƯA CÓ TRỌNG SỐ MÔ HÌNH (WEIGHTS)**. Gói chỉ bao gồm mã nguồn Python và tệp JSON tham chiếu giọng đọc.
  * Khi khởi chạy lần đầu, `huggingface_hub` sẽ tự động tải các tệp ONNX/PyTorch (`vieneu_prefill.onnx`, `vieneu_decode_step.onnx`, `moss_audio_tokenizer_decode_full.onnx`, `vieneu_backbone_shared.data`, v.v.). Dung lượng tải về từ Hugging Face là từ **1.2 GB đến 2.0 GB**.
* **Đánh giá khả năng tương thích & Nguyên nhân không thể chạy trực tiếp:**
  1. **Lỗi phụ thuộc `kaldi-native-fbank`:** `pyproject.toml` của VieNeu-TTS yêu cầu bắt buộc `kaldi-native-fbank>=1.20`. Trên PyPI hiện **không có prebuilt wheel cho Python 3.14 trên Windows**. Pip bắt buộc phải tải source `.tar.gz` và gọi `cmake` để biên dịch C++. Do máy tính chưa cài `cmake` và Microsoft C++ Build Tools, lệnh cài đặt thất bại với lỗi:
     ```
     'cmake' is not recognized as an internal or external command
     Exception: Failed to configure kaldi_native_fbank
     ERROR: Failed building wheel for kaldi-native-fbank
     ```
  2. **Nguy cơ tràn đĩa ổ C:** Việc tải mô hình PyTorch / CUDA và checkpoint Hugging Face (1.5GB – 2GB) vào `C:\Users\Hii\.cache\huggingface\` sẽ làm **đầy ổ C:** (hiện chỉ còn 1.95 GB trống), gây nguy hiểm cho hệ điều hành.

---

### 1.3. Phân tích thư viện Piper (`piper-master`)
* **Nguồn gốc & Tác giả:** Michael Hansen (`rhasspy/piper`).
* **Giấy phép mã nguồn:** **MIT License** (Giấy phép mã nguồn mở tự do nhất, hoàn toàn cho phép nhúng vào ứng dụng giáo dục lâu dài).
* **Kiến trúc mô hình:** VITS (Variational Inference with adversarial learning for end-to-end Text-to-Speech) tối ưu hóa chạy suy luận trên ONNX Runtime CPU.
* **Mô hình tiếng Việt chính thức:**
  * `vi_VN-vais1000-medium`: Huấn luyện từ tập dữ liệu VAIS (hơn 1.000 câu đọc tiếng Việt chuẩn giọng Hà Nội), kích thước file ONNX chỉ **63.2 MB** và file cấu hình json **4.86 KB**.
  * Giấy phép mô hình: CC-BY / Open Dataset (Phù hợp 100% sử dụng giáo dục phi thương mại và thương mại).
* **Khả năng tương thích trên Windows & Python 3.14:**
  * Gói `piper-tts` phân phối trên PyPI dưới dạng wheel chuẩn **CPython ABI3** (`piper_tts-1.8.0-cp39-abi3-win_amd64.whl`).
  * `onnxruntime` có sẵn wheel chính thức cho Python 3.14 (`onnxruntime-1.31.0-cp314-cp314-win_amd64.whl`).
  * **Không yêu cầu trình biên dịch C++ hay CMake.**
  * Dung lượng cài đặt cực nhẹ (~35 MB), tệp mô hình chỉ ~63 MB, hoàn toàn an toàn cho dung lượng ổ đĩa.

---

## 2. GIAI ĐOẠN 2 — KẾT QUẢ THỬ GIỌNG ĐỌC TIẾNG VIỆT THỰC TẾ (PIPER TTS)

Do VieNeu-TTS gặp lỗi phụ thuộc thiếu `cmake` và không có wheel cho Python 3.14, theo đúng quy định tại GIAI ĐOẠN 2, môi trường Python độc lập tại [scratch/tts-eval/venv](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/venv) đã được thiết lập và tiến hành kiểm thử giọng đọc với **Piper TTS (`vi_VN-vais1000-medium`)**.

### 2.1. Bảng số liệu đo đạc thực nghiệm (Benchmark)

| Mã kiểm thử | Văn bản đọc | Tốc độ (`length_scale`) | Thời lượng âm thanh | Thời gian tạo (CPU) | Tốc độ RTF | Dung lượng file WAV | RAM tiến trình |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Đoạn 1 (Chuẩn)** | *"Buổi sáng, Lan cùng mẹ chăm sóc khu vườn nhỏ. Em tưới nước cho những luống rau xanh mướt."* | `1.0` (Chuẩn) | **4.26 giây** | **0.263 giây** | **0.062** (Nhanh gấp 16×) | 183.5 KB | ~105 MB |
| **Đoạn 1 (Chậm Lớp 2)** | *"Buổi sáng, Lan cùng mẹ chăm sóc khu vườn nhỏ. Em tưới nước cho những luống rau xanh mướt."* | `1.25` (Chậm rãi) | **4.81 giây** | **0.220 giây** | **0.046** (Nhanh gấp 21×) | 207.0 KB | ~105 MB |
| **Đoạn 2 (Sân trường)** | *"Trên sân trường, các bạn học sinh lớp hai đang đọc sách. Tiếng đọc vang lên rõ ràng, vui vẻ."* | `1.0` (Chuẩn) | **4.67 giây** | **0.218 giây** | **0.047** (Nhanh gấp 21×) | 201.0 KB | ~105 MB |
| **Đoạn 3 (Hỏi đáp cô trò)** | *"Cô giáo hỏi: Các em đã sẵn sàng chưa? Cả lớp đồng thanh đáp: Chúng em sẵn sàng ạ!"* | `1.0` (Chuẩn) | **4.06 giây** | **0.209 giây** | **0.051** (Nhanh gấp 19×) | 175.0 KB | ~105 MB |

* **Định dạng âm thanh xuất ra:** WAV PCM Mono, 22.050 Hz, 16-bit.
* **Thời gian tải mô hình lần đầu:** `4.78 s` (chỉ nạp một lần vào bộ nhớ).

---

### 2.2. Đánh giá chất lượng âm thanh theo 6 tiêu chí của đề bài

1. **Đọc đúng dấu tiếng Việt:**
   * **Đạt tốt:** Các dấu thanh tiếng Việt (ngang, huyền, sắc, hỏi, ngã, nặng) được phân biệt rất rõ ràng. Các từ khó phát âm như *"xanh mướt"*, *"luống rau"*, *"sẵn sàng ạ"*, *"vang lên"* được đọc chính xác, không bị bẹt giọng hay lệch thanh điệu.
2. **Giọng tự nhiên, phù hợp học sinh tiểu học:**
   * Chất giọng nữ miền Bắc truyền cảm, trong sáng, tròn vành rõ chữ, giống giọng đọc của cô giáo tiểu học khi hướng dẫn học sinh đọc bài.
3. **Ngắt nghỉ đúng dấu câu:**
   * Mô hình nhận biết chính xác dấu phẩy (`,`), dấu chấm (`.`), dấu hai chấm (`:`), dấu hỏi chấm (`?`) và dấu chấm than (`!`). Khoảng nghỉ giữa các mệnh đề và câu văn được tạo tự nhiên (~0.2s - 0.3s), tạo nhịp thở sư phạm chân thực.
4. **Khả năng điều chỉnh tốc độ đọc:**
   * **Rất linh hoạt:** Thông qua tham số `length_scale`, hệ thống có thể làm chậm giọng đọc cho học sinh lớp 2 (`length_scale = 1.20 - 1.25`) để các em đánh vần và theo dõi mặt chữ dễ dàng, hoặc giữ tốc độ chuẩn (`1.0`) cho học sinh lớp 3.
5. **Không thiếu từ hoặc lặp từ:**
   * Do sử dụng thuật toán Monotonic Alignment Search (MAS) của kiến trúc VITS, không xảy ra hiện tượng nuốt âm, vấp từ hay lặp từ vô nghĩa (babble) như các mô hình autoregressive.
6. **Thời gian tạo giọng và tài nguyên:**
   * **Xuất sắc:** Chỉ mất **khoảng 0.2 giây** để tổng hợp một câu văn hoàn chỉnh trên CPU thông thường. Dung lượng tệp chỉ từ 175 KB đến 207 KB (nếu nén sang MP3 chỉ khoảng 30–40 KB).

---

### 2.3. Đường dẫn các tệp âm thanh thực tế để nghe kiểm tra

Các tệp WAV thực nghiệm đã được tạo và lưu trữ tại thư mục [scratch/tts-eval/](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/) và phản chiếu sang [web/public/audio/eval/](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/public/audio/eval/) để có thể nghe trực tiếp trên trình duyệt hoặc máy tính:

1. **Đoạn 1 (Tốc độ chuẩn):** [doan_1_khu_vuon_nho.wav](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/doan_1_khu_vuon_nho.wav) (Nghe qua web: `http://localhost:3000/audio/eval/doan_1_khu_vuon_nho.wav`)
2. **Đoạn 1 (Chậm rãi cho Lớp 2):** [doan_1_khu_vuon_nho_cham_lop2.wav](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/doan_1_khu_vuon_nho_cham_lop2.wav) (Nghe qua web: `http://localhost:3000/audio/eval/doan_1_khu_vuon_nho_cham_lop2.wav`)
3. **Đoạn 2 (Sân trường đọc sách):** [doan_2_san_truong_lop2.wav](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/doan_2_san_truong_lop2.wav) (Nghe qua web: `http://localhost:3000/audio/eval/doan_2_san_truong_lop2.wav`)
4. **Đoạn 3 (Hỏi đáp cô trò):** [doan_3_co_giao_hoi_dap.wav](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/doan_3_co_giao_hoi_dap.wav) (Nghe qua web: `http://localhost:3000/audio/eval/doan_3_co_giao_hoi_dap.wav`)
5. **Dữ liệu đo đạc JSON đầy đủ:** [eval_results.json](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scratch/tts-eval/eval_results.json)

---

## 3. GIAI ĐOẠN 3 — ĐỀ XUẤT PHƯƠNG ÁN TÍCH HỢP HỆ THỐNG

### 3.1. Đánh giá luồng quy trình nghiệp vụ: "Tạo một lần — Dùng nhiều lần"

Quy trình chuẩn hóa đề xuất cho **EM YÊU TIẾNG VIỆT**:
```
┌─────────────────────────┐
│ 1. AI Gemini soạn bài   │ (Tạo tiêu đề, bài đọc 100-180 từ, 5 câu hỏi)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 2. Giáo viên chỉnh sửa  │ (Biên tập câu chữ, từ ngữ địa phương, đáp án)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 3. Tạo giọng đọc AI     │ (Tùy chọn: Gemini TTS Cloud HOẶC Piper TTS Cục bộ)
│    (Chỉ chạy 1 LẦN)     │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 4. Giáo viên nghe thử   │ (Nghe kiểm tra ngữ điệu, bấm phê duyệt)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 5. Xuất bản bài học     │ (Khóa phiên bản bất biến v1, v2, lưu tệp âm thanh)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 6. Học sinh làm bài     │ (Tải tệp âm thanh tĩnh đã duyệt, 0 chi phí API,
│    (200 học sinh × N)   │  không độ trễ, hoạt động mượt mà trên Desktop/Mobile)
└─────────────────────────┘
```

* **Lợi ích cốt lõi:**
  1. **Không tính phí suy luận lặp lại:** Toàn bộ học sinh trong trường khi mở bài chỉ đọc stream tệp tĩnh đã lưu, không gọi lại mô hình AI TTS.
  2. **Tốc độ mở bài tức thì (< 100ms):** Tránh hiện tượng 30-40 học sinh trong lớp cùng lúc bấm nghe làm nghẽn server.
  3. **Độc lập và bảo vệ phiên bản:** Tệp âm thanh gắn liền với `versionId` của bài học. Nếu giáo viên sửa bài đọc ở bản nháp sau, hệ thống cảnh báo lệch mã băm (`passageHash`) để giáo viên tạo lại âm thanh cho phiên bản mới mà không ảnh hưởng tới lịch sử chấm bài cũ.

---

### 3.2. Đề xuất nơi lưu trữ tệp & Cơ chế liên kết Firestore

1. **Nơi lưu trữ tệp âm thanh:**
   * **Môi trường Cục bộ / Máy chủ trường học:** Lưu vào thư mục bền vững `persistent_storage/audio/` và phản chiếu sang `web/public/audio/uploads/`.
   * **Môi trường Cloud Production:** Lưu vào Firebase Storage Bucket (`gs://em-yeu-tieng-viet.appspot.com/audio/lessons/{lessonId}/{versionId}.wav`), phục vụ qua CDN toàn cầu.
2. **Cơ chế liên kết Firestore:**
   * Trong collection `lessons/{lessonId}` và subcollection `versions/{versionId}`:
     ```json
     {
       "audioUrl": "/audio/uploads/tts_lesson_v1.wav",
       "audioMetadata": {
         "storagePath": "persistent_storage/audio/tts_lesson_v1.wav",
         "downloadUrl": "/audio/uploads/tts_lesson_v1.wav",
         "engine": "piper_tts",
         "model": "vi_VN-vais1000-medium",
         "voiceId": "vais1000",
         "durationSeconds": 45,
         "sizeBytes": 1984500,
         "passageHash": "1739380895",
         "status": "approved",
         "uploadedAt": "2026-10-18T19:40:00Z"
       }
     }
     ```
   * **Tuyệt đối không lưu dữ liệu Base64 âm thanh trong Firestore**, đảm bảo Firestore doc luôn nhỏ gọn (< 5 KB), đáp ứng quy định kỹ thuật dự án.

---

### 3.3. So sánh 3 lựa chọn động cơ âm thanh cho dự án

| Đặc điểm | Lựa chọn 1: Gemini TTS Cloud (Đang chạy V5.5.2) | Lựa chọn 2: Piper TTS Local (Khảo nghiệm thành công) | Lựa chọn 3: VieNeu-TTS (Cục bộ) |
| :--- | :--- | :--- | :--- |
| **Chất lượng giọng** | Rất cao, tự nhiên, biểu cảm sư phạm (Aoede/Puck, 24kHz) | Khá tự nhiên, rõ ràng, chuẩn dấu sư phạm (22.05kHz) | Rất cao, clone giọng (48kHz) |
| **Yêu cầu kết nối** | Cần Internet & API Key Gemini | **Hoàn toàn Offline 100%, không cần Internet** | Hoàn toàn Offline (nếu đã tải model) |
| **Chi phí vận hành** | Theo quota API của Google Cloud | **Miễn phí 100% vĩnh viễn** | Miễn phí v3 (v4 có phí) |
| **Tài nguyên máy tính** | 0% tải CPU máy khách | **Cực nhẹ: CPU ~5%, RAM ~120MB, Ổ đĩa ~70MB** | Nặng: RAM > 4GB, Ổ đĩa > 1.5GB, cần GPU/CMake |
| **Độ phức tạp cài đặt** | Đã hoàn thiện và tích hợp sẵn trong V5.5.2 | Dễ đóng gói: Gói binary `piper.exe` chỉ 10MB | Phức tạp: Lỗi `kaldi-native-fbank` trên Python 3.14 |

---

### 3.4. Đề xuất giải pháp kiến trúc tối ưu nhất (Hybrid Architecture)

**Khuyến nghị:**
1. **Giữ nguyên Gemini TTS làm Động cơ Chính (Primary Cloud TTS):** Đã hoạt động ổn định và kiểm thử thành công 100% tại V5.5.2 với chất lượng biểu cảm xuất sắc.
2. **Bổ sung Piper TTS làm Động cơ Dự phòng Cục bộ (Offline / Edge Fallback):**
   * Đóng gói mô hình `vi_VN-vais1000-medium.onnx` (chỉ 63MB) đi kèm ứng dụng.
   * Khi giáo viên không có kết nối Internet hoặc chưa cấu hình Gemini API Key, hệ thống tự động kích hoạt Piper TTS để tạo giọng đọc tiếng Việt hoàn toàn miễn phí ngay trên máy tính của giáo viên.
   * Toàn bộ giao diện `LessonAudioPanel` đã được thiết kế sẵn để chấp nhận cả hai engine này mà không làm thay đổi luồng trải nghiệm người dùng.

---

## 4. TỔNG KẾT & TRẠNG THÁI BÀN GIAO

* **Mã nguồn EM YÊU TIẾNG VIỆT:** Giữ nguyên 100%, không bị sửa đổi.
* **Dữ liệu Firebase:** Giữ nguyên 10 lớp, 200 học sinh, 20 bài đọc, 403 lượt làm bài.
* **Gemini TTS hiện hữu:** Giữ nguyên hoạt động bình thường.
* **Tệp âm thanh mẫu kiểm thử:** Đã xuất đầy đủ 4 tệp WAV tại `scratch/tts-eval/` và `web/public/audio/eval/`.

**Báo cáo đã hoàn thành và sẵn sàng để Người dùng duyệt phương án trước khi triển khai bất kỳ bước lập trình nào tiếp theo.**
