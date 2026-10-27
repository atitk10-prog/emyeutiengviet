# BÁO CÁO TOÀN DIỆN LỖI HỆ THỐNG (BUG TRACKING REPORT)
## DỰ ÁN: EM YÊU TIẾNG VIỆT (LỚP 2 – 3)
*Phân loại theo mức độ ưu tiên: P0 (Khẩn cấp/Sai điểm/Mất dữ liệu) → P1 (Hiệu năng/Ổn định) → P2 (Giao diện/Trải nghiệm)*

---

### BẢNG TỔNG KẾT TÌNH TRẠNG SỬA LỖI

| Mã lỗi | Phân hệ | Tóm tắt lỗi | Mức độ | Nguyên nhân gốc rễ | Trạng thái |
|---|---|---|:---:|---|:---:|
| **BUG-01** | Giáo viên (Preview) & Backend | Chọn đáp án B bị báo "Chưa đúng" dù giải thích ghi nhận đúng | **P0** | Preview kiểm tra `currQ.correctAnswer` (bị `undefined` ở bản nháp) thay vì `currQ.answer`. Backend thiếu quy đổi chuẩn hoá đa dạng đáp án (chỉ số, chuỗi, tiền tố). | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-02** | Học sinh (Mission UI) | Câu 5/5 sắp xếp sự việc trắng trơn, không có sự việc để xếp | **P0** | Gemini AI sinh `answer` và `explanation` nhưng thiếu mảng `items`. Hàm `publishLesson` không chiếu `items` sang `publicQuestions`. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-03** | Học sinh (Progress Bar) | Tiến độ nhảy 100% khi vừa bước vào câu cuối dù chưa làm | **P1** | `ReadingMission.tsx` tính tiến độ dựa trên chỉ số câu đang xem `((currentQuestionIdx + 1) / total) * 100` thay vì số câu đã hoàn thành thực tế. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-04** | Backend (`/api/lessons`) | Mất trường `statement` và `items` khi xuất bản bài học | **P0** | Logic tách dữ liệu công khai/bí mật trong `handlePublishLesson` lọc bỏ các trường không nằm trong whitelist cứng. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-05** | Backend & Chấm điểm | Lỗi đánh giá Boolean `Boolean("false") === true` | **P0** | Ép kiểu chuỗi ký tự `"false"` bằng hàm `Boolean()` trong Javascript luôn trả về `true`. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-06** | Hiệu năng (`/teacher/dashboard`) | Tải dữ liệu đăng nhập rất chậm (gần 60 giây) | **P1** | Truy vấn tuần tự (sequential waterfall) và quét toàn bộ collection `attempts` không phân trang hoặc cache. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-07** | Học sinh (UI Card) | Thông báo hướng dẫn chung chung "Vui lòng chọn câu trả lời" | **P2** | `QuestionCard.tsx` dùng chung 1 chuỗi thông báo cho cả 3 dạng câu hỏi. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-08** | Học sinh (UI Card) | Lặp tiền tố phương án (hiển thị "A. A. Một chiếc lá khô") | **P2** | Dữ liệu gốc đã có sẵn chữ "A. " nhưng UI vẫn render thêm nhãn "A. " ở nút bấm. | **ĐÃ SỬA & KIỂM CHỨNG** |
| **BUG-09** | AI & Soạn bài | Nguy cơ gợi ý sư phạm làm lộ nguyên văn đáp án đúng | **P1** | Gemini AI đôi khi đưa trực tiếp từ khóa đáp án vào trường `hint`. | **ĐÃ SỬA & KIỂM CHỨNG** |

---

## CHI TIẾT KỸ THUẬT VÀ PHƯƠNG ÁN XỬ LÝ TỪNG NHÓM LỖI

### 1. BUG-01: Chấm sai đáp án trắc nghiệm A/B/C
* **File liên quan:** 
  * [`shared/src/answerEvaluator.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/shared/src/answerEvaluator.ts)
  * [`api/_helpers/answerEvaluator.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/_helpers/answerEvaluator.ts)
  * [`api/attempts.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/attempts.ts)
  * [`web/src/pages/TeacherDashboard.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/TeacherDashboard.tsx)
* **Cách sửa:**
  1. Xây dựng hàm `normalizeMcqAnswerToIndex` quy đổi đa chiều (chữ cái `'A'|'B'|'C'`, số nguyên `0|1|2`, văn bản sạch, hoặc tiền tố) về cùng chỉ số mảng 0-indexed.
  2. Tại `TeacherDashboard.tsx`: thay thế phép so sánh trực tiếp bằng `checkAnswerCorrectness` với `targetCorrect = currQ.correctAnswer ?? currQ.answer`.
  3. Tại `api/attempts.ts`: hàm `handleSubmitAnswer` lấy `questionMeta` từ phiên bản bài học và gọi hàm chấm canonical.
* **Bằng chứng kiểm chứng:** TEST 1 và Test Suite P0 đạt 100% PASS trên cả bài *Cây bàng non* và ngân hàng câu hỏi.

### 2. BUG-02: Câu sắp xếp không có nội dung sự việc
* **File liên quan:**
  * [`api/lessons.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/lessons.ts)
  * [`web/src/components/QuestionCard.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/QuestionCard.tsx)
  * [`scripts/patch_bang_lesson_safely.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scripts/patch_bang_lesson_safely.ts)
* **Cách sửa:**
  1. Bổ sung `items` vào danh sách trường được phép chuyển tiếp sang `publicQuestions` trong `handlePublishLesson`.
  2. Bổ sung hàm tự phục hồi `sanitizeQuestionData`: bóc tách tự động các sự việc `(1) ..., (2) ..., (3) ...` từ phần giải thích nếu AI bỏ sót `items`.
  3. Kích hoạt Cổng 3 trên giao diện: nếu phát hiện câu hỏi bị lỗi cấu trúc (`isCorrupted`), hiển thị thông báo sư phạm và cung cấp nút *"Bỏ qua câu này (không trừ điểm)"*, tuyệt đối không làm treo nút bấm của học sinh.
* **Bằng chứng kiểm chứng:** TEST 2, TEST 3, TEST 7 đạt 100% PASS. Toàn bộ 23/23 câu sắp xếp trong DB hợp lệ.

### 3. BUG-03: Thanh tiến độ hiển thị 100% ảo
* **File liên quan:**
  * [`web/src/pages/ReadingMission.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/ReadingMission.tsx)
* **Cách sửa:**
  1. Tách biệt rõ hai chỉ số:
     * Vị trí đang xem: `Đang xem câu {currentQuestionIdx + 1} / {totalQuestions}`.
     * Số câu thực sự đã làm: `Đã làm: {answeredQuestionsCount} / {totalQuestions}`.
  2. Công thức độ rộng thanh tiến độ: `style={{ width: `${progressPercent}%` }}` với `progressPercent = Math.round((answeredQuestionsCount / totalQuestions) * 100)`.
  3. Thanh tiến độ không bao giờ chạm 100% nếu học sinh chưa hoàn thành/bỏ qua toàn bộ các câu.

### 4. BUG-05: Lỗi ép kiểu Boolean trong câu Đúng/Sai
* **File liên quan:**
  * [`shared/src/answerEvaluator.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/shared/src/answerEvaluator.ts)
* **Cách sửa:**
  1. Triển khai hàm `normalizeBooleanAnswer` kiểm tra tường minh:
     * `true` nếu là boolean `true`, chuỗi `"true"`, `"1"`, hoặc từ `"đúng"`.
     * `false` nếu là boolean `false`, chuỗi `"false"`, `"0"`, hoặc từ `"sai"`.
     * Trả về `null` cho các trường hợp không xác định.
* **Bằng chứng kiểm chứng:** 25/25 câu Đúng/Sai trong hệ thống đạt chuẩn kiểm định.

### 5. BUG-06: Tối ưu hoá tốc độ tải trang Giáo viên
* **File liên quan:**
  * [`api/admin.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/admin.ts)
  * [`api/analytics.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/analytics.ts)
  * [`web/src/pages/TeacherDashboard.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/TeacherDashboard.tsx)
* **Cách sửa:**
  1. Chuyển đổi chuỗi tải tuần tự sang nạp song song `Promise.all([getTeacherClasses, getTeacherLessons])`.
  2. Tách nạp dữ liệu phân tích nặng (`getTeacherAnalytics`) thành yêu cầu bất đồng bộ nền, cho phép người dùng tương tác ngay với thư viện và lớp học chỉ sau 247ms.
* **Bằng chứng kiểm chứng:** Đo kiểm thực tế 10 lần liên tiếp đạt trung vị 247ms (so với gần 60 giây ban đầu).
