# BÁO CÁO KIỂM TOÁN CẤU HÌNH VÀ KẾ HOẠCH KẾT NỐI FIREBASE CLOUD (STAGING)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Dự án Cloud mục tiêu:** `em-yeu-tieng-viet---staging`  
**Ngày thực hiện:** 17/10/2026  
**Chế độ thực thi:** Chỉ kiểm tra và báo cáo (*Read-Only Audit* — Không sửa mã nguồn, không đổi env, không deploy, không nâng cấp gói).  

---

## 1. TỔNG QUAN KIỂM TOÁN (EXECUTIVE SUMMARY)

| Tiêu chí | Trạng thái hiện tại | Đánh giá & Rủi ro |
| :--- | :--- | :--- |
| **Môi trường kết nối** | Đang kết nối **100% Firebase Local Emulator Suite** | An toàn cho phát triển nội bộ, chưa kết nối đến Cloud Staging. |
| **Dự án Firebase CLI** | `.firebaserc` trỏ tới `em-yeu-tieng-viet-demo` | Chưa có alias cho project `em-yeu-tieng-viet---staging`. |
| **Cấu hình Web App (`web/.env`)** | `VITE_USE_FIREBASE_EMULATOR=true`, dùng mock keys | Frontend hiện tự động chuyển hướng toàn bộ sang cổng Emulator nội bộ. |
| **Gói dịch vụ Staging Cloud** | **Spark (Miễn phí)** | **RỦI RO CỐT TỬ:** Không thể deploy Cloud Functions trên gói Spark. |
| **Security Rules trên Cloud** | **Deny All (`allow read, write: if false;`)** | Mọi yêu cầu truy vấn Firestore từ Web Client sẽ bị chặn 100%. |
| **Kiến trúc ứng dụng** | **Server-Centric / Zero-Trust Client** | Toàn bộ nghiệp vụ (đăng nhập học sinh, chấm điểm, bảo vệ đáp án) phụ thuộc vào Cloud Functions. |

> [!IMPORTANT]
> **KẾT LUẬN QUAN TRỌNG:**  
> Hệ thống hiện tại áp dụng chuẩn kiến trúc bảo mật nghiêm ngặt (Zero-Trust): đáp án đúng (`privateAnswerKeys`), mã băm PIN học sinh (`studentSecrets`) và logic chấm điểm chỉ được xử lý ở backend qua Firebase Admin SDK.  
> Do đó, **nếu chưa nâng cấp gói Blaze và chưa deploy Cloud Functions**, ứng dụng trên Cloud Staging sẽ **HOÀN TOÀN KHÔNG HOẠT ĐỘNG** (từ chối đăng nhập học sinh, không giao được bài, không chấm được bài).

---

## 2. RÀ SOÁT CHI TIẾT CÁC TỆP CẤU HÌNH HIỆN TẠI

### 2.1. Tệp `.firebaserc`
- **Nội dung hiện tại:**
  ```json
  {
    "projects": {
      "default": "em-yeu-tieng-viet-demo"
    }
  }
  ```
- **Phân tích:** 
  - Chỉ cấu hình một project duy nhất mang tên demo giả lập.
  - Chưa khai báo alias cho môi trường Staging (`em-yeu-tieng-viet---staging`) hoặc Production.
  - Khi chạy lệnh `firebase deploy` từ thư mục gốc, Firebase CLI sẽ báo lỗi không tìm thấy project `em-yeu-tieng-viet-demo` trên Google Cloud.

### 2.2. Tệp `firebase.json`
- **Nội dung:** Cấu hình đầy đủ các phân hệ:
  - `firestore`: trỏ đến rules `firestore.rules` và indexes `firestore.indexes.json`.
  - `functions`: codebase `default`, Node.js runtime, predeploy build (`npm run build`).
  - `hosting`: thư mục đích `web/dist`, rewrite `** -> /index.html` (chuẩn SPA).
  - `emulators`: Auth (9099), Functions (5001), Firestore (8080), Hosting (5000), UI Hub (4000).
- **Phân tích:** Cấu hình `firebase.json` đã chuẩn hóa và tương thích tốt cho cả Emulator lẫn Cloud Deployment.

### 2.3. Tệp `web/.env` và `.env.example`
- **`web/.env` hiện tại:**
  ```env
  VITE_USE_FIREBASE_EMULATOR=true
  VITE_FIREBASE_EMULATOR_HOST=localhost
  VITE_FIREBASE_API_KEY=AIzaSyDemoDummyKeyForEmulatorUsageOnly123
  VITE_FIREBASE_AUTH_DOMAIN=em-yeu-tieng-viet-demo.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=em-yeu-tieng-viet-demo
  ...
  ```
- **Phân tích:**
  - Biến `VITE_USE_FIREBASE_EMULATOR=true` đang bật.
  - Các thông số `API_KEY`, `PROJECT_ID`, `APP_ID` đều là giá trị giả lập dùng cho Emulator Suite nội bộ.
  - Chưa có tệp cấu hình riêng biệt cho Staging (`.env.staging`).

### 2.4. Tệp khởi tạo Firebase Client (`web/src/firebase.ts`)
- **Phân tích logic:**
  ```typescript
  const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR !== 'false';
  ```
  - Nếu `VITE_USE_FIREBASE_EMULATOR` không phải là chuỗi `'false'` (ví dụ: `true`, rỗng hoặc `undefined`), client sẽ **luôn luôn kết nối vào Local Emulator**:
    - `connectAuthEmulator(auth, 'http://localhost:9099')`
    - `connectFirestoreEmulator(db, 'localhost', 8080)`
    - `connectFunctionsEmulator(functions, 'localhost', 5001)`
  - Để chuyển sang Firebase Cloud thật, bắt buộc phải đặt `VITE_USE_FIREBASE_EMULATOR=false` kèm theo bộ credentials Web App thực tế lấy từ Firebase Console.

### 2.5. Cấu hình Backend Cloud Functions (`functions/src/config/firebase.ts` & `package.json`)
- `admin.initializeApp()` được gọi không đối số: Đây là chuẩn tốt nhất của Google Cloud (tự động nạp Application Default Credentials khi chạy trên Cloud Functions).
- `functions/package.json` định nghĩa `"engines": { "node": "22" }`.
- **Lưu ý:** Node.js 22 Cloud Functions yêu cầu dự án Firebase ở gói Blaze để kích hoạt Cloud Build và Artifact Registry của Google Cloud.

---

## 3. PHÂN TÁCH MÔI TRƯỜNG DEVELOPMENT, STAGING VÀ PRODUCTION

### 3.1. Hiện trạng
Hệ thống hiện tại mới chỉ hỗ trợ cơ chế chuyển đổi nhị phân thông qua biến `VITE_USE_FIREBASE_EMULATOR` (true = Local Emulator, false = Cloud), chưa tách rõ các cấp độ môi trường kiểm thử và sản phẩm.

### 3.2. Đề xuất mô hình chuẩn 3 môi trường
Để quản trị an toàn, cần thiết lập 3 môi trường độc lập:

```
[Môi trường 1: Local Development]
- Firebase: Local Emulator Suite (0 chi phí, không cần mạng)
- Vite Env: web/.env (VITE_USE_FIREBASE_EMULATOR=true)
- CLI Target: firebase use default (em-yeu-tieng-viet-demo)

[Môi trường 2: Staging Cloud]
- Firebase Project: em-yeu-tieng-viet---staging
- Vite Env: web/.env.staging (VITE_USE_FIREBASE_EMULATOR=false)
- CLI Target: firebase use staging
- Mục đích: Kiểm thử tích hợp thật, kiểm thử AI thật, giáo viên thử nghiệm UAT.

[Môi trường 3: Production Cloud]
- Firebase Project: em-yeu-tieng-viet (hoặc tương đương)
- Vite Env: web/.env.production
- CLI Target: firebase use production
- Mục đích: Vận hành chính thức cho nhà trường và học sinh.
```

---

## 4. DANH MỤC CHỨC NĂNG SẼ BỊ TÊ LIỆT NẾU CHƯA TRIỂN KHAI CLOUD FUNCTIONS

Do dự án tuân thủ triệt để nguyên tắc **bảo vệ kết quả và an toàn trẻ em**, máy khách (trình duyệt) không được phép ghi điểm, không được giữ khóa đáp án và không được tự phân quyền. 

Nếu dự án Staging hiện tại đang ở gói **Spark** và Rules là **Deny All**, các chức năng sau sẽ **HOÀN TOÀN BỊ LIỆT**:

| STT | Chức năng nghiệp vụ | Hàm backend xử lý | Hậu quả khi chưa có Cloud Functions |
| :---: | :--- | :--- | :--- |
| 1 | **Đăng nhập học sinh** | `joinClass` | **Liệt hoàn toàn:** Học sinh không thể đăng nhập vì logic băm PBKDF2 và tạo token ẩn danh nằm trên máy chủ. |
| 2 | **Cấp quyền Giáo viên** | `bootstrapTeacherRole` | **Liệt hoàn toàn:** Người dùng đăng ký tài khoản không thể trở thành giáo viên vì Rules cấm client tự gán `role: 'teacher'`. |
| 3 | **Tạo lớp học** | `createClassroom` | **Liệt:** Không sinh được mã lớp ngẫu nhiên và không ghi được vào `classes`. |
| 4 | **Thêm học sinh & Cấp mã PIN** | `createStudentAccess` | **Liệt:** Thuật toán băm PBKDF2 10.000 vòng và ghi vào `studentSecrets` (nơi cấm client) không thể thực thi. |
| 5 | **Đổi / Thu hồi mã học sinh** | `rotateStudentAccess` | **Liệt:** Không thể cập nhật hash mới hay hủy phiên học cũ. |
| 6 | **Tạo bài đọc bằng AI** | `generateLessonDraft` | **Liệt:** Không gọi được Google Gemini API và không thể kiểm định JSON Schema. |
| 7 | **Xuất bản bài học** | `publishLesson` | **Liệt hoàn toàn:** Không thể chia tách bài đọc vào `lessons/.../versions` và cách ly đáp án vào `privateAnswerKeys`. |
| 8 | **Giao bài cho lớp** | `assignLesson` | **Liệt:** Không tạo được bản ghi bài giao khóa phiên bản. |
| 9 | **Góc đọc sách của học sinh** | `getStudentLibrary` | **Liệt:** Học sinh không thể tải danh sách bài tập được giao. |
| 10 | **Học sinh bắt đầu làm bài** | `startAttempt` | **Liệt:** Không thể khởi tạo lượt làm bài và không lấy được bộ câu hỏi đã lược bỏ đáp án. |
| 11 | **Chấm điểm & Gợi ý sư phạm** | `submitAnswer` | **Liệt hoàn toàn:** Chấm điểm lần 1 và trả gợi ý sư phạm nằm trên máy chủ; client bị Rules cấm ghi `attempts`. |
| 12 | **Tổng kết lượt làm bài** | `finishAttempt` | **Liệt:** Không thể tính lại điểm số toàn vẹn và chốt sao thưởng. |
| 13 | **Báo cáo & Biểu đồ giáo viên** | `getTeacherAnalytics` | **Liệt:** Không tổng hợp được 5 năng lực đọc hiểu và số liệu trước/sau. |
| 14 | **AI đề xuất củng cố** | `suggestRemediation` | **Liệt:** Không thể gửi dữ liệu ẩn danh đến AI để nhận đề xuất bài tập. |
| 15 | **Xuất báo cáo CSV UTF-8 BOM** | `exportTeacherData` | **Liệt:** Không trích xuất được tệp CSV tiếng Việt chuẩn cho giáo viên. |

> [!WARNING]
> Nếu chỉ triển khai Web Hosting lên Staging mà không có Cloud Functions và giữ nguyên Security Rules "Deny All", người dùng vào trang web sẽ chỉ thấy giao diện tải lỗi liên tục với thông báo: `FirebaseError: Missing or insufficient permissions` hoặc `FirebaseError: NOT_FOUND (functions)`.

---

## 5. KIỂM TOÁN KHẢ NĂNG QUẢN LÝ NHIỀU GIÁO VIÊN, NHIỀU LỚP VÀ NĂM HỌC

### 5.1. Quản lý nhiều giáo viên (Multi-Teacher)
- **Đánh giá: ĐẠT CHUẨN.**
- **Cơ chế:**
  - Bảng `classes`, `lessons`, `assignments` đều lưu trường `teacherUid`.
  - Frontend truy vấn ràng buộc `where('teacherUid', '==', user.uid)`.
  - Quy tắc `firestore.rules` kiểm tra nghiêm ngặt quyền sở hữu:
    ```javascript
    match /classes/{classId} {
      allow read, write: if isTeacher() && resource.data.teacherUid == request.auth.uid;
    }
    ```
  - Giáo viên A hoàn toàn không thể xem hoặc sửa đổi lớp học, bài giảng hay báo cáo của Giáo viên B.

### 5.2. Quản lý nhiều lớp học (Multi-Class)
- **Đánh giá: ĐẠT CHUẨN.**
- **Cơ chế:**
  - Mỗi lớp học sở hữu một `classCode` ngẫu nhiên 6 ký tự (đã cấu hình chỉ mục trong Firestore).
  - Học sinh thuộc lớp nào chỉ được cấp quyền truy cập các bài tập được giao cho lớp đó (`request.auth.token.classId == resource.data.classId`).
  - Đã có cơ chế chống tấn công vét cạn theo mã lớp (`loginAttempts/{cleanClassCode}`).

### 5.3. Quản lý dữ liệu qua các năm học (School Year / Archiving)
- **Hiện trạng:**
  - Mô hình dữ liệu lớp học hiện có trường `status: 'active' | 'archived'`. Giáo viên có thể đóng lớp cũ khi kết thúc năm học.
  - Tuy nhiên, hiện tại **chưa có trường `academicYear` riêng biệt** (ví dụ: `"2025-2026"`, `"2026-2027"`).
- **Kiến nghị nâng cấp cho tương lai:**
  1. Bổ sung trường `academicYear` vào schema `Classroom`.
  2. Bổ sung bộ lọc "Năm học" trên Bảng điều khiển giáo viên để dễ dàng tra cứu lịch sử các khóa trước mà không làm lẫn lộn với năm học hiện tại.

---

## 6. ĐIỀU KIỆN TIÊN QUYẾT TRƯỚC KHI NÂNG CẤP GÓI BLAZE VÀ TRIỂN KHAI

Để triển khai Cloud Functions và kích hoạt môi trường Staging Cloud an toàn mà không gặp rủi ro tài chính hay kỹ thuật:

1. **Phương thức thanh toán quốc tế hợp lệ:**
   - Cần liên kết tài khoản Billing (Thẻ Visa/Mastercard) với Google Cloud Project của `em-yeu-tieng-viet---staging`.
2. **Cài đặt Hạn mức Ngân sách & Cảnh báo (Budget Alerts):**
   - Truy cập **Google Cloud Console > Billing > Budgets & alerts**.
   - Thiết lập Budget Alert ở mức **10 USD – 20 USD/tháng**.
   - Cấu hình gửi email cảnh báo ngay khi chi phí đạt 50%, 90% và 100% ngân sách.
3. **Chuẩn bị khóa Google Gemini API Key:**
   - Lấy API Key từ **Google AI Studio** dành riêng cho môi trường Staging.
   - Sẵn sàng nạp vào Firebase Secrets Manager (không lưu trong tệp mã nguồn).
4. **Chuẩn bị danh sách Giáo viên thử nghiệm (Allowlist):**
   - Xác định danh sách email các thầy cô tham gia thử nghiệm Staging để đưa vào `TEACHER_EMAIL_ALLOWLIST`, ngăn chặn người ngoài tự cấp quyền giáo viên.
5. **Cài đặt giới hạn số lượt gọi Cloud Functions (Concurrency & Quota):**
   - Thiết lập `maxInstances` cho Cloud Functions (ví dụ: tối đa 5–10 instances) để chống phát sinh chi phí đột biến khi bị tấn công DDoS.

---

## 7. ĐỀ XUẤT CÁC BƯỚC THỰC HIỆN KHI ĐƯỢC PHÉP KẾT NỐI STAGING

*(Lưu ý: Dưới đây là kế hoạch kỹ thuật chi tiết; CHƯA THỰC HIỆN cho đến khi người dùng cấp quyền).*

### Bước 1: Nâng cấp dự án Staging lên gói Blaze
- Truy cập Firebase Console của project `em-yeu-tieng-viet---staging` > Bấm **Upgrade** chọn gói **Blaze (Pay as you go)**.
- Thiết lập Budget Alert 10 USD trên Google Cloud Console.

### Bước 2: Cập nhật cấu hình Alias trong `.firebaserc`
Bổ sung alias `staging`:
```json
{
  "projects": {
    "default": "em-yeu-tieng-viet-demo",
    "staging": "em-yeu-tieng-viet---staging"
  }
}
```

### Bước 3: Tạo tệp môi trường Staging cho Frontend (`web/.env.staging`)
Lấy thông số Web App từ Firebase Console (Project Settings > General > Your apps) và tạo `web/.env.staging`:
```env
VITE_USE_FIREBASE_EMULATOR=false
VITE_FIREBASE_API_KEY=[API_KEY_THẬT_TỪ_CONSOLE]
VITE_FIREBASE_AUTH_DOMAIN=em-yeu-tieng-viet---staging.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=em-yeu-tieng-viet---staging
VITE_FIREBASE_STORAGE_BUCKET=em-yeu-tieng-viet---staging.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=[SENDER_ID_THẬT]
VITE_FIREBASE_APP_ID=[APP_ID_THẬT]
```

### Bước 4: Triển khai Firestore Rules & Indexes lên Staging
Gỡ bỏ rule "Deny All" hiện tại, thay bằng bộ quy tắc chuẩn của dự án:
```bash
firebase deploy --only firestore:rules,firestore:indexes --project staging
```

### Bước 5: Cấu hình Secret và Biến môi trường cho Cloud Functions
```bash
# Nạp Gemini API Key vào Google Cloud Secret Manager của project Staging
firebase functions:secrets:set GEMINI_API_KEY --project staging

# Cấu hình bí mật bootstrap giáo viên
firebase functions:secrets:set ADMIN_BOOTSTRAP_SECRET --project staging
```

### Bước 6: Triển khai Cloud Functions lên Staging
```bash
firebase deploy --only functions --project staging
```

### Bước 7: Build và Triển khai Web Hosting lên Staging
```bash
# Build frontend với cấu hình Staging
npm run build --prefix web -- --mode staging

# Triển khai lên Firebase Hosting
firebase deploy --only hosting --project staging
```

### Bước 8: Kiểm thử xác nhận trên Staging thực tế (Smoke Test)
- Mở URL Hosting thật: `https://em-yeu-tieng-viet---staging.web.app`.
- Đăng nhập giáo viên thử nghiệm -> Tạo lớp -> Thêm học sinh.
- Kiểm tra học sinh đăng nhập bằng mã PIN thật -> Đọc bài -> Làm bài -> Kiểm tra điểm số lưu trong Firestore Staging thật.

---

## 8. MA TRẬN RỦI RO VÀ BIỆN PHÁP KIỂM SOÁT (RISK REGISTER)

| Rủi ro kỹ thuật | Mức độ | Hậu quả | Biện pháp kiểm soát & Phòng ngừa |
| :--- | :---: | :--- | :--- |
| **Chi phí Cloud phát sinh ngoài dự kiến** | Trung bình | Vượt ngân sách dự án | Bật Budget Alert 10 USD; giới hạn `maxInstances` của Functions; giới hạn quota Gemini API. |
| **Lộ thông tin nhạy cảm của học sinh** | Rất cao | Vi phạm quy định an toàn trẻ em | Duy trì chính sách chỉ dùng biệt danh; không lưu email/SĐT/ảnh của trẻ em; không gửi PII vào AI. |
| **Lộ khóa API hoặc Access Token** | Cao | Lạm dụng tài nguyên AI | Dùng Firebase Secrets Manager; không đưa API key vào client hoặc commit Git; dùng `.gitignore` nghiêm ngặt. |
| **Khởi động nguội (Cold Start) của Functions** | Thấp | Học sinh phải chờ 3–5 giây ở lượt bấm đầu tiên | Giao diện hiển thị linh vật và trạng thái xoay sinh động; tối ưu hóa kích thước bundle của functions. |
| **Trùng lặp mã lớp (`classCode`)** | Rất thấp | Xung đột lớp học | Thuật toán sinh mã 6 ký tự kết hợp kiểm tra trùng lặp trước khi tạo. |

---
**Báo cáo được lập để phục vụ công tác rà soát kỹ thuật. Mọi thay đổi mã nguồn và triển khai thực tế sẽ chỉ được tiến hành sau khi có phê duyệt chính thức từ người dùng.**
