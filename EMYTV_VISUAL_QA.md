# EM YÊU TIẾNG VIỆT — CHECKLIST UI & RELEASE

## Trực quan
- [ ] Không còn emoji hệ điều hành làm icon logo, header, button, feature cards, mascot, student library, reading screens, teacher dashboard, success screen.
- [ ] Logo, favicon, chim mascot SVG đồng bộ và có quyền sử dụng.
- [ ] Có illustrations theo chủ đề học sinh lớp 2–3, không ảnh sai độ tuổi hoặc watermark.
- [ ] Trang chủ cân đối desktop 1440x900, mobile 390x844.
- [ ] 2 CTA chính rõ ràng; nút lớn; font tiếng Việt đúng dấu; không tràn chữ.
- [ ] Học sinh có thư viện, bài đọc, câu hỏi, tổng kết với cùng hệ thống màu/icon.
- [ ] Dashboard giáo viên có empty state hướng dẫn khi chưa dữ liệu; biểu đồ không rỗng vô nghĩa.
- [ ] Reduced motion, keyboard focus, alt, nhãn icon, tương phản được kiểm tra.

## Số liệu & tính đúng
- [ ] Khi 0 attempts: KHÔNG hiển thị +16% tiến bộ, phần trăm giả, kết luận chưa có mẫu.
- [ ] Pre/post so sánh ghép đúng hồ sơ và tiêu chí; có N; không coi sửa đúng sau gợi ý là tiến bộ dài hạn.
- [ ] Phân biệt dữ liệu Emulator, seed demo và production, không tạo dữ liệu giả như dữ liệu học sinh thật.
- [ ] 6 bài seed gọi lặp không tạo bản sao vô hạn.

## AI và dữ liệu
- [ ] Không hardcode gemini-1.5-flash; model cấu hình và đã kiểm tra khả dụng bằng API nếu có key.
- [ ] Nếu thiếu API key, UI hiển thị trạng thái chính xác và soạn thủ công vẫn chạy.
- [ ] Teacher role không thể tự nâng bằng bootstrapTeacherRole.
- [ ] Nút demo đăng nhập chỉ hiện trong dev/emulator, không ở production.
- [ ] Student PIN có chống brute force, rate limiting, mã riêng; không lộ secrets.
- [ ] Không lộ đáp án trước khi chấm; chấm tại Cloud Functions; Firestore Security Rules test đầy đủ.
- [ ] Có lưu/đọc Firestore Emulator đúng; thử đăng nhập và tải lại; chống nộp trùng.
- [ ] Giọng đọc Web Speech phụ thuộc thiết bị, có fallback, không ghi “chuẩn” khi chưa kiểm chứng.

## Kiểm thử & bàn giao
- [ ] npm run build thành công và ghi log.
- [ ] Unit/rules/e2e chạy thực tế và ghi PASS/FAIL (không sao chép từ báo cáo cũ).
- [ ] Browser test giáo viên -> học sinh -> kết quả -> giáo viên.
- [ ] Ảnh chụp trang chủ, dashboard empty, thư viện, làm bài, tổng kết ở desktop/mobile.
- [ ] Cập nhật UI_ASSET_AUDIT.md, UI_UPGRADE_REPORT.md, QA_REPORT.md, README.md.
- [ ] Ghi rõ Emulator hay Firebase Cloud, AI gọi API thật hay chưa, phần chưa hoàn thiện.
