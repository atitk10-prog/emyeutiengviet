# PROMPT GỬI AGENT — CHỐT GÓI ÂM THANH EM YÊU TIẾNG VIỆT

Bạn là kỹ sư full-stack Firebase / React TypeScript phụ trách **GÓI ÂM THANH CUỐI DỰ ÁN**. Trước khi thay đổi, hãy đọc `GUIDE_CONTENT.md` trong gói thư mục này và đối chiếu các ảnh trong `assets/` với UI thực tế. Đọc code `web/src/components/LessonAudioPanel.tsx`, các điểm gọi ở `TeacherDashboard.tsx`, `AudioReader.tsx`, backend upload/storage, bài học/phiên bản, và pipeline xuất bản. KHÔNG dựa vào báo cáo cũ để kết luận đã đạt.

## Mục tiêu giao diện

1. Trong vùng `Giáo Viên Thu Âm`, **bỏ dãy nút Gán mẫu nhanh** (`Giọng cô giáo`, `Piper TTS`, `VieNeu-TTS`). Chỉ giữ chọn tệp âm thanh tải lên + nghe thử + lưu/phê duyệt + đổi/xóa. Không tự động gán bài đọc mẫu.
2. Giữ nguyên các engine Gemini TTS và Piper hiện hoạt động, không viết lại, không cải tiến gây rủi ro; giáo viên có thể dùng hoặc không dùng chúng. Không làm biến mất chức năng đang chạy khác.
3. Thêm tab/trợ giúp `Hướng dẫn tạo giọng đọc với Google AI Studio` ở phần âm thanh. Hướng dẫn **6 bước** chi tiết theo `GUIDE_CONTENT.md`, trình bày song ngữ `Tiếng Việt | English` (ưu tiên Việt); có ảnh minh họa thực của người dùng từ assets, mô tả thay thế và phóng to. Nút `Mở Google AI Studio` dẫn tới `https://aistudio.google.com/generate-speech`.
4. Thêm `Sao chép bài đọc` (sao chép chính xác passage hiện tại), `Sao chép gợi ý giọng đọc` (chỉ style prompt, song ngữ). Hướng dẫn **không dán prompt style vào transcript**. Có thông báo thành công/thất bại.
5. Thêm hướng dẫn đổi ngôn ngữ giao diện Chrome, nhắc rõ dịch trình duyệt không thay đổi ngôn ngữ âm thanh và các tên nút AI Studio có thể đổi.
6. Tương thích mobile 375–390 px, tablet, desktop; tránh modal lệch/lệch scroll hay chữ ảnh không đọc được.

## Tiêu chí chất lượng âm thanh & lưu trữ

1. Giới hạn tệp hiện theo UI là MP3/M4A ≤15MB, WAV ≤30MB; xác thực định dạng/byte/header và giới hạn backend thật. Nếu không đáp ứng được 30 MB qua cách upload hiện tại, sửa giải pháp upload/hiển thị giới hạn theo thực tế, không hứa giả.
2. File phải gắn với đúng bài và phiên bản; lưu trữ **binary trên đĩa/Storage** và **chỉ metadata trên Firestore**; tuyệt đối không base64 trong Firestore. Không làm mất các file cũ.
3. Lưu/phê duyệt xong, F5, logout/login, restart server và học sinh mở bài đều nghe được; đổi/xóa bài không xóa nhầm âm thanh của phiên bản cũ còn sử dụng.
4. Nội dung bài đọc sửa khác hash bản thu phải cảnh báo cần nghe/dựng lại; không lặng lẽ phát bản cũ sai văn bản.
5. Giữ cơ chế bảo vệ dữ liệu học sinh/giáo viên, quyền owner của bài. Không công khai URL của tệp riêng nếu chưa có kiểm tra quyền.

## Kiểm thử bắt buộc, báo cáo thật

- Sao lưu trước khi sửa. Không reset Firestore/Auth, không xóa demo, không tạo thêm hàng loạt dữ liệu. Đếm lại dataset trước/sau (tham chiếu 10 lớp, 200 HS, 20 bài; attempts phải đo thật, có thể thay đổi do test được phép).
- Chạy build web/functions và những test hiện có liên quan; thực hiện E2E thao tác **tệp giáo viên tải từ ngoài** → nghe → phê duyệt → refresh → học sinh nghe trên desktop & mobile.
- Kiểm thử âm thanh WAV/MP3, sai extension/MIME, >dung lượng, lỗi mạng, thay file, xóa và quay lại trang.
- Kiểm tra mỗi ảnh thực tế trong tab hiển thị trên mobile; thử Chrome English và Chrome Translate Vietnamese.
- Không gọi API Gemini dư thừa, không yêu cầu tạo API key mới, không deploy Cloud khi chưa được người dùng cho phép.
- Báo cáo rõ mỗi điều đạt `PASS` / `FAIL` / `BLOCKED`, kèm file đổi, lệnh test, link/ảnh minh chứng thực tế. Không ghi '100% hoàn thiện' nếu còn lỗi hoặc chỉ dựa test tự động.

**Chỉ thực hiện GÓI ÂM THANH và hướng dẫn AI Studio. Không mở rộng trò chơi hoặc thiết kế lại dashboard. Hoàn thành gói này để chuyển sang chuẩn bị slide/video/poster dự thi.**
