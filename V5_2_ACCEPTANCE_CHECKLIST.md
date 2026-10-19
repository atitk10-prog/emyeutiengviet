# EM YÊU TIẾNG VIỆT V5.2 — CHECKLIST NGHIỆM THU

## P0 – Bắt buộc trước khi làm slide / video
- [ ] V5.1: `V5_1_SECURITY_UX_AUDIT.md` hoàn thành, dựa trên bằng chứng, không suy diễn.
- [ ] Có backup dữ liệu emulator và snapshot các tệp liên quan trước khi sửa.
- [ ] Build `shared`, `functions`, `web` không lỗi.
- [ ] GV tạo nháp 5 câu, F5 và mở lại đúng bài.
- [ ] GV thêm 3 câu; xóa/nhân bản/đổi thứ tự; số câu cập nhật đúng mọi nơi.
- [ ] Hệ thống chấm 8–10 câu đúng backend và biểu đồ đúng mẫu số.
- [ ] Câu hỏi thiếu/mâu thuẫn đáp án bị chặn publish.
- [ ] Phiên bản bài đã giao bất biến; chỉnh sửa tạo version mới và giữ điểm lịch sử.
- [ ] Giao lại cùng version/cùng đợt không tạo bản ghi trùng, kể cả 2 request song song.
- [ ] GV vẫn có thể chủ động tạo đợt giao mới sau xác nhận.
- [ ] Bài có kết quả chỉ được lưu trữ, không hard-delete mất dữ liệu.
- [ ] Đúng phân quyền GV A, GV B, Admin, học sinh; không lộ đáp án trước khi cho phép review.
- [ ] HS đọc → trả lời → nộp → xem lại; F5 không mất bài/chỉ số lần làm đúng.
- [ ] UAT browser desktop/mobile có ảnh minh chứng; dữ liệu thử không chứa trẻ em thật.

## P1 – Có thể làm sau khi P0 ổn
- [ ] AI thêm 1–5 câu vào draft hiện có, không tự publish/thay văn bản.
- [ ] Phản hồi AI được kiểm định và giáo viên duyệt.
- [ ] Giọng đọc Việt / file do GV cung cấp được phát thử và cập nhật an toàn.
- [ ] Dashboard có số liệu thật: số HS hoàn thành, đúng lần đầu, đúng sau gợi ý, theo kỹ năng.
- [ ] Có báo cáo minh chứng và kế hoạch quay màn hình thực.

## Không thuộc bản V5.2
- Trò chơi phức tạp, đánh giá tự động mọi dạng trả lời mở, đọc toàn bộ 10 cuốn SGK, tự mở Cloud Production.

**Chỉ báo PASS khi có kết quả chạy thực tế; thiếu log/bằng chứng ghi NOT TESTED.**
