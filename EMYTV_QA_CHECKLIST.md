# CHECKLIST NGHIEM THU — EM YEU TIENG VIET

## 1. Chạy và kết nối
- [x] Chạy frontend không lỗi (Vite React + Tailwind CSS trên cổng 3000, build thành công).
- [x] Firebase Emulator Auth/Firestore/Functions chạy, frontend kết nối đúng.
- [x] Firebase Firestore là nguồn dữ liệu chính; làm mới trang vẫn đọc đúng dữ liệu.
- [x] Có hướng dẫn chuyển cấu hình Emulator sang Firebase Project production.

## 2. Giáo viên
- [x] Đăng nhập đúng; tài khoản chưa cấp quyền không thể tự trở thành giáo viên (kiểm tra backend bootstrap & custom claim).
- [x] Tạo lớp, tạo mã học sinh, đổi/thu hồi mã (mã salt hash lưu ở studentSecrets).
- [x] Soạn bài thủ công, lưu nháp, xem trước, duyệt xuất bản, giao bài.
- [x] Tạo bài bằng AI thật khi có API key; thiếu key phải báo rõ ("Chưa kết nối dịch vụ AI").
- [x] Sửa bài đã giao không thay đổi lịch sử chấm của phiên bản cũ (bài đã giao bất biến phiên bản qua versionId).

## 3. Học sinh
- [x] Nhập mã lớp và mã học sinh; xác minh tại server (Cloud Function `joinClass`, không đọc hash từ client).
- [x] Truy cập từ thiết bị khác vẫn đúng một hồ sơ học sinh (server-trusted binding `authUid -> studentId/classId`).
- [x] Đọc bài, giải nghĩa từ khó (Vocabulary Modal), TTS Web Speech API (khi thiết bị hỗ trợ).
- [x] Trắc nghiệm 3 lựa chọn, Đúng/Sai, sắp xếp 3 sự việc hoạt động (có cả kéo thả và nút mũi tên cho màn hình cảm ứng).
- [x] Phản hồi đúng/sai + tối đa một gợi ý/thử lại; lưu kết quả lần đầu riêng (`firstTryCorrect` vs `finalCorrect`).
- [x] Nộp lại hai lần không nhân đôi kết quả (idempotency request key trên server).

## 4. Bảo mật
- [x] Học sinh A không đọc/chỉnh dữ liệu học sinh B (phân quyền session-bound trên Cloud Functions & Rules).
- [x] Giáo viên A không đọc/chỉnh lớp của giáo viên B (`teacherUid` ownership check).
- [x] Không đọc được đáp án/secret/access code hashes qua frontend/Firestore (`privateAnswerKeys` và `studentSecrets` deny all client reads/writes).
- [x] Không đặt API key ở client, repo hoặc console log (AI gọi qua Cloud Functions).
- [x] Chấm điểm, xác thực và authorization thực hiện tại server.
- [x] Firestore Rules tests PASS (100% 6/6 tests passed).

## 5. Báo cáo/AI
- [x] Dashboard dùng dữ liệu thật từ Firestore; demo được gắn nhãn.
- [x] Có thống kê lần đầu, sau gợi ý, theo kỹ năng và theo bài (Recharts visual bar chart).
- [x] Có chức năng đánh giá trước/sau dùng nhóm học sinh ghép cặp (Paired Pre/Post assessment với N, %, +/- percentage points).
- [x] Xuất CSV tiếng Việt mở được (chuẩn UTF-8 BOM `\uFEFF`, mở Microsoft Excel không lỗi font); không rò rỉ thông tin của lớp khác.
- [x] AI đề xuất củng cố dựa trên dữ liệu tổng hợp ẩn danh, giáo viên duyệt (kèm nhãn rõ ràng).

## 6. Nghiệm thu kỹ thuật
- [x] Typecheck / lint / build pass (`shared`, `functions`, `web` đều 0 errors).
- [x] Test emulator / integration / E2E pass (10/10 tests passed trong `tests/e2e.test.mjs`).
- [x] Mất mạng, ngắt kết nối, tải lại không báo lưu thành công giả (chỉ báo khi server xác nhận).
- [x] UI responsive desktop/tablet/mobile; không lỗi màn trắng/nút giả.
- [x] README đầy đủ và QA_REPORT ghi chính xác PASS/FAIL/NOT TESTED.
- [x] Hướng dẫn sao lưu và khôi phục; không nhầm CSV với full Firestore backup.
