# BÁO CÁO KIỂM THỬ VÀ NGHIỆM THU (QA REPORT v4.0)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI thiết kế học liệu tương tác nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản:** 4.0 Hardened & Acceptance-Ready  
**Thời điểm thực hiện:** 17/10/2026  
**Môi trường thực nghiệm:** Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001, Hub UI: 4000) + React Vite Frontend + OpenJDK 21  

---

## 1. MA TRẬN 4 CỔNG NGHIỆM THU (RELEASE GATES G1–G4)

Tuân thủ nghiêm ngặt theo đặc tả `EMYTV_RELEASE_GATES.md`:

| Cổng nghiệm thu | Mô tả cổng | Trạng thái | Đánh giá & Điều kiện hoàn tất |
| :--- | :--- | :---: | :--- |
| **G1: Cổng Chức năng cốt lõi (Functional Core Gate)** | Hoàn thiện 100% luồng nghiệp vụ: Đăng nhập giáo viên, quản lý lớp theo năm học, cấp/đổi mã PIN học sinh, soạn bài thủ công & duyệt bài, 6 bài mẫu GDPT, học sinh đọc/nghe, 3 dạng câu hỏi (MCQ, True/False, Sequence), chấm điểm 2 giai đoạn, gợi ý sư phạm và xuất báo cáo UTF-8 BOM CSV. | **PASS** | 10/10 bước E2E test (`tests/e2e.test.mjs`) và 11/11 bài test sư phạm (`tests/pedagogical_fixtures.test.mjs`) đạt 100%. |
| **G2: Cổng Bảo mật dữ liệu & Đánh giá (Security & Assessment Gate)** | Quy tắc Firestore Rules Deny-by-default; cách ly tuyệt đối `privateAnswerKeys` và `studentSecrets` khỏi client; băm mã PIN bằng PBKDF2 10.000 vòng; khóa thử lại có mục tiêu chống tấn công vét cạn (không làm tê liệt cả lớp); chống leo thang đặc quyền `bootstrapTeacherRole`. | **PASS** | 6/6 test Rules (`tests/rules.test.mjs`) và 4/4 test bảo mật (`tests/security_and_ai.test.mjs`) xác minh 100%. |
| **G3: Cổng Dịch vụ AI Thực tế (Live AI Service Gate)** | Tích hợp Google Gemini với model hiện hành `gemini-3.5-flash-lite` và `gemini-3.8-flash`; đọc biến môi trường backend `GEMINI_MODEL`; hỗ trợ tệp bí mật `functions/.secret.local`; hiển thị 4 trạng thái AI minh bạch; điểm cuối `testAIConnection` an toàn, chống spam; không fallback sang model đã khai tử. | **READY_UNVERIFIED / CHỜ KHÓA THẬT** *(BLOCKED cho Live Call nếu chưa có key)* | Bộ chuyển đổi Gemini Adapter và endpoint `testAIConnection` đã sẵn sàng 100%. Khi cung cấp `GEMINI_API_KEY` hợp lệ, hệ thống chuyển tức thời sang trạng thái `VERIFIED`. Không bao giờ báo thành công giả khi thiếu key. |
| **G4: Cổng Triển khai Cloud Staging (Cloud Staging Gate)** | Triển khai hạ tầng thực tế lên Firebase Cloud Staging (`em-yeu-tieng-viet---staging`): Cloud Functions v2, Secret Manager, Firestore Rules, và Hosting. | **BLOCKED** | Tuân thủ cam kết: Dự án Cloud hiện tại ở gói Spark (Free). **Đang tạm dừng đợi người dùng nâng cấp gói Blaze và ra lệnh deploy chính thức.** |

---

## 2. TỔNG QUAN KẾT QUẢ KIỂM THỬ TỰ ĐỘNG

| Bộ kiểm thử | Tệp kiểm thử | Số ca kiểm thử | Kết quả | Ghi chú kỹ thuật |
| :--- | :--- | :---: | :---: | :--- |
| **Quy tắc bảo mật Firestore** | `tests/rules.test.mjs` | 6/6 | **PASS (100%)** | Deny-by-default, cách ly đáp án, cấm client ghi attempts |
| **Kiểm định Sư phạm & Ca biên âm tính** | `tests/pedagogical_fixtures.test.mjs` | 11/11 | **PASS (100%)** | 3 fixtures L2/L3 (`EMYTV_SAMPLE_CASES.json`) + 8 ca biên sư phạm/bảo mật |
| **Bảo mật & Cấu hình AI v4.0** | `tests/security_and_ai.test.mjs` | 4/4 | **PASS (100%)** | 4 trạng thái AI, khóa PIN đích danh, xác thực `testAIConnection` |
| **Quy trình sư phạm khép kín E2E** | `tests/e2e.test.mjs` | 10/10 | **PASS (100%)** | Luồng đầy đủ từ tạo lớp, cấp mã, làm bài, chấm điểm đến xuất CSV |
| **TỔNG HỢP TOÀN BỘ TEST SUITES** | `npm run test:all` | **31/31** | **PASS (100%)** | Toàn bộ 31 test suites vượt qua trong 10.2 giây |

---

## 3. CHI TIẾT CÁC CẢI TIẾN TRỌNG TÂM TRONG PHIÊN BẢN 4.0

### 3.1. Nâng cấp Google Gemini AI Adapter
- **Model chính:** `gemini-3.5-flash-lite` (nhanh, tối ưu chi phí, hỗ trợ xử lý ngôn ngữ tiếng Việt tự nhiên).
- **Model chất lượng cao:** `gemini-3.8-flash`.
- **Cấu hình động:** Đọc từ biến môi trường máy chủ `GEMINI_MODEL`.
- **Loại bỏ model ngừng hoạt động:** Xóa hoàn toàn mã liên quan đến `gemini-2.0-flash` và `gemini-1.5-flash`.
- **4 trạng thái AI minh bạch:**
  - `NOT_CONFIGURED`: Chưa tìm thấy API key trong backend -> Bật chế độ Soạn thủ công và 6 bài mẫu.
  - `READY_UNVERIFIED`: Đã phát hiện khóa API nhưng chưa kiểm chứng bằng lệnh thực tế.
  - `VERIFIED`: Đã kiểm chứng thành công bằng cuộc gọi thực tế (hiển thị model và độ trễ ms).
  - `UNAVAILABLE`: Gặp lỗi gần nhất (401, 404, 429, timeout) -> Hiển thị cảnh báo và mã lỗi sư phạm.
- **Điểm cuối `testAIConnection`:** Endpoint an toàn, giới hạn tốc độ 15s/lần, chỉ dành cho giáo viên đã xác thực để thử nghiệm tạo 1 câu mẫu ngắn không chứa dữ liệu học sinh.

### 3.2. Sửa lỗi Chống Tấn công Vét cạn (Anti-Brute-Force Lockout)
- *Trước đây:* Theo dõi thất bại theo `cleanClassCode`, dẫn đến việc 1 đối tượng xấu nhập sai 5 lần sẽ khóa luôn tất cả học sinh trong lớp.
- *Hiện tại:* Theo dõi số lần nhập sai theo khóa kết hợp `${cleanClassCode}_${cleanAccessCode}`. Khi nhập sai 1 mã PIN cụ thể 5 lần, chỉ khóa thử lại đối với mã PIN đó trong 5 phút (`300s`). Các học sinh khác với mã PIN hợp lệ vẫn tham gia lớp học bình thường.

### 3.3. Quản lý Đa Giáo viên, Lớp học & Năm học (`academicYear`)
- Mở rộng giao diện và backend để hỗ trợ trường `academicYear` (mặc định `'2025-2026'`).
- Giáo viên có thể theo dõi và lọc học sinh theo từng năm học riêng biệt, phục vụ lưu trữ học bạ dài hạn.

### 3.4. Kiểm chứng Bộ dữ liệu Sư phạm (`EMYTV_SAMPLE_CASES.json`)
- Đã kiểm chứng thành công 3 bài đọc mẫu GDPT:
  - `fixture-l2-hat-dau`: "Hạt đậu trước hiên nhà" (Lớp 2, 5 câu hỏi).
  - `fixture-l2-quyen-sach`: "Quyển sách ở góc lớp" (Lớp 2, 5 câu hỏi).
  - `fixture-l3-cay-cau`: "Con đường sau cơn mưa" (Lớp 3, 5 câu hỏi).
- Đã kiểm chứng 8 ca biên tiêu cực: từ chối câu thiếu đáp án, phát hiện lựa chọn trùng lặp, từ chối câu sắp xếp không đủ 3 sự việc, vô hiệu hóa prompt injection, phân loại chuẩn xác lỗi 401, 404, 429 và từ chối báo lưu thành công giả khi mất mạng.

---

## 4. MINH CHỨNG GIAO DIỆN VÀ TRÌNH DUYỆT (BROWSER RUN)

| Màn hình kiểm tra | Độ phân giải | Kết quả kiểm tra | Tệp ảnh minh chứng |
| :--- | :---: | :---: | :--- |
| **Banner Trạng thái AI & Nút kiểm tra** | Desktop (1280x800) | **PASS** | [`artifacts/ai_status_banner.png`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/ai_status_banner.png) |
| **Hộp thoại Tạo Lớp mới có Năm học** | Desktop (1280x800) | **PASS** | [`artifacts/create_class_modal.png`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/create_class_modal.png) |
| **Bảng điều khiển trên Di động** | Mobile (390x844) | **PASS** | [`artifacts/mobile_dashboard.png`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/mobile_dashboard.png) |
| **Video ghi nhận phiên duyệt trình duyệt** | WebP Video | **PASS** | [`browser_v4_verification_1792243835232.webp`](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/3627e53d-e21e-4893-bdaf-b32c5a28ba69/browser_v4_verification_1792243835232.webp) |

---

---

## 6. BÁO CÁO NGHIỆM THU KHẨN CẤP P0 PRODUCTION (28/10/2026)

### 6.1. Nguyên nhân gốc rễ 4 lỗi Production
1. **Lỗi 1 (Màn hình trắng – TypeError `teacherSteps.map`):**
   - *Nguyên nhân:* Phản hồi từ Google Gemini hoặc các bản ghi `remediationActivities` trong Firestore trả về `teacherSteps` dưới dạng chuỗi (string) phân cách dòng/dấu gạch đầu dòng hoặc object, thay vì mảng chuỗi (`string[]`). Trong JSX của `TeacherDashboard.tsx`, biểu thức `{act.teacherSteps && act.teacherSteps.length > 0 && act.teacherSteps.map(...)}` được kích hoạt vì string cũng có thuộc tính `.length > 0`, dẫn đến `TypeError: act.teacherSteps.map is not a function` gây sập toàn bộ React render tree.
   - *Khắc phục:* Viết hàm chuẩn hóa `normalizeTeacherSteps(raw)` trong `@emytv/shared` và `api/analytics.ts`. Áp dụng bọc toàn diện ở tầng API (khi Gemini sinh, khi lưu Firestore, khi tải danh sách) và ở tầng React Component trước khi map/filter. Bản ghi lỗi dữ liệu tự động chuyển thành mảng hợp lệ, không tạo bước sư phạm giả.

2. **Lỗi 2 (Giao bài báo "Bài đọc không tồn tại" - `seed-lop2-bai1`):**
   - *Nguyên nhân:* 6 bài mẫu GDPT 2018 được lưu in-memory trong `api/_helpers/seedLessons.ts` và tiêm vào danh sách `getTeacherLessons` để giáo viên xem trước mà không tốn đọc Firestore. Tuy nhiên, chúng chưa từng được khởi tạo tài liệu (materialized) trong các collection `lessons`, `versions`, và `privateAnswerKeys` của Firestore Production `emyeutiengviet-prod`. Khi giáo viên bấm "Giao bài", hàm `handleAssignLesson` kiểm tra `db.collection('lessons').doc(lessonId).get()` trả về rỗng và ném lỗi 404.
   - *Khắc phục:* Tạo quy trình vật lý hóa bài mẫu tự động và idempotent:
     - Chạy script `seed_production_lessons_idempotent.mjs` khởi tạo đầy đủ 6 bài mẫu vào Firestore `emyeutiengviet-prod`.
     - Bổ sung helper `ensureSeedLessonMaterialized(db, seedLessonId)` ngay trong API backend `api/lessons.ts` để bảo đảm mọi lượt giao bài mẫu đều tự động kiểm tra và vật lý hóa nếu thiếu, bảo toàn tính idempotent và không ghi đè dữ liệu cũ.

3. **Lỗi 3 (/api/lessons trả HTTP 404):**
   - *Nguyên nhân:* Kiểm tra Network thực tế cho thấy đường dẫn endpoint `/api/lessons` trên Vercel hoàn toàn hợp lệ (route hoạt động 100%). Mã HTTP 404 được trả về từ tầng nghiệp vụ `handleAssignLesson` (`ApiError(404, 'not-found', 'Bài đọc không tồn tại.')`) do document bài đọc chưa tồn tại trong Firestore (Lỗi 2). Đây KHÔNG phải lỗi định tuyến (route 404).

4. **Lỗi 4 (checkTtsAvailability bị CORS):**
   - *Nguyên nhân:* Tệp `web/src/services/apiClient.ts` thiếu action `checkTtsAvailability` trong mảng `MIGRATED_LESSON_ACTIONS`. Khi frontend gọi `checkTtsAvailability`, hệ thống fallback về Google Cloud Functions callable trên Firebase vốn không có cấu hình CORS preflight cho domain `emyeutiengviet-zeta.vercel.app`.
   - *Khắc phục:*
     - Thêm `checkTtsAvailability` vào `MIGRATED_LESSON_ACTIONS` trong `apiClient.ts`.
     - Bổ sung route `handleCheckTtsAvailability` có xác thực giáo viên trong `api/lessons.ts` trên Vercel.
     - Cập nhật `LessonAudioPanel.tsx` với cơ chế thử bắt lỗi an toàn (graceful fallback) sang Web Speech API của trình duyệt, hiển thị trạng thái chuẩn xác, không làm trắng trang.

### 6.2. Kết quả nghiệm thu 10 tiêu chí bắt buộc (A–J)
- **[A] Mở AI đề xuất củng cố 10 lần:** ĐÃ KIỂM CHỨNG PASS 100%. Không xuất hiện TypeError, trang hiển thị mượt mà.
- **[B] Danh sách hoạt động cũ tải an toàn:** ĐÃ KIỂM CHỨNG PASS. Các bản ghi `teacherSteps` dạng chuỗi hay mảng đều hiển thị chuẩn xác.
- **[C] Giao bài "Chim sâu nhỏ và vườn cam" (`seed-lop2-bai1`) cho Lớp 2A:** ĐÃ KIỂM CHỨNG PASS. Tạo thành công assignment `asg_77b38d3ad48a` trên Firestore Production.
- **[D] Giao bài AI mới ("Cây bàng non và chú chim nhỏ") cho Lớp 2B:** ĐÃ KIỂM CHỨNG PASS. Tạo thành công assignment `asg_026727e199d7`.
- **[E] Học sinh đăng nhập, làm bài và nộp bài:** ĐÃ KIỂM CHỨNG PASS. Học sinh `HS123456` đăng nhập vào Lớp 2B, nhận bài, trả lời câu hỏi và kết thúc với điểm số 100%.
- **[F] Giáo viên theo dõi tiến độ và điểm số:** ĐÃ KIỂM CHỨNG PASS. Lượt làm của học sinh được ghi nhận ngay lập tức trên dashboard lớp học.
- **[G] TTS khả dụng/báo lỗi chuẩn mực:** ĐÃ KIỂM CHỨNG PASS. API trả về trạng thái động cơ kèm fallback Web Speech API, âm thanh phát âm tiếng Việt chuẩn.
- **[H] Không còn lỗi Console P0 & không còn Network 404:** ĐÃ KIỂM CHỨNG PASS.
- **[I] Kiểm thử đa thiết bị (Desktop & Mobile):** ĐÃ KIỂM CHỨNG PASS trên cả viewport Desktop và Mobile.
- **[J] Xác nhận triển khai Production Vercel:** Commit `62db3e2` và `7e83883` đã được triển khai lên Production alias `https://emyeutiengviet-zeta.vercel.app` với bundle JS `index-Bh3CrFcu.js`.

**KẾT LUẬN CUỐI CÙNG: HỆ THỐNG ĐÃ SẴN SÀNG QUAY VIDEO VÀ TRÌNH DIỄN THỰC TẾ.**
