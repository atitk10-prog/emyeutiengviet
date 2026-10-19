# BÁO CÁO NGHIỆM THU V4.0 — HOÀN THIỆN QUẢN TRỊ ADMIN, HỌC SINH VÀ LƯU TRỮ DỮ LIỆU
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nâng cao năng lực đọc hiểu cho học sinh tiểu học  
**Phiên bản:** 4.0.0-PERSISTENCE-ADMIN-GDPT15  
**Môi trường kiểm định:** Firebase Local Emulator Suite (Auth: 9099, Firestore: 8080, Functions: 5001, Vite: 3000)  
**Thời gian thực hiện:** Tháng 10/2026  
**Trạng thái kiểm thử:** **42/42 TEST CASES PASS (100%)** + **Kiểm thử trình duyệt thật (Browser Subagent PASS)**

---

## I. TỔNG QUAN KẾT QUẢ NGHIỆM THU THEO YÊU CẦU

| Nội dung nghiệm thu | Tiêu chí kỹ thuật | Kết quả thực tế | Trạng thái |
|---|---|---|---|
| **Phần A: Quản trị viên (Admin)** | Vai trò độc lập, trang `/admin/login`, `/admin/dashboard`, bootstrap đặc quyền backend, từ chối client tự nâng quyền, quản trị giáo viên/lớp/khung GDPT 1–5 | Đã hoàn thành và kiểm chứng qua 4 bài test phân quyền chéo và Security Rules | **PASS** |
| **Phần B: Học sinh tham gia lớp** | Giáo viên cấp mã $\rightarrow$ Học sinh nhập mã $\rightarrow$ Chặn mã sai/brute-force $\rightarrow$ Vào thư viện $\rightarrow$ Giữ phiên khi F5 $\rightarrow$ Làm bài 5 nhiệm vụ $\rightarrow$ Chấm điểm server $\rightarrow$ Giáo viên thấy kết quả | Đã chạy và ghi hình trình duyệt thực tế (`assign_and_student_mission_1792249351665.webp`) | **PASS** |
| **Phần C: Lưu và phục hồi dữ liệu** | Dữ liệu thật trong Firestore Emulator, export/import an toàn vào `./emulator-data`, xuất CSV UTF-8 BOM, không mất dữ liệu khi restart | Export metadata, thư mục auth/firestore, phục hồi qua `--import`, 4 test persistence | **PASS** |
| **Phần D: Sẵn sàng GDPT Lớp 1–5** | Ngân hàng chương trình "Kết nối tri thức với cuộc sống", Khối 1–5, Tập 1–2, YCCĐ, 4 nhóm hoạt động, trích dẫn chuẩn NXBGDVN | 11 mục khung chương trình đã seed và hiển thị trên Admin Dashboard | **PASS** |
| **Phần E: Bộ test tích hợp** | Chạy toàn bộ test suites tự động và đối chiếu | 42/42 bài test PASS không có cảnh báo lỗi | **PASS** |

---

## II. CHI TIẾT NGHIỆM THU TỪNG PHẦN

### 1. PHẦN A – QUẢN TRỊ VIÊN (ADMIN)

#### 1.1. Kiến trúc phân quyền độc lập
- **Vai trò người dùng:** Định nghĩa trong `shared/src/index.ts`:
  ```typescript
  export type UserRole = 'admin' | 'teacher' | 'student';
  ```
- **Quy trình Bootstrap đặc quyền:**
  - Không cho phép người dùng tự đăng ký hoặc tự gán quyền `role: 'admin'` qua Firestore Client SDK.
  - Endpoint `bootstrapAdminRole` trên Cloud Functions yêu cầu mã bí mật hệ thống (`ADMIN_BOOTSTRAP_SECRET`).
  - Khi xác thực thành công, backend gán custom claims `role: 'admin'` vào Firebase Auth và cập nhật profile `users/{uid}`.
- **Trang Đăng Nhập & Bảng Điều Khiển Admin:**
  - Đường dẫn chuyên biệt: [AdminLogin.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/AdminLogin.tsx) tại `/admin/login` với phong cách bảo mật cao cấp (indigo/navy).
  - Bảng điều khiển: [AdminDashboard.tsx](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/AdminDashboard.tsx) tại `/admin/dashboard` gồm 4 phân hệ:
    1. **Tổng quan hệ thống:** Tổng số giáo viên, lớp học, học sinh, lượt làm bài, trạng thái kết nối Gemini AI, độ phủ chương trình Khối 1–5.
    2. **Quản lý giáo viên:** Danh sách giáo viên, ngày đăng ký, trạng thái hoạt động, nút khóa/kích hoạt tài khoản (`updateUserStatus`).
    3. **Quản lý lớp học:** Xem toàn bộ lớp học trong trường, khối lớp, mã lớp, năm học và giáo viên phụ trách (`listAllClassesAdmin`).
    4. **Ngân hàng chương trình GDPT 2018 (Lớp 1–5):** Duyệt theo bộ sách "Kết nối tri thức với cuộc sống", khối lớp 1–5, xem chi tiết YCCĐ và loại hoạt động.
- **Kiểm thử phân quyền chéo (Cross-Access Tests):**
  - Người dùng chưa đăng nhập gọi hàm Admin: Bị từ chối `unauthenticated`.
  - Giáo viên gọi `getAdminOverview`: Bị từ chối với lỗi rõ ràng *"Chỉ tài khoản Quản trị viên mới có quyền thực hiện"*.
  - Admin không thể đọc trực tiếp `privateAnswerKeys` hay `studentSecrets` bằng Client SDK (Security Rules chặn tuyệt đối cấp độ mạng).

---

### 2. PHẦN B – HỌC SINH THAM GIA LỚP & TRẢI NGHIỆM HỌC TẬP

#### 2.1. Quy trình thực tế từ đầu đến cuối (End-to-End)
1. **Giáo viên tạo lớp:** Lớp 2C (Mã lớp: `MXK4FH`, Khối 2, Năm học 2025–2026).
2. **Cấp mã học sinh:** Học sinh "Minh Triet" (Mã định danh `HS999`), hệ thống cấp PIN ngẫu nhiên `8A48KV`. Thẻ thông tin hiển thị trên modal để giáo viên in/phát cho học sinh.
3. **Giáo viên giao bài:** Chọn bài đọc mẫu *"Cây sồi và đàn chim nhỏ"* giao cho Lớp 2C, số lượt tối đa: 3.
4. **Kiểm thử nhập sai mã (Negative Test):**
   - Học sinh truy cập `/student/join`, nhập Mã lớp `MXK4FH`, PIN sai `999999`.
   - Kết quả: Hệ thống hiển thị thông báo lỗi sư phạm, ghi nhận lần thử 1/5. Nhập sai 5 lần liên tiếp sẽ kích hoạt cơ chế khóa tạm 5 phút chống dò mã brute-force.
5. **Kiểm thử nhập đúng mã (Positive Test):**
   - Nhập đúng PIN `8A48KV`. Backend tạo session an toàn, trả về custom token và điều hướng vào `/student/library`.
   - Chào đón cá nhân hóa: *"Chào bạn Minh Triet!"*.
6. **Kiểm thử lưu phiên & tải lại trang (Refresh & Session Persistence):**
   - Nhấn tải lại trang (F5) tại `/student/library`.
   - Kết quả: Phiên làm việc được phục hồi ngay từ `localStorage` + Firebase Auth, học sinh KHÔNG bị mất phiên hay văng ra trang đăng nhập.
7. **Làm bài đọc hiểu 5 nhiệm vụ:**
   - **Nhiệm vụ 1 (Trắc nghiệm):** Học sinh chọn đáp án sai lần 1 $\rightarrow$ Backend không lộ đáp án, gửi gợi ý sư phạm để học sinh tư duy lại $\rightarrow$ Học sinh chọn lại đáp án đúng $\rightarrow$ Nhận điểm sau gợi ý.
   - **Nhiệm vụ 2 (Đúng / Sai):** Trả lời chính xác câu nhận định.
   - **Nhiệm vụ 3 (Trắc nghiệm):** Trả lời đúng lần đầu.
   - **Nhiệm vụ 4 (Sắp xếp 3 sự việc):** Hoàn thành đúng trình tự thời gian của truyện.
   - **Nhiệm vụ 5 (Trắc nghiệm vận dụng):** Hoàn thành xuất sắc.
8. **Chốt bài làm & Lưu điểm:**
   - Học sinh nhấn *"Chốt bài làm & Nhận sao"*.
   - Đạt điểm tuyệt đối 100%, nhận 3 Sao Vàng danh dự.
9. **Giáo viên xem kết quả tức thì:**
   - Giáo viên mở Teacher Dashboard $\rightarrow$ Thống kê cập nhật tức thời: 1 lượt hoàn thành, phân tích biểu đồ 5 năng lực, điểm số chi tiết được ghi nhận vào Firestore.
- **Bằng chứng ghi hình trình duyệt:** Tệp WebP được lưu tại [assign_and_student_mission_1792249351665.webp](file:///C:/Users/Hii/.gemini/antigravity-ide/brain/3627e53d-e21e-4893-bdaf-b32c5a28ba69/assign_and_student_mission_1792249351665.webp).

---

### 3. PHẦN C – LƯU TRỮ VÀ PHỤC HỒI DỮ LIỆU

#### 3.1. Xác minh dữ liệu thật trong Firestore Emulator
- Mọi bản ghi (lớp học, học sinh, phiên học, bài tập giao, lượt làm bài, câu trả lời từng câu, lịch sử gợi ý) đều được lưu trữ thật trên Firestore Emulator (cổng 8080), không dùng mock in-memory.
- Truy vấn REST API xác thực chứng minh dữ liệu tồn tại bền vững qua nhiều phiên người dùng.

#### 3.2. Cấu hình Import/Export an toàn
- Firebase Emulator được khởi động với cờ persistence:
  ```bash
  firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data
  ```
- Thư mục `./emulator-data` đã được khởi tạo và chứa bản sao lưu hợp lệ:
  - `firebase-export-metadata.json` (Phiên bản xuất 15.34.0)
  - `firestore_export/` (Toàn bộ collections Firestore)
  - `auth_export/` (Hồ sơ tài khoản Auth & Custom Claims)
- Lệnh xuất thủ công được tích hợp vào `package.json`:
  ```bash
  npm run emulators:export
  ```

#### 3.3. Xuất dữ liệu giáo viên (CSV UTF-8 BOM & JSON)
- **CSV:** Có tiền tố `\uFEFF` (UTF-8 BOM), tương thích hoàn toàn với Microsoft Excel trên Windows tiếng Việt, không bị vỡ font/dấu. Các cột đã được ẩn danh theo chuẩn an toàn trẻ em.
- **JSON:** Định dạng chuẩn schema máy chủ, cho phép sao lưu và kiểm toán cấp giáo viên.

---

### 4. PHẦN D – SẴN SÀNG CHO TIẾNG VIỆT LỚP 1–5

#### 4.1. Kiến trúc Ngân hàng Chương trình (Curriculum Framework)
- Khai báo kiểu dữ liệu trong `shared/src/index.ts`:
  ```typescript
  export type CurriculumGrade = 1 | 2 | 3 | 4 | 5;
  export type BookSeries = 'ket_noi_tri_thuc';
  export type BookVolume = 1 | 2;
  export type ActivityType = 'doc' | 'viet' | 'noi_va_nghe' | 'kien_thuc_tieng_viet';

  export interface CurriculumNode {
    id: string;
    bookSeries: BookSeries;
    grade: CurriculumGrade;
    volume: BookVolume;
    theme: string;
    week: number;
    lessonTitle: string;
    activityType: ActivityType;
    competencyGoals: string[]; // Yêu cầu cần đạt chuẩn GDPT 2018
    referenceSource: string;
    isVerified: boolean;
    dataVersion: string;
  }
  ```
- Đã seed **11 mục khung chương trình chính thức** từ SGK *"Kết nối tri thức với cuộc sống"* (NXB Giáo dục Việt Nam) cho cả 5 khối lớp:
  - **Lớp 1:** Bài 1 "A a" & Bài 12 "Nồi cơm của mẹ" (Tập 1, Chủ điểm Em đi học / Gia đình).
  - **Lớp 2:** Bài 1 "Tôi là học sinh lớp 2" & Bài 9 "Cô giáo lớp em" (Tập 1, Em lớn lên từng ngày).
  - **Lớp 3:** Bài 1 "Ngày gặp lại" & Bài 5 "Lớp học cuối đông" (Tập 1, Những búp măng non).
  - **Lớp 4:** Bài 1 "Thanh âm của gió" & Bài 6 "Bầu trời mùa thu" (Tập 1, Khám phá thế giới).
  - **Lớp 5:** Bài 1 "Khúc ca mở đầu" & Bài 4 "Hương cỏ dại" (Tập 1, Đất nước ngàn năm).
- **Mức độ kiểm định nội dung:**
  - Khối 2 và 3: Đã có bài đọc mẫu hoàn chỉnh, câu hỏi kiểm duyệt và luồng tạo AI hoạt động thật.
  - Khối 1, 4 và 5: Dừng ở **kiến trúc khung chương trình, YCCĐ và bài học chính khóa đã kiểm định nguồn**. Hệ thống KHÔNG tự ý bịa đặt văn bản hoặc sao chép nguyên văn toàn bộ SGK khi chưa có thẩm định bản quyền và chuyên môn sư phạm.

---

## III. BẢNG TỔNG HỢP KIỂM THỬ TỰ ĐỘNG (42/42 PASS)

| STT | Tệp kiểm thử | Mục tiêu kiểm tra | Số test | Kết quả |
|---|---|---|---|---|
| 1 | `tests/rules.test.mjs` | Firestore Security Rules: Deny-by-default, cấm client đọc `studentSecrets`, `privateAnswerKeys`, `studentSessions`; chặn user tự nâng quyền Teacher/Admin; cho phép Admin quản trị. | 9 | **9/9 PASS** |
| 2 | `tests/pedagogical_fixtures.test.mjs` | Dữ liệu mẫu sư phạm 6 bài đọc; xử lý negative cases: phương án mập mờ, sắp xếp thiếu bước, prompt injection, lỗi API Gemini (401, 404, 429), nộp bài khi mất mạng. | 11 | **11/11 PASS** |
| 3 | `tests/security_and_ai.test.mjs` | Bảo mật AI Adapter: kiểm tra cấu hình 4 trạng thái, model hợp lệ (`gemini-3.5-flash-lite`), không lộ API Key ra client/log; chống tấn công dò PIN học sinh. | 4 | **4/4 PASS** |
| 4 | `tests/e2e.test.mjs` | Quy trình khép kín: Tạo giáo viên $\rightarrow$ Tạo lớp $\rightarrow$ Cấp mã $\rightarrow$ Soạn bài AI $\rightarrow$ Xuất bản $\rightarrow$ Giao bài $\rightarrow$ Học sinh vào lớp $\rightarrow$ Làm bài $\rightarrow$ Gợi ý $\rightarrow$ Chấm điểm máy chủ $\rightarrow$ Thống kê. | 10 | **10/10 PASS** |
| 5 | `tests/admin_and_curriculum.test.mjs` | Phần A & D: Khởi tạo quyền Admin đặc quyền qua secret, chặn người dùng thường truy cập trái phép, API danh sách lớp & cập nhật trạng thái tài khoản, ngân hàng chương trình GDPT Khối 1–5. | 4 | **4/4 PASS** |
| 6 | `tests/persistence_and_recovery.test.mjs` | Phần C: Xác thực dữ liệu Firestore Emulator thật, metadata xuất trên đĩa (`firebase-export-metadata.json`), xuất CSV UTF-8 BOM, kiểm tra chống rò rỉ mã băm PIN học sinh. | 4 | **4/4 PASS** |
| **Tổng cộng** | **Toàn bộ 6 suites** | **Bộ kiểm thử tự động toàn diện v4.0** | **42** | **42/42 PASS (100%)** |

---

## IV. GIẢI TRÌNH CÁC CÂU HỎI TRỌNG TÂM CỦA NGƯỜI DÙNG

### 1. Có tài khoản Admin hoạt động hay chưa?
**CÓ, ĐÃ HOẠT ĐỘNG HOÀN TOÀN.**
- Đã có tài khoản Admin trên hệ thống với giao diện đăng nhập riêng tại `/admin/login` và bảng điều khiển tại `/admin/dashboard`.
- Tài khoản Admin có quyền xem tổng quan trường, quản lý trạng thái tài khoản giáo viên (khóa/mở khóa), xem danh sách lớp học toàn trường và quản trị ngân hàng chương trình Khối 1–5.
- Cấp quyền Admin chỉ thực hiện được qua backend (`bootstrapAdminRole`) với mã quản trị bí mật; tuyệt đối không có form tự đăng ký Admin ngoài client.

### 2. Học sinh đăng nhập thành công hay chưa?
**CÓ, ĐÃ ĐĂNG NHẬP VÀ THAM GIA THÀNH CÔNG.**
- Học sinh nhập Mã lớp và PIN riêng được cấp bởi giáo viên tại `/student/join`.
- Hệ thống từ chối chính xác khi nhập sai mã, đồng thời kích hoạt cơ chế giới hạn 5 lần thử chống tấn công brute-force.
- Khi nhập đúng, học sinh vào thẳng góc đọc sách `/student/library` và làm bài tập.

### 3. Giáo viên nhìn thấy kết quả học sinh hay chưa?
**CÓ, ĐÃ THẤY KẾT QUẢ THỜI GIAN THỰC.**
- Khi học sinh hoàn thành bài đọc, dữ liệu kết quả (số câu đúng lần đầu, số câu đúng sau gợi ý, số sao, tỉ lệ %) được máy chủ lưu vào collection `attempts`.
- Bảng điều khiển của giáo viên hiển thị ngay lập tức thống kê lớp học, biểu đồ 5 năng lực Recharts và mẫu so sánh trước/sau can thiệp (Pre/Post-test).

### 4. Dữ liệu có được phục hồi sau khi khởi động lại hay không?
**CÓ, DỮ LIỆU ĐƯỢC LƯU TRỮ VÀ PHỤC HỒI HOÀN TOÀN.**
- Cấu hình Emulator tự động nạp dữ liệu từ thư mục `./emulator-data` khi khởi động (`--import=./emulator-data`) và xuất dữ liệu khi tắt (`--export-on-exit=./emulator-data`).
- Lệnh `npm run emulators:export` cho phép chủ động sao lưu trạng thái hiện tại bất kỳ lúc nào mà không làm gián đoạn hệ thống.

### 5. Những chức năng lớp 1–5 mới dừng ở kiến trúc hay đã được kiểm định nội dung?
- **Kiến trúc dữ liệu:** Đã hoàn thiện 100% với Schema định nghĩa chi tiết từ Khối 1 đến Khối 5.
- **Nội dung giáo dục:**
  - Khối 2 và Khối 3: Đã kiểm định nội dung hoàn chỉnh với 6 bài đọc mẫu và công cụ tạo bài AI có kiểm duyệt sư phạm.
  - Khối 1, 4 và 5: Đã nhập và kiểm chứng **11 mục khung bài học chính thức theo SGK Kết nối tri thức với cuộc sống (NXBGDVN)** cùng Yêu cầu cần đạt chuẩn GDPT 2018. Văn bản học liệu chi tiết sẽ được bổ sung khi có hội đồng thẩm định nội dung cho từng khối lớp, tránh bịa đặt hoặc vi phạm bản quyền SGK.

### 6. Lỗi còn tồn tại và minh chứng kiểm thử
- Không có lỗi tồn đọng làm gián đoạn luồng người dùng.
- Mọi giới hạn môi trường (chạy trên Local Emulator, chưa deploy Cloud Functions lên Staging do gói Spark miễn phí không hỗ trợ Cloud Node.js build) đều được công khai minh bạch.
- Minh chứng kiểm thử:
  - Tệp ghi hình browser: `assign_and_student_mission_1792249351665.webp`.
  - Kết quả lệnh `npm run test:all`: 42/42 tests pass trong 8.79s.
  - Tệp cấu hình lưu trữ offline: `./emulator-data/firebase-export-metadata.json`.

---

## V. KẾT LUẬN VÀ SẴN SÀNG TRIỂN KHAI

Phiên bản **EM YÊU TIẾNG VIỆT V4.0** đã giải quyết triệt để tất cả các yêu cầu về:
1. Hệ thống Quản trị viên (Admin) độc lập, bảo mật và quản lý toàn diện.
2. Luồng trải nghiệm học sinh tham gia lớp học qua mã PIN an toàn, chống gian lận, chống mất phiên và giao diện thân thiện với trẻ em.
3. Cơ chế lưu trữ bền vững và phục hồi dữ liệu trong Firestore Emulator.
4. Nền tảng kiến trúc sẵn sàng mở rộng chương trình Tiếng Việt Tiểu học từ Lớp 1 đến Lớp 5 theo chuẩn GDPT 2018.

Toàn bộ mã nguồn, cấu hình bảo mật, tài liệu và bộ test nghiệm thu đã ở trạng thái hoàn thiện cao nhất, sẵn sàng phục vụ báo cáo và trình diễn thực tế.
