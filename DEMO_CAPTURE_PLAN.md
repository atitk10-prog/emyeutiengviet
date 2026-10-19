# KẾ HOẠCH & KỊCH BẢN CHỤP ẢNH MINH CHỨNG V5.2 — EM YÊU TIẾNG VIỆT
**Mục đích:** Cung cấp danh mục hình ảnh và kịch bản ghi hình chuẩn mực cho hồ sơ nghiệm thu kỹ thuật và bài thuyết trình hội thi khoa học giáo dục.  
**Phiên bản:** V5.2 (Tháng 10/2026)  
**Địa chỉ ứng dụng cục bộ:** `http://localhost:3000`

---

## 1. DANH MỤC ẢNH MINH CHỨNG CẦN THU THẬP

| STT | Mã ảnh | Tiêu đề ảnh | Vị trí màn hình / Thao tác | Mục đích thuyết minh sư phạm |
|:---:|:---|:---|:---|:---|
| **1** | `v5_2_01_library_filters.png` | Kho bài đọc & Bộ lọc đa năng | Màn hình Thư viện Giáo viên: Bộ lọc Khối 2, Đã xuất bản, Ô tìm kiếm | Minh chứng khả năng quản lý bài đọc trực quan, phân loại khối lớp rõ ràng |
| **2** | `v5_2_02_student_preview.png` | Xem trước dưới góc nhìn học sinh | Modal Student Preview: Text lớn, chỉnh cỡ chữ, làm thử câu hỏi | Giáo viên kiểm duyệt nội dung thực tế trước khi giao bài, không tạo rác dữ liệu |
| **3** | `v5_2_03_question_editor.png` | Trình biên tập câu hỏi linh hoạt | Trình soạn thảo: Nút `+ Thêm câu hỏi` 3 dạng, di chuyển $\uparrow \downarrow$, Clone, Xóa | Năng lực tùy biến đề từ 1 đến 20 câu, sắp xếp linh hoạt |
| **4** | `v5_2_04_save_draft_and_v2.png` | Lưu bản nháp & Tăng phiên bản v2 | Banner bản nháp, nút Lưu nháp & Duyệt xuất bản v2 | Cơ chế Immutable Versioning: Bảo toàn snapshot phiên bản cũ |
| **5** | `v5_2_05_duplicate_prevention.png` | Giao bài & Cảnh báo chống giao trùng | Modal Giao bài: Tên đợt, cảnh báo bài đã giao cho lớp, checkbox đợt mới | Chống giao đè, chống nhầm lẫn trong quản lý đợt khảo sát |
| **6** | `v5_2_06_student_passage_tts.png` | Màn hình đọc bài & Nghe đọc mẫu | Giao diện học sinh: Chữ to rõ, nút nghe đọc mẫu Web Speech | Trợ giúp học sinh vùng khó khăn và các em đọc chậm |
| **7** | `v5_2_07_pedagogical_hint.png` | Gợi ý sư phạm sau câu trả lời sai | Câu hỏi đọc hiểu: Chọn sai lần 1 $\rightarrow$ Hộp thoại gợi ý sư phạm xuất hiện | Giúp trẻ tự tư duy lại mà không lộ đáp án đúng |
| **8** | `v5_2_08_attempt_summary.png` | Màn hình tổng kết & Khen thưởng | Bảng tổng kết: Sao vàng, tỉ lệ đúng lần 1, nhận xét tích cực | Động viên tâm lý học sinh tiểu học, không gắn nhãn yếu kém |
| **9** | `v5_2_09_admin_dashboard.png` | Bảng điều khiển Quản trị viên | Giao diện Admin: Quản lý giáo viên, số liệu trường, bảo mật | Quản lý tập trung, an toàn tài khoản và phân quyền |

---

## 2. KỊCH BẢN THAO TÁC THỰC HIỆN TỪNG BƯỚC

### Kịch bản 1: Luồng Giáo viên (Ảnh 1 $\rightarrow$ Ảnh 5)
1. **Đăng nhập Giáo viên:**
   - URL: `http://localhost:3000/login`
   - Email: `cophuong@emyeutiengviet.edu.vn`
   - Mật khẩu: `Giaovien123!`
2. **Kho bài đọc:**
   - Vào tab "Thư viện bài đọc".
   - Bấm chọn chip "Khối 2", chọn chip "Đã xuất bản". Chụp ảnh `v5_2_01_library_filters.png`.
3. **Xem trước học sinh:**
   - Trên bài học "seed-lop2-bai1", bấm nút con mắt "Xem thử".
   - Bấm nút "A++" để tăng cỡ chữ. Bấm thử vào đáp án đúng của câu hỏi số 1 để thấy thông báo màu xanh chúc mừng và lời giải thích.
   - Chụp ảnh `v5_2_02_student_preview.png`.
   - Bấm nút đóng modal.
4. **Biên tập câu hỏi:**
   - Bấm nút "Sửa / Tạo bản mới".
   - Bấm nút mũi tên đi xuống ($\downarrow$) ở câu 1 để đổi vị trí.
   - Bấm nút "+ Thêm câu hỏi" $\rightarrow$ chọn "Trắc nghiệm A/B/C".
   - Chụp ảnh `v5_2_03_question_editor.png`.
5. **Lưu nháp & Xuất bản:**
   - Bấm "Lưu bản nháp" $\rightarrow$ quan sát thông báo thành công.
   - Bấm "Duyệt & Xuất bản (v2)" $\rightarrow$ hệ thống chuyển trạng thái sang Đã xuất bản phiên bản v2.
   - Chụp ảnh `v5_2_04_save_draft_and_v2.png`.
6. **Giao bài & Cảnh báo chống trùng:**
   - Bấm "Giao bài cho lớp" trên bài vừa sửa. Chọn lớp `9JZVTW` (Lớp 2A - Ban Mai), nhập tên đợt "Khảo sát đầu năm", bấm "Xác nhận giao bài".
   - Bấm lại nút "Giao bài cho lớp" trên cùng bài đó $\rightarrow$ quan sát khung cảnh báo màu vàng: *"Lớp này đã được giao phiên bản này!"*.
   - Chụp ảnh `v5_2_05_duplicate_prevention.png`.
   - Đăng xuất tài khoản giáo viên.

---

### Kịch bản 2: Luồng Học sinh (Ảnh 6 $\rightarrow$ Ảnh 8)
1. **Đăng nhập Học sinh:**
   - URL: `http://localhost:3000/student/login`
   - Mã lớp: `9JZVTW`
   - Mã PIN: `KCEPJ9`
   - Bấm "Vào lớp học".
2. **Đọc bài:**
   - Bấm "Làm bài" trên bài học được giao.
   - Thử bấm nút "A+" để tăng kích thước chữ, bấm nút "Nghe đọc mẫu".
   - Chụp ảnh `v5_2_06_student_passage_tts.png`.
   - Bấm nút "Em đã đọc xong – Bắt đầu thử thách".
3. **Làm bài & Nhận gợi ý:**
   - Ở câu hỏi trắc nghiệm, cố ý chọn một phương án sai và bấm "Nộp câu trả lời".
   - Khung gợi ý sư phạm màu vàng xuất hiện hướng dẫn em đọc lại đoạn văn mà không tiết lộ đáp án.
   - Chụp ảnh `v5_2_07_pedagogical_hint.png`.
   - Chọn lại phương án đúng và bấm tiếp tục.
4. **Tổng kết bài làm:**
   - Hoàn thành các câu hỏi còn lại.
   - Màn hình chúc mừng hiện ra với các ngôi sao vàng rực rỡ, tỉ lệ đúng lần 1, số câu sửa đúng sau gợi ý và lời khen tích cực.
   - Chụp ảnh `v5_2_08_attempt_summary.png`.
   - Bấm nút đăng xuất học sinh.

---

### Kịch bản 3: Luồng Quản trị viên (Ảnh 9)
1. **Đăng nhập Quản trị viên:**
   - URL: `http://localhost:3000/login`
   - Email: `admin@emyeutiengviet.edu.vn`
   - Mật khẩu: `Admin123!`
2. **Bảng điều khiển:**
   - Quan sát tổng quan thống kê trường, danh sách giáo viên phụ trách, bảng điều khiển an toàn tài khoản.
   - Chụp ảnh `v5_2_09_admin_dashboard.png`.
   - Đăng xuất hoàn tất quy trình.
