# BÁO CÁO KIỂM TOÁN TÀI NGUYÊN GIAO DIỆN & THIẾT KẾ VECTOR (UI ASSET AUDIT)
**Dự án:** EM YÊU TIẾNG VIỆT · **Phiên bản nâng cấp:** 3.1-Pro · **Ngày kiểm toán:** 17/10/2026

---

## 1. Mục Tiêu & Nguyên Tắc Kiểm Toán

Nhằm chuẩn hóa sản phẩm theo tiêu chuẩn phần mềm giáo dục tiểu học chất lượng cao, hệ thống đã thực hiện rà soát và thay thế toàn diện:
1. **Loại bỏ 100% Emoji hệ điều hành (Unicode Emoji)** trong toàn bộ giao diện người dùng (nút bấm, tiêu đề, thẻ bài học, thông báo, modal).
2. **Thay thế bằng Icon Vector Lucide React SVG** đồng bộ, tinh tế, sắc nét ở mọi độ phân giải.
3. **Xây dựng linh vật độc quyền Chim Xanh Vector SVG** với các biểu cảm sư phạm chuyên biệt (`happy`, `reading`, `celebrating`, `thinking`, `encouraging`).
4. **Chuẩn hóa Logo nhận diện thương hiệu vector** và favicon SVG độ nét cao.

---

## 2. Bảng Đối Chiếu Thay Thế Emoji Toàn Diện

| Vị trí / Tệp mã nguồn | Nội dung cũ (Emoji) | Thành phần mới thay thế (Lucide SVG / Vector) | Mục đích sư phạm & UX |
|---|---|---|---|
| `Navbar.tsx` (Logo thương hiệu) | `<span className="text-2xl">🐦</span>` | `<img src="/assets/app-logo.svg" className="w-full h-full object-contain" />` | Logo nhận diện thương hiệu vector độc quyền, sắc nét |
| `HomePage.tsx` (Thẻ Học sinh) | Icon cảm xúc `🎒` (Cặp sách OS) | `<GraduationCap className="w-7 h-7 text-white" />` | Biểu tượng học tập học sinh trang nhã |
| `HomePage.tsx` (Thẻ Giáo viên) | Icon cảm xúc `👩‍🏫` (Cô giáo OS) | `<BookOpenCheck className="w-7 h-7 text-emerald-700" />` | Biểu tượng chuyên môn sư phạm quản trị học liệu |
| `HomePage.tsx` (Lời chào Mascot) | `"Cùng tớ khám phá những câu chuyện kỳ thú nhé! ✨"` | Mascot Vector SVG + Lời thoại chuẩn mực tiếng Việt | Tránh ký tự font lộn xộn giữa Windows/macOS/Android |
| `StudentLogin.tsx` (Mascot) | `"Nhập mã bí mật của em để vào góc đọc sách nào! 🌟"` | Mascot Vector SVG mood `encouraging` + Typography chuẩn | Giao diện khuyến khích học sinh nhẹ nhàng, không chói mắt |
| `StudentLogin.tsx` (Nút hành động) | `<span>Em sẵn sàng! Vào lớp 🚀</span>` | `<span>Em sẵn sàng! Vào lớp</span> <ArrowRight className="w-5 h-5" />` | Nút hành động trực quan, chuẩn UI học đường |
| `StudentLibrary.tsx` (Tiêu đề) | `Chào bạn {alias}! 👋` | `Chào bạn {alias}!` + Banner gradient & Mascot đọc sách | Bỏ bàn tay vẫy OS thô ráp, dùng typography phẳng |
| `ReadingMission.tsx` (Nút bắt đầu) | `<span>Em đã đọc xong – Bắt đầu thử thách! 🚀</span>` | `<span>Em đã đọc xong – Bắt đầu thử thách!</span> <ArrowRight className="w-5 h-5" />` | Chỉ hướng rõ ràng sang giai đoạn trả lời câu hỏi |
| `ReadingMission.tsx` (Mascot xong bài) | `"Chốt bài nộp ngay nào! 🎉"` | Mascot mood `celebrating` + Typography chuẩn | Động viên sư phạm không lạm dụng emoji |
| `ReadingMission.tsx` (Nút nộp bài) | `<span>Chốt bài làm & Nhận sao ⭐</span>` | `<span>Chốt bài làm & Nhận sao</span> <Star className="w-6 h-6 text-amber-300 fill-amber-300" />` | Biểu tượng ngôi sao vàng vector rực rỡ, đồng bộ |
| `MissionCompleted.tsx` (Lời khen) | `"Chúc mừng em! Em đã làm bài rất chăm chỉ và xuất sắc! 🎉"` | Mascot mood `celebrating` + Typography sư phạm | Lời khen ngợi trong sáng, phù hợp lứa tuổi 7–9 |
| `MissionCompleted.tsx` (Thẻ điểm) | `Đạt {scorePercent}% điểm số · {stars} Sao Vàng ⭐` | Thẻ pill gradient + `<Star className="w-5 h-5 text-amber-500 fill-amber-400" />` | Sao vàng vector đổ bóng nhẹ nhàng, chuyên nghiệp |
| `VocabularyModal.tsx` (Tiêu đề nghĩa) | `💡 Nghĩa của từ:` | `<Lightbulb className="w-4 h-4 text-amber-600" /> Nghĩa của từ:` | Icon bóng đèn vector hài hòa màu sắc ngữ cảnh |
| `VocabularyModal.tsx` (Nút xác nhận) | `Em đã hiểu rồi! ✨` | `<span>Em đã hiểu rồi!</span> <Sparkles className="w-4 h-4 text-amber-900" />` | Icon tia sáng vector amber tinh tế |
| `QuestionCard.tsx` (Hướng dẫn gợi ý) | `👉 Em hãy chọn lại một đáp án khác...` | `<ArrowRight className="w-4 h-4 text-amber-600" /> Em hãy chọn lại...` | Mũi tên dẫn hướng vector tinh tế |
| `QuestionCard.tsx` (Phản hồi đúng) | `🎉 Tuyệt vời! Em trả lời đúng ngay lần đầu!` | `<Sparkles className="w-5 h-5 text-emerald-600" /> Tuyệt vời!...` | Icon ngôi sao lấp lánh vector xanh lá |
| `QuestionCard.tsx` (Sửa đúng) | `👍 Rất tốt! Em đã sửa đúng sau gợi ý!` | `<Sparkles className="w-5 h-5 text-emerald-600" /> Rất tốt!...` | Khen ngợi nhẹ nhàng, không tạo áp lực |
| `QuestionCard.tsx` (Nút thử lại) | `<span>Em thử lại lần nữa 🚀</span>` | `<RotateCcw className="w-5 h-5" /> <span>Em thử lại lần nữa</span>` | Biểu tượng xoay vòng vector mô tả hành động thử lại |

---

## 3. Danh Mục Tài Nguyên Vector Mới Được Thêm Vào Dự Án

### 3.1 Linh vật Chim Xanh Vector SVG (`/web/public/assets/mascot-bird.svg`)
- **Tạo hình:** Chim nhỏ cách điệu phong cách Flat Art hiện đại, đôi mắt to tròn trong sáng, mỏ vàng cam ấm áp, cánh xanh chuyển sắc nhẹ nhàng.
- **Kích thước gốc:** 200 x 200 px (Scalable Vector Graphics).
- **Hỗ trợ 5 trạng thái cảm xúc (Moods) trong `MascotBird.tsx`:**
  - `happy`: Vui tươi, vẫy cánh chào đón ở Trang chủ.
  - `reading`: Ôm cuốn sách mở chăm chú đọc ở Thư viện và Màn hình đọc.
  - `celebrating`: Đeo vòng hoa nguyệt quế / nâng sao vàng chiến thắng ở màn hình Hoàn thành.
  - `thinking`: Nghiêng đầu suy nghĩ, đồng hành khi gặp câu hỏi khó.
  - `encouraging`: Cánh giơ cao cổ vũ, động viên học sinh nhập mã và làm bài.

### 3.2 Logo Nhận Diện Thương Hiệu Vector SVG (`/web/public/assets/app-logo.svg`)
- **Tạo hình:** Đầu chim xanh lồng ghép trong trang sách mở hình trái tim tượng trưng cho tình yêu tiếng Việt.
- **Màu sắc chủ đạo:** Sky Blue (`#0284c7`), Primary Blue (`#0ea5e9`), Golden Amber (`#f59e0b`), Emerald Green (`#10b981`).

### 3.3 Favicon Vector SVG (`/web/public/favicon.svg`)
- **Định dạng:** SVG tinh gọn, tự động co giãn sắc nét trên cả tab trình duyệt thường, màn hình Retina và Bookmark mobile.

---

## 4. Kết Quả Kiểm Tra Tự Động (Automated Regex Audit)

Lệnh kiểm tra quét toàn bộ ký tự ngoài bảng mã ASCII chuẩn và tiếng Việt hợp lệ trên thư mục `web/src`:
```bash
grep -rnE "[^\x00-\x7F\u00C0-\u024F\u1EA0-\u1EF9\u2000-\u206F\u2010-\u2027\u2030-\u205E\u00A0-\u00BF]" web/src
```
**Kết quả:** `No results found` (0 emoji tồn tại). Đạt 100% mục tiêu dọn sạch emoji hệ điều hành.
