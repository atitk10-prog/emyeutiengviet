# MA TRẬN TRẠNG THÁI TÍNH NĂNG — EM YÊU TIẾNG VIỆT (PHIÊN BẢN 5.0)

Bảng tổng hợp chi tiết toàn bộ các tính năng, mức độ ưu tiên (P0–P4), cơ chế bảo mật, phương pháp kiểm chứng và trạng thái nghiệm thu thực tế.

| Mã | Hạng mục tính năng | Mô tả chi tiết | Thành phần triển khai | Phương pháp kiểm chứng | Bằng chứng kiểm thử | Trạng thái |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **F01** | Khởi tạo & Dữ liệu Emulator | Sao lưu an toàn thư mục dữ liệu `./emulator-data-backup-v5`, chạy đầy đủ Auth, Firestore, Functions. | `firebase.json`, `emulator-data/` | Kiểm tra tệp sao lưu, kiểm tra cổng 9099, 8080, 5001. | `persistence_and_recovery.test.mjs` | **PASS** |
| **F02** | Ngăn ngừa rò rỉ mã khóa AI | Không đặt `GEMINI_API_KEY` ở client, đọc qua `functions/.env.local` và `.secret.local`, `.gitignore` bảo vệ. | `aiAdapter.ts`, `.gitignore` | Tìm kiếm mã nguồn client, kiểm tra endpoint `getAIStatus`. | `security_and_ai.test.mjs` (Test 1) | **PASS** |
| **F03** | Xử lý lỗi JSON Gemini AI | Tự động bóc tách `{ ... }`, chuẩn hóa ngoặc thông minh, sửa dấu phẩy thừa bằng `robustParseJSON`. | `aiAdapter.ts` | Phân tích cú pháp chuỗi JSON lỗi cấu trúc và markdown fence. | `security_and_ai.test.mjs` (Test 3) | **PASS** |
| **F04** | Giọng đọc Tiếng Việt chuẩn | Chỉ phát âm khi có `vi-VN` / `vi`; từ chối phát và hiện thông báo nếu thiết bị chỉ có tiếng Anh. | `AudioReader.tsx` | Browser subagent, giả lập speechSynthesis voices. | Browser Subagent Artifacts | **PASS** |
| **F05** | Hiệu ứng âm thanh Đúng/Sai | Web Audio API thuần, âm đúng tăng tần số vui tươi, âm sai dịu nhẹ, nút bật/tắt Mute. | `soundEffects.ts`, `QuestionCard.tsx` | Browser Subagent, AudioContext oscillators. | Browser Subagent Artifacts | **PASS** |
| **F06** | Thử thách đọc hiểu Stepper | Card từng câu (1/5 $\rightarrow$ 5/5), nút nộp khóa khi chưa chọn, nút "Câu tiếp theo" rõ ràng, không cuộn dọc. | `QuestionCard.tsx`, `ReadingMission.tsx` | Kiểm tra giao diện Desktop & Mobile (390x844). | `ux_audio_attempt_excel.test.mjs` (Test 3) | **PASS** |
| **F07** | Câu hỏi Sắp xếp linh hoạt | Hỗ trợ kéo thả kèm các nút số `[1]`, `[2]`, `[3]` cho màn hình cảm ứng điện thoại và máy tính bảng. | `QuestionCard.tsx` | Tương tác chọn số thứ tự sự việc trên giao diện. | `pedagogical_fixtures.test.mjs` | **PASS** |
| **F08** | Gợi ý & Chấm điểm 2 pha | Lần 1 sai: nhận gợi ý, KHÔNG lộ đáp án. Lần 2 sai: hiện đáp án và giải thích sư phạm. | `submitAnswer` Cloud Function | Nộp sai lần 1 $\rightarrow$ kiểm tra `hint`, nộp lần 2 $\rightarrow$ kiểm tra `explanation`. | `ux_audio_attempt_excel.test.mjs` (Test 3) | **PASS** |
| **F09** | Khôi phục lượt làm dở (F5) | Khi học sinh tải lại trang, tiếp tục attempt `in_progress` đang có, không sinh attempt trùng. | `startAttempt` Cloud Function | Gọi `startAttempt` liên tiếp 2 lần khi đang làm dở. | `ux_audio_attempt_excel.test.mjs` (Test 2) | **PASS** |
| **F10** | Chế độ Ôn tập Read-only | Học sinh và giáo viên mở xem lại bài đã làm kèm giải thích, xem được cả khi hết 3/3 lượt. | `getAttemptReview`, `StudentReview.tsx` | Gọi `getAttemptReview` sau khi attempt hoàn thành & sau khi hết lượt. | `ux_audio_attempt_excel.test.mjs` (Test 4, 5) | **PASS** |
| **F11** | Khóa lượt làm tối đa (3/3) | Khi hoàn thành đủ `maxAttempts`, thông báo lịch sự và dẫn học sinh sang nút "Xem lại bài đã làm". | `startAttempt`, `StudentLibrary.tsx` | Kiểm tra mã lỗi `resource-exhausted` và thông điệp tiếng Việt. | `ux_audio_attempt_excel.test.mjs` (Test 5) | **PASS** |
| **F12** | Sao chép mã lớp nhanh | Nút "Sao chép mã" cạnh mã lớp trên Teacher Dashboard kèm thông báo phản hồi "Đã sao chép!". | `TeacherDashboard.tsx` | Thao tác clipboard qua nút bấm trên màn hình lớp học. | Browser Subagent Artifacts | **PASS** |
| **F13** | Cấp lại mã PIN học sinh | Giáo viên đổi mã PIN khi học sinh quên, tự động sinh mã mới, cập nhật salted hash. | `rotateStudentAccess`, `TeacherDashboard.tsx` | Bấm nút "Cấp lại PIN" trong bảng học sinh, xem hộp thoại PIN mới. | `ux_audio_attempt_excel.test.mjs` (Test 8) | **PASS** |
| **F14** | Xuất danh sách học sinh Excel | Xuất file `.xlsx` danh sách lớp gồm Mã học sinh, Tên/Biệt danh, Mã lớp, Năm học, Trạng thái. | `TeacherDashboard.tsx`, `xlsx` | Bấm nút "Xuất Excel" $\rightarrow$ tạo file `.xlsx` hợp lệ. | Browser Subagent Artifacts | **PASS** |
| **F15** | Nhập học sinh từ Excel | Tải file `.xlsx`, xem trước số lượng, kiểm tra trùng lặp, tự sinh PIN và xuất thẻ đăng nhập. | `batchCreateStudents`, `TeacherDashboard.tsx` | Tải lên file Excel mẫu, kiểm tra bản ghi Firestore. | `ux_audio_attempt_excel.test.mjs` (Test 6) | **PASS** |
| **F16** | Tệp mẫu Excel tải về | Cung cấp link tải trực tiếp `/mau_nhap_hoc_sinh.xlsx` và `/mau_nhap_giao_vien.xlsx` trên giao diện. | `web/public/*.xlsx` | Tải về bằng trình duyệt và kiểm tra cấu trúc cột. | Node.js verification script | **PASS** |
| **F17** | Xuất/Nhập giáo viên Excel | Quản trị viên (Admin) xuất/nhập danh sách giáo viên toàn trường qua tệp `.xlsx`. | `batchCreateTeachers`, `AdminDashboard.tsx` | Admin nạp hàng loạt giáo viên, cấp quyền teacher claim. | `ux_audio_attempt_excel.test.mjs` (Test 7) | **PASS** |
| **F18** | Đặt lại mật khẩu Giáo viên | Admin đặt lại mật khẩu cho tài khoản giáo viên, trả về mật khẩu tạm thời an toàn. | `adminResetTeacherPassword`, `AdminDashboard.tsx` | Admin bấm "Đặt lại MK", nhận mật khẩu tạm thời. | `ux_audio_attempt_excel.test.mjs` (Test 8) | **PASS** |
| **F19** | Bảo vệ chống Brute-force | Khóa 5 phút đối với từng mã PIN cụ thể khi nhập sai 5 lần, không làm tê liệt toàn bộ lớp học. | `joinClass` Cloud Function | Nhập sai liên tiếp 5 lần cùng 1 accessCode $\rightarrow$ nhận thông báo khóa. | `security_and_ai.test.mjs` (Test 2) | **PASS** |
| **F20** | Phân tách Private Answer Keys | Đáp án đúng và lời giải lưu riêng biệt trong `privateAnswerKeys`, deny all client SDK reads. | `firestore.rules`, `publishLesson` | Truy vấn collection `privateAnswerKeys` từ Client REST/SDK $\rightarrow$ PERMISSION_DENIED. | `rules.test.mjs` (Test 2, 8) | **PASS** |

---

## TỔNG KẾT NGHIỆM THU
- **Tổng số tính năng kiểm định:** 20/20 tính năng hoàn tất.
- **Tỉ lệ đạt yêu cầu:** **100% PASS**.
- **Không có bất kỳ tính năng nào bị bỏ sót hoặc mô phỏng giả tạo.**
