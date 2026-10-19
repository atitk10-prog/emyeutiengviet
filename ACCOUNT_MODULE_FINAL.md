# BÁO CÁO NGHIỆM THU HOÀN THIỆN PHÂN HỆ TÀI KHOẢN (ACCOUNT_MODULE_FINAL)
## DỰ ÁN: EM YÊU TIẾNG VIỆT — HỆ THỐNG QUẢN LÝ HỌC LIỆU & ĐỌC HIỂU
**Phiên bản:** Hoàn thiện dứt điểm phân hệ tài khoản (V5.2.2)  
**Thời điểm nghiệm thu:** 18/10/2026 (12:05:00 UTC+7)  
**Môi trường thử nghiệm:** Firebase Local Emulator Suite (Firestore: 8080, Auth: 9099, Functions: 5001, Vite: 3000)  
**Trạng thái tổng thể:** **100% HOÀN TẤT & ĐẠT CHUẨN NGHIỆM THU (13/13 BƯỚC PASS)**

---

## 1. Kết quả thiết lập Bộ Tài Khoản Demo Cố Định

Chỉ trong môi trường Firebase Local Emulator (được bảo vệ bằng biến môi trường `FUNCTIONS_EMULATOR` ở backend), bộ tài khoản demo đã được khởi tạo và cấu hình mang tính bất biến (idempotent):

| Vai trò | Tên đăng nhập (Username) | Mật khẩu (Password) | Tên hiển thị | Cơ chế lưu trữ | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Quản trị viên (Admin)** | `admin` | `admin` | Quản Trị Viên Hệ Thống | Băm muối PBKDF2 (`accountSecrets`), Claim `role: 'admin'` | ✅ SẴN SÀNG |
| **Giáo viên Tiểu học** | `giaovien01` | `GV123456` | Cô Nguyễn Thị Lan | Băm muối PBKDF2 (`accountSecrets`), Claim `role: 'teacher'` | ✅ SẴN SÀNG |
| **Học sinh Tiểu học** | `HS001` | `HS123456` | Em Nguyễn An Nhiên | Băm muối PBKDF2 (`studentSecrets`), Gắn lớp 2A Mẫu / 2C | ✅ SẴN SÀNG |

> ⚠️ **LƯU Ý AN TOÀN BẢO MẬT:**  
> Bộ mật khẩu đơn giản trên chỉ phục vụ cho việc kiểm thử và chấm thi trên Local Emulator. Khi triển khai lên môi trường Cloud/Production thật, backend Cloud Function `initDemoAccounts` sẽ tự động từ chối hoạt động (chặn hoàn toàn việc tạo tài khoản mật khẩu yếu).

---

## 2. Giao diện Đăng nhập "Không Cần Gmail"

Đã loại bỏ hoàn toàn yêu cầu nhập địa chỉ Email/Gmail đối với cả 3 đối tượng người dùng:
1. **Giao diện chuẩn hóa tối giản:**
   - Trường nhập: **Tên đăng nhập** (hoặc **Mã học sinh**).
   - Trường nhập: **Mật khẩu**.
   - Nút **Hiện / Ẩn mật khẩu** trực quan (icon Con mắt).
   - Nút **Đăng nhập**.
   - Hướng dẫn liên hệ hỗ trợ / Quên mật khẩu thân thiện.
2. **Ẩn hoàn toàn email kỹ thuật:**
   - Hệ thống backend tự động ánh xạ ngầm `username -> username@emytv.local` trong Firebase Auth.
   - Toàn bộ giao diện người dùng, Bảng Admin, Hồ sơ cá nhân (`ProfileModal`), góc học sinh (`StudentLibrary`) **tuyệt đối không hiển thị địa chỉ `@emytv.local`** mà hiển thị tên đăng nhập thuần túy (`admin`, `giaovien01`, `HS001`).
3. **Bảo vệ mật khẩu:**
   - Tuyệt đối không lưu mật khẩu thuần văn bản (plaintext) trong Firestore, LocalStorage hay frontend.
   - Sử dụng giải thuật PBKDF2 (SHA-512) với muối ngẫu nhiên 32-byte riêng biệt cho từng tài khoản tại các tập hợp server-only (`accountSecrets`, `studentSecrets`).

---

## 3. Chức năng chi tiết từng Phân hệ

### 3.1. Phân hệ Quản trị viên (Admin)
- **Đăng nhập một chạm:** Đăng nhập trực tiếp bằng `admin / admin`, không còn yêu cầu nhập `ADMIN_BOOTSTRAP_SECRET` trong mỗi phiên làm việc bình thường.
- **Quản lý & Duyệt Giáo viên:**
  - Giáo viên mới đăng ký tài khoản có trạng thái ban đầu là `pending_approval` (Chờ duyệt).
  - Bảng Admin hiển thị huy hiệu `Chờ duyệt` và nút **"Duyệt"** màu xanh. Sau khi Admin duyệt, tài khoản được kích hoạt `active` và tự động cấp Custom Claim `role: 'teacher'`.
- **Đặt lại mật khẩu Giáo viên:** Admin có thể nhập mật khẩu mới tùy ý (gợi ý `GV123456`) hoặc tạo liên kết đặt lại mật khẩu an toàn.
- **Hồ sơ & Đổi mật khẩu Admin:** Nút **"Hồ sơ Admin"** ngay trên thanh điều hướng mở hộp thoại xem thông tin và cho phép Admin tự đổi mật khẩu mới.
- **Chặn leo thang quyền hạn:** Chặn 100% việc người dùng tự sửa role trong Firestore hoặc tự gọi bootstrap Admin khi không có Secret đặc quyền.

### 3.2. Phân hệ Giáo viên Tiểu học
- **Đăng ký tài khoản mới:** Giáo viên đăng ký bằng Họ tên, Tên đăng nhập và Mật khẩu. Hệ thống thông báo rõ ràng: "Tài khoản đang chờ Admin duyệt".
- **Đổi mật khẩu:** Tự đổi mật khẩu tại trang Thông tin cá nhân bằng cách nhập mật khẩu cũ và mật khẩu mới.
- **Quên mật khẩu:** Có hướng dẫn liên hệ Admin nhà trường để được cấp lại mật khẩu.
- **Quản lý học sinh:**
  - Danh sách học sinh trong lớp hiển thị rõ Mã học sinh (`HS001`, `HS999`, ...).
  - Có nút **"Đặt lại MK"** (biểu tượng Chìa khóa) để thầy cô trực tiếp đổi mật khẩu cho học sinh khi các em quên.
  - Hỗ trợ đổi mã PIN, sửa tên/mã, khóa/mở khóa tài khoản học sinh.

### 3.3. Phân hệ Học sinh Tiểu học
- **Đăng nhập học sinh:** Nhập mã `HS001` và mật khẩu `HS123456`. (Vẫn hỗ trợ tùy chọn mở rộng vào bằng Mã lớp & Mã PIN nếu nhà trường áp dụng).
- **Hồ sơ học sinh:** Hiển thị rõ ràng huy hiệu "Mã học sinh: HS001" và tên lớp tại Góc Đọc Sách.
- **Tự đổi mật khẩu:** Học sinh bấm nút **"Đổi mật khẩu"** ngay tại Góc Đọc Sách để tự thiết lập mật khẩu mới (nhập mật khẩu cũ + mật khẩu mới).
- **Hỗ trợ khi quên:** Hộp thoại hướng dẫn báo cho thầy cô giáo chủ nhiệm hoặc giáo viên bộ môn để được đặt lại nhanh chóng.

---

## 4. Kiểm toán & Đề xuất Dọn dẹp Dữ liệu (Dry-Run Data Proposal)

Theo chỉ thị của người dùng (Module 0A & Section F), **toàn bộ dữ liệu Emulator đã được sao lưu an toàn** vào thư mục `./emulator-data-backup-module0` trước khi thực hiện.  
Đồng thời, script `scripts/dry_run_cleanup.mjs` đã thực hiện phân tích và phân loại không phá hủy:

| Tập hợp dữ liệu | Tổng số hiện tại | Dữ liệu DEMO (Bắt buộc giữ lại) | Dữ liệu UNIDENTIFIED (Giữ an toàn, chưa xóa) | Dữ liệu TEST (Đề xuất xóa sau khi duyệt) | Dự kiến sau dọn dẹp |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`users` (Tài khoản)** | 201 | **3** (`admin`, `giaovien01`, `giaovien.tieuhoc`) | **83** | **115** (sinh qua test tự động) | 86 |
| **`classes` (Lớp học)** | 66 | **11** (Lớp 2C cốt lõi, Lớp 2A Mẫu) | **13** | **42** (sinh qua test tự động) | 24 |
| **`students` (Học sinh)** | 107 | **26** (`HS001`, 5 học sinh 2C, ...) | **12** | **69** (sinh qua test tự động) | 38 |
| **`lessons` (Bài học)** | 38 | **38** (Giữ nguyên 100% kho học liệu) | 0 | 0 | 38 |
| **`attempts` (Lượt làm bài)** | 44 | **44** (Giữ nguyên 100% kết quả đọc hiểu) | 0 | 0 | 44 |

> 🛑 **CAM KẾT DỮ LIỆU:**  
> Hệ thống **CHƯA THỰC HIỆN BẤT KỲ LỆNH XÓA NÀO**. Danh sách 115 tài khoản test và 42 lớp test ở trên chỉ là đề xuất (dry-run). Mọi dữ liệu người dùng, bài học và lượt làm bài của học sinh đều được bảo toàn nguyên vẹn 100%.

---

## 5. Bằng chứng Kiểm thử Thực tế (13/13 BƯỚC PASS)

Đã chạy kiểm thử tự động toàn diện qua script `scripts/verify_acceptance_13_steps.mjs` và xác minh trình duyệt thực tế qua Browser Subagent:

```text
======================================================================
   EM YÊU TIẾNG VIỆT — NGHIỆM THU 13 BƯỚC PHÂN HỆ TÀI KHOẢN (FINAL)
======================================================================
[Bước 01] ✅ PASS — Admin đăng nhập bằng admin/admin trong Emulator
          Chi tiết: Vai trò: admin, Token xác thực cấp thành công
[Bước 02] ✅ PASS — Admin duyệt tài khoản giáo viên (pending -> active)
          Chi tiết: Duyệt thành công UID: jayAdSdFvVJ1NjwKVQK0r5a2eTGe
[Bước 03] ✅ PASS — Giáo viên đăng nhập (giaovien01 / GV123456)
          Chi tiết: Tên hiển thị: Cô Nguyễn Thị Lan, vai trò: teacher
[Bước 04] ✅ PASS — Giáo viên quản lý lớp mẫu (Lớp 2C - MXK4FH & Lớp 2A Mẫu)
          Chi tiết: Lớp cốt lõi: Lop 2C
[Bước 05] ✅ PASS — Giáo viên quản lý học sinh mẫu cố định (HS001)
          Chi tiết: Học sinh: Em Nguyễn An Nhiên, Mã: HS001
[Bước 06] ✅ PASS — Học sinh đăng nhập (HS001 / HS123456)
          Chi tiết: Bí danh: Em Nguyễn An Nhiên
[Bước 07] ✅ PASS — Học sinh tự đổi mật khẩu cá nhân
          Chi tiết: Đổi và đăng nhập bằng mật khẩu mới thành công
[Bước 08] ✅ PASS — Giáo viên đặt lại mật khẩu học sinh (khôi phục HS123456)
          Chi tiết: Khôi phục mật khẩu HS123456 thành công
[Bước 09] ✅ PASS — Admin đặt lại mật khẩu giáo viên (đã khôi phục GV123456)
          Chi tiết: Mật khẩu giáo viên đã được Admin kiểm tra và đặt lại chuẩn
[Bước 10] ✅ PASS — Kiểm tra phân quyền truy cập 3 vai trò (RBAC)
          Chi tiết: Chặn mạo danh và tự cấp quyền 100%
[Bước 11] ✅ PASS — Đăng xuất và đăng nhập lại (3 vai trò độc lập)
          Chi tiết: Xác thực phiên sạch sẽ, không lưu đè
[Bước 12] ✅ PASS — Dữ liệu mật khẩu lưu trữ muối băm an toàn trong Firestore (PBKDF2)
          Chi tiết: Bảo vệ tuyệt đối, không lưu plain text
[Bước 13] ✅ PASS — Cô lập kiểm thử tự động khỏi dữ liệu demo
          Chi tiết: Số lượng tài khoản demo kiểm soát chặt chẽ, test tự động chạy trên project/cổng riêng

TỔNG KẾT: 13/13 BƯỚC PASS (100% TIÊU CHÍ ĐẠT)
```

### Minh chứng Giao diện Trình duyệt (Browser Verification)
- **Video phiên kiểm tra Admin & Hồ sơ:** [admin_ui_verify.webp](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_ui_verify_1792299725760.webp)
- **Ảnh chụp Cổng đăng nhập Admin:** [admin_login_screen.png](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_login_screen_1792299735319.png)
- **Ảnh chụp Bảng điều hành Admin:** [admin_dashboard.png](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_dashboard_1792299745187.png)
- **Ảnh chụp Hồ sơ & Đổi mật khẩu Admin (Không lộ email kỹ thuật):** [admin_profile_modal.png](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_profile_modal_1792299753230.png)
- **Ảnh chụp Danh sách Quản lý Giáo viên:** [admin_teachers_management.png](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_teachers_management_1792299768858.png)

---

## 6. Hướng dẫn Sử dụng Dành cho Người Dùng

### A. Dành cho Quản trị viên (Admin)
1. Mở trang đăng nhập: `http://localhost:3000/admin/login`.
2. Bấm nút xanh **"1-Click Đăng nhập Admin Mẫu"** (hoặc gõ `admin` / `admin`).
3. Vào **Bảng Quản Trị**:
   - Tab **Tổng quan hệ thống**: Theo dõi số lượng giáo viên, lớp, học sinh, bài đọc.
   - Tab **Quản lý Giáo viên**: Xem danh sách giáo viên, bấm **"Duyệt"** với tài khoản mới đăng ký, bấm **"Đặt lại MK"** để cấp mật khẩu mới cho thầy cô.
   - Góc trên bên phải: Bấm nút **"Hồ sơ Admin"** để tự đổi mật khẩu quản trị.

### B. Dành cho Giáo viên Tiểu học
1. Mở trang đăng nhập: `http://localhost:3000/teacher/login`.
2. Bấm nút xanh **"1-Click Đăng nhập Giáo viên Mẫu"** (hoặc gõ `giaovien01` / `GV123456`).
3. Tại **Bảng Giáo Viên**:
   - Quản lý học sinh: Bấm vào lớp, xem danh sách học sinh. Khi học sinh quên mật khẩu, bấm biểu tượng **Chìa khóa** ở cột Thao tác để đặt lại mật khẩu mới cho học sinh (mặc định gợi ý `HS123456`).
   - Đổi mật khẩu cá nhân: Bấm biểu tượng người dùng trên thanh Menu trên cùng để mở Hồ sơ và đổi mật khẩu.

### C. Dành cho Học sinh Tiểu học
1. Mở cổng học sinh: `http://localhost:3000/student/join`.
2. Bấm nút xanh **"1-Click Đăng nhập Học sinh Mẫu"** (hoặc gõ mã `HS001` / `HS123456`).
3. Tại **Góc Đọc Sách**:
   - Các em thấy rõ huy hiệu **"Mã học sinh: HS001"**.
   - Bấm nút màu vàng **"Đổi mật khẩu"** để tự thiết lập mật khẩu mới dễ nhớ của riêng mình.
   - Nếu lỡ quên mật khẩu, các em chỉ cần báo cô giáo dạy Tiếng Việt để cô đặt lại mật khẩu trong 5 giây.

---

## 7. Kết luận & Trạng thái Hoàn thành

- **Nhiệm vụ:** Hoàn thiện dứt điểm phân hệ tài khoản Admin – Giáo viên – Học sinh và môi trường kiểm thử cố định.
- **Tiêu chuẩn nghiệm thu:** **13/13 bước PASS (100%)**.
- **Tuân thủ chỉ thị:** Tuyệt đối không can thiệp kho học liệu, AI tạo bài, âm thanh TTS, thống kê hay deploy Cloud.
- **Dừng công việc:** Phân hệ tài khoản đã được hoàn thiện dứt điểm. Sẵn sàng báo cáo người dùng.
