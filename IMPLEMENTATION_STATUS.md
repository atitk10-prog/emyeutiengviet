# TRẠNG THÁI TRIỂN KHAI CHI TIẾT (IMPLEMENTATION STATUS)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI thiết kế học liệu tương tác nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản:** 3.1-Pro (Nâng cấp toàn diện Gemini AI, Bảo mật Firebase & Giao diện Vector)  
**Cập nhật lần cuối:** 17/10/2026  

---

## 1. TIẾN ĐỘ THEO CÁC GIAI ĐOẠN P0 – P4

### Giai đoạn P0 — Nền tảng chạy được
- [x] Khởi tạo cấu trúc dự án monorepo (`shared`, `functions`, `web`).
- [x] Cấu hình TypeScript, Tailwind CSS, React Router DOM, Lucide Icons, Recharts.
- [x] Cấu hình Firebase (`firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`, `.env.example`).
- [x] Khởi tạo và kết nối Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001, UI: 4000).
- [x] Tích hợp bộ Java 21 portable (`.jdk21/`) tương thích với Firestore Emulator jar.
- [x] Xây dựng bộ dữ liệu 6 bài học mẫu chuẩn GDPT (3 bài Lớp 2, 3 bài Lớp 3) có đầy đủ từ vựng và 5 câu hỏi đủ 3 dạng.

### Giai đoạn P1 — Luồng lõi khép kín (Core Loop)
- [x] **Giáo viên đăng nhập:** Đăng nhập email/mật khẩu, cơ chế bảo vệ `bootstrapTeacherRole` nghiêm ngặt (chặn tự cấp quyền ở Production), 1-Click Demo Login cho môi trường thử nghiệm.
- [x] **Quản lý lớp & học sinh:** Tạo lớp (Khối 2/3, sinh mã lớp 6 ký tự), thêm học sinh (biệt danh an toàn), cấp mã truy cập 6 ký tự được băm muối bằng thuật toán **PBKDF2 với 10.000 vòng lặp** an toàn tại `studentSecrets`.
- [x] **Đổi mã học sinh:** Hỗ trợ rotate mã bảo mật, tự động thu hồi phiên học cũ.
- [x] **Soạn & Duyệt bài:** Soạn thủ công hoặc AI nháp, xem trước tương tác, duyệt xuất bản (`publishLesson` chia tách an toàn thành `lessons/.../versions` và `privateAnswerKeys`).
- [x] **Chỉnh sửa bài nháp trực tiếp (Interactive Draft Editor):** Cho phép giáo viên sửa tiêu đề, bài đọc, lựa chọn A/B/C, đáp án máy chủ, gợi ý và giải thích trước khi xuất bản.
- [x] **Giao bài:** Giao bài cho lớp học (`assignLesson`), bài đã giao bất biến theo `lessonVersionId`.
- [x] **Học sinh vào lớp:** Đăng nhập bằng mã lớp + mã riêng (`joinClass`), xác minh bằng so sánh thời gian thực `crypto.timingSafeEqual`, bind `authUid` qua Firebase Anonymous Auth.
- [x] **Chống tấn công vét cạn (Anti-Brute-Force Lockout):** Khóa tạm thời 5 phút sau 5 lần nhập sai mã liên tiếp.
- [x] **Đọc & Nghe:** Đọc chữ lớn, 4 mức phóng to cỡ chữ, nghe đọc mẫu bằng Web Speech API tiếng Việt, khám phá từ khó qua popup giải nghĩa sinh động.
- [x] **3 dạng bài tập:** Trắc nghiệm 3 lựa chọn (A/B/C); Đúng/Sai; Sắp xếp 3 sự việc (hỗ trợ kéo thả và nút mũi tên cho màn hình cảm ứng).
- [x] **Chấm điểm & Gợi ý 2 giai đoạn:** Chấm độc lập trên máy chủ. Lần 1 sai gửi gợi ý sư phạm (`hint`), không lộ đáp án; cho phép thử lại 1 lần duy nhất; chốt bài hiển thị đáp án và lời giải thích.
- [x] **Lưu trữ Firestore:** Kết quả lượt làm bài, số đúng lần 1, số đúng sau gợi ý, số sao ghi nhận an toàn vào Firestore.
- [x] **Bảng điều khiển giáo viên:** Xem tiến độ, thống kê lượt làm bài, biểu đồ so sánh đúng lần 1 vs sau gợi ý (xóa bỏ hoàn toàn số liệu giả).

### Giai đoạn P2 — AI thực sự (Real AI Integration)
- [x] Cập nhật adapter LLM Google Gemini (`functions/src/services/aiAdapter.ts`) sử dụng model hiện hành **`gemini-2.5-flash`** (loại bỏ hoàn toàn model cũ `gemini-1.5-flash`).
- [x] Đọc cấu hình model linh hoạt từ biến môi trường máy chủ **`GEMINI_MODEL`** và tự động fallback sang **`gemini-2.0-flash`**.
- [x] Kiểm định JSON schema bằng Zod (`LessonDraftSchema`) đảm bảo cấu trúc bài học lớp 2–3, số từ (100–180 từ lớp 2, 150–220 từ lớp 3) và đủ 3 dạng câu hỏi.
- [x] Bổ sung Cloud Function `getAIStatus` và Banner thông báo trạng thái AI minh bạch trên giao diện Soạn bài.
- [x] Thông báo minh bạch *"Chưa kết nối AI"* khi thiếu khóa API trong biến môi trường và cung cấp nút chuyển sang Soạn thủ công; không giả vờ đã kết nối AI thành công.
- [x] AI đề xuất hoạt động củng cố phân hóa 10–15 phút dựa trên thống kê tổng hợp ẩn danh, gắn nhãn *"Gợi ý AI – cần giáo viên duyệt"*.
- [x] Cơ chế dự phòng theo quy tắc (rule-based fallback) khi dịch vụ AI ngoại vi gặp sự cố hoặc thiếu API key.

### Giai đoạn P3 — Minh chứng & Hoàn thiện (Evidence & Completeness)
- [x] Biểu đồ Recharts trực quan hóa tỉ lệ đạt 5 năng lực đọc hiểu (Tìm thông tin trực tiếp, Hiểu từ trong ngữ cảnh, Hiểu nội dung chính, Sắp xếp trình tự, Liên hệ vận dụng).
- [x] Đánh giá hiệu quả Trước / Sau can thiệp (Paired Pre/Post assessment) ghép cặp học sinh theo `studentId`, tính chênh lệch điểm phần trăm (+/- percentage points) và quy mô mẫu $N$.
- [x] Xuất báo cáo CSV chuẩn UTF-8 BOM (`\uFEFF`) mở bằng Microsoft Excel và Google Sheets không bị lỗi dấu tiếng Việt.
- [x] Xuất tệp sao lưu dữ liệu có cấu trúc JSON.
- [x] Bộ nhận diện 100% Vector SVG: linh vật Chim Xanh 5 biểu cảm sư phạm, app logo, favicon, 0 emoji hệ điều hành còn sót.

### Giai đoạn P4 — Chất lượng, Bảo mật & Bàn giao
- [x] 100% tests quy tắc bảo mật Firestore (`tests/rules.test.mjs`) đạt PASS (6/6).
- [x] 100% tests quy trình tích hợp End-to-End (`tests/e2e.test.mjs`) đạt PASS (10/10).
- [x] 100% tests bảo mật và AI status (`tests/security_and_ai.test.mjs`) đạt PASS (3/3).
- [x] Đã kiểm thử trực tiếp trên trình duyệt bằng Browser Agent, có video ghi hình và 11 ảnh chụp màn hình lưu tại `artifacts/final-ui/`.
- [x] Hoàn thiện tài liệu nghiệm thu cuối [`FINAL_RELEASE_AUDIT.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/FINAL_RELEASE_AUDIT.md) và hướng dẫn triển khai [`README.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/README.md).

---

## 2. DANH MỤC THÀNH PHẦN MÃ NGUỒN

| Tệp tin / Thư mục | Vai trò | Trạng thái |
| :--- | :--- | :---: |
| `/shared/src/index.ts` | Schema Zod, kiểu dữ liệu dùng chung (Lesson, Question, Attempt...) | **Hoàn thành** |
| `/functions/src/index.ts` | 18 Cloud Functions nghiệp vụ, bảo mật, xác thực và chấm điểm | **Hoàn thành** |
| `/functions/src/services/aiAdapter.ts` | Adapter Google Gemini (`gemini-2.5-flash` / `gemini-2.0-flash` fallback) | **Hoàn thành** |
| `/functions/src/seed/seedData.ts` | 6 bài đọc mẫu chuẩn GDPT Lớp 2 và Lớp 3 | **Hoàn thành** |
| `/functions/src/utils/crypto.ts` | Tiện ích sinh mã, băm PBKDF2 10.000 vòng, timingSafeEqual | **Hoàn thành** |
| `/firestore.rules` | Quy tắc bảo mật deny-by-default, chặn đọc đáp án và secret hash | **Hoàn thành** |
| `/firestore.indexes.json` | Cấu hình chỉ mục truy vấn Firestore | **Hoàn thành** |
| `/firebase.json` | Cấu hình cổng Emulator và các dịch vụ Firebase | **Hoàn thành** |
| `/web/src/firebase.ts` | Kết nối Firebase Web Client với Local Emulator Suite | **Hoàn thành** |
| `/web/src/context/AuthContext.tsx` | Quản lý phiên giáo viên và học sinh, tự động phục hồi phiên | **Hoàn thành** |
| `/web/src/components/MascotBird.tsx` | Linh vật SVG Chim Xanh biểu cảm phong phú | **Hoàn thành** |
| `/web/src/components/AudioReader.tsx` | Đọc mẫu văn bản tiếng Việt qua Web Speech API | **Hoàn thành** |
| `/web/src/components/VocabularyModal.tsx` | Popup giải nghĩa từ khó khi học sinh bấm vào từ | **Hoàn thành** |
| `/web/src/components/QuestionCard.tsx` | Thẻ câu hỏi 3 dạng bài tập, hiển thị gợi ý và giải thích | **Hoàn thành** |
| `/web/src/pages/HomePage.tsx` | Trang chủ điều hướng vai trò Học sinh / Giáo viên | **Hoàn thành** |
| `/web/src/pages/StudentLogin.tsx` | Đăng nhập học sinh bằng mã lớp và mã riêng | **Hoàn thành** |
| `/web/src/pages/StudentLibrary.tsx` | Góc đọc sách hiển thị các bài được giao và số sao đạt được | **Hoàn thành** |
| `/web/src/pages/ReadingMission.tsx` | Màn hình đọc bài, nghe đọc, cỡ chữ và 5 câu hỏi đọc hiểu | **Hoàn thành** |
| `/web/src/pages/MissionCompleted.tsx` | Màn hình tổng kết, pháo hoa ăn mừng và bảng điểm phân tách | **Hoàn thành** |
| `/web/src/pages/TeacherLogin.tsx` | Đăng nhập/đăng ký giáo viên + 1-Click Demo Login | **Hoàn thành** |
| `/web/src/pages/TeacherDashboard.tsx` | Bảng điều khiển quản lý lớp, học sinh, soạn bài, AI, sửa nháp, xuất báo cáo | **Hoàn thành** |
| `/tests/rules.test.mjs` | Bộ unit test kiểm tra toàn diện Firestore Security Rules | **Hoàn thành** |
| `/tests/e2e.test.mjs` | Bộ test tích hợp End-to-End toàn bộ quy trình sư phạm | **Hoàn thành** |
| `/tests/security_and_ai.test.mjs` | Bộ test bảo mật nâng cao (lockout 5 lần, AI config, PBKDF2) | **Hoàn thành** |
| `/README.md` | Hướng dẫn cài đặt, vận hành và demo 5 phút | **Hoàn thành** |
| `/QA_REPORT.md` | Báo cáo kiểm định chất lượng chi tiết | **Hoàn thành** |
| `/FINAL_RELEASE_AUDIT.md` | Báo cáo kiểm toán phát hành cuối cùng | **Hoàn thành** |

---

## 3. CÁC HẠNG MỤC CẦN LƯU Ý KHI TRIỂN KHAI PRODUCTION

1. **Khóa API AI (Google Gemini):**
   - Khuyến nghị cấu hình qua Firebase Secrets:
     ```bash
     firebase functions:secrets:set GEMINI_API_KEY
     ```
   - Model mặc định: `gemini-2.5-flash` (có thể điều chỉnh bằng `GEMINI_MODEL`).
2. **Kế hoạch cước Firebase Blaze:**
   - Triển khai Cloud Functions lên môi trường thực tế yêu cầu dự án Firebase nâng cấp gói Blaze (Pay as you go).
   - Chưa triển khai production và chưa bật thanh toán khi chưa được người dùng cấp quyền.
