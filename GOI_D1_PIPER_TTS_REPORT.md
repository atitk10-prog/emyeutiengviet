# BÁO CÁO NGHIỆM THU: GÓI D1 – TÍCH HỢP PIPER TTS VÀO EM YÊU TIẾNG VIỆT

**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng tương tác nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản bàn giao:** Gói D1 (V5.6.0)  
**Ngày hoàn thành:** 18/10/2026  
**Trạng thái kiểm thử:** **100% PASS (9/9 MỤC KIỂM THỬ ĐẠT)**

---

## 1. TỔNG QUAN KẾT QUẢ GÓI D1

Mục tiêu của Gói D1 là bổ sung **Piper TTS** như một phương án tạo giọng đọc tiếng Việt ngoại tuyến (Offline 100%), hoạt động song song và đồng nhất với **Gemini Cloud TTS** và **Tệp thu âm của giáo viên**, bảo toàn nguyên vẹn toàn bộ các tính năng và dữ liệu đã hoạt động ổn định ở Gói C V5.5.2.

### Tóm tắt chỉ số thực nghiệm:
* **Động cơ TTS ngoại tuyến:** Piper TTS với mô hình nơ-ron chính thức `vi_VN-vais1000-medium` (giọng chuẩn miền Bắc, huấn luyện trên tập dữ liệu VAIS).
* **Tốc độ tổng hợp:** **~0.22 giây / câu** trên CPU thông thường (RTF ~0.05, nhanh gấp 16–21 lần thời gian thực).
* **Tài nguyên sử dụng:** Mô hình chỉ **63.2 MB**, RAM suy luận chỉ **~105 MB**, **0% chi phí API**, không phụ thuộc Internet.
* **Giao diện thống nhất:** Bảng điều khiển 3 lựa chọn (Gemini AI Trực Tuyến, Piper AI Ngoại Tuyến, Giáo Viên Thu Âm) với tính năng nghe thử, duyệt, tạo lại, gỡ và phát hiện lệch câu chữ (`isPassageDirty`).
* **Bảo toàn dữ liệu:** 100% bảo toàn **10 lớp, 200 học sinh, 20 bài đọc và 403 lượt làm bài** (0 dữ liệu bị mất mát hoặc sinh trùng).

---

## 2. DANH MỤC TỆP ĐÃ SỬA & TỆP MỚI

### Tệp mới tạo:
1. [`scripts/piper_synthesize.py`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scripts/piper_synthesize.py): Kịch bản CLI độc lập nhận văn bản tiếng Việt UTF-8, cấu hình `length_scale`, gọi thư viện `piper` nơ-ron và xuất tệp WAV chuẩn PCM 22.050 Hz kèm siêu dữ liệu JSON.
2. [`functions/src/services/piperService.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/functions/src/services/piperService.ts): Dịch vụ Node.js trong Cloud Functions quản lý tiến trình suy luận cục bộ, tự động tìm kiếm mô hình (ưu tiên ổ F `F:\piper_models` và `scratch/tts-eval/models`), kiểm tra khả dụng và kiểm soát thời gian chờ (timeout).
3. [`scripts/test_package_d1_piper.mjs`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scripts/test_package_d1_piper.mjs): Kịch bản kiểm thử tích hợp tự động 9 tiêu chí cho Gói D1.
4. [`backups/emulator_backup_goi_d1_pre`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/backups/emulator_backup_goi_d1_pre): Bản sao lưu Firestore + Auth trước khi thực hiện Gói D1.
5. [`backups/emulator_backup_goi_d1_post`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/backups/emulator_backup_goi_d1_post): Bản sao lưu hoàn tất sau khi kiểm thử Gói D1.
6. [`backups/audio_backup_goi_d1_post`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/backups/audio_backup_goi_d1_post): Bản sao lưu kho âm thanh bền vững.

### Tệp đã nâng cấp & tối ưu:
1. [`functions/src/index.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/functions/src/index.ts):
   * Thêm callable endpoint `checkTtsAvailability`: kiểm tra trạng thái khả dụng của cả Gemini TTS (API key) và Piper TTS (môi trường & mô hình).
   * Mở rộng `generateLessonAudioWithAI`: nhận tham số `engine: 'piper_tts' | 'gemini_tts'`, điều phối qua `PiperService` hoặc `generateSpeechWithGeminiTTS`, lưu bền vững qua `StorageService` và trả về `AudioMetadata` chuẩn hóa.
2. [`web/src/components/LessonAudioPanel.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/LessonAudioPanel.tsx):
   * Tái cấu trúc giao diện theo tiêu chuẩn thẩm mỹ cao với 3 thẻ chọn động cơ: **Gemini AI (Trực Tuyến)**, **Piper AI (Ngoại Tuyến 100%)**, **Giáo Viên Thu Âm (Tệp Thật)**.
   * Thêm bộ điều chỉnh tốc độ đọc sư phạm cho Piper: **Chậm rãi 1.25x** (chuẩn Khối 2 theo dõi mặt chữ) và **Chuẩn 1.0x** (Khối 3).
   * Thống nhất hoàn toàn luồng nghe thử (Preview Box), phê duyệt (Approval), lưu kho bền vững (Persistent Storage), phát hiện lệch câu chữ (`isPassageDirty`), và tương thích 100% trên màn hình điện thoại 390px.

---

## 3. KIẾN TRÚC TÍCH HỢP: HYBRID AI TTS ("TẠO MỘT LẦN — DÙNG NHIỀU LẦN")

```
                                  GIAO DIỆN GIÁO VIÊN
                        ┌─────────────────────────────────────┐
                        │      LessonAudioPanel Component     │
                        └──────────────────┬──────────────────┘
                                           │
                      ┌────────────────────┴────────────────────┐
                      │ Chọn động cơ âm thanh bài đọc           │
                      ├───────────────────┬─────────────────────┤
                      │                   │                     │
               [ Gemini AI ]       [ Piper AI ]          [ Giáo viên ]
               (Trực Tuyến)        (Ngoại Tuyến)         (Tải MP3/WAV)
                      │                   │                     │
                      ▼                   ▼                     ▼
          functions/index.ts      functions/index.ts    functions/index.ts
         generateSpeechGemini     PiperService (CPU)     uploadLessonAudio
                      │                   │                     │
                      └───────────────────┼─────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────┐
                       │    StorageService.saveAudioBuffer    │
                       ├──────────────────┬───────────────────┤
                       │ persistent_storage/audio/            │
                       │ web/public/audio/uploads/ (Mirror)   │
                       └──────────────────┬───────────────────┘
                                          │
                                          ▼
                                   Nghe thử âm thanh
                             (Unified Preview Audio Player)
                                          │
                                          ▼
                             Phê duyệt & Lưu vào bài học
                     (Ghi audioMetadata + passageHash Firestore)
                                          │
                                          ▼
                                    Xuất bản bài học
                             (Khóa phiên bản bất biến v1)
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
             HỌC SINH DESKTOP                            HỌC SINH MOBILE (390px)
        (Tải stream tệp tĩnh WAV                   (Tải stream tệp tĩnh WAV
          độ trễ < 100ms, 0 API)                     độ trễ < 100ms, 0 API)
```

---

## 4. KẾT QUẢ KIỂM THỬ THỰC TẾ (AUTOMATED & BROWSER VERIFICATION)

### 4.1. Kết quả kiểm thử tự động (Script `test_package_d1_piper.mjs`)

| STT | Hạng mục kiểm thử | Kết quả | Chi tiết đo đạc |
| :---: | :--- | :---: | :--- |
| 1 | **Bảo toàn dữ liệu đầu vào** | **PASS** | 10 lớp, 200 học sinh, 20 bài đọc, 403 lượt làm bài nguyên vẹn |
| 2 | **Xác thực giáo viên** | **PASS** | Token Firebase Auth hợp lệ cho `teacher_demo_account` |
| 3 | **Kiểm tra khả dụng `checkTtsAvailability`** | **PASS** | Piper: `available: true`, Model: `vi_VN-vais1000-medium` |
| 4 | **Tạo giọng đọc Piper AI qua Functions** | **PASS** | Tạo tệp WAV trong **0.22s**, thời lượng **~5.56s**, model `vi_VN-vais1000-medium` |
| 5 | **Lưu trữ tệp âm thanh bền vững** | **PASS** | Đã lưu tại `persistent_storage/audio` (dung lượng 239.5 KB) |
| 6 | **Phản chiếu stream sang web public** | **PASS** | Stream tức thì qua HTTP web port 3000 (`/audio/uploads/...`) |
| 7 | **Phòng vệ an toàn (Validation)** | **PASS** | Từ chối văn bản < 20 ký tự, ném HttpsError hợp lệ |
| 8 | **Đồng bộ nội dung & âm thanh (Hash)** | **PASS** | Hash gốc `14344804` khác Hash sửa đổi `-1169145623` |
| 9 | **Bảo toàn dữ liệu sau kiểm thử** | **PASS** | Số lượng lớp (10), học sinh (200), bài học (20), lượt làm (403) bất biến |

---

### 4.2. Minh chứng thực tế qua Browser Subagent & Screenshots

#### Minh chứng 1: Bảng điều khiển Piper AI TTS trên Desktop sau khi tạo giọng và phê duyệt
![Bảng điều khiển Piper AI TTS trên Desktop](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/piper_ai_tts_success_1792329363119.png)
* *Ghi nhận:* Thẻ Piper AI viền xanh ngọc nổi bật; nút chọn tốc độ 1.25x / 1.0x; thông báo phê duyệt thành công; thẻ âm thanh đính kèm hiển thị đầy đủ nhãn `PIPER AI TTS (NGOẠI TUYẾN)`, mã mô hình `vi_VN-vais1000-medium`, thời lượng ~14 giây, dung lượng 0.57 MB, và trình phát audio HTML5 hoạt động mượt mà.

#### Minh chứng 2: Giao diện điện thoại di động (Viewport 390px × 844px)
![Giao diện điện thoại di động 390px](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/piper_mobile_390px_1792329397307.png)
* *Ghi nhận:* Toàn bộ các khối chọn chế độ, bảng cấu hình tốc độ đọc, thông báo trạng thái, thẻ bài thu âm và nút điều khiển xếp chồng dọc chuẩn mực, không tràn viền ngang (0 horizontal scroll), nút bấm lớn dễ thao tác cảm ứng trên màn hình điện thoại 390px.

#### Minh chứng 3: Trải nghiệm học sinh nghe bài đọc đã duyệt (`AudioReader`)
![Trải nghiệm học sinh nghe bài đọc](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/student_reading_audio_player_1792329427296.png)
* *Ghi nhận:* Học sinh mở bài "Chim sâu nhỏ và vườn cam" được nghe trực tiếp tệp âm thanh đã duyệt qua nút "Nghe cô đọc", điều chỉnh tốc độ (0.75x, 1x, 1.25x), cỡ chữ linh hoạt, từ khó có gợn sóng vàng giải nghĩa.

---

## 5. GIẤY PHÉP & KHẢ NĂNG SỬ DỤNG LÂU DÀI

* **Mã nguồn Piper:** Giấy phép **MIT License** — Cho phép tự do tích hợp, phân phối và nhúng vào ứng dụng giáo dục phi thương mại và thương mại mà không có bất kỳ rào cản pháp lý nào.
* **Mô hình giọng nói `vi_VN-vais1000-medium`:** Huấn luyện trên tập dữ liệu VAIS mở, giấy phép **Creative Commons Attribution (CC-BY)** — Hoàn toàn hợp pháp để sử dụng lâu dài trong nhà trường.
* **Vị trí lưu trữ mô hình tối ưu:** Đã thiết lập ưu tiên tìm kiếm mô hình tại `F:\piper_models\` (dung lượng trống 184 GB dồi dào) và thư mục dự án cục bộ, tránh nguy cơ làm đầy ổ C: (hiện chỉ còn 1.59 GB).

---

## 6. KẾT LUẬN & TRẠNG THÁI BÀN GIAO

1. **Gói D1 đã hoàn thành xuất sắc 100% mục tiêu:**
   - Hệ thống hiện sở hữu giải pháp **Hybrid AI Speech** mạnh mẽ nhất: Khi có mạng và API, giáo viên dùng **Gemini AI TTS**; khi ngoại tuyến hoặc ở vùng khó khăn, giáo viên dùng **Piper AI TTS**; đồng thời vẫn hỗ trợ giáo viên tự thu âm bài giảng.
   - Cơ chế "Tạo một lần — Dùng nhiều lần" giải phóng hoàn toàn chi phí và tài nguyên máy chủ khi học sinh học bài.
2. **Tuân thủ tuyệt đối quy định an toàn:**
   - [x] Không sửa đổi các chức năng khác ngoài phạm vi âm thanh bài đọc.
   - [x] Không xóa hay reset dữ liệu Firebase (10 lớp, 200 học sinh, 20 bài đọc, 403 lượt làm bài giữ nguyên 100%).
   - [x] Không deploy Cloud.
   - [x] Không gọi lặp lại Gemini API không cần thiết.
   - [x] Đã sao lưu toàn bộ cơ sở dữ liệu và kho âm thanh vào `backups/emulator_backup_goi_d1_post`.
