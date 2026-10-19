# EM YEU TIENG VIET — Acceptance checklist v5.0

| ID | Ca kiểm thử thực tế | Kết quả bắt buộc |
|---|---|---|
| TTS-01 | Máy có voice `vi-VN` | Chỉ phát giọng tiếng Việt; nghe, dừng, đổi tốc độ hoạt động |
| TTS-02 | Máy không có voice tiếng Việt | Không phát bằng giọng tiếng Anh; hiện thông báo nhẹ; vẫn đọc được bài |
| TTS-03 | Chuyển bài giữa chừng | Giọng trước dừng hẳn, không đọc chồng |
| SFX-01 | Trả lời đúng, âm bật | Phát tín hiệu ngắn, hiển thị thông báo đúng; không tự chuyển câu |
| SFX-02 | Trả lời sai, âm bật | Phát âm khác nhẹ nhàng, hiện gợi ý |
| SFX-03 | Chế độ tắt âm | Không phát hiệu ứng, vẫn có phản hồi bằng chữ/icon |
| Q-01 | Chưa chọn đáp án | Nút Kiểm tra bị khóa, không được gửi câu rỗng |
| Q-02 | Sai lần đầu | Gợi ý không lộ đáp án; cho thử lại đúng một lần |
| Q-03 | Sai lần hai | Hiện đáp án và giải thích rồi mới cho Tiếp |
| Q-04 | Sai rồi đúng | `firstTryCorrect=false`; `finalCorrect=true`; chỉ số tính đúng |
| Q-05 | Đúng ngay | `firstTryCorrect=true`; hiện Tiếp và giải thích |
| Q-06 | Sắp xếp chưa đầy đủ | Không chấm/nộp được |
| Q-07 | Mobile 390x844 | Câu hỏi và nút thao tác rõ ràng, không cần cuộn qua các câu khác |
| Q-08 | Double click/Nghẽn mạng | Không tạo phản hồi/lượt làm trùng |
| A-01 | Tạo lớp & học sinh | Hiển thị classCode và studentCode; mã PIN mới chỉ hiện ở thời điểm cấp |
| A-02 | Đã quên PIN | Cấp PIN mới; PIN cũ không còn hiệu lực; không giải mã hash |
| A-03 | Teacher quên mật khẩu | Email reset hoặc quy trình an toàn; không xem được mật khẩu cũ |
| A-04 | Admin đăng nhập | Trang Admin riêng, giáo viên không thể tự nâng quyền |
| XLS-01 | Nhập file `.xlsx` đúng mẫu | Preview/kiểm lỗi/confirm; dữ liệu thực ghi vào Firestore |
| XLS-02 | File trùng/thiếu cột/kiểu sai | Báo dòng lỗi rõ; không tạo dữ liệu hỏng |
| XLS-03 | Nhập file hai lần | Không phát sinh bản ghi học sinh trùng |
| XLS-04 | Xuất Excel HS/GV | Mở được Excel, đúng dấu và đủ cột, không có PIN/hash/password |
| R-01 | Học sinh hoàn thành một lượt | Lịch sử đúng, có nút Xem lại và lượt còn lại |
| R-02 | Hết 3/3 lượt | Không cho lượt mới nhưng vẫn xem lại được các lần đã làm |
| R-03 | F5 giữa bài | Tiếp tục đúng attempt, không tăng lượt |
| R-04 | F5 sau hoàn thành | Kết quả đã nộp và chi tiết vẫn còn |
| R-05 | Đổi học sinh cùng máy | Học sinh sau không đọc được bài làm học sinh trước |
| R-06 | Restart emulator có import/export | Kiểm tra nội dung attempt/assignment và người dùng trước/sau bằng ID và kết quả, không chỉ thấy có file |
| AI-01 | Gemini trả JSON chuẩn | Tạo bài, Zod validate, giáo viên xem và duyệt |
| AI-02 | Gemini trả JSON sai | Không crash/đổ JSON thô ra UI; thông báo tiếng Việt, retry có giới hạn |
| AI-03 | AI sửa văn bản sau khi có câu hỏi | Đáp án và gợi ý phải được rà soát lại và lưu cùng version |
| SEC-01 | Học sinh A dùng ID học sinh B | Server trả permission-denied, không lộ dữ liệu |
| SEC-02 | Giáo viên A truy cập lớp B | Server/Rules từ chối |
| SEC-03 | Gọi API admin bằng teacher token | Từ chối, không ghi dữ liệu |
| SEC-04 | Frontend giả mạo điểm hoặc maxAttempts | Server từ chối hoặc bỏ qua dữ liệu không có thẩm quyền |
| REG-01 | Build + unit + security rules + E2E | Tất cả chạy thành công; log có bằng chứng |
| REG-02 | Browser Admin → Teacher → Student → Report | Thử thực tế với bản ghi mới; bài làm xem lại sau logout/login |

**Quy ước:** chỉ đánh `PASS` khi đã quan sát/đo đạt; `BLOCKED` nếu chưa có giọng vi-VN hoặc chưa có dịch vụ cần thiết; `FAIL` nếu lệch yêu cầu. Phân biệt khả năng thiết bị và lỗi ứng dụng. Giữ ảnh minh chứng và báo cáo dưới thư mục `artifacts/` của dự án.
