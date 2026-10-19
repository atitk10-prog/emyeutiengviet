# EM YÊU TIẾNG VIỆT — RELEASE GATES

| Cổng | Điều kiện | Bằng chứng tối thiểu | Khi chưa đạt |
|---|---|---|---|
| G1: Core | Giáo viên tạo/duyệt/giao bài; học sinh đăng nhập riêng/làm/chấm; dashboard đúng | E2E bằng Emulator và ảnh luồng web | FAIL/BLOCKED |
| G2: An toàn dữ liệu | Quyền GV/HS, secret/answer key, idempotency, rate limits, versioning, không rò PII | Rules tests + Function auth tests, không có key trong client | FAIL |
| G3: AI thật | API key thật được lưu server-side, live call hợp lệ, bản nháp JSON đúng schema, giáo viên duyệt | HTTP status/model/timestamp đã làm mờ thông tin nhạy cảm, một bài AI thật | BLOCKED khi chưa có key |
| G4: Cloud staging | Firebase Hosting + Auth + Firestore + Functions cùng một project, rollback, xem dữ liệu sau refresh, bảo vệ chi phí | URL + smoke tests + IAM/config + billing monitoring | BLOCKED khi chưa cấp quyền Blaze/deploy |

## Checklist ngắn

- [ ] Build all workspaces PASS.
- [ ] Firestore rules tests cho truy cập sai lớp, ẩn danh, đọc answer key PASS.
- [ ] Cloud Functions tự kiểm tra auth + role PASS.
- [ ] Rate limit thử sai không khóa cả lớp vì một tác nhân xấu.
- [ ] Không lộ Gemini key, admin secret, đáp án hoặc dữ liệu cá nhân học sinh.
- [ ] Có bộ 6 bài seed và các fixtures kiểm tra với kết quả đúng.
- [ ] Tạo bài AI live 1 lần có kiểm chứng (chưa có key thì BLOCKED).
- [ ] Gián đoạn mạng và gửi đáp án hai lần không mất/nhân đôi dữ liệu.
- [ ] Không hiển thị thống kê tăng điểm giả khi chưa có dữ liệu.
- [ ] Tất cả ảnh/mobile không tràn chữ và giữ bộ SVG đã hoàn thiện.
- [ ] Test staging chỉ dùng dữ liệu giả, không ghi học sinh thật.
- [ ] Cloud deploy chỉ thực hiện sau chấp thuận nâng cấp Blaze và ngân sách.

*100% test pass chỉ áp dụng cho các case đã chạy; không suy ra toàn hệ thống không có lỗi.*
