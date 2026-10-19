# NHẬT KÝ TIẾN ĐỘ THỰC HIỆN V5.2.1 — EM YÊU TIẾNG VIỆT
*Tệp trạng thái nghiệm thu thực tế theo thời gian thực — EM YÊU TIẾNG VIỆT V5.2.1*

## TRẠNG THÁI TỔNG QUAN
- **Phiên bản:** V5.2.1 (Sửa lỗi thực tế, hoàn thiện quản trị và lưu trữ lâu dài)
- **Thời gian nghiệm thu:** 18/10/2026
- **Tiến độ tổng thể:** **7/7 PHASES HOÀN THÀNH 100% (VERIFIED & PASSED)**
- **Kiểm thử tự động:** **73/73 tests PASS (0 fail) trên 11 test suites**
- **Kiểm thử trình duyệt (UAT thực tế):** Đã kiểm chứng trọn vẹn 3 vai trò (Giáo viên, Quản trị viên, Học sinh) và chế độ giao diện Mobile.

---

## BẢNG THEO DÕI CHI TIẾT TỪNG PHASE

### PHASE 1 – SỬA LỖI KHÔNG MỞ ĐƯỢC BÀI ĐỂ CHỈNH SỬA (P0)
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Lỗi gốc:** `(privateAnswers || []).find is not a function`
- **Nguyên nhân kỹ thuật:** Backend lưu `privateAnswers` dưới dạng Dictionary/Object (`Record<string, QuestionAnswerDetail>`). Khi frontend gọi `(privateAnswers || []).find(...)`, do `privateAnswers` là Object chứ không phải Array nên phương thức `.find` không tồn tại, dẫn đến crash giao diện khi giáo viên bấm "Sửa / Tạo bản mới" hoặc "Xem thử".
- **Giải pháp xử lý:**
  1. *Frontend (`web/src/pages/TeacherDashboard.tsx`):* Xây dựng hàm helper `getQuestionPrivateAnswer(privateAnswers, questionId)` an toàn, hỗ trợ trích xuất cả từ Dictionary (`answers[qId]`), Array (`answers.find(...)`), và xử lý an toàn khi `null/undefined`.
  2. *Backend (`functions/src/index.ts`):* Cập nhật hàm `getLessonDetail` chuẩn hóa trả về cả `privateAnswers` (Record) lẫn `privateAnswersList` (Array) để tương thích 100% với mọi client.
  3. *Regression Tests:* Bổ sung test case `P0-8` trong `tests/v5_2_lesson_lifecycle.test.mjs`, kiểm thử mô phỏng cả 3 trường hợp: Dictionary, Array, null. Kết quả: **PASS 100%**.
  4. *Kiểm chứng UAT Browser:* Giáo viên mở lại bài đã xuất bản, sửa nội dung, lưu nháp, F5, xem trước simulator mượt mà không crash.

---

### PHASE 2 – HOÀN THIỆN QUẢN LÝ BÀI ĐỌC (P0)
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Nội dung đã triển khai:**
  - [x] Xem trước học sinh (`Student Preview Modal`) hoạt động mượt mà, độc lập, không ghi nhận điểm thật.
  - [x] Mở bài đã tạo để chỉnh sửa (đã sửa dứt điểm lỗi ở Phase 1).
  - [x] Thao tác câu hỏi đầy đủ: Thêm câu hỏi mới, Sửa nội dung/đáp án/gợi ý/giải thích, Xóa, Nhân bản (`Clone`), Sắp xếp thứ tự ($\uparrow \downarrow$).
  - [x] AI tạo thêm câu hỏi cho bài hiện tại (`generateAdditionalQuestions`) kiểm định JSON Schema chặt chẽ.
  - [x] Nút `v1 (Lịch sử)` trên thẻ bài đọc: mở modal xem lịch sử tất cả các phiên bản của bài học (`versionsList`), bảo toàn dữ liệu bất biến.
  - [x] Nút `Đã giao: X lớp (Chi tiết)`: mở modal tra cứu danh sách các lớp và các đợt đã được giao bài đọc này.
  - [x] Gắn/thay/xóa tệp âm thanh đọc mẫu MP3/WAV hoặc đường link URL theo phiên bản; có trình phát nghe thử trực tiếp.
  - [x] Chống giao trùng vô ý: cảnh báo trùng lặp đợt giao và hỗ trợ tùy chọn `forceNewRound`.
  - [x] Bảo vệ dữ liệu an toàn: Bài đã xuất bản/đã giao được chuyển sang trạng thái `Lưu trữ` (Archived) để bảo toàn 100% lịch sử điểm số của học sinh; chỉ cho phép xóa vĩnh viễn các bản nháp chưa từng xuất bản/chưa giao.

---

### PHASE 3 – HOÀN THIỆN QUẢN LÝ HỌC SINH (P0)
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Nội dung đã triển khai:**
  - [x] Xem đầy đủ mã định danh học sinh: hiển thị `studentCode` kèm mã UID duy nhất trong hệ thống (`ID: ${st.id}`).
  - [x] Nút sao chép mã lớp (`classCode`), mã học sinh (`studentCode`) và mã UID tiện lợi.
  - [x] Nút biểu tượng con mắt ($\odot$) cho phép ẩn/hiện mã PIN một lần (`••••••` $\leftrightarrow$ `123456`) trong thẻ đăng nhập mới và thẻ cấp lại PIN.
  - [x] Cấp lại PIN an toàn (`rotateStudentAccess`): mã cũ lập tức bị thu hồi, mã mới chỉ hiển thị một lần duy nhất, backend lưu dạng băm an toàn (`salted hash`).
  - [x] Nút "In thẻ cả lớp" (`showBatchPrintCards`): hiển thị toàn bộ thẻ đăng nhập của học sinh trong lớp theo định dạng in ấn (`window.print()`).
  - [x] Chỉnh sửa thông tin học sinh (`updateStudentInfo`): đổi tên hiển thị / alias và studentCode (có kiểm tra chống trùng mã).
  - [x] Khóa / mở khóa tài khoản học sinh (`toggleStudentStatus`): đổi trạng thái `active` $\leftrightarrow$ `suspended`; tự động vô hiệu hóa phiên đăng nhập khi bị khóa; từ chối học sinh đăng nhập với thông báo rõ ràng.
  - [x] Chuyển lớp có kiểm soát (`transferStudentClass`): chuyển học sinh sang lớp khác cùng giáo viên sở hữu, bảo toàn hồ sơ và lịch sử làm bài.
  - [x] Hiển thị trạng thái PIN và thời điểm cấp gần nhất (`lastPinRotatedAt`).

---

### PHASE 4 – HOÀN THIỆN ADMIN VÀ TÀI KHOẢN GIÁO VIÊN (P0)
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Nội dung đã triển khai:**
  - [x] Bổ sung lối truy cập Quản trị rõ ràng: nút "Quản trị" trên thanh Navbar và liên kết dẫn vào cổng Quản trị ngay dưới thẻ chọn vai trò ở Trang chủ.
  - [x] Điều hướng chuẩn xác sau đăng nhập: Admin $\rightarrow$ `/admin/dashboard`, Giáo viên $\rightarrow$ `/teacher/dashboard`, Học sinh $\rightarrow$ `/student/library`.
  - [x] Bảng điều khiển Quản trị viên (`AdminDashboard`): Thống kê toàn trường, quản lý danh sách giáo viên, duyệt / tạm khóa tài khoản giáo viên, quản lý toàn bộ lớp học, xem Khung năng lực GDPT 2018.
  - [x] Trang Thông tin cá nhân & Bảo mật (`ProfileModal`): Giáo viên và Admin cập nhật họ tên, đổi mật khẩu hiện tại, gửi email khôi phục mật khẩu qua Firebase Auth.
  - [x] Rà soát an toàn thông tin: Khắc phục logic `bootstrapAdminRole` trong backend, vô hiệu hóa hoàn toàn mã secret mặc định khi chạy ngoài môi trường Emulator; bắt buộc Secret Manager trên Production.

---

### PHASE 5 – GIỌNG ĐỌC TIẾNG VIỆT (P1)
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Nội dung đã triển khai:**
  - [x] Cho phép giáo viên gắn liên kết URL hoặc tải lên tệp âm thanh MP3/WAV tiếng Việt trực tiếp trong form biên soạn bài đọc, có trình phát nghe thử, thay thế và xóa âm thanh.
  - [x] Tạo tệp âm thanh đọc mẫu mẫu chuẩn WAV tiếng Việt tại thư mục `web/public/assets/audio/`.
  - [x] Bộ điều khiển `AudioReader`: Ưu tiên phát tệp âm thanh MP3/WAV chuẩn của giáo viên trước. Khi không có tệp âm thanh, tự động chuyển đổi sang Web Speech API (giọng vi-VN). Nếu thiết bị chưa hỗ trợ tiếng Việt, hiển thị hướng dẫn rõ ràng, không dùng giọng tiếng Anh để đọc bài tiếng Việt.
  - [x] Tài liệu nghiên cứu & quy trình tích hợp mô hình giọng đọc cục bộ VieNeu-TTS (`VIENEU_TTS_GUIDE.md`).

---

### PHASE 6 – DỮ LIỆU LÂU DÀI VÀ QUY MÔ NHIỀU LỚP (P0 THIẾT KẾ)
- **Trạng thái:** **HOÀN THÀNH 100% (DESIGNED & DOCUMENTED)**
- **Nội dung đã triển khai:**
  - [x] Hoàn thiện tài liệu thiết kế cơ sở dữ liệu quy mô dài hạn: `LONG_TERM_ARCHITECTURE_DESIGN.md`.
  - [x] Thiết kế mô hình dữ liệu hỗ trợ nhiều giáo viên, nhiều khối lớp, quản lý năm học (`academicYear`), kho bài học dùng chung hệ thống (`system`) và kho riêng giáo viên.
  - [x] Cơ chế khóa phiên bản bất biến (`immutable versions`) và liên kết bài nộp vĩnh viễn với phiên bản giao.
  - [x] Lộ trình phân tách môi trường Staging và Production chuẩn Firebase, kế hoạch dự toán tài nguyên Blaze mà không tự ý phát sinh chi phí.

---

### PHASE 7 – KIỂM THỬ BẮT BUỘC & BÁO CÁO CUỐI
- **Trạng thái:** **HOÀN THÀNH 100% (PASSED & VERIFIED)**
- **Kết quả kiểm thử:**
  - **Shared:** Build sạch, không lỗi kiểu dữ liệu.
  - **Functions:** Build TypeScript sạch, pass toàn bộ API callable.
  - **Web:** Vite production build thành công trong 8.86s, dung lượng tối ưu.
  - **Test Suite:** **73/73 tests độc lập PASS 100%** (trong đó có 12 tests chuyên sâu về vòng đời bài đọc, chống giao trùng, sửa lỗi privateAnswers, quản lý trạng thái học sinh và chuyển lớp).
  - **Browser Subagent:** Ghi hình thực tế WebP, kiểm chứng toàn diện các luồng nghiệp vụ trên cả 3 vai trò và Responsive Mobile.
  - **Báo cáo cuối:** Xuất bản tài liệu `V5_2_1_REAL_UAT.md`.
