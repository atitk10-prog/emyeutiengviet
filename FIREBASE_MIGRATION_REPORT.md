# BÁO CÁO THIẾT LẬP VÀ DI CHUYỂN FIREBASE MỚI (FIREBASE MIGRATION REPORT)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI Đọc hiểu Lớp 2–3  
**Dự án Cũ (Staging Backup):** `em-yeu-tieng-viet---staging`  
**Dự án Mới (Production Live):** `emyeutiengviet-prod`  
**Tài khoản Quản trị Google Cloud:** `at.it.k10@gmail.com`  
**Ngày thực hiện:** 28/10/2026  

---

## 1. THÔNG TIN DỰ ÁN FIREBASE MỚI (PRODUCTION)

- **Tên dự án Firebase:** `emyeutiengviet-prod`
- **Project ID:** `emyeutiengviet-prod`
- **Gói dịch vụ:** **Firebase Spark** (Gói miễn phí vĩnh viễn, $0/tháng, **không kích hoạt thẻ thanh toán/Blaze** theo đúng chỉ thị).
- **Vị trí Cloud Firestore:** `nam5` (us-central, multi-region phân tán).
- **Web App đã đăng ký:** `emyeutiengviet-web`
- **Cấu hình Client SDK (Public):**
  ```javascript
  const firebaseConfig = {
    apiKey: "AIzaSyDhx3ubazUjmaaNdhmXSD3uDhVD1s0fHCk",
    authDomain: "emyeutiengviet-prod.firebaseapp.com",
    projectId: "emyeutiengviet-prod",
    storageBucket: "emyeutiengviet-prod.firebasestorage.app",
    messagingSenderId: "662875205963",
    appId: "1:662875205963:web:cf79da18f2186cf1e8b8ce"
  };
  ```
- **Phương thức xác thực (Authentication Providers):**
  - **Email / Mật khẩu (Email/Password):** Bật cho Giáo viên và Quản trị viên.
  - **Khách ẩn danh (Anonymous Auth):** Bật cho Học sinh kết nối session bảo mật backend.
- **Service Account Admin SDK:**
  - Client Email: `firebase-adminsdk-fbsvc@emyeutiengviet-prod.iam.gserviceaccount.com`
  - Đã xuất khóa riêng tư chính thức qua Google Cloud IAM và mã hóa an toàn Base64 đưa vào biến môi trường Vercel `FIREBASE_SERVICE_ACCOUNT_KEY`.
  - **Tuyệt đối không lưu khóa vào Git hay in ra tài liệu công khai.**

---

## 2. QUY TRÌNH DI CHUYỂN DỮ LIỆU TOÀN VẸN (STEP-BY-STEP MIGRATION)

Quá trình di chuyển được thực hiện tự động bằng kịch bản kiểm soát nghiêm ngặt [`scripts/migrate_to_emyeutiengviet_prod.mjs`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/scripts/migrate_to_emyeutiengviet_prod.mjs):

```
+-------------------------------------------------------------+
| 1. Kiểm tra môi trường & Xác thực kết nối Firebase Prod     |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 2. Khởi tạo tài khoản Admin & Giáo viên trên Firebase Auth  |
|    - Cấp Custom Claims: { role: 'admin' }, { role: 'teacher' }
|    - Đồng bộ mật khẩu an toàn theo .secret.local            |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 3. Nhập Collections Căn bản (Users, Usernames, Secrets)    |
|    - Băm mật khẩu chuẩn OWASP PBKDF2 600.000 vòng           |
|    - Đồng bộ Academic Year: 2026-2027                       |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 4. Nhập 11 Curriculum Nodes chuẩn kỹ năng đọc hiểu GDPT 2018|
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 5. Nhập 10 Lớp học & 200 Học sinh (20 em/lớp)               |
|    - Lưu salted hash cho studentSecrets                      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 6. Nhập 20 Bài học, Subcollection Versions & Answer Keys    |
|    - 22 privateAnswerKeys lưu riêng biệt trên server        |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 7. Nhập 26 Bài giao & 403 Lượt làm bài (1.930 responses)    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
| 8. Triển khai Firestore Security Rules qua Google Auth API   |
+-------------------------------------------------------------+
```

---

## 3. TRIỂN KHAI BẢO MẬT VÀ RULES (SECURITY RULES DEPLOYMENT)

Quy tắc bảo mật [`firestore.rules`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/firestore.rules) đã được phát hành chính thức lên dự án `emyeutiengviet-prod` với các ràng buộc:
1. **Deny-by-default:** Mọi truy vấn không có quyền xác thực đều bị từ chối tuyệt đối.
2. **Server-Private Collections:** Các collection `privateAnswerKeys`, `studentSecrets`, `accountSecrets`, `studentSessions`, `loginAttempts` bị **cấm hoàn toàn quyền đọc/ghi từ client**. Chỉ Serverless Functions qua Firebase Admin SDK mới có quyền truy cập.
3. **Phân quyền Giáo viên:** Giáo viên chỉ đọc/ghi bài học, lớp học và học sinh thuộc quyền sở hữu của mình (`resource.data.teacherUid == request.auth.uid`).
4. **Bảo vệ Học sinh:** Học sinh chỉ đọc bài học đã xuất bản (`published`), không xem trước đáp án hay xem bản nháp của giáo viên.

---

## 4. KẾ HOẠCH DỰ PHÒNG VÀ QUAY ĐẦU (ROLLBACK STRATEGY)

Tuân thủ nguyên tắc không được làm mất dữ liệu:
1. **Bảo toàn cơ sở dữ liệu cũ:** Dự án `em-yeu-tieng-viet---staging` **vẫn được giữ nguyên 100%**, không bị xóa dữ liệu, không xóa tài khoản hay bài làm.
2. **Khả năng quay về tức thì:** Nếu môi trường mới phát sinh sự cố, chỉ cần chạy lại lệnh Vercel CLI đổi biến môi trường trỏ lại `em-yeu-tieng-viet---staging` trong vòng chưa đầy 60 giây.
3. **Bản sao lưu lưu trữ cục bộ:** Toàn bộ dữ liệu trước và sau chuẩn hóa đã được lưu trữ an toàn tại thư mục `backups/` trên máy chủ phát triển.
