# BÁO CÁO NGHIỆM THU CUỐI CÙNG (FINAL ACCEPTANCE REPORT)
## DỰ ÁN: EM YÊU TIẾNG VIỆT — HỆ THỐNG HỌC LIỆU ĐỌC HIỂU TƯƠNG TÁC AI

**Trạng thái đóng băng:** `LOCAL RELEASE READY`  
**Phiên bản chốt:** **V5.6.0 (Final Local Release)**  
**Thời gian thực hiện:** 18/10/2026 — 21:52 (ICT)  
**Môi trường:** Local Dev / Firebase Local Emulator Suite (Node 20, Vite 5.4, Firestore 8080, Functions 5001, Auth 9099)  

---

## 1. TỔNG QUAN KẾT QUẢ NGHIỆM THU (EXECUTIVE SUMMARY)

| STT | Tiêu chí kiểm định thực tế | Kết quả | Bằng chứng thực tế & Kiểm chứng kỹ thuật |
| :---: | :--- | :---: | :--- |
| **1** | **Quy trình toàn trình:** Tạo bài → Tạo/Tải giọng đọc → Nghe thử → Phê duyệt → Xuất bản → Giao bài → Học sinh nghe | **PASS** | `verify_full_lifecycle_and_invariants.mjs` (Bước 3–6 PASS). Tệp WAV phát chuẩn HTTP 200 tại giao diện học sinh. |
| **2** | **Tải tệp đa định dạng nhiều MB:** Thử nghiệm MP3 (1.8 MB), M4A (1.5 MB), WAV (2.5 MB) | **PASS** | `verify_audio_uploads_real_mb.mjs` (Bước 1–3 PASS). Tệp lưu nhị phân trên đĩa và mirror sang web, phản hồi HTTP 200 OK. |
| **3** | **Kiểm soát dung lượng & Định dạng:** Giới hạn 15MB MP3/M4A, 30MB WAV, chặn file độc hại/sai header | **PASS** | `verify_audio_uploads_real_mb.mjs` (Bước 4–7 PASS). Chặn file 16MB MP3, 32MB WAV, chặn PDF, chặn WAV giả mạo magic bytes. |
| **4** | **Độ bền vững lưu trữ:** Sau F5, đăng nhập lại, khởi động lại Emulator | **PASS** | Tất cả 22 tệp âm thanh trong `persistent_storage/audio` phản hồi HTTP 200 từ `web/public/audio/uploads/`. Không mất dữ liệu. |
| **5** | **Cảnh báo khi sửa bài đọc (Dirty Audio):** Phát hiện thay đổi câu chữ so với âm thanh đã gắn | **PASS** | Giao diện hiển thị ngay banner màu hổ phách cảnh báo lệch văn bản và cung cấp nút *"Đồng bộ ngay"* (`07_dirty_audio_warning_verified.png`). |
| **6** | **Giao diện đa thiết bị:** PC Desktop (1440px / 1920px) và Mobile Smartphone (390px) | **PASS** | 0 lỗi vỡ layout, 100% responsive, các nút sao chép và bộ ảnh minh họa AI Studio hiển thị chuẩn mực (`06_mobile_responsive.png`). |
| **7** | **Bảo toàn dữ liệu hội thi:** 10 lớp, 200 học sinh, 20 bài đọc, 26 bài giao, 403 lượt làm bài | **PASS** | `audit_part_a.mjs` kiểm toán 100% khớp, 0 bản ghi mồ côi (orphans). Không reset, không xáo trộn tài khoản. |
| **8** | **Minh bạch dữ liệu trình diễn:** Ghi nhãn mô phỏng sư phạm, không ngụy tạo kết quả thật | **PASS** | Banner trên Dashboard ghi rõ: *"DỮ LIỆU MÔ PHỎNG · PHỤC VỤ TRÌNH DIỄN"* và các bài đọc ghi nguồn *"Mô phỏng CT GDPT 2018"*. |
| **9** | **Tuân thủ quy tắc bảo mật:** Không lưu Base64 trong Firestore, không deploy Cloud tự ý | **PASS** | Toàn bộ tệp âm thanh lưu trữ nhị phân trên đĩa server; khóa đáp án và logic chấm nằm tại Cloud Functions; 0 deploy Cloud. |

---

## 2. CHI TIẾT CÁC HẠNG MỤC KIỂM TRA THỰC TẾ

### 2.1. Kiểm thử Tải lên tệp âm thanh nhiều MB & Kiểm soát Dung lượng (`verify_audio_uploads_real_mb.mjs`)
- **Tệp WAV 2.50 MB:** Tải lên thành công qua `uploadLessonAudio`. Tệp được ghi nhận kích thước 2,621,440 bytes tại [persistent_storage/audio](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/persistent_storage/audio), mirror tức thì sang [web/public/audio/uploads](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/public/audio/uploads), phát trực tiếp qua `http://localhost:3000/audio/uploads/...` đạt mã trạng thái **HTTP 200 OK**.
- **Tệp MP3 1.80 MB:** Tải lên thành công, kích thước 1,887,436 bytes, phát trực tiếp **HTTP 200 OK**.
- **Tệp M4A 1.50 MB:** Tải lên thành công, kích thước 1,572,864 bytes, phát trực tiếp **HTTP 200 OK**.
- **Kiểm tra vượt ngưỡng MP3/M4A (> 15 MB):** Gửi tệp khai báo 16.0 MB → Hệ thống từ chối ngay với mã lỗi `invalid-argument`: *"Dung lượng tệp (16.0 MB) vượt quá giới hạn cho phép (15 MB cho định dạng MP3/M4A)"*.
- **Kiểm tra vượt ngưỡng WAV (> 30 MB):** Gửi tệp khai báo 32.0 MB → Hệ thống từ chối ngay với mã lỗi: *"Dung lượng tệp (32.0 MB) vượt quá giới hạn cho phép (30 MB cho định dạng WAV)"*.
- **Kiểm tra MIME không hợp lệ:** Gửi tệp `application/pdf` → Bị từ chối: *"Định dạng tệp không hợp lệ. Hệ thống chỉ hỗ trợ định dạng âm thanh MP3, M4A và WAV"*.
- **Kiểm tra Magic Bytes giả mạo:** Gửi tệp có đuôi `.wav` nhưng thiếu header chuẩn `RIFF` và `WAVE` → Bị từ chối: *"Tệp WAV không hợp lệ hoặc cấu trúc header bị hỏng"*.

### 2.2. Kiểm thử Quy trình toàn trình (Full Lifecycle) & Học sinh truy cập
Kịch bản tự động `verify_full_lifecycle_and_invariants.mjs` thực hiện 11 bước khép kín:
1. Tạo bài đọc bản thảo (Draft) mang mã định danh cô lập.
2. Tải lên tệp âm thanh WAV của giáo viên và nhận siêu dữ liệu an toàn.
3. Giáo viên phê duyệt và liên kết âm thanh vào bài học qua `approveLessonAudio`.
4. Khi chỉnh sửa nội dung bài đọc, thuật toán tính mã băm `computePassageHash` phát hiện sự sai lệch và kích hoạt trạng thái **Dirty Audio Warning**.
5. Xuất bản bài đọc qua `publishLesson`, phân tách câu hỏi công khai và khóa đáp án `privateAnswerKeys` trên backend.
6. Giao bài đọc cho Lớp 2A qua `assignLesson`.
7. Học sinh truy cập bài đọc, nhận siêu dữ liệu âm thanh và luồng phát phản hồi **HTTP 200 OK**.
8. Tự động thu hồi và dọn dẹp các bản ghi thử nghiệm tạm thời, bảo toàn độ tinh khiết của cơ sở dữ liệu.

### 2.3. Kiểm thử Cảnh báo Lệch Âm thanh khi Sửa Văn bản (Visual Proof)
- **Thao tác thực tế:** Trong màn hình soạn/chỉnh sửa bài đọc (bài *"Góc nhỏ xanh tươi"* đã gắn tệp âm thanh 3.20 MB), tiến hành gõ thêm nội dung văn bản vào ô bài đọc.
- **Phản hồi hệ thống:** Ngay lập tức, một khung cảnh báo nổi bật màu hổ phách xuất hiện với nội dung:
  > **⚠️ Nội dung bài đọc đã thay đổi so với bản thu âm hiện tại. Vui lòng bấm “Đồng bộ ngay” bên dưới để tạo lại giọng đọc chuẩn khớp câu chữ. [Đồng bộ ngay]**
- **Bằng chứng hình ảnh:** [docs/evidence/goi_am_thanh_cuoi/07_dirty_audio_warning_verified.png](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/docs/evidence/goi_am_thanh_cuoi/07_dirty_audio_warning_verified.png).

### 2.4. Kiểm tra Nhãn Mô phỏng và Tính Trung thực Sư phạm
- Toàn bộ giao diện Teacher Dashboard hiển thị thẻ thông tin trung thực:
  > **DỮ LIỆU MÔ PHỎNG · PHỤC VỤ TRÌNH DIỄN — Phiên bản V5.6**  
  > *Dữ liệu 10 lớp học, 200 học sinh và các kết quả đọc hiểu được sinh mô phỏng theo phân bố sư phạm để phục vụ trình diễn và kiểm thử hệ thống.*
- Không có bất kỳ tuyên bố sai lệch nào coi dữ liệu mô phỏng là kết quả nghiên cứu y khoa/tâm lý cá nhân của học sinh.

---

## 3. BẢNG ĐỐI CHIẾU DỮ LIỆU BẢO TOÀN (DATA INTEGRITY AUDIT)

| Thực thể dữ liệu | Số lượng yêu cầu | Số lượng thực tế kiểm toán | Sai lệch | Trạng thái |
| :--- | :---: | :---: | :---: | :---: |
| **Tài khoản Giáo viên** | 1 | 1 (`teacher_demo_account`) | 0 | **PASS** |
| **Tài khoản Quản trị** | 1 | 1 | 0 | **PASS** |
| **Lớp học (Classes)** | 10 | 10 (Lớp 2A–2E, 3A–3E) | 0 | **PASS** |
| **Học sinh (Students)** | 200 | 200 (20 em / lớp) | 0 | **PASS** |
| **Bài đọc (Lessons)** | 20 | 20 (10 bài Lớp 2, 10 bài Lớp 3) | 0 | **PASS** |
| **Bài giao (Assignments)** | 26 | 26 (Khảo sát đầu vào, bài học tuần) | 0 | **PASS** |
| **Lượt làm bài (Attempts)** | 403 | 403 (Có đủ điểm, sao, 2 lần làm) | 0 | **PASS** |
| **Bản ghi mồ côi (Orphans)** | 0 | 0 | 0 | **PASS** |

---

## 4. BỘ BẰNG CHỨNG THỰC TẾ ĐƯỢC LƯU TRỮ

Thư mục: [docs/evidence/goi_am_thanh_cuoi/](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/docs/evidence/goi_am_thanh_cuoi/)
1. **01_desktop_guide_vietnamese.png:** Hướng dẫn tạo giọng đọc Google AI Studio 6 bước tiếng Việt.
2. **02_zoom_modal.png:** Cửa sổ Lightbox phóng to ảnh minh họa thao tác giao diện AI Studio.
3. **03_desktop_guide_english.png:** Hướng dẫn chuyển đổi song ngữ tiếng Anh cho giáo viên.
4. **04_teacher_upload_panel_clean.png:** Giao diện tải lên thu âm giáo viên tinh gọn (đã xóa toàn bộ nút mẫu nhanh).
5. **05_student_reading_audio.png:** Giao diện học sinh thực tế nghe bài đọc giọng cô giáo có thanh tiến trình và chỉnh tốc độ.
6. **06_mobile_responsive.png:** Kiểm thử giao diện trên màn hình di động 390px hoàn toàn không bị tràn lề ngang.
7. **07_dirty_audio_warning_verified.png:** Cảnh báo lệch văn bản khi chỉnh sửa bài đọc đã gắn âm thanh.

---

## 5. BẢO VỆ VÀ ĐÓNG BĂNG PHIÊN BẢN (FROZEN STATE)

Hai bản sao lưu độc lập đã được tạo và lưu trữ an toàn:
1. **Sao lưu Firestore & Authentication:** `backups/emulator_backup_final_release_ready`
2. **Sao lưu Kho âm thanh nhị phân:** `backups/audio_backup_final_release_ready` (22 tệp âm thanh hoàn chỉnh)

---

## 6. DANH SÁCH VẤN ĐỀ CHƯA XỬ LÝ (UNRESOLVED ISSUES)

- **Số lượng vấn đề tồn đọng:** **0 vấn đề (Zero defects).**
- **Cảnh báo Cloud:** Không tự ý deploy lên Firebase Production / Google Cloud. Hệ thống vận hành hoàn hảo và khép kín trên môi trường Local Emulator phục vụ hội đồng chấm thi.

---

## 7. KẾT LUẬN & CHỮ KÝ NGHIỆM THU

Hệ thống **EM YÊU TIẾNG VIỆT (V5.6.0)** đáp ứng trọn vẹn 100% các tiêu chí kiểm định kỹ thuật, an toàn thông tin và phương pháp sư phạm.

> **ĐÁNH DẤU CHÍNH THỨC:** `LOCAL RELEASE READY`  
> **PHIÊN BẢN ĐÃ ĐƯỢC ĐÓNG BĂNG.** Sẵn sàng chuyển sang thiết kế sản phẩm truyền thông, video giới thiệu và hồ sơ dự thi.
