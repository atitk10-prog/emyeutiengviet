# BÁO CÁO PHỤC HỒI TIẾN ĐỘ DỰ ÁN — EM YÊU TIẾNG VIỆT
## TÌNH TRẠNG HỆ THỐNG SAU KHI ANTIGRAVITY TỰ ĐỘNG TẮT
**Thời điểm rà soát:** Ngày 18/10/2026  
**Thư mục gốc:** `c:\Users\Hii\Desktop\GITHUB\EMYTV_AGENT_PACK`  
**Môi trường xác minh thực tế:** Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001, Vite: 3000) + Node.js 22 LTS + Java 21  
**Mục tiêu:** Khôi phục chính xác điểm công việc bị gián đoạn, bảo toàn 100% mã nguồn và dữ liệu, không làm lại từ đầu.

---

## 1. XÁC NHẬN THƯ MỤC GỐC VÀ CÁC TỆP CẤU HÌNH CỐT LÕI

| Tệp cấu hình | Kích thước | Trạng thái kiểm tra | Ghi chú kỹ thuật |
| :--- | :---: | :---: | :--- |
| [`package.json`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/package.json) | 1,789 bytes | **AN TOÀN / HỢP LỆ** | Cấu trúc Monorepo npm workspaces (`shared`, `functions`, `web`). Đã tích hợp `exceljs` (^4.4.0), các script build và 8 bộ test suite. |
| [`AGENTS.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/AGENTS.md) | 28,076 bytes | **NGUYÊN VẸN** | Master Build Prompt v3.0 đặt ra các nguyên tắc không thương lượng: dữ liệu Firestore thật, bảo mật trẻ em, server-side scoring, không mock data. |
| [`README.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/README.md) | 13,021 bytes | **NGUYÊN VẸN** | Đặc tả kiến trúc, Release Gates G1–G4, hướng dẫn chạy Emulator Suite và hướng dẫn sử dụng. |
| `emulator-data/` & `emulator-data-backup-v5/` | Đầy đủ | **AN TOÀN / NGUYÊN VẸN** | Thư mục dữ liệu Firestore và Auth export được bảo toàn nguyên vẹn, có bản sao lưu dự phòng. |

---

## 2. DANH SÁCH 50 TỆP CHỈNH SỬA GẦN NHẤT TRƯỚC KHI GIÁN ĐOẠN

Dưới đây là các tệp được tạo/chỉnh sửa trong khoảng thời gian từ 22:30 đến 23:59 ngày 17/10/2026 (đã lọc bỏ `node_modules`, `build`, `dist`, `emulator-data` và các tệp bí mật):

1. `tests/v5_1_security_and_ux.test.mjs` (11:59:23 PM · 13,808 bytes) — *Tạo bộ test kiểm định V5.1*
2. `package.json` (11:58:08 PM · 1,789 bytes) — *Cập nhật script test:all bổ sung v5_1*
3. `functions/src/index.ts` (11:56:19 PM · 67,674 bytes) — *Cloud Functions: PIN rotation, secure reset, batch Excel*
4. `functions/lib/index.js` (11:56:32 PM · 75,052 bytes) — *Bản biên dịch Cloud Functions*
5. `functions/lib/services/curriculumBank.js` (11:56:32 PM · 10,553 bytes)
6. `functions/lib/seed/seedData.js` (11:56:32 PM · 39,806 bytes)
7. `functions/lib/services/aiAdapter.js` (11:56:32 PM · 31,691 bytes)
8. `functions/lib/utils/crypto.js` (11:56:32 PM · 3,906 bytes)
9. `tests/security_and_ai.test.mjs` (11:51:59 PM · 7,340 bytes)
10. `tests/persistence_and_recovery.test.mjs` (11:51:11 PM · 4,911 bytes)
11. `tests/admin_and_curriculum.test.mjs` (11:50:18 PM · 5,350 bytes)
12. `tests/ux_audio_attempt_excel.test.mjs` (11:49:40 PM · 13,878 bytes)
13. `web/src/pages/TeacherDashboard.tsx` (11:46:45 PM · 118,362 bytes) — *Giao diện quản lý PIN, Excel, audioUrl*
14. `shared/src/index.ts` (11:45:14 PM · 14,037 bytes) — *Schema audioUrl, status, academicYear*
15. `web/src/pages/AdminDashboard.tsx` (11:44:31 PM · 41,669 bytes) — *Admin Excel, Reset mật khẩu qua Firebase link*
16. `web/src/pages/StudentReview.tsx` (11:38:29 PM · 14,778 bytes) — *Trang xem lại bài làm read-only*
17. `web/src/pages/ReadingMission.tsx` (11:37:55 PM · 19,650 bytes) — *Stepper 1 câu/màn hình, khôi phục bài dở*
18. `web/src/components/AudioReader.tsx` (11:37:41 PM · 12,461 bytes) — *Phát MP3/WAV hoặc vi-VN Web Speech*
19. `web/src/components/Navbar.tsx` (11:36:03 PM · 8,344 bytes) — *Tích hợp ProfileModal cho Teacher & Admin*
20. `web/src/pages/AdminLogin.tsx` (11:35:14 PM · 7,881 bytes)
21. `web/src/pages/TeacherLogin.tsx` (11:34:33 PM · 9,537 bytes) — *Tích hợp ForgotPasswordModal*
22. `web/src/pages/StudentLogin.tsx` (11:32:38 PM · 8,182 bytes) — *Phân biệt classCode vs PIN cá nhân, chặn nhầm mã HS*
23. `web/src/components/ForgotPasswordModal.tsx` (11:32:12 PM · 5,818 bytes) — *Modal gửi email reset mật khẩu*
24. `web/src/components/ProfileModal.tsx` (11:31:57 PM · 12,598 bytes) — *Modal đổi tên, đổi mật khẩu*
25. `web/src/context/AuthContext.tsx` (11:31:30 PM · 7,635 bytes) — *Hỗ trợ changePassword, sendPasswordReset*
26. `web/public/mau_nhap_giao_vien.xlsx` (11:30:56 PM · 6,955 bytes) — *Mẫu Excel giáo viên chuẩn ExcelJS*
27. `web/public/mau_nhap_hoc_sinh.xlsx` (11:30:56 PM · 6,894 bytes) — *Mẫu Excel học sinh chuẩn ExcelJS*
28. `scripts/generate_excel_templates.mjs` (11:30:50 PM · 3,645 bytes) — *Script tạo mẫu Excel bằng exceljs*
29. `web/src/utils/excelHelper.ts` (11:30:36 PM · 12,979 bytes) — *Thư viện ExcelJS, chống Formula Injection*
30. `web/package.json` (11:25:41 PM · 819 bytes)
31. `STUDENT_TEACHER_MANUAL.md` (11:06:05 PM · 10,210 bytes)
32. `FEATURE_STATUS_MATRIX.md` (11:05:35 PM · 7,174 bytes)
33. `UX_ACCOUNT_RELIABILITY_REPORT.md` (11:05:05 PM · 14,323 bytes)
34. `web/src/App.tsx` (10:49:02 PM · 4,472 bytes) — *Định tuyến /student/review/:attemptId*
35. `web/src/pages/StudentLibrary.tsx` (10:48:07 PM · 12,719 bytes)
36. `web/src/components/QuestionCard.tsx` (10:46:17 PM · 19,207 bytes) — *Card stepper, khóa nộp trống, Web Audio SFX*
37. `web/src/utils/soundEffects.ts` (10:45:12 PM · 3,125 bytes) — *Web Audio API thuần, âm đúng/sai, mute*
38. `functions/src/services/aiAdapter.ts` (10:43:17 PM · 28,481 bytes) — *robustParseJSON, 4 trạng thái AI*
39. `ADMIN_STUDENT_DATA_ACCEPTANCE.md` (10:11:43 PM · 17,872 bytes)
40. `firestore.rules` (10:01:37 PM · 5,611 bytes) — *Cách ly privateAnswerKeys, studentSecrets*

---

## 3. TỔNG QUAN BÁO CÁO V5.0, V5.1 VÀ YÊU CẦU NÂNG CẤP TIẾP THEO

### 3.1. Báo cáo Nghiệm thu V5.0 (`UX_ACCOUNT_RELIABILITY_REPORT.md`)
- Đã giải quyết 9 vấn đề lớn về UX, Stepper 1 câu/màn hình, khôi phục bài dở (F5), chế độ xem lại bài đã làm (`getAttemptReview`), âm thanh Web Audio API, và xuất/nhập Excel bước đầu.
- Ghi nhận 51/51 bài kiểm thử PASS (100%) tại thời điểm lập báo cáo V5.0.

### 3.2. Yêu cầu Nâng cấp & Bản vá Bảo mật V5.1 (Nhiệm vụ đang thực hiện dở dang)
Tại thời điểm trước khi Antigravity tự tắt, người dùng đã giao nhiệm vụ **EM YÊU TIẾNG VIỆT V5.1** với 5 nhóm hạng mục chính:
1. **Quản lý học sinh:** Phân biệt rõ `classCode`, `studentCode`, `access PIN`; kiểm tra nhập nhầm mã HS vào ô PIN; cấp lại PIN an toàn, vô hiệu hóa PIN cũ.
2. **Quản lý tài khoản:** Chặn tự cấp quyền giáo viên/admin; bổ sung ProfileModal (thông tin cá nhân, đổi mật khẩu), ForgotPasswordModal (Firebase Auth reset link); loại bỏ mật khẩu tạm văn bản thuần.
3. **Kiểm toán Excel:** Loại bỏ cảnh báo bảo mật của thư viện `xlsx` (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9), thay bằng `exceljs`; chống Formula Injection (CWE-1236); kiểm soát dung lượng $\le 2$MB, $\le 100$ dòng; kiểm tra trùng lặp và có modal xem trước/xác nhận.
4. **Giọng đọc tiếng Việt:** Phát MP3/WAV hoặc `vi-VN`; nghiên cứu đánh giá VieNeu-TTS (pnnbao97) và VietTTS (dangvansam) cho môi trường CPU cục bộ.
5. **Kiểm thử thực tế & Báo cáo:** Kiểm thử 3 vai trò trên trình duyệt (Browser Subagent), chạy test suites và tạo tệp báo cáo `V5_1_SECURITY_UX_AUDIT.md`.

### 3.3. Tình trạng tài liệu V5.2
- **Chưa có tài liệu V5.2:** Tìm kiếm trong toàn bộ workspace không có tệp nào về V5.2. Công việc hiện tại đang dừng ở giai đoạn hoàn tất bàn giao V5.1.

---

## 4. MA TRẬN PHỤC HỒI TIẾN ĐỘ CHỨC NĂNG (BẢNG TRỌNG TÂM)

| Chức năng | Tệp mã nguồn liên quan | Đã hoàn thành / Đang dở / Chưa thực hiện | Kết quả kiểm thử mới nhất | Lỗi còn tồn tại | Hành động tiếp theo |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **1. Quản lý tài khoản & Phân quyền** | `TeacherLogin.tsx`, `AdminLogin.tsx`, `Navbar.tsx`, `ProfileModal.tsx`, `ForgotPasswordModal.tsx`, `AuthContext.tsx`, `functions/src/index.ts` | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test B1, B2, B3 trong `v5_1_security_and_ux.test.mjs`) | Không có. Đã chặn tự nâng quyền; Admin khóa/mở khóa giáo viên; reset mật khẩu qua Firebase link an toàn (không có plaintext password). | Giữ nguyên. |
| **2. Quản lý mã PIN học sinh** | `StudentLogin.tsx`, `TeacherDashboard.tsx`, `functions/src/index.ts`, `functions/src/utils/crypto.ts` | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test A1, A2, A3, A4 trong `v5_1_security_and_ux.test.mjs`) | Không có. Đã tách bạch `classCode`, `studentCode`, `access PIN`. Cảnh báo nhập nhầm mã HS. Cấp lại PIN bảo mật, vô hiệu hóa PIN cũ ngay, lưu salted hash PBKDF2 10.000 vòng. | Giữ nguyên. |
| **3. Nhập/Xuất Excel an toàn** | `web/src/utils/excelHelper.ts`, `TeacherDashboard.tsx`, `AdminDashboard.tsx`, `scripts/generate_excel_templates.mjs`, `functions/src/index.ts` | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test C1 trong `v5_1_security_and_ux.test.mjs`) | Không có. Đã thay `xlsx` bằng `exceljs` loại bỏ hoàn toàn cảnh báo CVE/GHSA. Phòng chống Formula Injection, giới hạn 2MB/100 dòng, phát hiện trùng lặp, có bảng xem trước và xác nhận. | Giữ nguyên. |
| **4. Âm thanh tiếng Việt & Nghiên cứu TTS** | `AudioReader.tsx`, `TeacherDashboard.tsx`, `functions/src/index.ts` | **ĐANG DỞ** | **PASS 100%** (Test D1 trong `v5_1_security_and_ux.test.mjs`). Đã thu thập đủ tài liệu kỹ thuật về VieNeu-TTS & VietTTS. | Chưa xuất kết quả nghiên cứu VieNeu-TTS và VietTTS vào báo cáo chính thức `V5_1_SECURITY_UX_AUDIT.md`. | Biên soạn mục đánh giá VieNeu-TTS và VietTTS vào báo cáo nghiệm thu V5.1; giữ nguyên cơ chế Web Speech vi-VN và phát file MP3/WAV do giáo viên duyệt. |
| **5. Thư viện bài đọc GDPT** | `functions/src/services/curriculumBank.ts`, `seedData.ts`, `TeacherDashboard.tsx`, `StudentLibrary.tsx` | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test `admin_and_curriculum.test.mjs` & `pedagogical_fixtures.test.mjs`) | Không có. Đầy đủ 6 bài đọc mẫu GDPT Khối 2–3 và 11 nút phân phối chương trình Kết nối tri thức Lớp 1–5. | Giữ nguyên. |
| **6. Chỉnh sửa bài đọc (Draft Editor)** | `TeacherDashboard.tsx`, `functions/src/index.ts` (`generateLessonDraft`, `publishLesson`) | **ĐÃ HOÀN THÀNH** (phần chỉnh sửa nội dung) | **PASS 100%** (Biên tập tiêu đề, chủ đề, văn bản, đính kèm audio, sửa prompt/lựa chọn/đáp án/gợi ý/giải thích của từng câu). | Chưa có nút thêm câu hỏi mới và xóa câu hỏi trong chế độ chỉnh sửa bản nháp. | Nâng cấp bổ sung nút "Thêm câu hỏi mới" và "Xóa câu hỏi" (xem mục 7). |
| **7. Thêm câu hỏi vào bài đọc** | `TeacherDashboard.tsx` (dòng 1986–2104) | **CHƯA THỰC HIỆN ĐẦY ĐỦ** | Mã nguồn hiện tại chỉ cho phép chỉnh sửa các câu hỏi có sẵn, chưa có hàm `handleAddQuestion` và `handleDeleteQuestion`. | Giáo viên không thể thêm câu hỏi thứ 6 hoặc xóa bớt câu hỏi không cần thiết khi soạn/duyệt bài. | Bổ sung giao diện và hàm xử lý thêm câu hỏi mới (Trắc nghiệm A/B/C, Đúng/Sai, Sắp xếp sự việc) và xóa câu hỏi trong Inline Draft Editor. |
| **8. Giao bài đọc bất biến phiên bản** | `TeacherDashboard.tsx`, `functions/src/index.ts` (`assignLesson`) | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test `e2e.test.mjs`, `ux_audio_attempt_excel.test.mjs`) | Không có. Giao bài khóa versionId, cấu hình maxAttempts, phân loại bài trước/sau (pre-test/post-test). | Giữ nguyên. |
| **9. Làm bài & Lưu kết quả (Stepper & Resume)** | `ReadingMission.tsx`, `QuestionCard.tsx`, `StudentReview.tsx`, `functions/src/index.ts` (`startAttempt`, `submitAnswer`, `getAttemptReview`) | **ĐÃ HOÀN THÀNH** | **PASS 100%** (Test 2, 3, 4, 5 trong `ux_audio_attempt_excel.test.mjs`) | Không có. Chấm điểm server 2 pha, gợi ý không lộ đáp án, stepper 1 câu/màn hình, khôi phục bài dở khi F5, xem lại bài đã làm read-only kể cả khi hết lượt. | Giữ nguyên. |
| **10. Báo cáo kiểm định V5.1 (`V5_1_SECURITY_UX_AUDIT.md`)** | Root directory | **BỊ GIÁN ĐOẠN** (chưa tạo) | Browser subagent đã kiểm thử thực tế và chụp 6 ảnh minh chứng; test suites đã chạy xong. | Tệp báo cáo nghiệm thu V5.1 chưa được tạo do phần mềm bị tắt đột ngột lúc 00:02 ngày 18/10. | Tạo tệp `V5_1_SECURITY_UX_AUDIT.md` tổng kết toàn diện kết quả thực thi và ảnh minh chứng. |
| **11. Cấu hình chạy Test song song** | `package.json` (`test:all`) | **CẦN TỐI ƯU** | Chạy đơn lẻ từng suite hoặc tuần tự (`--test-concurrency=1`): **61/61 PASS (100%)**. Chạy đồng thời mặc định gây tranh chấp dữ liệu trên Firestore Emulator giữa 2 suite test. | Lệnh `npm run test:all` hiện tại chưa có cờ `--test-concurrency=1`. | Bổ sung cờ `--test-concurrency=1` vào script `test:all` trong `package.json` để bảo đảm test luôn đạt 100% ổn định. |

---

## 5. KẾT QUẢ KIỂM THỬ THỰC TẾ MỚI NHẤT (ĐÃ XÁC MINH TRỰC TIẾP)

Tuân thủ nghiêm ngặt chỉ thị **"Không tự động kết luận PASS dựa trên báo cáo cũ"**, hệ thống đã trực tiếp chạy build và test trên môi trường hiện tại:

### 5.1. Kiểm thử biên dịch toàn dự án (`npm run build`)
- **Shared Workspace:** `tsc` biên dịch ESM và CJS thành công.
- **Functions Workspace:** `tsc` biên dịch Cloud Functions không có lỗi.
- **Web Workspace:** `vite build` chuyển đổi 2,412 module thành công trong 9.76s.
- **Kết quả:** **BUILD SUCCESS (Code 0)**.

### 5.2. Kiểm thử đơn vị Functions (`npm run test:unit`)
- Test 1: Crypto sinh mã truy cập 6 ký tự ngẫu nhiên $\rightarrow$ **PASS**.
- Test 2: Crypto sinh mã lớp 6 ký tự $\rightarrow$ **PASS**.
- Test 3: PBKDF2 băm và xác minh salted hash $\rightarrow$ **PASS**.
- **Kết quả:** **3/3 TESTS PASS**.

### 5.3. Kiểm thử tích hợp toàn bộ hệ thống (`node --test --test-concurrency=1 ...`)
Chạy trực tiếp trên Firebase Local Emulator Suite đang hoạt động (Auth: 9099, Firestore: 8080, Functions: 5001):
```
# tests 61
# suites 10
# pass 61
# fail 0
# cancelled 0
# skipped 0
# duration_ms 16135
```
- **Chi tiết các bộ test đã vượt qua 100%:**
  1. `tests/rules.test.mjs`: 9/9 tests PASS (Bảo mật Rules Deny-all, cách ly đáp án & PIN)
  2. `tests/pedagogical_fixtures.test.mjs`: 11/11 tests PASS (Kiểm định sư phạm 3 dạng câu hỏi)
  3. `tests/security_and_ai.test.mjs`: 4/4 tests PASS (Bảo vệ khóa AI, chống brute-force PIN)
  4. `tests/e2e.test.mjs`: 10/10 tests PASS (Luồng End-to-End trọn vẹn)
  5. `tests/admin_and_curriculum.test.mjs`: 4/4 tests PASS (Quản trị Admin & Khung GDPT 1–5)
  6. `tests/persistence_and_recovery.test.mjs`: 4/4 tests PASS (Lưu trữ và phục hồi Firestore Emulator)
  7. `tests/ux_audio_attempt_excel.test.mjs`: 9/9 tests PASS (Stepper, F5 resume, review mode, Excel, reset password)
  8. `tests/v5_1_security_and_ux.test.mjs`: 10/10 tests PASS (Toàn bộ các tiêu chí V5.1 mới nhất)

---

## 6. ĐÁNH GIÁ KỸ THUẬT VỀ MÔ HÌNH GIỌNG ĐỌC VIỆT (VieNeu-TTS vs VietTTS)

Theo yêu cầu mục D của V5.1, đã tiến hành khảo sát và đánh giá độc lập hai giải pháp TTS mã nguồn mở tiếng Việt:

| Tiêu chí | Web Speech API vi-VN (Hiện hành) | VieNeu-TTS (`pnnbao97/VieNeu-TTS`) | VietTTS (`dangvansam/viet-tts`) |
| :--- | :--- | :--- | :--- |
| **Kiến trúc mô hình** | Trình duyệt Client-side native | Transformer LM (Qwen 0.3B/0.5B) + Neural Audio Codec (NeuCodec / MOSS-Audio-Tokenizer) | FastSpeech 2 / Tacotron 2 + HiFi-GAN Vocoder (`hift.pt`) |
| **Chất lượng tiếng Việt** | Phụ thuộc OS (rất tốt nếu có Google/Microsoft vi-VN) | Cực kỳ tự nhiên, ngữ điệu chân thực, hỗ trợ Voice Cloning tức thì | Tương đối tốt, giọng đều, hỗ trợ nhân bản giọng từ mẫu audio |
| **Khả năng chạy CPU Windows** | 0% tài nguyên CPU (có sẵn trong trình duyệt) | Tốt với bản lượng hóa **0.3B GGUF (Q4/Q8)**; chạy trực tiếp bằng C++/Python | Cần môi trường Python + PyTorch; tiêu tốn RAM (~1–2GB), tốc độ CPU trung bình |
| **Giấy phép bản quyền** | Miễn phí theo trình duyệt | **Apache 2.0** cho bản v3 Turbo và các bản lượng hóa mã nguồn mở; bản v4 là thương mại đóng | Mã nguồn: **Apache 2.0**; Trọng số mô hình pre-trained: **CC BY-NC (Không thương mại)** |
| **Khuyến nghị triển khai** | **Ưu tiên số 1 cho Web App**: nhẹ, tức thời, chi phí 0đ, không cần cài đặt thêm. | **Phù hợp làm công cụ ngoại tuyến (Offline Tool)** cho giáo viên tạo sẵn tệp MP3 bài đọc chất lượng cao. | **Không khuyến nghị dùng cho production** do ràng buộc bản quyền phi thương mại (CC BY-NC). |

> **Khuyến nghị sư phạm:** Giữ nguyên giải pháp hiện tại: Ưu tiên phát tệp MP3/WAV do giáo viên duyệt/tải lên; nếu chưa có tệp thì dùng Web Speech API vi-VN (có thông báo sư phạm lịch sự nếu thiết bị thiếu giọng đọc). Không nhúng trực tiếp mô hình nơ-ron nặng vào Firebase Cloud Functions để tránh lỗi Cold-start và chi phí Cloud.

---

## 7. ĐIỂM GIÁN ĐOẠN VÀ KẾ HOẠCH HÀNH ĐỘNG TIẾP THEO

### 7.1. Điểm chính xác phiên làm việc trước bị ngắt
Phiên làm việc trước bị ngắt ngay sau khi:
1. Đã hoàn thành lập trình toàn bộ tính năng V5.1.
2. Đã chạy bộ test tự động V5.1 đạt 10/10 PASS.
3. Đã chạy Browser Subagent kiểm thử trên trình duyệt thật và chụp đầy đủ 6 ảnh màn hình minh chứng.
4. Đã tra cứu xong thông tin kỹ thuật về VieNeu-TTS và VietTTS.
5. **Đang chuẩn bị viết tệp báo cáo `V5_1_SECURITY_UX_AUDIT.md` thì Antigravity tự tắt.**

### 7.2. Các phần việc cần thực hiện tiếp theo (Chờ người dùng xác nhận)
Sau khi người dùng kiểm tra báo cáo phục hồi này và ra lệnh tiếp tục, Agent sẽ thực hiện ngay:
1. **Nâng cấp Inline Draft Editor trong `TeacherDashboard.tsx`:**
   - Thêm nút **"Thêm câu hỏi mới"** cho phép giáo viên chọn loại câu hỏi (Trắc nghiệm A/B/C, Đúng/Sai, Sắp xếp).
   - Thêm nút **"Xóa câu hỏi"** kèm xác nhận để giáo viên linh hoạt số lượng nhiệm vụ đọc hiểu.
2. **Cập nhật script `test:all` trong `package.json`:**
   - Thêm cờ `--test-concurrency=1` để bảo đảm kiểm thử tự động 61 bài test luôn ổn định tuyệt đối.
3. **Biên soạn và hoàn tất báo cáo `V5_1_SECURITY_UX_AUDIT.md`:**
   - Tổng kết 100% kết quả nghiệm thu V5.1 kèm đường dẫn ảnh chụp màn hình minh chứng từ Browser Subagent và đánh giá TTS.
4. **Kiểm tra xác nhận giao diện thực tế bằng Browser Tool** để ghi nhận chức năng Thêm câu hỏi hoạt động hoàn hảo.

---
*Báo cáo được khởi tạo tự động bởi Antigravity Agent nhằm khôi phục và tiếp tục dự án chính xác, không ghi đè, không làm mất bất kỳ dữ liệu nào của người dùng.*
