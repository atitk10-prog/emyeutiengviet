# KẾ HOẠCH TRIỂN KHAI FIREBASE CLOUD STAGING (DEPLOYMENT PLAN)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Mục tiêu:** Môi trường thử nghiệm đám mây (Cloud Staging)  
**Project ID:** `em-yeu-tieng-viet---staging`  
**Ngày lập kế hoạch:** 17/10/2026  
**Trạng thái phê duyệt:** **ĐANG TẠM DỪNG (BLOCKED)** — Đợi lệnh cho phép và nâng gói Blaze từ chủ dự án  

---

## 1. KHẢO SÁT HIỆN TRẠNG FIREBASE CLOUD STAGING

Dự án Firebase Cloud `em-yeu-tieng-viet---staging` đã được khởi tạo trên Google Cloud Console với các thông số sau:

| Thành phần | Trạng thái trên Cloud hiện tại | Yêu cầu để hệ thống hoạt động | Đánh giá |
| :--- | :--- | :--- | :--- |
| **Gói dịch vụ (Pricing Plan)** | **Spark (Miễn phí)** | **Blaze (Pay-as-you-go)** | **BẮT BUỘC NÂNG CẤP BLAZE** để chạy Cloud Functions v2 và gọi ra ngoài Internet (Gemini API) |
| **Authentication** | Email/Password & Anonymous: **ĐÃ BẬT** | Email/Password & Anonymous | **SẴN SÀNG** |
| **Cloud Firestore** | Cơ sở dữ liệu: **ĐÃ TẠO** | Đã tạo ở khu vực `asia-southeast1` (hoặc tương đương) | **SẴN SÀNG** |
| **Firestore Security Rules** | Hiện đang là **Deny All** | Cần deploy `firestore.rules` của dự án | **CHỜ DEPLOY** |
| **Cloud Functions** | **CHƯA TRIỂN KHAI** | 12 functions Node.js 20 TypeScript | **CHỜ DEPLOY** (Cần Blaze) |
| **Firebase Secrets** | **CHƯA CẤU HÌNH** | Khóa `GEMINI_API_KEY` | **CHỜ CẤU HÌNH** (Cần Blaze) |
| **Firebase Hosting** | **CHƯA TRIỂN KHAI** | Bản build Vite React | **CHỜ DEPLOY** |

> [!CAUTION]
> **CAM KẾT AN TOÀN:** Đại lý AI **KHÔNG** tự ý thực hiện bất kỳ lệnh `firebase deploy` hay thay đổi thông tin thanh toán nào lên Cloud Staging khi người dùng chưa có chỉ thị chấp thuận rõ ràng.

---

## 2. DỰ TOÁN CHI PHÍ & HẠN MỨC MIỄN PHÍ GÓI BLAZE

Gói Blaze của Firebase tính theo lưu lượng sử dụng thực tế (pay-as-you-go), nhưng **vẫn giữ nguyên toàn bộ hạn mức miễn phí hàng tháng của gói Spark**:

1. **Cloud Functions:**
   - 2 triệu lượt gọi miễn phí mỗi tháng.
   - 400.000 GB-giây và 200.000 CPU-giây tính toán miễn phí mỗi tháng.
   - 5GB đường truyền ra ngoài (outbound data transfer) miễn phí mỗi tháng.
   - *Chi phí cho thử nghiệm Staging (dưới 500 lượt test/tháng):* **0 VNĐ (Hoàn toàn nằm trong hạn mức miễn phí)**.
2. **Cloud Firestore:**
   - 50.000 lượt đọc, 20.000 lượt ghi, 20.000 lượt xóa miễn phí mỗi ngày.
   - 1GB dung lượng lưu trữ miễn phí.
3. **Gemini API:**
   - Sử dụng gói Free Tier hoặc chi phí cực thấp với model `gemini-3.5-flash-lite` (khoảng 0.075 USD / 1 triệu token đầu vào).
4. **Biện pháp khống chế chi phí (Budget Alert):**
   - Thiết lập cảnh báo ngân sách (Budget Alert) tại Google Cloud Console: đặt ngưỡng cảnh báo khi chi phí đạt **1 USD (25.000 VNĐ)**.
   - Thiết lập giới hạn tối đa số instance đồng thời của Cloud Functions: `maxInstances: 5` để chống spam ngoài ý muốn.

---

## 3. CÁC BƯỚC THỰC HIỆN KHI ĐƯỢC PHÉP TRIỂN KHAI (STEP-BY-STEP)

Khi người dùng quyết định nâng cấp gói Blaze và phê duyệt triển khai, thực hiện tuần tự 7 bước sau:

### Bước 1: Nâng cấp gói Blaze trên Firebase Console
1. Truy cập https://console.firebase.google.com/project/em-yeu-tieng-viet---staging/usage/details
2. Nhấn nút **"Upgrade to Blaze"** và liên kết tài khoản thanh toán Google Cloud.
3. Cài đặt Budget Alert: $1/tháng.

### Bước 2: Đăng nhập Firebase CLI và kiểm tra dự án
```powershell
# Kiểm tra đăng nhập
npx firebase login

# Kiểm tra danh sách dự án
npx firebase projects:list

# Chuyển alias sang staging
npx firebase use staging
```

### Bước 3: Cấu hình khóa bí mật trong Firebase Secret Manager
Khóa Gemini API được mã hóa và bảo mật tại cấp hạ tầng Google Cloud:
```powershell
# Thiết lập khóa Gemini API trong Secret Manager của dự án Staging
npx firebase functions:secrets:set GEMINI_API_KEY --project em-yeu-tieng-viet---staging
# (Nhập khóa bí mật khi CLI nhắc)

# Thiết lập chuỗi bí mật cấp quyền giáo viên quản trị
npx firebase functions:secrets:set ADMIN_BOOTSTRAP_SECRET --project em-yeu-tieng-viet---staging
```

### Bước 4: Triển khai Firestore Rules & Indexes
Deploy quy tắc bảo mật trước để đảm bảo dữ liệu được cách ly an toàn ngay từ giây đầu tiên:
```powershell
npx firebase deploy --only firestore:rules,firestore:indexes --project em-yeu-tieng-viet---staging
```

### Bước 5: Biên dịch và Triển khai Cloud Functions
```powershell
# Biên dịch shared và functions
npm run build --workspace=shared
npm run build --workspace=functions

# Triển khai toàn bộ Cloud Functions
npx firebase deploy --only functions --project em-yeu-tieng-viet---staging
```

### Bước 6: Biên dịch và Triển khai Giao diện Web (Hosting)
Cập nhật tệp cấu hình môi trường staging cho frontend `web/.env.staging`:
```env
VITE_USE_EMULATOR=false
VITE_FIREBASE_API_KEY=<API_KEY_STAGING>
VITE_FIREBASE_AUTH_DOMAIN=em-yeu-tieng-viet---staging.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=em-yeu-tieng-viet---staging
VITE_FIREBASE_STORAGE_BUCKET=em-yeu-tieng-viet---staging.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<SENDER_ID>
VITE_FIREBASE_APP_ID=<APP_ID>
```
Thực hiện build và deploy:
```powershell
npm run build:web
npx firebase deploy --only hosting --project em-yeu-tieng-viet---staging
```

### Bước 7: Khởi tạo tài khoản Giáo viên Quản trị & Kiểm tra khói (Smoke Test)
1. Đăng ký tài khoản giáo viên đầu tiên tại giao diện Staging (ví dụ: `admin.giaovien@tieuhoc.edu.vn`).
2. Kích hoạt quyền giáo viên bằng cách gọi `bootstrapTeacherRole` kèm `adminSecret` đã đặt ở Bước 3:
```javascript
// Hoặc qua Firebase Admin Node script nội bộ
```
3. Đăng nhập vào Bảng điều khiển Giáo viên:
   - Tạo một lớp học mới kèm năm học `2025-2026`.
   - Cấp mã PIN cho 1 học sinh mẫu.
   - Kiểm tra trạng thái AI (ấn "Kiểm tra kết nối AI").
   - Giao 1 bài đọc mẫu GDPT.
4. Mở cửa sổ ẩn danh, đăng nhập học sinh bằng mã lớp và mã PIN:
   - Làm bài, kiểm tra chấm điểm trên máy chủ và hiển thị gợi ý khi chọn sai lần 1.
   - Nộp bài và xác nhận kết quả lưu đúng Firestore.

---

## 4. MA TRẬN ĐÁNH GIÁ CỔNG NGHIỆM THU (RELEASE GATES)

| Cổng nghiệm thu | Mô tả cổng | Trạng thái hiện tại | Điều kiện cần để hoàn tất |
| :--- | :--- | :---: | :--- |
| **G1: Cổng Chức năng cốt lõi (Functional Core Gate)** | Toàn bộ luồng giáo viên, học sinh, 3 dạng câu hỏi, chấm điểm 2 giai đoạn, xuất CSV UTF-8 BOM | **PASS (100%)** | Đã nghiệm thu đầy đủ trên môi trường Local Emulator |
| **G2: Cổng Bảo mật dữ liệu & Đánh giá (Security & Rules Gate)** | Cách ly đáp án `privateAnswerKeys`, mã hóa PIN PBKDF2, chống vét cạn theo mã PIN, chống leo thang quyền | **PASS (100%)** | Đã vượt qua 6/6 Rules tests và 4/4 Security tests |
| **G3: Cổng Dịch vụ AI Thực tế (Live AI Service Gate)** | Gọi model `gemini-3.5-flash-lite`/`gemini-3.8-flash` qua backend, 4 trạng thái, không rò rỉ khóa | **SẴN SÀNG / ĐỢI KHÓA** | Chờ người dùng cung cấp `GEMINI_API_KEY` hợp lệ để chuyển từ `READY_UNVERIFIED` sang `VERIFIED` |
| **G4: Cổng Cloud Staging (Cloud Staging Gate)** | Triển khai thật lên `em-yeu-tieng-viet---staging` với Cloud Functions, Secrets và Hosting | **BLOCKED** | Cần nâng cấp gói Blaze và có sự cho phép chính thức của người dùng |
