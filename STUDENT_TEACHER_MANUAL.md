# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG EM YÊU TIẾNG VIỆT (PHIÊN BẢN 5.0)

> **Dành cho:** Quản trị viên (Admin), Giáo viên tiểu học, Học sinh lớp 2–3 và Phụ huynh học sinh.  
> **Khẩu hiệu:** *“Mỗi ngày một câu chuyện – Mỗi ngày thêm yêu tiếng Việt”*

---

## PHẦN 1: HƯỚNG DẪN DÀNH CHO HỌC SINH & PHỤ HUYNH

### 1. Cách đăng nhập vào góc học tập
1. Mở trình duyệt web và truy cập địa chỉ: `http://localhost:3000/student/join` (hoặc tên miền của trường).
2. Nhập **Mã vào lớp** (do cô giáo cung cấp, ví dụ: `L2A-2026`).
3. Nhập **Mã PIN cá nhân** gồm 6 ký tự (ví dụ: `123456`).
4. Bấm nút **“Vào góc học tập”**.

> **Lưu ý bảo mật:**  
> - Mỗi bạn nhỏ có một mã PIN riêng. Các em không chia sẻ mã PIN cho bạn khác.  
> - Nếu nhập sai quá 5 lần, mã sẽ tạm khóa 5 phút để bảo vệ tài khoản. Nếu quên mã PIN, em hãy báo cô giáo để được cấp lại nhé!

---

### 2. Cách đọc bài và nghe giọng đọc mẫu
1. Tại **Thư viện bài đọc**, em bấm vào bài đọc cô giáo đã giao.
2. Em có thể:
   - Tự đọc thầm câu chuyện với chữ to, rõ ràng.
   - Bấm vào các **từ in đậm màu cam** để xem giải thích từ khó kèm ví dụ dễ hiểu.
   - Bấm nút hình **Loa âm thanh** để nghe đọc mẫu nếu thiết bị có giọng tiếng Việt.
   - Bấm các nút **`A-`** hoặc **`A+`** để điều chỉnh chữ to nhỏ vừa mắt.
3. Khi đọc xong và hiểu bài, em bấm nút xanh: **“Em đã đọc xong – Bắt đầu thử thách”**.

---

### 3. Cách tham gia thử thách đọc hiểu (5 câu hỏi)
Hệ thống sẽ lần lượt đưa ra từng câu hỏi dạng trò chơi vui vẻ:

1. **Câu trắc nghiệm (Chọn A, B hoặc C):** Em bấm vào lựa chọn mình thấy đúng nhất rồi bấm **“Nộp câu trả lời”**.
2. **Câu Đúng / Sai:** Em chọn thẻ **ĐÚNG** hoặc **SAI** rồi bấm nộp.
3. **Câu Sắp xếp thứ tự sự việc:** Em có thể kéo thả hoặc **bấm các nút số `[1]`, `[2]`, `[3]`** ở đầu mỗi dòng để đổi vị trí theo đúng diễn biến câu chuyện.

#### Quy tắc nhận điểm và sao:
- **Nếu đúng ngay lần đầu:** Em sẽ nghe âm thanh leng keng vui tai, nhận lời khen của chú chim xanh và ghi trọn vẹn điểm câu đó!
- **Nếu chưa đúng lần đầu:** Em đừng lo, hệ thống sẽ đưa ra **gợi ý chỉ dẫn** mà không làm lộ đáp án. Em được **thử lại thêm 1 lần nữa**!
- Sau khi hoàn thành câu hỏi, em bấm nút **“Câu tiếp theo”** để sang câu kế tiếp.
- Ở câu cuối cùng, em bấm **“Hoàn thành bài đọc”** để nhận Cúp và Sao khen thưởng!

---

### 4. Cách xem lại bài đã làm để ôn tập
- Kể cả khi đã hoàn thành bài hoặc đã làm đủ số lượt tối đa ($3/3$ lượt), em luôn có thể ôn tập bằng cách:
  1. Vào **Thư viện bài đọc**.
  2. Bấm nút **“Xem lại kết quả & giải thích”** hoặc **“Xem lại bài đã làm”**.
  3. Màn hình sẽ hiện lại toàn bộ bài đọc, câu em đã chọn, đáp án chính xác và lời giải thích chi tiết của từng câu.

---

## PHẦN 2: HƯỚNG DẪN DÀNH CHO GIÁO VIÊN

### 1. Đăng nhập và quản lý lớp học
1. Truy cập `http://localhost:3000/teacher/login`.
2. Đăng nhập bằng Email và Mật khẩu giáo viên đã được cấp.
3. Chuyển sang thẻ **“Lớp học & Học sinh”**:
   - Bấm **“Tạo Lớp Học Mới”** $\rightarrow$ Nhập tên lớp (VD: *Lớp 2A*), khối lớp (Khối 2 hoặc Khối 3) và năm học.
   - Bấm nút **“Sao chép mã”** cạnh mã vào lớp để gửi ngay vào nhóm Zalo của phụ huynh.

---

### 2. Thêm học sinh và quản lý mã PIN
Giáo viên có 2 cách thêm học sinh:

#### Cách 1: Thêm từng học sinh
- Bấm **“Thêm học sinh”** $\rightarrow$ Nhập biệt danh (VD: *Bảo Nam*, *Họa Mi*) $\rightarrow$ Bấm **“Cấp mã pin ngẫu nhiên”**.
- Hệ thống sẽ hiển thị Thẻ đăng nhập của học sinh kèm mã PIN.

#### Cách 2: Nhập hàng loạt từ tệp Excel (.xlsx)
1. Bấm nút **“Nhập từ Excel”**.
2. Bấm **“Tải mẫu Excel”** để tải file mẫu chuẩn `mau_nhap_hoc_sinh.xlsx`.
3. Điền danh sách học sinh vào file Excel.
4. Chọn file Excel để tải lên $\rightarrow$ Hệ thống tự động kiểm tra và hiển thị bảng xem trước.
5. Bấm **“Xác nhận nhập học sinh”** $\rightarrow$ Hệ thống tự động tạo tài khoản và sinh mã PIN bảo mật cho từng em.
6. Bấm nút **“Sao chép toàn bộ mã PIN để gửi phụ huynh”** để lưu lại hoặc gửi danh sách cho lớp.

#### Cấp lại mã PIN khi học sinh quên:
- Trong danh sách học sinh, tìm tên học sinh và bấm nút **“Cấp lại PIN”**.
- Hệ thống sẽ cấp mã PIN 6 ký tự mới và thu hồi mã cũ ngay lập tức.

#### Xuất danh sách lớp ra Excel:
- Bấm nút **“Xuất Excel”** để tải về tệp Excel danh sách cả lớp phục vụ lưu trữ sổ sách chuyên môn.

---

### 3. Soạn bài đọc và duyệt câu hỏi với trợ lý Gemini AI
1. Chuyển sang thẻ **“Soạn bài & AI”**.
2. Chọn khối lớp (2 hoặc 3), chủ đề bài học, thể loại văn bản (tự sự hoặc thông tin) và mục tiêu đọc hiểu.
3. Bấm **“Sinh bản nháp bài đọc bằng AI”**.
4. **Kiểm duyệt sư phạm (Bắt buộc):**
   - Giáo viên đọc lại bài đọc, có thể chỉnh sửa câu từ cho phù hợp với đặc thù học sinh vùng miền của lớp mình.
   - Kiểm tra 5 câu hỏi và đáp án do AI đề xuất, chỉnh sửa gợi ý và lời giải thích nếu cần.
5. Bấm **“Phê duyệt & Xuất bản bài học”**.
6. Sang thẻ **“Thư viện bài đọc”**, bấm **“Giao bài cho lớp”** để học sinh có thể bắt đầu làm bài.

---

### 4. Theo dõi tiến bộ & Đề xuất củng cố
- **Thẻ “Tổng quan & Biểu đồ”:** Theo dõi tỷ lệ đúng lần đầu và tỷ lệ tiến bộ sau gợi ý trên biểu đồ phân bố 5 năng lực đọc hiểu GDPT 2018.
- **Thẻ “Đề xuất củng cố AI”:** Hệ thống tổng hợp ẩn danh các kỹ năng học sinh trong lớp còn hay sai, Gemini AI sẽ đề xuất 2–3 bài tập nhỏ để giáo viên giao củng cố cho các em.

---

## PHẦN 3: HƯỚNG DẪN DÀNH CHO QUẢN TRỊ VIÊN (ADMIN)

### 1. Đăng nhập bảng điều hành
1. Truy cập `http://localhost:3000/admin/login`.
2. Đăng nhập tài khoản Quản trị viên (được cấp đặc quyền từ backend).

---

### 2. Quản lý tài khoản Giáo viên
1. Tại thẻ **“Giáo viên”**:
   - Theo dõi danh sách giáo viên toàn trường và số lớp mỗi thầy cô đang phụ trách.
   - Bấm **“Xuất Excel”** để tải danh sách giáo viên toàn trường ra file `.xlsx`.
   - Bấm **“Nhập từ Excel”** để thêm hàng loạt giáo viên mới từ file `mau_nhap_giao_vien.xlsx`.
2. **Đặt lại mật khẩu giáo viên:**
   - Khi giáo viên quên mật khẩu, bấm nút **“Đặt lại MK”** tại dòng của giáo viên đó.
   - Hệ thống sẽ tạo mật khẩu tạm thời an toàn và hiển thị để Admin bàn giao cho giáo viên.
3. **Khóa / Mở khóa tài khoản:**
   - Bấm nút **“Tạm khóa”** để tạm ngưng quyền truy cập của tài khoản, hoặc **“Kích hoạt lại”** khi cần mở lại.

---

### 3. Ngân hàng Khung Chương trình GDPT 2018
- Tại thẻ **“Khung GDPT 1–5”**:
  - Tra cứu và quản lý các đơn vị kiến thức đọc hiểu chuẩn từ Lớp 1 đến Lớp 5 theo chương trình sách giáo khoa *Kết nối tri thức với cuộc sống*.
  - Giúp nhà trường bảo đảm tất cả bài đọc AI tạo ra đều bám sát chuẩn kiến thức kỹ năng của Bộ GD&ĐT.

---

## PHẦN 4: XỬ LÝ SỰ CỐ THƯỜNG GẶP (FAQ & TROUBLESHOOTING)

| Tình huống | Nguyên nhân | Hướng dẫn xử lý |
| :--- | :--- | :--- |
| **Không nghe thấy giọng đọc tiếng Việt khi bấm loa** | Trình duyệt hoặc hệ điều hành của thiết bị chưa cài đặt gói ngôn ngữ tiếng Việt (vi-VN). | Ứng dụng sẽ hiển thị thông báo khuyên học sinh đọc kỹ bài đọc. Không có lỗi dữ liệu. Trên Windows/Android/iOS, người dùng có thể vào cài đặt hệ thống để tải thêm voice tiếng Việt nếu muốn nghe. |
| **Học sinh báo bị khóa mã PIN (5 phút)** | Học sinh hoặc người khác nhập sai mã PIN quá 5 lần liên tiếp. | Hãy đợi 5 phút để hệ thống tự mở khóa, hoặc giáo viên vào trang quản lý lớp bấm **“Cấp lại PIN”** để cấp mã mới cho học sinh vào ngay. |
| **Không nộp được câu trả lời** | Học sinh chưa chọn đáp án hoặc chưa xếp xong thứ tự các sự việc. | Hãy nhắc các em tích chọn 1 đáp án A/B/C, chọn Đúng/Sai, hoặc bấm các nút số `[1]`, `[2]`, `[3]` trước khi bấm nộp bài. |
| **Tải lại trang web (F5) khi đang làm dở** | Mạng chập chờn hoặc học sinh lỡ tay tải lại trang. | Hệ thống đã có cơ chế tự động khôi phục lượt làm dở. Học sinh chỉ cần bấm lại bài đọc, các câu đã trả lời trước đó vẫn được giữ nguyên vẹn. |
| **Không tải được tệp Excel mẫu** | Trình duyệt chặn tải xuống tự động. | Giáo viên kiểm tra thanh địa chỉ trình duyệt, chọn "Cho phép tải tệp xuống từ trang web này" hoặc truy cập trực tiếp đường dẫn `/mau_nhap_hoc_sinh.xlsx`. |
