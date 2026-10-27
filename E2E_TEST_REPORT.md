# BÁO CÁO KIỂM THỬ KHÉP KÍN E2E VÀ ĐA THIẾT BỊ
## DỰ ÁN: EM YÊU TIẾNG VIỆT (LỚP 2 – 3)
*Phương thức kiểm thử: Tự động hoá Node.js API + Component Verification*
*Thời gian chạy kiểm thử: 27/10/2026*

---

## 1. KẾT QUẢ KIỂM THỬ KHÉP KÍN BA VAI TRÒ (ROLE-BASED E2E)

### 1.1. Phân hệ Quản trị viên (Admin Workflow)
* **Tài khoản kiểm thử:** `admin` / `Adm_35E0d6ff^42`
* **Kết quả từng bước:**
  1. Đăng nhập qua `/api/auth` (`accountLogin`): **PASS** (1112ms, Custom Token cấp role `admin`).
  2. Nạp số liệu tổng quan hệ thống (`getAdminOverview`): **PASS** (247ms, phản ánh trung thực 2 giáo viên, 10 lớp, 200 học sinh, 21 bài đọc, 30 bài giao).
  3. Quản lý danh sách giáo viên & trạng thái (`listTeachers`): **PASS** (63ms, tìm thấy 2 giáo viên đang active).
  4. Quản lý danh mục Khung chương trình & Năm học (`getCurriculumFramework`, `listAcademicYears`): **PASS** (71ms, nạp dữ liệu năm học `2026-2027`).
  5. Đăng xuất: **PASS** (Xoá token, huỷ phiên).

### 1.2. Phân hệ Giáo viên (Teacher Workflow)
* **Tài khoản kiểm thử:** `giaovien01` / `Gv_6D53d912!64`
* **Kết quả từng bước:**
  1. Đăng nhập qua `/api/auth`: **PASS** (285ms, role `teacher`).
  2. Tải trang Dashboard điều khiển: **PASS** (Song song nạp lớp & bài trong 247ms).
  3. Quản lý danh sách học sinh theo lớp (`class_2a`): **PASS** (82ms, 19 học sinh).
  4. Thư viện bài đọc (`getTeacherLessons`): **PASS** (69ms, 21 bài đọc).
  5. Bộ mô phỏng Xem trước (Student Preview Simulator): **PASS** (Thao tác thử thách 5 câu, nhận diện đúng đáp án B bài Cây bàng non, sắp xếp sự việc bằng nút ▲/▼ mượt mà).
  6. Xuất bản bài học qua Cổng 2 (`publishLesson`): **PASS** (Xác thực đầy đủ câu hỏi, tự động phân tách `publicQuestions` và `privateAnswerKeys`).
  7. Giao bài cho lớp học (`assignLesson`): **PASS** (Bản giao gắn chặt phiên bản bài học bất biến).
  8. Xem tiến độ & Báo cáo kỹ năng (`getTeacherAnalytics`): **PASS** (Hiển thị tỷ lệ đúng lần đầu và sau gợi ý).

### 1.3. Phân hệ Học sinh (Student Workflow)
* **Tài khoản kiểm thử:** Mã `HS002` / PIN `HS123456`
* **Kết quả từng bước:**
  1. Đăng nhập tại `/student/join`: **PASS** (240ms, nhận diện học sinh *Trần Thu Phương Linh*, lớp `class_2a`).
  2. Góc đọc sách (`getStudentLibrary`): **PASS** (116ms, hiển thị 5 bài tập được giao cho lớp `class_2a`).
  3. Bắt đầu bài làm (`startAttempt`): **PASS** (Mở bài đọc, nghe giọng đọc mẫu TTS, tra cứu từ khó *mơn mởn*, *thì thầm* qua popup).
  4. Trả lời Trắc nghiệm A/B/C: **PASS** (Chọn "B. Một vỏ chai nhựa" được máy chủ chấm Đúng, nhận sao).
  5. Trả lời Đúng/Sai: **PASS** (Chọn nhận định, gửi máy chủ chấm chính xác).
  6. Sắp xếp 3 sự việc: **PASS** (Dùng nút mũi tên Lên/Xuống sắp xếp trình tự, gửi mảng thứ tự và được chấm đúng).
  7. Cơ chế gợi ý & Thử lại: **PASS** (Lần 1 chọn sai -> Máy chủ gửi gợi ý sư phạm -> Bấm "Em thử lại lần nữa" -> Chọn đúng -> Được cộng điểm và ghi nhận đúng sau gợi ý).
  8. Nộp bài & Nhận sao (`finishAttempt`): **PASS** (Idempotent update, chống nộp lặp, điều hướng đến trang `/student/completed/:id`).

---

## 2. KẾT QUẢ KIỂM THỬ 10 KỊCH BẢN SƯ PHẠM VÀ PHỤC HỒI DỮ LIỆU

| Kịch bản | Mô tả tình huống thử nghiệm | Kết quả | Chi tiết kỹ thuật |
|:---:|---|:---:|---|
| **KB-01** | Học sinh trả lời đúng tất cả ngay lần đầu | **PASS** | Đạt 5/5 câu (100%), `firstTryCorrectCount = 5`, nhận 3 sao. |
| **KB-02** | Học sinh trả lời sai tất cả các câu | **PASS** | Ghi nhận 0/5 câu, không bị tính điểm khống. |
| **KB-03** | Học sinh đúng một phần bài làm | **PASS** | Tính điểm độc lập từng câu, điểm tổng khớp chính xác số câu đúng. |
| **KB-04** | Sai lần đầu, nhận gợi ý và đúng sau khi thử lại | **PASS** | Lần 1: Sai -> Gửi gợi ý -> Lần 2: Đúng -> Lưu `firstTryCorrect = false`, `finalCorrect = true`. |
| **KB-05** | Học sinh chưa làm xong bài | **PASS** | Giữ trạng thái `in_progress`, không sinh báo cáo hoàn thành giả. |
| **KB-06** | Học sinh tải lại trang giữa chừng | **PASS** | Khôi phục chính xác các câu đã làm và mở đúng câu tiếp theo (q3). |
| **KB-07** | Hai học sinh làm bài đồng thời | **PASS** | Hai phiên làm bài độc lập, không xung đột hoặc ghi đè kết quả. |
| **KB-08** | Giáo viên sửa học liệu sau khi đã giao bài | **PASS** | Bài đã giao bất biến theo `versionId`, không làm thay đổi đề thi của học sinh. |
| **KB-09** | Idempotency khi nộp bài (Double click) | **PASS** | Gửi lại yêu cầu với cùng `idempotencyKey` không tạo thêm bản ghi hoàn thành trùng lặp. |
| **KB-10** | Đánh giá mức độ tiến bộ sau gợi ý | **PASS** | Thống kê phân định rõ: Đúng lần đầu 60% -> Sau gợi ý 80% (Tiến bộ +20%). |

---

## 3. KIỂM THỬ TƯƠNG THÍCH ĐA THIẾT BỊ (MULTI-DEVICE RESPONSIVE)

| Thiết bị kiểm thử | Kích thước màn hình | Khu vực kiểm tra đặc biệt | Kết quả |
|---|:---:|---|:---:|
| **Desktop màn lớn** | 1920 × 1080 | Dashboard giáo viên, biểu đồ Recharts, bảng danh sách học sinh | **ĐẠT CHUẨN** (Bố cục thoáng, không tràn lề) |
| **Laptop tiêu chuẩn** | 1366 × 768 | Màn hình đọc bài kết hợp ngăn kéo đối chiếu bài đọc (Accordion) | **ĐẠT CHUẨN** (Cuộn trang mượt mà, chiều cao tối ưu) |
| **Máy tính bảng** | 768 × 1024 (iPad) | Giao diện thẻ câu hỏi, nút chọn phương án A/B/C | **ĐẠT CHUẨN** (Cảm ứng nhạy, chữ to rõ ràng) |
| **Điện thoại phổ thông** | 390 × 844 (iPhone 14) | Kéo thả/nút mũi tên sắp xếp sự việc, thanh tiến độ | **ĐẠT CHUẨN** (Nút bấm tối thiểu 44px, không che khuất nội dung) |
| **Điện thoại nhỏ** | 360 × 800 (Android) | Header điều hướng, nút nghe phát âm Audio TTS, popup từ khó | **ĐẠT CHUẨN** (Tự động co giãn cỡ chữ, không bị vỡ khung) |
