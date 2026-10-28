# BÁO CÁO TÍNH TOÀN VẸN VÀ ĐỐI CHIẾU DỮ LIỆU (DATA INTEGRITY REPORT)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI Đọc hiểu Lớp 2–3  
**Dự án Đích:** `emyeutiengviet-prod` (Firebase Cloud Production)  
**Ngày kiểm toán:** 28/10/2026  
**Trạng thái kiểm tra:** 100% PASS — Tất cả các ràng buộc toàn vẹn được bảo toàn  

---

## 1. BẢNG ĐỐI CHIẾU SỐ LƯỢNG TÀI LIỆU (CENSUS & VERIFICATION)

| Tên Collection / Subcollection | Bản Chuẩn V5.6 (Baseline) | Cơ sở dữ liệu Mới (`emyeutiengviet-prod`) | Chênh lệch | Trạng thái toàn vẹn |
| :--- | :---: | :---: | :---: | :---: |
| **Firebase Auth Users** | 2 | **2** | 0 | **Khớp 100% (Admin & Teacher)** |
| **users** | 2 | **2** | 0 | **Khớp 100%** |
| **academicYears** | 1 | **1** (`2026-2027`) | 0 | **Khớp 100%** |
| **classes** | 10 | **10** (5 lớp 2, 5 lớp 3) | 0 | **Khớp 100%** |
| **students** | 200 | **200** (20 em / lớp) | 0 | **Khớp 100%** |
| **studentSecrets** | 200 | **200** (Salted Hash) | 0 | **Khớp 100%** |
| **usernames** | 203 | **203** | 0 | **Khớp 100%** |
| **curriculumNodes** | 11 | **11** (5 Kỹ năng GDPT) | 0 | **Khớp 100%** |
| **lessons** | 20 | **20** (Kèm 6 bài chuẩn mẫu) | 0 | **Khớp 100%** |
| **lessons/\*/versions** | 20 | **20** (Bản công bố) | 0 | **Khớp 100%** |
| **privateAnswerKeys** | 22 | **22** (Bảo mật server) | 0 | **Khớp 100%** |
| **assignments** | 26 | **26** | 0 | **Khớp 100%** |
| **attempts** | 403 | **403** (376 done, 27 in-progress)| 0 | **Khớp 100%** |
| **attempts/\*/responses** | 1.930 | **1.930** (Chi tiết từng câu) | 0 | **Khớp 100%** |

---

## 2. KIỂM CHỨNG CÁC RÀNG BUỘC TOÀN VẸN NGHIỆP VỤ (INVARIANT CHECKS)

### 2.1. Phân bố Học sinh theo Lớp (Headcount Invariant)
Quy chuẩn yêu cầu mỗi lớp học phải có đúng 20 học sinh, không có học sinh mồ côi (`orphan student`):
- Lớp 2A (`LOP2A0`): **20 học sinh**
- Lớp 2B (`LOP2B1`): **20 học sinh**
- Lớp 2C (`LOP2C2`): **20 học sinh**
- Lớp 2D (`LOP2D3`): **20 học sinh**
- Lớp 2E (`LOP2E4`): **20 học sinh**
- Lớp 3A (`LOP3A5`): **20 học sinh**
- Lớp 3B (`LOP3B6`): **20 học sinh**
- Lớp 3C (`LOP3C7`): **20 học sinh**
- Lớp 3D (`LOP3D8`): **20 học sinh**
- Lớp 3E (`LOP3E9`): **20 học sinh**
- **Tổng cộng:** 10 lớp = **200 học sinh**. Không có bản ghi trùng lặp mã định danh.

### 2.2. Tính Bất biến của Phiên bản Bài đọc (Version Immutability)
- Tất cả 20 bài học đều có phiên bản độc lập trong subcollection `versions/{versionId}`.
- Khi một bài học đã được giao (`assignments`), `lessonVersionId` được khóa cố định. Lịch sử chấm điểm và các câu hỏi trong quá khứ không bị thay đổi khi giáo viên chỉnh sửa bài học.
- 6 bài đọc mẫu chuẩn (3 bài lớp 2, 3 bài lớp 3) được bảo toàn nguyên vẹn về ngữ liệu, câu hỏi và từ vựng.

### 2.3. Bảo mật Khóa đáp án (Answer Key Privacy)
- Toàn bộ 22 tài liệu trong `privateAnswerKeys` đã được đối chiếu:
  - Trường `correctAnswers`, `scoringRules`, `approvedHints`, `approvedExplanations` chỉ tồn tại trong `privateAnswerKeys`.
  - Phía học sinh (`publicQuestions` trong `versions`) chỉ nhận các trường: `id`, `prompt`, `type`, `options`, `skillTag`. **Tuyệt đối không chứa đáp án hay gợi ý lộ đáp án.**

### 2.4. Xác thực Mật khẩu & Mã truy cập cá nhân
- Mật khẩu Quản trị viên (`admin`) và Giáo viên (`giaovien01`) được mã hóa chuẩn OWASP PBKDF2-HMAC-SHA256 với 600.000 vòng lặp và muối ngẫu nhiên (salt 16-byte).
- Mã truy cập học sinh (`HS123456`) được băm bằng PBKDF2 an toàn trong `studentSecrets`. Không lưu mật khẩu văn bản thuần dưới bất kỳ hình thức nào.
- Đã kiểm tra đăng nhập thực tế cả 3 vai trò trên môi trường Production mới: **100% khớp và xác thực thành công.**
