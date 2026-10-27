# BÁO CÁO KIỂM TOÁN HỌC LIỆU VÀ NGÂN HÀNG CÂU HỎI
## DỰ ÁN: EM YÊU TIẾNG VIỆT (LỚP 2 – 3)
*Chuẩn đối chiếu: Chương trình GDPT 2018 môn Tiếng Việt cấp Tiểu học*
*Tổng số bài đọc: 21 bài (Lớp 2: 12 bài; Lớp 3: 9 bài)*
*Tổng số câu hỏi được kiểm định: 115 câu hỏi*

---

## 1. BẢNG TỔNG HỢP KIỂM ĐỊNH TOÀN DIỆN NGÂN HÀNG CÂU HỎI

| Dạng câu hỏi | Tổng số câu | Đạt chuẩn sư phạm | Hợp lệ chấm điểm | Lỗi cấu trúc | Cần xem xét lại |
|---|---:|---:|---:|---:|---:|
| **Trắc nghiệm A/B/C** | 67 | 67 | 67 | 0 | 0 |
| **Đúng / Sai** | 25 | 25 | 25 | 0 | 0 |
| **Sắp xếp sự việc** | 23 | 23 | 23 | 0 | 0 |
| **TỔNG CỘNG** | **115** | **115** | **115** | **0** | **0** |

---

## 2. CHUẨN HOÁ VÀ KIỂM TOÁN NĂM NHÓM KỸ NĂNG ĐỌC HIỂU

Mỗi bài học được thiết kế chuẩn mực gồm **5 nhiệm vụ đọc hiểu** tương ứng với 5 nhóm kỹ năng cốt lõi theo Chương trình GDPT 2018:

| STT | Nhóm kỹ năng đọc hiểu | Dạng câu hỏi phù hợp | Phân bố độ khó | Mục tiêu cần đạt của học sinh Lớp 2-3 |
|:---:|---|---|:---:|---|
| **1** | **Tìm thông tin trực tiếp** (`thong_tin_truc_tiep`) | Trắc nghiệm A/B/C | Nhận biết (60%) | Học sinh tìm được chi tiết, nhân vật, sự việc diễn ra trực tiếp trong văn bản. |
| **2** | **Hiểu từ trong ngữ cảnh** (`tu_trong_ngu_canh`) | Trắc nghiệm A/B/C / Đúng-Sai | Thông hiểu (75%) | Học sinh hiểu nghĩa của từ ngữ, hình ảnh gợi tả, từ láy (VD: *mơn mởn*, *thì thầm*). |
| **3** | **Hiểu nội dung chính** (`y_chinh_doan_van`) | Trắc nghiệm A/B/C | Thông hiểu (70%) | Học sinh nắm được chủ đề, bài học rút ra, thông điệp về tình cảm, đạo đức, môi trường. |
| **4** | **Sắp xếp trình tự** (`sap_xep_trinh_tu`) | Sắp xếp 3 sự việc | Thông hiểu (80%) | Học sinh tái hiện được trình tự thời gian diễn biến câu chuyện từ mở đầu đến kết thúc. |
| **5** | **Liên hệ – Vận dụng** (`lien_he_ban_than`) | Đúng/Sai / Trắc nghiệm | Vận dụng (65%) | Học sinh liên hệ việc làm của bản thân, thể hiện hành vi tích cực (bảo vệ môi trường, yêu quý bạn bè). |

---

## 3. QUY TRÌNH KIỂM TOÁN CHI TIẾT THEO BA DẠNG CÂU HỎI

### 3.1. Dạng 1: Trắc nghiệm A/B/C (67 câu hỏi)
* **Quy tắc kiểm định:**
  1. Có đúng 3 phương án lựa chọn, không có phương án rỗng hoặc trùng lặp ngữ nghĩa.
  2. Các phương án có độ dài tương đồng, ngôn từ trong sáng, phù hợp tâm lý lứa tuổi 7–9 tuổi.
  3. Có duy nhất một đáp án đúng có căn cứ trực tiếp trong văn bản bài đọc.
  4. Khử hoàn toàn tiền tố lặp nhãn `"A. "`, `"B. "` trước khi hiển thị trên giao diện.
  5. Độc lập với thứ tự: khi hoán đổi vị trí các phương án, đáp án đúng vẫn được máy chủ chấm chính xác 100%.

### 3.2. Dạng 2: Đúng / Sai (25 câu hỏi)
* **Quy tắc kiểm định:**
  1. Câu nhận định rõ ràng, không sử dụng câu phủ định hai lần gây khó hiểu cho học sinh tiểu học.
  2. Giá trị đáp án lưu trữ là Boolean chuẩn (`true` hoặc `false`), không dùng chuỗi ký tự mơ hồ.
  3. Gợi ý sư phạm chỉ dẫn học sinh đọc lại đoạn văn tương ứng, không tiết lộ trực tiếp kết luận Đúng hay Sai.

### 3.3. Dạng 3: Sắp xếp sự việc (23 câu hỏi)
* **Quy tắc kiểm định bắt buộc:**
  1. Mọi câu hỏi bắt buộc phải có mảng `items: string[]` với ít nhất 3 sự việc.
  2. Thứ tự đúng (`correctAnswer`) là mảng chỉ số hoặc mảng sự việc xác định rõ ràng diễn biến thời gian.
  3. Tuyệt đối không để tồn tại câu sắp xếp có danh sách sự việc rỗng (`items: []`).
  4. Giao diện trang bị đồng thời nút bấm điều khiển mũi tên ▲/▼ và khả năng kéo thả để thuận tiện trên cả máy tính và màn hình cảm ứng điện thoại.

---

## 4. QUẢN TRỊ RỦI RO VÀ GIÁM SÁT GEMINI AI TẠO BÀI MỚI

Để đảm bảo câu hỏi do Gemini AI tạo mới luôn đạt chuẩn chất lượng giáo dục, hệ thống đã thiết lập quy trình kiểm soát 3 lớp:

1. **Lớp 1 – Kiểm định JSON Schema nghiêm ngặt tại Backend:**
   * Ngay khi Gemini trả về kết quả, backend áp dụng bộ kiểm tra cấu trúc: bắt buộc có đủ trường `title`, `passage`, `grade`, `topic`, `vocabulary`, và 5 nhiệm vụ câu hỏi.
   * Nếu phát hiện câu hỏi sắp xếp thiếu `items`, hệ thống tự động bóc tách từ phần giải thích (`explanation`). Nếu không thể bóc tách, bản nháp sẽ được đánh dấu yêu cầu giáo viên bổ sung trước khi lưu.
2. **Lớp 2 – Thuật toán quét lộ đáp án (Anti-Leakage Detector):**
   * Hàm `isHintLeakingAnswer` tự động đối chiếu nội dung gợi ý (`hint`) với đáp án đúng (`correctAnswer`). Nếu phát hiện gợi ý chứa nguyên văn đáp án, gợi ý sẽ được tự động điều chỉnh thành lời nhắc mang tính định hướng phương pháp đọc.
3. **Lớp 3 – Thẩm quyền phê duyệt tuyệt đối thuộc về Giáo viên:**
   * AI chỉ đóng vai trò trợ lý soạn thảo bản nháp (Draft Generator).
   * Bản nháp chỉ được chuyển sang trạng thái đã xuất bản (`published`) sau khi giáo viên trực tiếp duyệt và bấm nút *"Xuất bản học liệu"*.
   * Cổng 2 (`validateQuestionForPublish`) chặn đứng mọi nỗ lực xuất bản nếu bài học còn tồn tại bất kỳ câu hỏi nào chưa hợp lệ.
