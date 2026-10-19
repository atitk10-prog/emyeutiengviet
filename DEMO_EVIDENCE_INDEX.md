# DANH MỤC MINH CHỨNG THỰC TẾ HỒ SƠ DỰ THI — EM YÊU TIẾNG VIỆT
**Dự án:** Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản chốt:** V5.2 (Tháng 10/2026)  
**Phục vụ:** Tài liệu hồ sơ khoa học, slide trình diễn, poster và video minh họa dự thi

---

## 1. DANH MỤC TỆP MINH CHỨNG TỰ ĐỘNG & VIDEO TRÌNH DIỄN

| STT | Tên tệp minh chứng | Định dạng | Nội dung & Thao tác kiểm chứng | Đường dẫn truy xuất |
|:---:|:---|:---:|:---|:---|
| **1** | `v5_2_student_and_mobile_flow_1792275080217.webp` | Video WebP | Ghi hình trọn vẹn luồng Học sinh: Đăng nhập PIN an toàn $\rightarrow$ Đọc bài $\rightarrow$ Trải nghiệm 3 dạng câu hỏi $\rightarrow$ Nhận gợi ý sư phạm $\rightarrow$ Nộp bài & Nhận sao vàng | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **2** | `v5_2_teacher_and_admin_flow_1792274808261.webp` | Video WebP | Ghi hình luồng Giáo viên & Admin: Đăng nhập Admin $\rightarrow$ Bảng điều khiển quản trị $\rightarrow$ Đăng nhập Giáo viên $\rightarrow$ Thư viện bài đọc $\rightarrow$ Xem trước học sinh $\rightarrow$ Sửa câu hỏi $\rightarrow$ Xuất bản v2 $\rightarrow$ Báo cáo tiến bộ | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **3** | `v5_2_verify_connection_1792274557051.webp` | Video WebP | Ghi hình kiểm tra kết nối ứng dụng thời gian thực trên cổng 3000 | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **4** | `em_yeu_tieng_viet_homepage_1792274562187.png` | Ảnh PNG | Trang chủ ứng dụng: Khẩu hiệu sư phạm, linh vật chim sâu nhỏ, nút chọn vai trò trực quan | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **5** | `teacher_dashboard_1792274995824.png` | Ảnh PNG | Bảng điều khiển giáo viên: Thống kê lớp học, kho học liệu, nút tạo bài AI | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **6** | `student_join_page_1792275093675.png` | Ảnh PNG | Trang đăng nhập học sinh: Nhập mã lớp và mã PIN 6 ký tự bảo mật | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |
| **7** | `export_tab_final_1792275065657.png` | Ảnh PNG | Màn hình xuất dữ liệu: Xuất CSV UTF-8 BOM chuẩn Excel và sao lưu JSON | `brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/` |

---

## 2. BỘ MINH CHỨNG CHỨC NĂNG SƯ PHẠM ĐỐI CHIẾU HỘI THI

### 2.1 Minh chứng 1: Trang chủ ứng dụng & Định vị thương hiệu
- **Tên màn hình:** Trang chủ "EM YÊU TIẾNG VIỆT"
- **Khẩu hiệu:** *"Mỗi ngày một câu chuyện – Mỗi ngày thêm yêu tiếng Việt"*
- **Ý nghĩa sư phạm:** Thiết kế gam màu xanh dương - vàng nhạt trong sáng, font chữ tiểu học rõ ràng, linh vật chim sâu nhỏ gần gũi, khơi gợi hứng thú đọc sách cho trẻ 7–9 tuổi.
- **Tệp minh chứng:** `em_yeu_tieng_viet_homepage_1792274562187.png`

### 2.2 Minh chứng 2: Dashboard Quản trị viên (Admin Security)
- **Tên màn hình:** Bảng điều khiển Quản trị viên Nhà trường
- **Ý nghĩa quản lý:** Giám sát tổng thể hoạt động của toàn trường, quản lý danh sách giáo viên, cấp lại mật khẩu qua liên kết bảo mật Firebase, khóa tài khoản khi cần mà không mất dữ liệu học sinh.
- **Tệp minh chứng:** Trích đoạn từ video `v5_2_teacher_and_admin_flow_1792274808261.webp` (giây 00:05 – 00:25)

### 2.3 Minh chứng 3: Kho học liệu & Bộ lọc đa năng (P0)
- **Tên màn hình:** Thư viện bài đọc Giáo viên
- **Ý nghĩa sư phạm:** Phân loại bài đọc theo Khối 2 và Khối 3; lọc theo trạng thái Đã xuất bản, Bản nháp, Đã lưu trữ; ô tìm kiếm theo tiêu đề bài đọc giúp giáo viên tìm kiếm giáo án nhanh chóng.
- **Tệp minh chứng:** `teacher_dashboard_1792274995824.png`

### 2.4 Minh chứng 4: Trí tuệ nhân tạo (AI) tạo bài đọc & Đề xuất củng cố (P1)
- **Tên chức năng:** AI Soạn thảo học liệu & Phân tích củng cố
- **Ý nghĩa công nghệ:** Tích hợp mô hình Gemini AI qua Cloud Functions backend. AI đóng vai trò trợ lý tạo bản nháp (Draft), phân loại câu hỏi theo 5 kỹ năng đọc hiểu; giáo viên toàn quyền duyệt trước khi xuất bản.
- **Tệp minh chứng:** Test suite `tests/security_and_ai.test.mjs` & `tests/v5_2_lesson_lifecycle.test.mjs` (Case P1-1)

### 2.5 Minh chứng 5: Chỉnh sửa bài đọc, CRUD câu hỏi ($1 \le N \le 20$) & Xem trước học sinh (P0)
- **Tên chức năng:** Trình biên tập câu hỏi linh hoạt & Modal Student Preview
- **Ý nghĩa sư phạm:** Giáo viên có thể thêm câu hỏi mới (Trắc nghiệm, Đúng/Sai, Sắp xếp), đổi thứ tự bằng nút mũi tên $\uparrow \downarrow$, nhân bản câu hỏi; xem thử giao diện học sinh với các nút phóng to cỡ chữ mà không tạo bản ghi rác.
- **Tệp minh chứng:** Video `v5_2_teacher_and_admin_flow_1792274808261.webp` (giây 00:45 – 01:30)

### 2.6 Minh chứng 6: Bất biến phiên bản (Immutable Versioning) & Chống giao trùng (P0)
- **Tên chức năng:** Xuất bản v2 bất biến & Kiểm tra trùng lặp
- **Ý nghĩa bảo vệ dữ liệu:** Khi sửa bài đã giao, hệ thống tạo bản snapshot v2 độc lập. Kết quả làm bài và điểm số của học sinh ở v1 được bảo toàn tuyệt đối. Giao bài có kiểm tra trùng lặp theo lớp và đợt giao.
- **Tệp minh chứng:** Test suite `tests/v5_2_lesson_lifecycle.test.mjs` (Case P0-3, P0-4, P0-6)

### 2.7 Minh chứng 7: Học sinh đọc bài, Nghe giọng đọc mẫu (Web Speech) & 3 dạng bài tập (P1)
- **Tên chức năng:** Góc đọc sách & Nhiệm vụ thử thách
- **Ý nghĩa sư phạm:** Hỗ trợ học sinh đọc chậm và học sinh vùng khó khăn bằng giọng đọc mẫu tiếng Việt chuẩn; 3 dạng bài tập trực quan kích thích tư duy đọc hiểu.
- **Tệp minh chứng:** Video `v5_2_student_and_mobile_flow_1792275080217.webp` (giây 00:20 – 01:10)

### 2.8 Minh chứng 8: Gợi ý sư phạm sau câu trả lời sai (Pedagogical Hints)
- **Tên chức năng:** Gợi ý hướng dẫn tư duy không lộ đáp án
- **Ý nghĩa sư phạm:** Khi học sinh chọn sai lần 1, hệ thống hiển thị hộp thoại gợi ý nhẹ nhàng trích xuất từ đoạn văn liên quan để học sinh đọc lại và tự tìm ra đáp án đúng ở lần thử thứ 2.
- **Tệp minh chứng:** Video `v5_2_student_and_mobile_flow_1792275080217.webp` (giây 01:15 – 01:45)

### 2.9 Minh chứng 9: Màn hình tổng kết, Động viên tích cực & Đánh giá trước/sau (P3)
- **Tên chức năng:** Khen thưởng sao vàng & Biểu đồ tiến bộ
- **Ý nghĩa tâm lý học đường:** Tổng kết số sao, tỷ lệ trả lời đúng kèm thông điệp khích lệ; biểu đồ giáo viên phân tích theo 5 kỹ năng và ghép cặp đánh giá trước/sau (Pre/Post Test) khoa học.
- **Tệp minh chứng:** Video `v5_2_student_and_mobile_flow_1792275080217.webp` (giây 02:00 – 02:25) & `export_tab_final_1792275065657.png`

---

## 3. LOG THỰC NGHIỆM KIỂM THỬ TỰ ĐỘNG CHỨNG THỰC 70/70 TESTS PASS

```
TAP version 13
ok 1 - EM YÊU TIẾNG VIỆT - PHẦN A & D: ADMIN ROLE & CURRICULUM FRAMEWORK TESTS (4/4 PASS)
ok 2 - EM YÊU TIẾNG VIỆT - END-TO-END PEDAGOGICAL WORKFLOW TEST (10/10 PASS)
ok 3 - EMYTV PEDAGOGICAL FIXTURES & NEGATIVE CASES ACCEPTANCE (9/9 PASS)
ok 4 - EM YÊU TIẾNG VIỆT - PERSISTENCE & DATA RECOVERY TEST SUITE (4/4 PASS)
ok 5 - EM YÊU TIẾNG VIỆT - FIRESTORE SECURITY RULES TESTS (9/9 PASS)
ok 6 - EM YÊU TIẾNG VIỆT - SECURITY & AI HARDENING TESTS (4/4 PASS)
ok 7 - EM YÊU TIẾNG VIỆT - V5.0 FINAL UX, DATA FIX & RELIABILITY TEST SUITE (9/9 PASS)
ok 8 - EM YÊU TIẾNG VIỆT V5.1 — SECURITY & OPERATIONAL AUDIT TEST SUITE (10/10 PASS)
ok 9 - EM YÊU TIẾNG VIỆT V5.2 — LESSON LIFECYCLE, IMMUTABLE VERSIONING & ASSIGNMENT AUDIT (9/9 PASS)

1..9
# tests 70
# suites 11
# pass 70
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 19189.7009
```
*Ghi chú:* Toàn bộ 70 bài test chạy hoàn tất và đạt 100% tỷ lệ thành công trong môi trường kiểm định tự động.
