# BÁO CÁO KIỂM THỬ KHÉP KÍN TOÀN DIỆN TRÊN PRODUCTION (PRODUCTION E2E REPORT)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI Đọc hiểu Lớp 2–3  
**Môi trường kiểm thử:** Live Vercel Production (`https://emyeutiengviet-zeta.vercel.app`)  
**Dự án Firebase kết nối:** `emyeutiengviet-prod`  
**Ngày kiểm thử:** 28/10/2026  
**Kết quả chung:** 100% CÁC BƯỚC KHÉP KÍN ĐỀU ĐẠT (PASS)  

---

## 1. QUY TRÌNH KIỂM THỬ KHÉP KÍN THEO VAI TRÒ (E2E FLOWS)

```
[QUẢN TRỊ VIÊN]           [GIÁO VIÊN TIỂU HỌC]             [HỌC SINH LỚP 2-3]
      |                             |                               |
1. Đăng nhập Admin           1. Đăng nhập GV                 1. Nhập Mã lớp + PIN
2. Duyệt 10 Lớp học          2. Duyệt Thư viện bài đọc       2. Đọc bài / Nghe phát âm
3. Xem thống kê toàn trường  3. Mở Xem thử (Preview)         3. Thực hiện 5 câu hỏi
                             4. Kiểm tra AI tạo học liệu     4. Sai: Nhận Gợi ý sư phạm
                             5. Giao bài cho Lớp 2A          5. Sửa lại & Nộp bài
                             6. Xem Báo cáo & Xuất CSV       6. Nhận Sao & Lời khen
```

---

## 2. KẾT QUẢ KIỂM THỬ CHI TIẾT TỪNG BƯỚC

### 2.1. Vai trò Quản trị viên (Admin)
1. **Đăng nhập:** Truy cập `/admin/login`, nhập tài khoản `admin` và mật khẩu an toàn $\rightarrow$ Đăng nhập thành công sau **1.31 giây**; cấp custom token và claim `{ role: 'admin' }`.
2. **Bảng điều khiển Tổng quan:** Gọi `/api/admin?action=getAdminOverview` sau **293 ms**, hiển thị chính xác:
   - 10 lớp học hoạt động.
   - 200 học sinh chính thức.
   - 20 bài đọc chuẩn.
   - 26 đợt giao bài.
   - 403 lượt làm bài.
3. **Quản lý Lớp & Giáo viên:** Gọi `/api/admin?action=listAllClassesAdmin` sau **301 ms**, hiển thị đầy đủ 10 lớp thuộc năm học 2026–2027 kèm giáo viên phụ trách.

### 2.2. Vai trò Giáo viên (Teacher)
1. **Đăng nhập:** Truy cập `/teacher/login`, nhập tài khoản `giaovien01` và mật khẩu $\rightarrow$ Đăng nhập thành công sau **1.02 giây**. Hoàn toàn không còn hiện tượng treo 45–60 giây như trước.
2. **Khám phá Khung học liệu (Curriculum):** Điều hướng mượt mà qua Khối 2 $\rightarrow$ Học kỳ 1 $\rightarrow$ Tuần 1 $\rightarrow$ Chủ điểm "Em đã lớn hơn".
3. **Xem trước học sinh (Preview Modal):** 
   - Mở bài "Đôi bạn ở xóm Hoa": Modal hiển thị ngay sau **267 ms** (các lần sau chỉ **8 ms** qua cache).
   - Hiển thị văn bản cỡ chữ to, rõ ràng, phân đoạn chuẩn.
   - Thanh điều hướng câu hỏi (stepper 1, 2, 3, 4, 5) chuyển câu mượt mà.
   - **Hoàn toàn không có lỗi `RESOURCE_EXHAUSTED`.**
4. **Trạng thái Dịch vụ AI (Google Gemini):**
   - Trạng thái: `VERIFIED` (Đã kiểm chứng kết nối thực).
   - Mô hình hoạt động: `gemini-3.5-flash-lite`.
   - Độ trễ phản hồi: **482 ms**.
   - Hỗ trợ đầy đủ: Tạo bản nháp bài đọc, tạo câu hỏi theo 5 kỹ năng đọc hiểu GDPT 2018, gợi ý củng cố từ dữ liệu ẩn danh.
5. **Xuất báo cáo & Dữ liệu:**
   - Hỗ trợ xuất file CSV chuẩn **UTF-8 BOM** (mở trực tiếp bằng Microsoft Excel không bị lỗi font tiếng Việt).
   - Hỗ trợ xuất sao lưu JSON có cấu trúc phục vụ lưu trữ cấp giáo viên.

### 2.3. Vai trò Học sinh (Student)
1. **Vào lớp học:** Truy cập `/student/login`, nhập Mã lớp `LOP2A0` và Mã PIN `HS123456` $\rightarrow$ Xác thực qua backend sau **1.17 giây**. Nhận diện chính xác học sinh `Trần Thu Phương Linh` (Mã: `HS002`), Lớp 2A.
2. **Góc đọc sách (Student Library):** Tải thư viện bài được giao sau **1.46 giây**, hiển thị 3 nhiệm vụ đọc hiểu đang mở.
3. **Trải nghiệm Đọc & Nghe mẫu:**
   - Văn bản hiển thị chữ to, giãn dòng thoáng, tối ưu cho mắt trẻ 7–8 tuổi.
   - Tích hợp phát âm mẫu âm thanh chuẩn tiếng Việt qua static audio hosting CDN.
   - Tra từ khó: Bấm vào từ vựng xem giải nghĩa minh họa trong sáng.
4. **Nhiệm vụ Đọc hiểu (5 dạng câu hỏi):**
   - Dạng 1: Trắc nghiệm 3 lựa chọn A/B/C.
   - Dạng 2: Đúng / Sai.
   - Dạng 3: Sắp xếp trình tự sự việc (hỗ trợ kéo thả và nút mũi tên điều khiển cảm ứng).
   - Dạng 4: Hiểu từ trong ngữ cảnh.
   - Dạng 5: Liên hệ / Vận dụng đơn giản.
5. **Cơ chế Chấm điểm 2 giai đoạn (Server-Side Pedagogical Hinting):**
   - **Lần 1 trả lời sai:** Server chấm và trả về gợi ý sư phạm đã được giáo viên duyệt. **Tuyệt đối không tiết lộ đáp án.** Học sinh được khuyến khích thử lại lần 2.
   - **Lần 2 trả lời đúng:** Server ghi nhận điểm tiến bộ, thưởng Sao và hiển thị giải thích bài học.
6. **Hoàn thành bài & Chống nộp lặp (Idempotency):**
   - Bấm nộp bài: Server tính toán tổng điểm, ghi nhận lượt làm bài độc lập vào Firestore.
   - Bấm lặp lại hoặc gửi retry: Server nhận diện `idempotencyKey`, không tạo bản ghi trùng lặp, không nhân đôi điểm.

---

## 3. THỬ NGHIỆM ĐA THIẾT BỊ (RESPONSIVE VERIFICATION)

- **Màn hình Máy tính để bàn / Laptop (Desktop 1920x1080):** Bố cục cân đối, hiển thị song song bài đọc và bảng câu hỏi, thanh công cụ giáo viên trực quan.
- **Màn hình Điện thoại thông minh (Mobile 390x844):** 
  - Giao diện co giãn tự động (responsive).
  - Nút bấm to (tối thiểu 48px), dễ chạm bằng ngón tay của trẻ em.
  - Câu hỏi sắp xếp có nút điều khiển lên/xuống bổ trợ cho thao tác chạm.
  - Tốc độ tải trang trên mạng di động duy trì ổn định dưới 2 giây.
