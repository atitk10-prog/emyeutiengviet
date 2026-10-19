# EM YÊU TIẾNG VIỆT — Hướng dẫn tạo âm thanh qua Google AI Studio

> Bộ tài liệu dành cho Agent triển khai giao diện trợ giúp trong dự án. Đây là gói hướng dẫn + ảnh chụp do giáo viên cung cấp; **chưa sửa mã nguồn của dự án trên máy người dùng**.

## Phạm vi cuối cùng của gói âm thanh

- Giữ các luồng Gemini TTS và Piper đang có (không tối ưu hoặc viết lại).
- Trong thẻ **Giáo viên thu âm**, chỉ giữ nút **Chọn tệp âm thanh tải lên** (và giao diện xem, nghe thử, đổi, xóa). **Gỡ toàn bộ nút 'Gán mẫu nhanh', 'Giọng cô giáo', 'Piper TTS', 'VieNeu-TTS' làm dữ liệu giả**. Không xóa các tệp mẫu hay bộ máy TTS nếu chúng cần cho kiểm thử/báo cáo, chỉ bỏ cơ chế gắn nhanh khỏi UI.
- Thêm một **tab / panel hướng dẫn 'Tạo giọng đọc với Google AI Studio'** cạnh phần tải lên. Tiếng Việt là mặc định, người dùng chuyển xem nhãn English/Việt.
- Gắn nút **Sao chép bài đọc** (nội dung bài đọc hiện đang biên tập) và **Sao chép hướng dẫn giọng đọc** (style/direction). Không gộp cả hai vào một chuỗi copy.
- Tệp tải lên phải gắn với đúng lesson/version, còn sau tải trang, đăng nhập lại, máy khác cùng hệ thống backend và khởi động lại dịch vụ. Bảo vệ học liệu trước và sau xuất bản.
- Giữ ngưỡng đang công bố trong UI: MP3/M4A tối đa **15 MB**, WAV tối đa **30 MB**. Nếu giới hạn thật của backend thấp hơn, sửa thành thống nhất và ghi rõ; không hiển thị giả.

## Bước 1 — Mở Google AI Studio (Open Google AI Studio)

Truy cập **https://aistudio.google.com/generate-speech** trong trình duyệt, đăng nhập nếu được yêu cầu.

- EN: `Turn text into natural-sounding speech` / VI: `Chuyển văn bản thành giọng nói tự nhiên`.
- EN: `Create new dialog` / VI: `Tạo đoạn thoại mới`.
- Ảnh: `assets/01_aistudio_home.png`.

## Bước 2 — Tùy chọn chuyển giao diện sang tiếng Việt (Optional Chrome translation)

Tại góc phải thanh địa chỉ Chrome, nhấp biểu tượng Google Dịch/Translate nếu hiện, chọn `Tiếng Việt` / `Vietnamese`. Nếu không hiện, mở menu Chrome ⋮ rồi tìm mục Dịch/Translate, tùy phiên bản trình duyệt. Trở lại `Tiếng Anh` / `English` bất cứ lúc nào.

**Lưu ý:** Dịch giao diện bằng Chrome **không đổi ngôn ngữ giọng đọc của mô hình**. Nội dung văn bản mới quyết định ngôn ngữ phát ra; giáo viên phải nghe kiểm tra trước khi tải.

Ảnh: `assets/03_chrome_translate.png`.

## Bước 3 — Chọn một người đọc / một đoạn thoại (Use a single narrator)

Ở trang biên tập, xóa các ví dụ tiếng Anh mặc định, bỏ những khối thoại không cần. Đối với bài đọc thông thường, **chỉ để một người đọc, một bài đọc**; không dùng nhiều người nói trừ khi bài học có hội thoại và giáo viên cố ý chọn.

- EN: `Speaker 1` / VI: `Người nói 1`.
- EN: `Create new dialog` / VI: `Tạo đoạn thoại mới`.
- EN: `Add speech block` / VI: `Thêm khối thoại` — thường không cần với một bài đọc.
- Sao chép văn bản từ EM YÊU TIẾNG VIỆT rồi dán vào ô **transcript**, thay toàn bộ nội dung tiếng Anh ví dụ.

Ảnh: `assets/04_dialog_editor.png`.

## Bước 4 — Chọn giọng đọc và phong cách (Choose voice and style)

- EN: `Speaker settings` / VI: `Cài đặt loa` hoặc `Cài đặt giọng nói`.
- EN: `Voice` / VI: `Giọng nói`; tìm/nghe thử giọng phù hợp qua nút ▶. Ví dụ trên ảnh là giọng Riko, **không mặc định Riko là giọng tiếng Việt tốt nhất**.
- EN: `Style` / `Narration` / `Friendly` / VI: `Phong cách` / `Lời kể` / `Thân thiện` (các nhãn có thể khác tùy thời điểm UI).
- Nhấn phần mô tả phong cách (nếu cho phép chỉnh) và dùng gợi ý dưới đây; **KHÔNG dán chỉ dẫn phong cách vào transcript cần đọc**.

**STYLE PROMPT — VI (dán vào phần hướng dẫn giọng đọc / phong cách nếu hỗ trợ):**

> Đọc nguyên văn bài đọc bằng tiếng Việt tự nhiên, giọng giáo viên tiểu học ấm áp, rõ chữ, thân thiện. Giữ tốc độ hơi chậm và đều từ đầu đến cuối, không bất ngờ tăng tốc. Ngắt nghỉ tự nhiên theo dấu câu, phát âm rõ dấu thanh, không nuốt chữ. Giữ âm lượng đồng đều và nhấn nhẹ các câu quan trọng; không thêm lời giới thiệu, không thêm từ, không thay đổi nội dung, không có nhạc nền hoặc hiệu ứng âm thanh.

**STYLE PROMPT — EN:**

> Read the Vietnamese passage exactly as written in a warm, natural, clear primary-school teacher voice. Maintain a consistent, slightly slow pace throughout without sudden speed changes. Pronounce Vietnamese tones accurately, articulate every word, pause naturally at punctuation, and use gentle emphasis. Keep volume steady. Do not add, omit, or change any words. No introductions, music, or sound effects.

Nếu giao diện chỉ có các lựa chọn phong cách, ưu tiên `Narration` hoặc `Friendly`, rồi nghe thử. Các tùy chọn có thể đổi theo bản cập nhật.

Ảnh: `assets/05_voice_selection.png`, `assets/07_expression_options.png`, `assets/08_style_vietnamese.png`, `assets/09_style_english.png`.

## Bước 5 — Chạy, nghe kiểm tra, tải xuống (Generate, review, download)

- EN: `Run` / VI: `Chạy`, thường ở phía dưới bên phải; hình minh họa có nhãn `Run Ctrl ↵` hoặc `Chạy Điều khiển` (dịch tự động đôi khi khó hiểu).
- Nghe kết quả qua nút ▶ ở thanh phát, kiểm tra **đọc đúng từng từ, tên riêng, dấu thanh, nhịp ổn định, không tiếng Anh xen vào**.
- Nếu lỗi: đổi giọng hoặc chỉnh style, chạy lại theo hạn mức khả dụng của tài khoản.
- Nhấn biểu tượng **tải xuống ↓** ở khu vực trình phát phía dưới để lưu tệp âm thanh. Định dạng thực tế phụ thuộc phiên bản UI/kiểu xuất; có thể dùng WAV rồi chuyển sang MP3 bằng công cụ phù hợp nếu file vượt giới hạn tải của EM YÊU TIẾNG VIỆT.

Ảnh: `assets/06_run_and_download.png`.

## Bước 6 — Gắn âm thanh vào bài đọc EM YÊU TIẾNG VIỆT (Upload to the lesson)

Về trang biên tập bài đọc trong EM YÊU TIẾNG VIỆT:

1. Mở mục **Giáo viên thu âm** → nhấn **Chọn tệp âm thanh tải lên**.
2. Chọn MP3/M4A (≤15 MB) hoặc WAV (≤30 MB), hoặc giới hạn thực đã cấu hình được thông báo trong UI.
3. Chờ thông báo thành công; nghe thử ngay trong trình phát.
4. Nhấn **Phê duyệt & Lưu vào bài học** (nếu hệ thống yêu cầu thao tác này).
5. Tải lại trang (F5), mở lại cùng bài học, rồi đăng nhập học sinh để kiểm tra phát được.

Ảnh: `assets/02_current_upload_panel.png`.

### Tiêu chí chốt nghiệm thu

- [ ] Các nút gán mẫu nhanh đã biến mất; không mất tính năng upload.
- [ ] Tab hướng dẫn hiển thị cả tiếng Việt/English, ảnh có chú thích, có thể phóng to, responsive trên desktop và mobile ~390px.
- [ ] Sao chép bài đọc và sao chép hướng dẫn là 2 nút riêng, thông báo rõ, không ghép style vào transcript.
- [ ] Giáo viên tạo MP3/WAV ngoài Google AI Studio, tải lên, nghe thử, đổi/xóa, phê duyệt.
- [ ] Lưu metadata liên kết chính xác lessonId, versionId, nguồn, checksum hoặc content hash, file path; chỉ lưu metadata vào Firestore, không lưu Base64 audio.
- [ ] F5, logout-login, restart Emulator/web dev server và mở lại bài học vẫn phát audio bình thường từ **cùng backend và volume có dữ liệu**.
- [ ] Học sinh được giao đúng bài mở nghe được, không thể xem khóa đáp án/URL không được phép.
- [ ] Nếu văn bản bài đọc đã thay đổi so với lúc tạo audio, cảnh báo cập nhật bản thu; không tự phát bản thu sai.
- [ ] Giới hạn upload / type / signature thực thi ở cả client và backend; kiểm thử tệp quá lớn/sai định dạng.
- [ ] Không đụng/cập nhật Firestore dataset demo nếu không cần; không tạo tài khoản/lớp mới. Trước và sau thử nghiệm kiểm toán lại 10 lớp / 200 HS / 20 bài (số lượt làm bài đo thực tế, không hardcode).
- [ ] Ứng dụng local lưu âm thanh qua persistent_storage + mirror chỉ là **lưu bền vững ở môi trường local**; để vận hành Cloud thật phải có cơ chế lưu trữ/URL/phân quyền bền vững của Cloud tương ứng (không gọi là đã cloud-ready khi chưa thử).

Lưu ý: Ảnh chụp là giao diện tại thời điểm người dùng ghi hình; bố cục và tên giọng của AI Studio có thể thay đổi. Hướng dẫn cung cấp cả nhãn tiếng Anh và tiếng Việt để người dùng dễ tìm.
