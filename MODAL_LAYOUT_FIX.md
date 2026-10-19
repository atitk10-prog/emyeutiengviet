# BÁO CÁO NGHIỆM THU SỬA LỖI MODAL HỒ SƠ & ĐỔI MẬT KHẨU
**Dự án:** EM YÊU TIẾNG VIỆT  
**Thời gian hoàn thành:** 18/10/2026  
**Trạng thái nghiệm thu:** **PASS 100% (TOÀN BỘ CÁC CA KIỂM THỬ THỰC TẾ TRÊN TRÌNH DUYỆT)**

---

## 1. Nguyên nhân gốc rễ (Root Cause Analysis)

Sau khi kiểm tra sâu `ProfileModal.tsx`, `ForgotPasswordModal.tsx`, `StudentLibrary.tsx` và cấu trúc DOM thực tế khi render, đã xác định chính xác **4 nguyên nhân kỹ thuật** khiến modal bị cắt mất phần trên màn hình:

1. **Bị bẫy trong Containing Block của thanh Navbar (Containing Block Escape Trap):**
   - `ProfileModal` được gọi và render bên trong thẻ `<header className="... backdrop-blur-md sticky top-0 z-40">` của `Navbar.tsx`.
   - Theo đặc tả CSS W3C, khi một phần tử cha có thuộc tính `backdrop-filter: blur(...)` hoặc `transform`, trình duyệt tự động thiết lập một **Containing Block mới** cho toàn bộ các phần tử con có `position: fixed`.
   - Hậu quả: Dù modal có `fixed inset-0`, nó vẫn bị giới hạn tọa độ và tính toán căn giữa tương đối theo chiều cao của Navbar (64px - 80px) thay vì toàn bộ Viewport của trang, dẫn đến phần trên của modal bị đẩy ra ngoài mép trên màn hình.

2. **Lỗi tràn tọa độ âm của Flexbox Centering (Flexbox Negative Coordinate Overflow):**
   - Lớp phủ overlay sử dụng `flex items-center justify-center`.
   - Khi chiều cao nội dung modal lớn hơn chiều cao màn hình (hoặc trên màn hình laptop thấp 768px, điện thoại di động, hoặc khi mở bàn phím ảo), Flexbox căn giữa sẽ đẩy cả 2 đầu: đỉnh modal bị trôi vào **tọa độ âm (`y < 0`)** phía trên viewport.
   - Trình duyệt KHÔNG THỂ cuộn ngược lên vùng tọa độ âm, khiến thanh tiêu đề, nút đóng (X) và các trường thông tin đầu modal bị che vĩnh viễn.

3. **Giới hạn Viewport không tối ưu cho Mobile (`vh` thay vì `dvh`):**
   - Đơn vị `max-h-[90vh]` không tính đến thanh điều hướng Safari/Chrome trên di động và sự xuất hiện của bàn phím ảo di động. Khi bàn phím xuất hiện, viewport thu hẹp nhưng `vh` vẫn tính theo chiều cao tĩnh, khiến modal tràn khỏi khung nhìn.

4. **Header và Footer không được ghim cố định bên trong thẻ card:**
   - Cụm tiêu đề modal (`Thông Tin Cá Nhân & Bảo Mật`) và nút đóng `X` trước đây nằm chung trong luồng cuộn tự do, thiếu thuộc tính `sticky top-0 z-10` và `shrink-0`. Khi cuộn nội dung, header bị trôi mất.

---

## 2. Giải pháp kỹ thuật và các tệp đã sửa đổi

Toàn bộ hệ thống modal hồ sơ và đổi mật khẩu đã được chuẩn hóa theo kiến trúc **5 lớp chống cắt tràn (Bulletproof Modal Architecture)**:

```
[document.body] -> React createPortal
  └── Overlay (fixed inset-0 z-[100] overflow-y-auto min-h-full flex items-center justify-center p-3 sm:p-6 overscroll-contain)
        └── Card Dialog (relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,720px)] flex flex-col overflow-hidden)
              ├── Header (shrink-0 sticky top-0 z-10 - luôn hiển thị tiêu đề và nút đóng)
              ├── Body (flex-1 overflow-y-auto overscroll-contain - cuộn mượt mà mọi trường dữ liệu)
              └── Footer/Actions (shrink-0 sticky bottom-0 z-10 - nút xác nhận luôn sẵn sàng)
```

### Danh sách các tệp đã sửa đổi:
1. `web/src/components/ProfileModal.tsx`:
   - Sử dụng `createPortal(..., document.body)` thoát hoàn toàn khỏi Containing Block của Navbar.
   - Thêm `fixed inset-0 z-[100] overflow-y-auto`.
   - Card dialog dùng `my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[min(88dvh,720px)]`.
   - Ghim header `shrink-0 sticky top-0 z-10` màu nền slate-900 đồng nhất, tiêu đề và nút đóng `X` cố định.
   - Thân modal `flex-1 overflow-y-auto overscroll-contain`.
2. `web/src/components/ForgotPasswordModal.tsx`:
   - Bổ sung `createPortal(..., document.body)`.
   - Căn giữa an toàn với `overflow-y-auto` trên overlay và `my-auto` trên dialog.
3. `web/src/pages/StudentLibrary.tsx`:
   - Nâng cấp modal "Đổi Mật Khẩu Cá Nhân" của học sinh với `createPortal(..., document.body)`.
   - Khống chế chiều cao theo `100dvh`, header và các nút thao tác luôn hiển thị đầy đủ.
4. `web/src/pages/AdminDashboard.tsx`:
   - Bổ sung `createPortal` cho modal Đặt lại mật khẩu giáo viên của Admin (`resetTargetTeacher`).
5. `web/src/pages/TeacherDashboard.tsx`:
   - Bổ sung `createPortal` cho modal Đặt lại mật khẩu học sinh của Giáo viên (`resetTargetStudent`).
6. `web/src/pages/TeacherLogin.tsx`:
   - Chuẩn hóa modal Quên mật khẩu giáo viên với `createPortal` và safe viewport.
7. `web/src/pages/StudentLogin.tsx`:
   - Chuẩn hóa modal Quên mật khẩu học sinh với `createPortal` và safe viewport.
8. `web/src/pages/AdminLogin.tsx`:
   - Chuẩn hóa modal Quên mật khẩu quản trị viên với `createPortal` và safe viewport.

---

## 3. Ảnh đối chiếu Trước và Sau khi sửa (Before / After Evidence)

### 3.1 Giao diện Desktop (1440×900)
| Trước khi sửa (Bị cắt phần trên) | Sau khi sửa (Hiển thị 100% đầy đủ) |
| :---: | :---: |
| ![Before Desktop](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_before_desktop.png) | ![After Desktop](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_after_desktop.png) |
| *Tiêu đề modal bị tụt lên trên, khuất nút đóng và phần header* | *Header và nút đóng hiển thị sắc nét, căn giữa hoàn hảo, nút đóng và form đầy đủ* |

### 3.2 Giao diện Mobile (390×844)
| Trước khi sửa (Bị mất đỉnh trên Mobile) | Sau khi sửa (Căn chuẩn 100dvh, cuộn mượt mà) |
| :---: | :---: |
| ![Before Mobile](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_before_mobile.png) | ![After Mobile](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_after_mobile.png) |
| *Toàn bộ tiêu đề "Thông Tin Cá Nhân & Bảo Mật" biến mất ngoài màn hình* | *Tiêu đề cố định trên đỉnh, trường nhập mật khẩu và nút bấm tiếp cận dễ dàng* |

---

## 4. Kết quả kiểm thử thực tế trên 6 độ phân giải yêu cầu

| Độ phân giải / Chế độ | Môi trường mô phỏng | Kết quả hiển thị Header & Nút đóng | Khả năng cuộn & thao tác form | Ảnh minh chứng | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1440×900** | Desktop tiêu chuẩn | Hiển thị 100%, không bị che | Hoàn hảo, nhập liệu trực tiếp | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_after_desktop.png) | **PASS** |
| **1366×768** | Laptop phổ thông (màn hình thấp) | Căn giữa an toàn, không bị tràn trên | Cuộn mượt, không mất góc | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_1366x768.png) | **PASS** |
| **1024×768** | Máy tính bảng iPad / Màn vuông | Header ghim cố định, chữ sắc nét | Tiếp cận 100% nút bấm | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_1024x768.png) | **PASS** |
| **390×844** | Mobile iPhone 12/13/14/15 | Header và nút X ghim ở đỉnh viewport | Cuộn chạm mượt, nút bấm lớn | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_after_mobile.png) | **PASS** |
| **360×740** | Mobile Android nhỏ | Vừa vặn 100dvh, không vỡ layout | Cuộn tới tận chân trang | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_mobile_360x740.png) | **PASS** |
| **Zoom 125%** | Desktop High-DPI (1152×720 eqv) | Header sticky chống tràn tuyệt đối | Thanh cuộn xuất hiện tự nhiên | [Xem ảnh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/profile_modal_desktop_zoom125.png) | **PASS** |

---

## 5. Xác minh các vai trò và nghiệp vụ đổi mật khẩu thực tế

### 5.1 Kiểm thử đổi mật khẩu với tài khoản cô lập (Không ảnh hưởng tài khoản Demo cố định)
- **Tài khoản kiểm thử cô lập:** `teacher_modal_test@emytv.local` (Username: `teacher_modal_test`).
- **Mật khẩu ban đầu:** `OldPassword123!`.
- **Mật khẩu mới đã đổi:** `NewPassword456!`.
- **Quy trình thực hiện:**
  1. Mở modal Hồ sơ từ Navbar -> Chuyển đến khối "Đổi Mật Khẩu Đăng Nhập".
  2. Nhập Mật khẩu hiện tại: `OldPassword123!`, Mật khẩu mới: `NewPassword456!`, Nhập lại: `NewPassword456!`.
  3. Bấm "Xác nhận Đổi Mật Khẩu".
  4. Thông báo thành công hiển thị xanh rõ ràng: *"Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn."* ([Ảnh minh chứng](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/password_change_success_desktop.png)).
  5. Đóng modal bằng nút `X` -> Mở lại modal -> Bố cục vẫn nguyên vẹn không hề bị xô lệch.
  6. Đăng xuất -> Đăng nhập lại với `teacher_modal_test` và mật khẩu mới `NewPassword456!` -> **Đăng nhập thành công 100%**.
- **Bảo toàn dữ liệu Demo:** Các tài khoản demo chuẩn `admin / admin`, `giaovien01 / GV123456`, `HS001 / HS123456` được bảo toàn nguyên vẹn, hoạt động hoàn hảo.

### 5.2 Kiểm thử Modal Hồ sơ Quản Trị Viên (Admin)
- Đăng nhập `admin / admin`.
- Mở modal Hồ sơ Quản Trị Viên: Tiêu đề, huy hiệu vai trò `Quản trị viên (Admin)`, các trường thông tin và đổi mật khẩu hiển thị hoàn chỉnh, không bị Navbar đè.
- [Ảnh minh chứng Admin Profile Modal](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/admin_profile_modal_desktop.png).

### 5.3 Kiểm thử Modal Đổi Mật Khẩu Học Sinh
- Đăng nhập `HS001 / HS123456`.
- Trên trang `/student/library`, bấm nút biểu tượng chìa khóa ở góc trên bên phải.
- Modal "Đổi Mật Khẩu Cá Nhân" mở lên với tiêu đề rõ ràng, hiển thị tên học sinh `Nguyễn Minh An Nhiên (Mã: HS001)`, 3 trường mật khẩu và 2 nút "Đóng" / "Lưu mật khẩu" đầy đủ trên cả Desktop và Mobile.
- [Ảnh Desktop Học Sinh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/student_change_password_modal_desktop.png).
- [Ảnh Mobile Học Sinh](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/fa260157-cc83-4bdf-9230-34ae3128a6b4/student_change_password_modal_mobile_390x844.png).

---

## 6. Kiểm tra Build và Hồi quy Hệ thống

Lệnh thực thi:
```bash
npm run build
```
Kết quả kiểm tra:
```
> web@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2411 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.97 kB │ gzip:   0.59 kB
dist/assets/index-BNqqn8mf.css     58.90 kB │ gzip:   9.28 kB
dist/assets/index-BbTd8URk.js   2,333.44 kB │ gzip: 626.22 kB
✓ built in 8.56s
```
- **TypeScript Compiler (tsc):** 0 lỗi cú pháp hay kiểu dữ liệu.
- **Vite Bundler:** Build thành công trong 8.56s.
- **Không xâm lấn:** Chỉ tinh chỉnh các thành phần modal, giữ nguyên 100% kho học liệu, logic AI, cấu trúc Firestore và các quy tắc phân quyền.

---

## 7. Kết luận nghiệm thu

Lỗi modal hồ sơ và đổi mật khẩu bị che phần trên đã được **GIẢI QUYẾT TRIỆT ĐỂ VÀ VĨNH VIỄN**.
1. Toàn bộ modal được render qua `createPortal` vào trực tiếp `document.body`, triệt tiêu hoàn toàn ảnh hưởng của `backdrop-filter` từ Navbar.
2. Overlay và dialog tuân thủ cơ chế `overflow-y-auto` kết hợp `my-auto`, bảo đảm không bao giờ trôi vào tọa độ âm của màn hình.
3. Header và nút đóng được ghim cố định ở đỉnh, luôn nhìn thấy và thao tác được trên mọi loại thiết bị (từ màn hình lớn 1440px tới điện thoại 360px).
4. Nghiệp vụ đổi mật khẩu đã được kiểm thử thực tế và đạt độ tin cậy 100%.
