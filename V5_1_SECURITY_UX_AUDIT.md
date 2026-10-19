# BÁO CÁO KIỂM ĐỊNH BẢO MẬT & TRẢI NGHIỆM NGƯỜI DÙNG V5.1
## DỰ ÁN: EM YÊU TIẾNG VIỆT — HỌC LIỆU TƯƠNG TÁC ĐỌC HIỂU TIỂU HỌC
**Phiên bản kiểm toán:** 5.1.0-SECURITY-HARDENED-UX  
**Thời điểm hoàn tất:** Tháng 10/2026  
**Môi trường kiểm định:** Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001, Vite: 3000) + Node.js 22 LTS  
**Trạng thái kiểm thử tự động:** **61/61 TESTS PASS (100%)** qua 10 Suites  
**Trạng thái kiểm thử trình duyệt thực tế (Browser Subagent):** **PASS 100%** cả 3 vai trò (Học sinh, Giáo viên, Quản trị viên)

---

## 1. TỔNG QUAN KẾT QUẢ NGHIỆM THU V5.1

| Hạng mục kiểm toán | Mục tiêu kỹ thuật | Bằng chứng kiểm thử thực tế | Kết luận |
| :--- | :--- | :--- | :---: |
| **A. Quản lý học sinh & Mã PIN** | Phân biệt rõ `classCode`, `studentCode`, `access PIN`; chặn nhập nhầm mã HS vào ô PIN; cấp lại PIN an toàn, vô hiệu hóa PIN cũ; không lưu PIN văn bản thuần. | Test A1, A2, A3, A4 trong `tests/v5_1_security_and_ux.test.mjs`; Browser UAT chụp ảnh lỗi nhập nhầm và thẻ PIN cấp lại. | **PASS** |
| **B. Quản lý tài khoản & Mật khẩu** | Chặn tự nâng quyền Teacher/Admin; Admin khóa/mở khóa tài khoản giáo viên; đổi mật khẩu an toàn; cấp link đặt lại mật khẩu qua Firebase Auth (bỏ mật khẩu tạm văn bản thuần); ProfileModal trên Navbar. | Test B1, B2, B3 trong `tests/v5_1_security_and_ux.test.mjs`; Security Rules Test 7; Browser UAT chụp ảnh ForgotPasswordModal và ProfileModal. | **PASS** |
| **C. Kiểm toán bảo mật Excel** | Thay thế thư viện `xlsx` có lỗ hổng CVE (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) bằng `exceljs`; chống Formula Injection (CWE-1236); kiểm soát dung lượng $\le 2$MB, $\le 100$ dòng; kiểm tra trùng mã học sinh. | Test C1 trong `tests/v5_1_security_and_ux.test.mjs`; `tests/ux_audio_attempt_excel.test.mjs` (Test 6, 7); tệp mẫu chuẩn trong `web/public/*.xlsx`. | **PASS** |
| **D. Giọng đọc Tiếng Việt & Đánh giá TTS** | Giữ Web Speech API vi-VN; hỗ trợ tải lên/nhập tệp âm thanh MP3/WAV do giáo viên duyệt (`audioUrl`); nghiên cứu độc lập khả năng chạy CPU cục bộ của VieNeu-TTS (`pnnbao97`) và VietTTS (`dangvansam`). | Test D1 trong `tests/v5_1_security_and_ux.test.mjs`; khảo sát kiến trúc, bản quyền và dung lượng của VieNeu-TTS vs VietTTS. | **PASS** |
| **E. Kiểm thử toàn diện 3 vai trò** | Kiểm thử luồng Học sinh (đăng nhập mã, đọc bài, làm bài 3 dạng, xem lại); Giáo viên (xem lớp, cấp lại PIN, soạn bài); Admin (danh sách giáo viên, reset mật khẩu, thông tin cá nhân). | 6 ảnh chụp màn hình minh chứng trong thư mục `artifacts/`; Browser Subagent chạy không lỗi. | **PASS** |

---

## 2. CHI TIẾT KỸ THUẬT VÀ BẰNG CHỨNG XÁC MINH

### 2.1. Phần A — Quản lý Học sinh & Mã PIN Cá nhân
- **Phân tách 3 loại mã rõ ràng:**
  - `classCode`: Mã định danh lớp học (dùng chung cho cả lớp, ví dụ `LOP2A`, `L2C-2026`).
  - `studentCode`: Mã định danh học sinh trong sổ điểm của giáo viên (ví dụ `HS2A-01`, `HS999`).
  - `accessCode` (access PIN): Mã PIN cá nhân bí mật gồm 6 ký tự ngẫu nhiên do giáo viên cấp.
- **Xử lý nhập nhầm:**
  - Trên [StudentLogin.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/StudentLogin.tsx), khi học sinh nhập chuỗi có định dạng mã học sinh (như `HS2A-01`) vào ô PIN, giao diện hiển thị cảnh báo hướng dẫn màu vàng: *"Bạn đang nhập Mã định danh học sinh. Ô này yêu cầu nhập Mã PIN cá nhân 6 số bí mật do cô giáo cấp!"*.
  - Trên backend Cloud Function `joinClass`, khi nhận chuỗi có tiền tố mã học sinh, hệ thống trả về lỗi sư phạm rõ ràng, không tính là một lần nhập sai làm ảnh hưởng đến tài khoản.
- **Cấp lại PIN an toàn:**
  - Cloud Function `rotateStudentAccess` tạo mã PIN mới, tính toán salted hash PBKDF2 với 10.000 vòng lặp, cập nhật tài liệu `studentSecrets/{studentId}` và trả về mã mới một lần duy nhất cho giáo viên bàn giao cho học sinh.
  - Mã PIN cũ bị vô hiệu hóa ngay lập tức. Đã kiểm chứng: Dùng PIN cũ đăng nhập bị từ chối `PERMISSION_DENIED`; dùng PIN mới đăng nhập thành công 100%.
- **Cách ly tuyệt đối:**
  - Bộ sưu tập `studentSecrets` bị Firestore Rules chặn 100% quyền đọc/ghi từ client SDK (`status: 403 Forbidden`).
  - Tài liệu công khai `students/{studentId}` hoàn toàn không chứa trường `accessCode` hoặc `pin` dạng văn bản thuần.

### 2.2. Phần B — Quản lý Tài khoản & Phân quyền Bảo mật
- **Chặn tự leo thang đặc quyền (Privilege Escalation):**
  - Chức năng `bootstrapTeacherRole` và `bootstrapAdminRole` trên Cloud Functions yêu cầu mã bí mật hệ thống (`adminSecret`). Mọi nỗ lực tự cấp quyền từ frontend mà không có secret đều bị từ chối `permission-denied`.
- **Admin Quản trị Giáo viên:**
  - Endpoint `updateUserStatus` cho phép Admin chuyển trạng thái tài khoản giáo viên giữa `active` và `suspended`.
  - Có cơ chế chặn Admin tự khóa tài khoản của chính mình (`failed-precondition: Quản trị viên không thể tự khóa tài khoản của chính mình`).
- **Đặt lại mật khẩu an toàn (Bỏ mật khẩu tạm văn bản thuần):**
  - Trước đây: Hệ thống cũ sinh chuỗi mật khẩu ngẫu nhiên và gửi về cho Admin. Điều này tiềm ẩn nguy cơ lộ mật khẩu và vi phạm nguyên tắc bảo mật.
  - Hiện tại: `adminResetTeacherPassword` sử dụng hàm `admin.auth().generatePasswordResetLink(email)` của Firebase Admin SDK, tạo liên kết đặt lại mật khẩu bảo mật và gửi cho giáo viên. Không có bất kỳ mật khẩu văn bản thuần nào được lưu trữ hay trả về phía client.
- **Giao diện Người dùng:**
  - [ForgotPasswordModal.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/ForgotPasswordModal.tsx) tích hợp tại trang đăng nhập Giáo viên và Quản trị viên, hỗ trợ tự khôi phục mật khẩu qua email Firebase Auth.
  - [ProfileModal.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/ProfileModal.tsx) tích hợp trực tiếp trên thanh điều hướng [Navbar.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/Navbar.tsx), cho phép giáo viên và admin đổi tên hiển thị và đổi mật khẩu bất cứ lúc nào.

### 2.3. Phần C — Kiểm toán Thư viện Excel & Phòng chống Tấn công
- **Loại bỏ lỗ hổng CVE của `xlsx`:**
  - Gói thư viện `xlsx` (SheetJS bản cũ) có 2 cảnh báo lỗ hổng nghiêm trọng (GHSA-4r6h-8v6p-xvw6 Prototype Pollution, GHSA-5pgg-2g8v-p4x9 ReDoS) đã được gỡ bỏ hoàn toàn khỏi dự án.
  - Thay thế bằng thư viện chuẩn doanh nghiệp **`exceljs` (^4.4.0)** an toàn, không có lỗ hổng bảo mật.
- **Phòng chống tấn công Formula Injection (CWE-1236):**
  - Hàm `sanitizeCellText` tự động kiểm tra ký tự đầu tiên của dữ liệu ô tính. Nếu bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`, hệ thống tự chèn dấu nháy đơn `'` ở đầu chuỗi để ép các phần mềm bảng tính (Microsoft Excel, Google Sheets, LibreOffice) xử lý dưới dạng văn bản thuần, triệt tiêu nguy cơ thực thi mã độc.
- **Kiểm soát dung lượng và hàng loạt:**
  - Giới hạn tệp tải lên: Tối đa 2MB.
  - Giới hạn số dòng: Tối đa 100 học sinh/lần nhập để đảm bảo hiệu năng và tránh quá tải Firestore.
  - Kiểm tra trùng lặp: Phát hiện mã học sinh trùng nhau ngay trong cùng tệp Excel và trùng với danh sách lớp hiện có; hiển thị cảnh báo chi tiết từng dòng lỗi trước khi ghi.

### 2.4. Phần D — Giọng đọc Tiếng Việt & Đánh giá Nghiên cứu TTS Ngoại tuyến
- **Tệp âm thanh đính kèm (`audioUrl`):**
  - Mở rộng schema bài đọc cho phép đính kèm tệp âm thanh MP3/WAV hoặc đường dẫn âm thanh do giáo viên duyệt.
  - Giao diện [AudioReader.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/components/AudioReader.tsx) tự động ưu tiên phát tệp âm thanh này kèm đầy đủ thanh trượt phát, tạm dừng, tua thời gian và chỉnh tốc độ (0.75x, 0.85x, 1.0x, 1.25x).
  - Nếu bài đọc chưa có file âm thanh, hệ thống chuyển sang chế độ đọc bằng Web Speech API tiếng Việt (`vi-VN`); nếu thiết bị không hỗ trợ tiếng Việt, hệ thống hiển thị thông báo sư phạm lịch sự và từ chối phát giọng tiếng Anh.
- **Báo cáo nghiên cứu độc lập về VieNeu-TTS và VietTTS:**
  - **VietTTS (`dangvansam/viet-tts`):** Dựa trên kiến trúc FastSpeech 2 / Tacotron 2 kết hợp HiFi-GAN vocoder. Có hỗ trợ Docker, API tương thích OpenAI TTS. Tuy nhiên, trọng số mô hình phát hành theo giấy phép **CC BY-NC (Không thương mại)**, hạn chế triển khai trong các ứng dụng giáo dục chính thống; cần môi trường Python/PyTorch nặng (~1.5GB RAM).
  - **VieNeu-TTS (`pnnbao97/VieNeu-TTS`):** Dựa trên mô hình ngôn ngữ nhân quả Transformer (Qwen 0.3B/0.5B backbone) kết hợp Neural Audio Codec Decoder (MOSS-Audio-Tokenizer / NeuCodec). Bản mã nguồn mở v3 Turbo phát hành theo giấy phép **Apache 2.0**. Hỗ trợ định dạng lượng hóa **0.3B GGUF (Q4/Q8)**, cho phép chạy trực tiếp trên CPU máy tính Windows cục bộ mà không cần GPU rời.
  - **Khuyến nghị kiến trúc:** Không nhúng mô hình nơ-ron nặng vào Firebase Cloud Functions serverless (tránh Cold-start 10–30s và chi phí Cloud cao). Nếu nhà trường vùng cao có nhu cầu tạo file đọc ngoại tuyến chất lượng cao, có thể sử dụng VieNeu-TTS 0.3B GGUF như một công cụ Desktop độc lập để giáo viên xuất ra file MP3 rồi nạp vào bài học.

---

## 3. BẰNG CHỨNG HÌNH ẢNH XÁC MINH TRÌNH DUYỆT (BROWSER SUBAGENT UAT)

Các ảnh chụp màn hình minh chứng được trích xuất trực tiếp từ phiên chạy trình duyệt thực tế và được lưu trữ tại thư mục [artifacts/](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts):

1. **Giao diện Đăng nhập Học sinh — Phân biệt rõ Mã lớp & Mã PIN:**  
   [artifacts/v5_1_student_login_pin.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_student_login_pin.png)  
   *Mô tả:* Form đăng nhập có 2 ô riêng biệt "Mã lớp học (classCode)" và "Mã PIN cá nhân (access PIN)", có cảnh báo thời gian thực khi học sinh gõ nhầm mã định danh HS.

2. **Giao diện Đọc bài & Nghe giọng đọc mẫu:**  
   [artifacts/v5_1_student_reading_audio.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_student_reading_audio.png)  
   *Mô tả:* Bài đọc khối 2 có tích hợp bộ phát âm thanh AudioReader, nút chỉnh cỡ chữ to/nhỏ và nút "Em đã đọc xong — Bắt đầu thử thách".

3. **Giao diện Quản lý Học sinh & Thẻ mã PIN Giáo viên:**  
   [artifacts/v5_1_teacher_dashboard_pin_cards.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_teacher_dashboard_pin_cards.png)  
   *Mô tả:* Bảng học sinh hiển thị mã HS, biệt danh, trạng thái PIN, nút "Cấp lại PIN" mở hộp thoại thẻ đăng nhập có nút "In thẻ" và "Sao chép".

4. **Giao diện Soạn bài Giáo viên — Tải tệp MP3/WAV:**  
   [artifacts/v5_1_teacher_authoring_audio.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_teacher_authoring_audio.png)  
   *Mô tả:* Mục đính kèm âm thanh bài đọc cho phép nhập link hoặc tải trực tiếp file MP3/WAV do giáo viên duyệt, nghe thử trực tiếp trên trình biên tập.

5. **Giao diện Quản trị viên (Admin) — Đặt lại Mật khẩu Giáo viên an toàn:**  
   [artifacts/v5_1_admin_reset_password_modal.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_admin_reset_password_modal.png)  
   *Mô tả:* Modal tạo liên kết an toàn từ Firebase Auth, không có mật khẩu tạm văn bản thuần.

6. **Giao diện Modal Thông tin Cá nhân & Đổi Mật khẩu:**  
   [artifacts/v5_1_profile_modal_navbar.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/artifacts/v5_1_profile_modal_navbar.png)  
   *Mô tả:* ProfileModal tích hợp trên thanh Navbar, cho phép cập nhật họ tên và đổi mật khẩu bảo mật.

---

## 4. KẾT LUẬN NGHIỆM THU V5.1

- Toàn bộ các tiêu chí an ninh, quản trị học sinh, chống Formula Injection Excel, phát âm thanh và kiểm soát quyền của phiên bản **V5.1** đã được thực hiện đầy đủ, chính xác và kiểm chứng qua 61 bài test tự động cũng như trình duyệt thực tế.
- **Chính thức nghiệm thu PASS phiên bản V5.1**.
- Hệ thống đã sẵn sàng 100% để chuyển sang các yêu cầu của **V5.2** (Quản lý vòng đời bài đọc, thêm/xóa/sắp xếp câu hỏi linh hoạt, phiên bản bất biến và chống giao bài trùng lặp).
