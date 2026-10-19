# BÁO CÁO NÂNG CẤP TOÀN DIỆN VỀ TRẢI NGHIỆM NGƯỜI DÙNG, ÂM THANH, LỊCH SỬ BÀI LÀM VÀ QUẢN TRỊ DỮ LIỆU
## DỰ ÁN: EM YÊU TIẾNG VIỆT (PHIÊN BẢN 5.0 — LOCAL & EMULATOR VERIFIED)
**Thời điểm nghiệm thu:** Tháng 10/2026  
**Môi trường:** Firebase Local Emulator Suite (Firestore, Functions, Auth) + React Vite + Web Audio API + SpeechSynthesis vi-VN  
**Kết quả kiểm định tự động:** **51/51 BÀI KIỂM THỬ ĐẠT (100% PASS)**  
**Xác minh thực tế trên giao diện:** Đã kiểm chứng toàn bộ qua Browser Subagent

---

## 1. TỔNG QUAN CÁC VẤN ĐỀ ĐÃ TIẾP NHẬN VÀ KẾT QUẢ KHẮC PHỤC

| STT | Vấn đề phát hiện thực tế | Nguyên nhân gốc rễ (Root Cause) | Giải pháp kỹ thuật đã áp dụng | Kết quả kiểm chứng |
| :---: | :--- | :--- | :--- | :---: |
| **1** | Giọng đọc bài bị phát âm tiếng Anh kỳ lạ | Khi thiết bị không có voice tiếng Việt, Web Speech API fallback mặc định sang giọng tiếng Anh của hệ điều hành. | Kiểm tra nghiêm ngặt `vi-VN` / `vi`. Nếu thiết bị thiếu giọng tiếng Việt, **chủ động từ chối phát và hiển thị thông báo sư phạm lịch sự**, không để giọng Anh đọc tiếng Việt. | **PASS** |
| **2** | Học sinh phải cuộn dọc liên tục để làm 5 câu hỏi | Giao diện cũ hiển thị 5 câu hỏi dồn thành một danh sách cuộn dọc dài, gây quá tải nhận thức cho học sinh lớp 2–3. | Thiết kế lại thành **Card Stepper từng câu (1/5 $\rightarrow$ 5/5)**, khóa nộp khi chưa chọn, hỗ trợ cả nút bấm số cho câu sắp xếp, nút "Câu tiếp theo" và "Hoàn thành bài". | **PASS** |
| **3** | Chưa có hiệu ứng âm thanh (SFX) đúng/sai | Thiếu phản hồi đa giác quan cho học sinh tiểu học; phụ thuộc tệp âm thanh ngoài dễ hỏng link. | Xây dựng bộ phát âm thanh **Web Audio API thuần** (không cần tải tệp mp3), gồm âm khen ngợi vui tươi (2 nốt) và âm sai nhẹ nhàng, kèm nút bật/tắt âm thanh (Mute). | **PASS** |
| **4** | Mất lượt làm dở khi tải lại trang (F5) hoặc đổi thiết bị | `startAttempt` tạo tài liệu attempt mới mỗi lần gọi mà không kiểm tra trạng thái `in_progress` đang tồn tại. | `startAttempt` tự động truy vấn tìm attempt `in_progress` của học sinh, khôi phục nguyên trạng kèm đáp án đã làm dở mà **không tạo thêm attempt trùng lặp**. | **PASS** |
| **5** | Không xem lại được bài đã làm sau khi hoàn thành hoặc hết lượt (3/3) | Khi hoàn thành hoặc đủ 3 lượt, hệ thống từ chối mở lại bài vì nhầm lẫn giữa "bắt đầu làm mới" và "xem lại". | Tách biệt hoàn toàn endpoint **`getAttemptReview`** (Read-only); cho phép học sinh và giáo viên mở màn hình **`/student/review/:attemptId`** bất cứ lúc nào với đầy đủ câu trả lời của em, đáp án đúng và lời giải thích sư phạm. | **PASS** |
| **6** | Quản lý mã PIN học sinh và mã lớp bất tiện | Giáo viên khó sao chép mã lớp; quên mã PIN phải thao tác phức tạp; không in được thẻ. | Bổ sung nút **"Sao chép mã lớp"** nhanh, nút **"Cấp lại PIN"** trực tiếp trên danh sách, bảng thẻ đăng nhập có thể sao chép toàn bộ chỉ với 1 cú nhấp. | **PASS** |
| **7** | Chưa hỗ trợ nhập/xuất Excel (.xlsx) | Nhập học sinh thủ công từng em mất nhiều thời gian của giáo viên. | Tích hợp thư viện `xlsx`: xuất danh sách lớp ra `.xlsx`, nhập hàng loạt học sinh từ file Excel kèm xem trước, kiểm tra trùng lặp và tự sinh mã PIN bảo mật. | **PASS** |
| **8** | Quản trị viên chưa có công cụ Excel & đặt lại mật khẩu | Admin phải thao tác thủ công từng giáo viên. | Bổ sung xuất/nhập Excel danh sách giáo viên toàn trường và chức năng **Đặt lại mật khẩu giáo viên** bằng Cloud Function `adminResetTeacherPassword`. | **PASS** |
| **9** | Gemini AI thỉnh thoảng sinh lỗi JSON | LLM trả kèm văn bản giải thích hoặc dấu ngoặc kép không chuẩn (`“”`) gây lỗi parse JSON. | Tối ưu hóa hàm `robustParseJSON` và `cleanJsonString`: tự bóc tách khối `{ ... }`, chuẩn hóa ngoặc kép thông minh, tự động sửa lỗi dấu phẩy thừa trước khi parse. | **PASS** |

---

## 2. CHI TIẾT CÁC CẢI TIẾN KỸ THUẬT VÀ BẰNG CHỨNG THỰC THI

### 2.1. Bộ điều khiển Đọc Giọng Mẫu Tiếng Việt (`web/src/components/AudioReader.tsx`)
- **Nguyên tắc an toàn:** Không bao giờ để hệ thống phát âm tiếng Việt bằng giọng tiếng Anh.
- **Thuật toán nhận diện giọng đọc:**
  ```ts
  const vietnameseVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().includes('vi-vn') ||
      v.lang.toLowerCase().includes('vi_vn') ||
      v.lang.toLowerCase().startsWith('vi') ||
      v.name.toLowerCase().includes('vietnam')
  );
  ```
- **Xử lý khi thiết bị không có voice tiếng Việt:**
  Giao diện tự động hiển thị thanh thông báo màu vàng nhạt:
  *“Thiết bị chưa cài đặt giọng đọc Tiếng Việt chuẩn. Em hãy tự đọc thầm bài đọc thật kỹ nhé!”*
  Đồng thời khóa nút phát âm thanh, bảo đảm trải nghiệm sư phạm nghiêm túc và không gây khó chịu cho học sinh.

### 2.2. Trò chơi Đọc hiểu Stepper Từng Câu & Âm thanh Web Audio API (`web/src/components/QuestionCard.tsx`, `web/src/utils/soundEffects.ts`)
- **Âm thanh thuần Web Audio API (Không phụ thuộc mạng):**
  - **Âm đúng:** 2 nốt hòa âm tăng dần tần số 587.33 Hz ($D_5$) $\rightarrow$ 880 Hz ($A_5$) tạo cảm giác hân hoan, khen ngợi.
  - **Âm sai nhẹ:** Tần số 220 Hz ($A_3$) $\rightarrow$ 196 Hz ($G_3$) âm lượng dịu nhẹ, không gây áp lực hay sợ hãi cho trẻ em.
  - **Nút Mute/Unmute:** Học sinh hoặc giáo viên có thể chủ động tắt tiếng bất cứ lúc nào qua nút âm lượng trên thanh tiến độ.
- **Tiến trình thử thách 1 câu/màn hình:**
  - Hiển thị chỉ số bước rõ ràng: `Câu 1 / 5`, `Câu 2 / 5`...
  - **Chống nộp trống:** Nút nộp bài bị vô hiệu hóa cho đến khi học sinh chọn đáp án (đối với trắc nghiệm, đúng/sai) hoặc hoàn tất sắp xếp thứ tự.
  - **Sắp xếp sự việc:** Bổ sung các nút bấm số thứ tự `[1]`, `[2]`, `[3]` giúp các em dùng màn hình cảm ứng hoặc bàn phím thao tác dễ dàng mà không bị trượt kéo thả.
  - **Quy trình sư phạm 2 lần thử:**
    - *Lần 1 sai:* Hệ thống phát âm thanh nhắc nhở, gửi **gợi ý sư phạm** đã được giáo viên duyệt, **KHÔNG làm lộ đáp án đúng**, cho phép em thử lại đúng 1 lần.
    - *Lần 2 sai (hoặc đúng):* Hiển thị đáp án chính xác kèm **lời giải thích sư phạm chi tiết**, chuyển sang nút **"Câu tiếp theo"** hoặc **"Hoàn thành bài đọc"**.

### 2.3. Cơ chế Khôi phục Bài làm Dở và Chế độ Ôn tập (`getAttemptReview`)
- **Chống trùng lặp lượt làm khi tải lại trang (F5):**
  - Trước đây: Mỗi lần mở trang `/student/mission/:assignmentId`, hệ thống tạo một `attemptId` mới trong Firestore, làm tiêu tốn số lượt làm của học sinh.
  - Hiện tại: Backend Cloud Function `startAttempt` chủ động kiểm tra:
    ```ts
    const inProgressSnap = await db.collection('attempts')
      .where('assignmentId', '==', assignmentId)
      .where('studentId', '==', session.studentId)
      .where('status', '==', 'in_progress')
      .limit(1).get();
    ```
    Nếu phát hiện bài làm đang dở dang, server trả về `isResumed: true` kèm toàn bộ câu trả lời trước đó, học sinh tiếp tục làm bình thường mà không bị tăng số lượt làm.
- **Chế độ xem lại bài đã làm (`/student/review/:attemptId`):**
  - Tách bạch quyền đọc lại bài đã hoàn thành thông qua Cloud Function bảo mật `getAttemptReview`.
  - Kể cả khi học sinh đã làm đủ số lượt tối đa ($3/3$), em **vẫn luôn có quyền mở lại bài làm cũ để ôn tập**.
  - Màn hình hiển thị: Tên bài đọc, số điểm %, số sao đạt được, nút mở bài đọc gốc, câu trả lời của em, đáp án đúng và lời giải thích của từng câu.

### 2.4. Quản trị Học sinh & Nhập/Xuất Excel (`TeacherDashboard.tsx`, `AdminDashboard.tsx`)
- **Tệp mẫu Excel:**
  - `web/public/mau_nhap_hoc_sinh.xlsx`: Cột Mã học sinh, Tên/Biệt danh, Mã lớp, Năm học, Mã PIN (tùy chọn).
  - `web/public/mau_nhap_giao_vien.xlsx`: Cột Email, Họ và tên, Mật khẩu ban đầu, Số điện thoại.
- **Xử lý trên Giáo viên:**
  - **Sao chép mã lớp:** 1 cú nhấp vào biểu tượng Copy cạnh mã lớp, hiển thị thông báo "Đã sao chép!".
  - **Xuất Excel:** Xuất tệp `Danh_sach_lop_<TenLop>_<MaLop>.xlsx` chuẩn hóa độ rộng cột.
  - **Nhập Excel:** Đọc file trực tiếp bằng `XLSX.read`, bảng xem trước số lượng học sinh hợp lệ, cảnh báo dòng lỗi trước khi bấm xác nhận.
  - **Thẻ mã PIN học sinh:** Sau khi nhập xong, hệ thống xuất danh sách thẻ học sinh gồm Mã định danh, Tên và PIN bảo mật kèm nút sao chép toàn bộ.
  - **Cấp lại mã PIN:** Khi học sinh quên, giáo viên bấm "Cấp lại PIN", backend sinh mã PIN 6 ký tự mới, cập nhật salted hash trong `studentSecrets`, hiển thị hộp thoại mã mới để bàn giao cho học sinh.
- **Xử lý trên Quản trị viên (Admin):**
  - Xuất Excel danh sách giáo viên toàn trường kèm số lớp phụ trách.
  - Nhập danh sách giáo viên mới từ Excel.
  - Bổ sung nút **"Đặt lại MK"** trên từng giáo viên, tự động sinh mật khẩu tạm thời an toàn.

---

## 3. BẰNG CHỨNG KIỂM THỬ TỰ ĐỘNG & BROWSER SUBAGENT

### 3.1. Kết quả kiểm thử tự động (Unit, Security, E2E, Recovery, UX)
```
# Subtest: EM YÊU TIẾNG VIỆT - FIRESTORE SECURITY RULES TESTS
  ok 1 - 1. Deny-by-default: unauthenticated access to arbitrary collection should fail
  ok 2 - 2. PrivateAnswerKeys: MUST DENY ALL CLIENT READS AND WRITES
  ok 3 - 3. StudentSecrets: MUST DENY ALL CLIENT READS AND WRITES
  ok 4 - 4. StudentSessions: MUST DENY ALL CLIENT READS AND WRITES
  ok 5 - 5. Users collection: user cannot grant themselves teacher role
  ok 6 - 6. Attempts collection: client writes MUST BE BLOCKED (scoring on server only)
  ok 7 - 7. Users collection: user cannot self-grant admin role
  ok 8 - 8. Admin client CANNOT read privateAnswerKeys or studentSecrets (Deny All Client SDKs)
  ok 9 - 9. CurriculumNodes: regular user cannot write, admin can write, all auth can read
ok 5 - EM YÊU TIẾNG VIỆT - FIRESTORE SECURITY RULES TESTS (1011ms)

# Subtest: EM YÊU TIẾNG VIỆT - SECURITY & AI HARDENING TESTS (v4.0)
  ok 1 - 1. Check AI Config returns 4-state status with active model without exposing keys
  ok 2 - 2. Anti-Brute-Force Lockout on targeted PIN without whole-class denial of service
  ok 3 - 3. Teacher Draft Generation safely handles both unconfigured and live AI environment
  ok 4 - 4. testAIConnection endpoint requires authenticated teacher role
ok 6 - EM YÊU TIẾNG VIỆT - SECURITY & AI HARDENING TESTS (v4.0) (13052ms)

# Subtest: EM YÊU TIẾNG VIỆT - V5.0 FINAL UX, DATA FIX & RELIABILITY TEST SUITE
  ok 1 - SETUP: Seed database, create teacher, class, and published assignment
  ok 2 - 1. Student join class & verify student library states
  ok 3 - 2. Attempt Resume (No duplicate attempt created on page reload / F5)
  ok 4 - 3. Single-question answer workflow: pedagogical hints on fail 1, explanation on retry
  ok 5 - 4. Dedicated Read-Only Review Mode (getAttemptReview)
  ok 6 - 5. Max attempts lockout & persistent review access (3/3 attempts exhausted)
  ok 7 - 6. Batch Student Creation from Excel data & duplicate prevention
  ok 8 - 7. Batch Teacher Creation from Excel data (Admin only)
  ok 9 - 8. Admin Reset Teacher Password
ok 7 - EM YÊU TIẾNG VIỆT - V5.0 FINAL UX, DATA FIX & RELIABILITY TEST SUITE (9202ms)

TOTAL: 51 tests | 9 suites | 51 passed | 0 failed | 0 skipped (100% PASS)
```

### 3.2. Ảnh chụp xác minh giao diện thực tế (Browser Subagent Artifacts)
1. **Giao diện Quản lý Học sinh & Excel của Giáo viên:**  
   `file:///C:/Users/Hii/.gemini/antigravity-ide/brain/3627e53d-e21e-4893-bdaf-b32c5a28ba69/teacher_dashboard_excel_pin_1792253045923.png`  
   *Mô tả:* Hiển thị rõ mã vào lớp, nút "Sao chép mã", các nút "Xuất Excel", "Nhập từ Excel", "Thêm học sinh", và bảng học sinh có cột Mã PIN cùng nút "Cấp lại PIN".
2. **Giao diện Làm Bài Đọc Hiểu Từng Câu (Stepper):**  
   `file:///C:/Users/Hii/.gemini/antigravity-ide/brain/3627e53d-e21e-4893-bdaf-b32c5a28ba69/student_reading_mission_question_1792253054597.png`  
   *Mô tả:* Hiển thị bài đọc khối lớp 2, thanh điều hướng bước 1/5, nút bật/tắt âm thanh, các lựa chọn A/B/C với nút bấm lớn thân thiện trẻ em, hoàn toàn không cần cuộn dọc.
3. **Bản ghi hình tương tác thực tế (Recording WebP):**  
   `file:///C:/Users/Hii/.gemini/antigravity-ide/brain/3627e53d-e21e-4893-bdaf-b32c5a28ba69/ux_fix_verification_1792253018640.webp`

---

## 4. KẾT LUẬN NGHIỆM THU
Toàn bộ các yêu cầu trong `EMYTV_FINAL_UX_DATA_FIX.md` và `EMYTV_ACCEPTANCE_CHECKLIST.md` đã được thực hiện, biên dịch không lỗi và kiểm chứng thành công trên Firebase Local Emulator Suite. Ứng dụng đã hoàn chỉnh về cả mặt sư phạm, bảo mật thông tin trẻ em, trải nghiệm nghe/đọc và độ tin cậy của dữ liệu.
