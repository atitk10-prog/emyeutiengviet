# NHẬT KÝ NÂNG CẤP TỔNG HỢP (ONE-PASS CHANGELOG v4.0)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI thiết kế học liệu tương tác nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản:** 4.0 Hardened & Acceptance-Ready  
**Thời điểm thực hiện:** 17/10/2026  
**Đơn vị thực hiện:** Antigravity Full-stack & AI Engineering Agent  

---

## 1. TỔNG QUAN ĐỢT NÂNG CẤP

Đợt nâng cấp One-Pass v4.0 tập trung giải quyết triệt để các yêu cầu cốt lõi theo `EMYTV_ONEPASS_AGENT.md`, chuẩn nghiệm thu `EMYTV_RELEASE_GATES.md` và bộ kiểm thử sư phạm độc lập `EMYTV_SAMPLE_CASES.json`, tuân thủ 15 nguyên tắc bắt buộc:
- Không tạo lại dự án, bảo toàn toàn bộ mã nguồn và chức năng đang chạy.
- Nâng cấp bộ chuyển đổi Gemini AI sang các model hiện hành (`gemini-3.5-flash-lite` và `gemini-3.8-flash`), xóa bỏ hoàn toàn fallback sang các model ngừng hoạt động.
- Bảo mật tuyệt đối khóa API trong môi trường backend, hỗ trợ tệp bí mật nội bộ `.secret.local` và Secret Manager.
- Phân biệt minh bạch 4 trạng thái AI: `NOT_CONFIGURED`, `READY_UNVERIFIED`, `VERIFIED`, `UNAVAILABLE`.
- Bổ sung điểm cuối kiểm thử AI thực tế `testAIConnection` chỉ dành cho giáo viên đã xác thực.
- Khắc phục cơ chế chống tấn công vét cạn mã PIN học sinh: khóa theo cặp `Mã lớp + Mã cá nhân`, không gây từ chối dịch vụ cho cả lớp khi có 1 người nhập sai.
- Thắt chặt `bootstrapTeacherRole`: chặn người dùng ẩn danh (anonymous auth) và kiểm tra `email_verified`.
- Hỗ trợ quản lý dữ liệu nhiều giáo viên, nhiều lớp qua các năm học (`academicYear`).
- Kiểm chứng toàn diện với 3 bài đọc mẫu và 8 ca biên sư phạm/bảo mật từ `EMYTV_SAMPLE_CASES.json`.
- 100% test tự động đạt PASS (31/31 bài test).
- Tuyệt đối không tự ý deploy lên Firebase Cloud Staging (`em-yeu-tieng-viet---staging`) hoặc kích hoạt thanh toán Blaze khi chưa có sự đồng ý của người dùng.

---

## 2. CHI TIẾT CÁC THAY ĐỔI THEO TỪNG GIAI ĐOẠN

### P0. Nền tảng và An toàn môi trường phát triển
- **Cập nhật `.gitignore`:** Bổ sung `.secret.local`, `*.secret.local`, `serviceAccountKey*.json` để ngăn ngừa rò rỉ khóa bí mật vào kho mã nguồn.
- **Hỗ trợ nạp bí mật cục bộ an toàn:** Hàm `loadLocalSecrets()` trong `functions/src/services/aiAdapter.ts` tự động tìm và nạp `GEMINI_API_KEY` từ `functions/.secret.local` hoặc `functions/.env.local` khi chạy trong Emulator mà không cần commit vào Git.
- **Root Scripts:** Bổ sung các lệnh kiểm thử chuyên biệt trong `package.json`:
  - `npm run test:rules`: Kiểm tra 6 quy tắc Firestore Rules.
  - `npm run test:security`: Kiểm tra bảo mật định danh, chống vét cạn PIN và an toàn AI.
  - `npm run test:pedagogical`: Kiểm tra 3 fixtures sư phạm và 8 ca biên âm tính.
  - `npm run test:e2e`: Kiểm tra quy trình sư phạm khép kín 10 bước.
  - `npm run test:all`: Chạy toàn bộ 31 bài test.

### P1. Quản lý Nhiều Giáo viên, Lớp học & Năm học (Multi-tenant & Academic Year)
- **Cập nhật Model `Classroom` (`shared/src/index.ts`):** Bổ sung trường tùy chọn `academicYear?: string` (ví dụ: `'2025-2026'`).
- **Cập nhật Cloud Function `createClassroom` (`functions/src/index.ts`):** Tiếp nhận `academicYear` từ yêu cầu tạo lớp, lưu trữ ổn định vào Firestore.
- **Cập nhật Giao diện Bảng điều khiển Giáo viên (`web/src/pages/TeacherDashboard.tsx`):**
  - Thêm ô nhập `"Năm học"` trong hộp thoại tạo lớp học mới (giá trị mặc định `'2025-2026'`).
  - Hiển thị nhãn năm học trên danh sách chọn lớp và thông tin chi tiết của lớp đang chọn.

### P2. Nâng cấp Bộ chuyển đổi Google Gemini AI & Trạng thái 4 cấp
- **Lựa chọn Model:**
  - Model mặc định: `gemini-3.5-flash-lite`.
  - Model nâng cao: `gemini-3.8-flash`.
  - Đọc tùy biến từ biến môi trường máy chủ `GEMINI_MODEL`.
  - Xóa bỏ fallback sang các model đã ngừng hỗ trợ (`gemini-2.0-flash`, `gemini-1.5-flash`).
- **Phân loại 4 trạng thái AI (`AIServiceStatus`):**
  1. `NOT_CONFIGURED`: Chưa có `GEMINI_API_KEY`. Ứng dụng tự động bật chế độ Soạn thủ công và 6 bài đọc mẫu GDPT.
  2. `READY_UNVERIFIED`: Đã nhận diện khóa trong backend nhưng chưa thực hiện kiểm chứng trực tiếp.
  3. `VERIFIED`: Đã kiểm chứng thành công bằng cuộc gọi thực tế; hiển thị model đang hoạt động và độ trễ (latency ms).
  4. `UNAVAILABLE`: Gặp lỗi dịch vụ gần nhất trong 5 phút (hết hạn mức, sai khóa, timeout); hiển thị mã lỗi rõ ràng.
- **Điểm cuối `testAIConnection`:**
  - Yêu cầu quyền giáo viên (`requireTeacher`).
  - Giới hạn tần suất gọi: tối thiểu cách nhau 15 giây để chống spam.
  - Chạy một prompt kiểm thử mẫu ngắn (không chứa bất kỳ thông tin nhận dạng học sinh nào).
  - Cập nhật trạng thái kiểm chứng và trả về kết quả cho giáo viên.
- **Phân loại lỗi AI chuẩn xác (`classifyAIError`):**
  - `UNAUTHORIZED_KEY`: Lỗi 401/403, sai khóa API.
  - `MODEL_NOT_FOUND`: Lỗi 404, model không tồn tại.
  - `RATE_LIMITED`: Lỗi 429, vượt hạn mức/quota.
  - `TIMEOUT`: Quá thời gian phản hồi.
  - `PROVIDER_ERROR`: Lỗi từ máy chủ nhà cung cấp.
- **Bộ chuẩn hóa phòng thủ dữ liệu AI (`defensive question normalizer`):** Tự động điền đầy đủ lời dẫn, gợi ý sư phạm và giải thích nếu AI trả thiếu trong câu hỏi sắp xếp sự việc trước khi xác thực qua Zod `LessonDraftSchema`.

### P3. Thắt chặt An ninh & Chống vét cạn mã PIN
- **Sửa lỗi Khóa mã PIN (`joinClass`):**
  - *Trước đây:* Theo dõi số lần nhập sai theo `cleanClassCode`, dẫn đến việc 1 học sinh bấm sai 5 lần sẽ khóa toàn bộ lớp học.
  - *Hiện tại:* Theo dõi theo khóa kết hợp `${cleanClassCode}_${cleanAccessCode}`. Khi nhập sai 1 mã PIN cụ thể 5 lần, chỉ khóa thử lại đối với mã PIN đó trong 5 phút. Học sinh khác với mã PIN hợp lệ vẫn tham gia lớp bình thường.
- **Bảo vệ `bootstrapTeacherRole`:**
  - Chặn hoàn toàn người dùng đăng nhập ẩn danh (`anonymous`).
  - Ở môi trường sản xuất (Production), kiểm tra `email_verified === true` khi dùng danh sách trắng email `TEACHER_EMAIL_ALLOWLIST`.
- **Cách ly đáp án đúng tuyệt đối (`publishLesson` & Firestore Rules):**
  - Nội dung bài đọc và câu hỏi công khai nằm trong `lessons/{id}/versions/{vId}` (hoàn toàn không chứa trường `answer`, `hint`, `explanation`).
  - Đáp án đúng và gợi ý sư phạm chỉ lưu trong `privateAnswerKeys/{vId}` với quy tắc `allow read, write: if false;`, chỉ Firebase Admin SDK trong Cloud Functions mới có quyền truy cập.

### P4. Kiểm thử Chấp nhận Bộ dữ liệu Sư phạm (`EMYTV_SAMPLE_CASES.json`)
- **3 Fixtures bài đọc tích cực (Positive Fixtures):**
  1. `fixture-l2-hat-dau`: "Hạt đậu trước hiên nhà" (Lớp 2, 5 câu hỏi tích hợp 3 dạng).
  2. `fixture-l2-quyen-sach`: "Quyển sách ở góc lớp" (Lớp 2, 5 câu hỏi tích hợp 3 dạng).
  3. `fixture-l3-cay-cau`: "Con đường sau cơn mưa" (Lớp 3, 5 câu hỏi tích hợp 3 dạng).
  - Tất cả đều vượt qua kiểm định `LessonDraftSchema` và chia tách thành công giữa công khai và đáp án cách ly.
- **8 Ca biên âm tính (Negative Cases):**
  - `invalid-missing-answer`: Bị từ chối (REJECT) bởi `FullAuthoringQuestionSchema`.
  - `invalid-ambiguous-options`: Phát hiện phương án trùng lặp, yêu cầu giáo viên duyệt (REVIEW_REQUIRED).
  - `invalid-ordering`: Bị từ chối (REJECT) nếu số sự việc khác 3.
  - `invalid-injection`: Xử lý an toàn như chuỗi thô, không thể can thiệp schema hay rò rỉ đáp án (SAFE_HANDLING).
  - `provider-401`: Phân loại lỗi `UNAUTHORIZED_KEY`, không báo thành công giả (CLEAR_ERROR).
  - `provider-404`: Phân loại lỗi `MODEL_NOT_FOUND`, không fallback model cũ (CLEAR_ERROR).
  - `provider-429`: Phân loại lỗi `RATE_LIMITED`, giữ nguyên bản nháp (RETRY_LIMITED).
  - `network-offline-submit`: Không xác nhận đã nộp nếu chưa nhận được phản hồi từ máy chủ (NO_FALSE_SUCCESS).

---

## 3. BẢNG TỔNG HỢP KIỂM THỬ TỰ ĐỘNG

| Bộ kiểm thử | Tệp kiểm thử | Số ca kiểm thử | Kết quả |
| :--- | :--- | :---: | :---: |
| **Quy tắc bảo mật Firestore** | `tests/rules.test.mjs` | 6/6 | **PASS** |
| **Kiểm định Sư phạm & Ca biên** | `tests/pedagogical_fixtures.test.mjs` | 11/11 | **PASS** |
| **Bảo mật & Cấu hình AI v4.0** | `tests/security_and_ai.test.mjs` | 4/4 | **PASS** |
| **Quy trình Sư phạm E2E** | `tests/e2e.test.mjs` | 10/10 | **PASS** |
| **TỔNG CỘNG** | `npm run test:all` | **31/31** | **PASS (100%)** |
