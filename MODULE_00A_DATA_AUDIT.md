# BÁO CÁO KIỂM TOÁN DỮ LIỆU ADMIN VÀ FIREBASE EMULATOR (MẢNG 0A)
## DỰ ÁN: EM YÊU TIẾNG VIỆT — PHIÊN BẢN V5.2.1
**Chế độ thực hiện:** **CHỈ KIỂM TOÁN ĐỌC (READ-ONLY AUDIT) — TUYỆT ĐỐI CHƯA CHỈNH SỬA / CHƯA XÓA DỮ LIỆU**  
**Thời điểm kiểm toán:** 18/10/2026 (Giờ hệ thống: 10:55:34 UTC+7)  
**Môi trường:** Firebase Local Emulator Suite (Firestore: 8080, Auth: 9099, Functions: 5001)

---

## 1. Môi trường kết nối thực tế & Cấu hình Firebase Project

* **Firebase Project ID:** `em-yeu-tieng-viet-demo` (được cấu hình đồng nhất trong `.firebaserc`, `firebase.json`, `web/src/firebase.ts`, `functions/src/index.ts`).
* **Firestore Emulator:** Đang chạy tại `127.0.0.1:8080` (Tiến trình `java.exe` PID 12332).
* **Firebase Auth Emulator:** Đang chạy tại `127.0.0.1:9099`.
* **Cloud Functions Emulator:** Đang chạy tại `127.0.0.1:5001`.
* **Hosting / Frontend:** Vite Dev Server chạy tại `http://localhost:3000` (PID 564).

---

## 2. Số liệu hiện trạng thực tế từ Firestore & Firebase Auth

Truy vấn chỉ đọc trực tiếp toàn bộ các collection trên Firestore Emulator và danh sách tài khoản Firebase Auth cho kết quả chính xác như sau:

| STT | Tập hợp dữ liệu (Collection / Service) | Số lượng bản ghi thực tế | Trạng thái / Phân loại chi tiết |
| :---: | :--- | :---: | :--- |
| 1 | **`users` (Firestore)** | **198** | • **140 giáo viên** (`role: 'teacher'`, 140 active, 0 suspended)<br>• **58 quản trị viên** (`role: 'admin'`, sinh qua các bài test) |
| 2 | **Firebase Authentication (`accounts`)** | **269** | • **140 tài khoản email giáo viên**<br>• **58 tài khoản email admin**<br>• **71 tài khoản học sinh / anonymous tokens** |
| 3 | **`classes` (Firestore)** | **65** | • **56 lớp Khối 2**, **9 lớp Khối 3**<br>• **64 lớp** mang `academicYear: "2025-2026"`, 1 lớp chưa gắn năm học<br>• **59/65 lớp** bị thiếu trường `studentCount` trên document |
| 4 | **`students` (Firestore)** | **106** | • **5 học sinh thuộc Lớp 2C demo** (`MXK4FH`)<br>• **101 học sinh** thuộc các lớp kiểm thử tự động |
| 5 | **`studentSecrets` (Firestore)** | **106** | • Chứa muối (`salt`) và mã băm PIN (PBKDF2/SHA-512) tương ứng 106 học sinh |
| 6 | **`studentSessions` (Firestore)** | **62** | • Phiên đăng nhập học sinh sinh ra trong các lượt chạy test |
| 7 | **`lessons` (Firestore)** | **38** | • **18 bài đã xuất bản** (`published`)<br>• **18 bài nháp** (`draft`)<br>• **2 bài lưu trữ** (`archived`) |
| 8 | **`assignments` (Firestore)** | **45** | • Các đợt giao bài (gồm bài giao Lớp 2C và các đợt giao trong bài test) |
| 9 | **`attempts` (Firestore)** | **44** | • Lượt làm bài thực tế và lượt làm bài kiểm thử |
| 10 | **`curriculumNodes` (Firestore)** | **11** | • Các mục khung chuẩn kiến thức GDPT 2018 |

---

## 3. Đối chiếu Admin Dashboard & Nguyên nhân chênh lệch số lượng

### 3.1. Hiện tượng người dùng phát hiện:
- Ảnh chụp màn hình trước đây hiển thị **128 giáo viên và 59 lớp**.
- Dữ liệu xuất ra và truy vấn hiện tại hiển thị **140 giáo viên và 65 lớp**.

### 3.2. Nguyên nhân kỹ thuật gốc rễ:
1. **Thời điểm chụp ảnh và thời điểm chạy test:**
   - Mỗi lần chạy bộ kiểm thử `npm test` hoặc các tệp `tests/*.mjs`, mỗi suite kiểm thử đều có khối `SETUP` tạo tài khoản và lớp học mới bằng dấu thời gian thực `Date.now()`.
   - Cụ thể: 1 lượt chạy kiểm thử tạo thêm đúng **12 tài khoản giáo viên** và **6 lớp học**:
     $$\text{Số cũ: } 128 \text{ GV} + 12 \text{ GV (test)} = \mathbf{140 \text{ GV}}$$
     $$\text{Số cũ: } 59 \text{ Lớp} + 6 \text{ Lớp (test)} = \mathbf{65 \text{ Lớp}}$$
   - Do Firebase Emulator đang chạy chế độ nền (`npx firebase-tools emulators:start --import=./emulator-data`), mọi thao tác ghi của các bài test đều tích lũy trực tiếp vào bộ nhớ RAM của tiến trình Emulator mà chưa từng được dọn dẹp (teardown).
2. **Khác biệt giữa Thẻ tổng quan (Overview KPI) và Bảng danh sách chi tiết:**
   - Trong `AdminDashboard.tsx`:
     * Thẻ KPI "Giáo viên": Lấy từ hàm `getAdminOverview` đếm số document trong `users` có `role == 'teacher'`. Hiện tại trả về **140**.
     * Bảng danh sách "Quản lý Giáo viên": Lấy từ hàm `listTeachers` truy vấn `users` có `role == 'teacher'`. Trả về đúng **140 dòng**.
     * Thẻ KPI "Lớp học": Lấy từ `classesSnap.size`. Hiện tại trả về **65**.
     * Bảng danh sách "Toàn bộ Lớp học": Lấy từ `listAllClassesAdmin`. Trả về đúng **65 dòng**.
   - Do đó, số lượng tại cùng một thời điểm giữa Thẻ KPI và Bảng danh sách là **hoàn toàn thống nhất (140 GV, 65 Lớp)**. Sự chênh lệch 128 vs 140 và 59 vs 65 là do **thời điểm chụp ảnh diễn ra trước lượt chạy test cuối cùng**.

---

## 4. Điều tra chi tiết Lớp 2C (Mã MXK4FH) — Vì sao Admin hiển thị Sĩ số = 0?

### 4.1. Dữ liệu thực tế của Lớp 2C trong cơ sở dữ liệu
Kiểm tra document Lớp 2C cốt lõi:
- **Class ID:** `OA3tsKnUG6FEaWSmWSE4`
- **Tên lớp:** `Lop 2C`
- **Mã lớp (`classCode`):** `MXK4FH`
- **Khối:** `2`
- **Năm học:** `2025-2026`
- **Giáo viên phụ trách (`teacherUid`):** `B5H9PeMrZowS3ewPm4BQ8aM4fkU1` (tài khoản `giaovien.tieuhoc@emytv.edu.vn`)
- **Trạng thái:** `active`

Kiểm tra tập hợp `students` với điều kiện `classId == 'OA3tsKnUG6FEaWSmWSE4'`:
Tìm thấy chính xác **5 học sinh thực tế**:
1. `00OgNg0jGYox5gYCU7aM` — Bí danh: **Minh Triet** | Mã: `HS999` | Trạng thái: `active`
2. `1Ja12vFY12n1vzzodUcu` — Bí danh: **BBao An** | Mã: `HS7802` | Trạng thái: `active`
3. `1W2l6rH4fSCeCCLtID4q` — Bí danh: **An Nhien** | Mã: `HS5349` | Trạng thái: `active`
4. `OwJTfKb5fhgfVZTYUTpy` — Bí danh: **Hoa Mi** | Mã: `HS888` | Trạng thái: `active`
5. `uMTHwoKaXS1DqXkXTwTU` — Bí danh: **ThTho Con** | Mã: `HS1234` | Trạng thái: `active`

### 4.2. Nguyên nhân Admin Dashboard hiển thị Sĩ số = 0:
Xác định chính xác vị trí lỗi trong mã nguồn backend Cloud Function [functions/src/index.ts:2582–2595](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/functions/src/index.ts#L2582-L2595):
```ts
// Hàm listAllClassesAdmin:
const classes = classesSnap.docs.map((doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    grade: data.grade,
    classCode: data.classCode,
    academicYear: data.academicYear || '2025-2026',
    studentCount: data.studentCount || 0, // <--- NGUYÊN NHÂN LỖI TẠI ĐÂY!
    teacherUid: data.teacherUid,
    teacherName: teacherMap[data.teacherUid] || 'Giáo viên phụ trách',
    createdAt: data.createdAt || Date.now()
  };
});
```
* **Phân tích:** Hàm `listAllClassesAdmin` đọc trường tĩnh `data.studentCount` từ document của collection `classes`.
* Tuy nhiên, trong mô hình dữ liệu Firestore của dự án, khi học sinh được thêm vào (qua seed script, nhập lẻ hoặc chuyển lớp), trường `studentCount` trên document `classes/OA3tsKnUG6FEaWSmWSE4` **không tồn tại** (`undefined`). Do đó, biểu thức `data.studentCount || 0` trả về giá trị **`0`**.
* Thực tế kiểm tra toàn bộ 65 lớp: có tới **59 / 65 lớp** bị `undefined` trường `studentCount` này.
* Trong khi đó, giao diện giáo viên [TeacherDashboard.tsx:255–268](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/TeacherDashboard.tsx#L255-L268) truy vấn trực tiếp vào tập hợp `students`:
```ts
const qStudents = query(
  collection(db, 'students'),
  where('classId', '==', classId)
);
const snap = await getDocs(qStudents);
```
Vì vậy, giao diện giáo viên đếm theo số lượng document thực tế (`snap.size`) nên hiển thị đầy đủ và chính xác **5 học sinh**.

---

## 5. Nguồn gốc dữ liệu kiểm thử trong `tests/*.mjs` và Scripts

Kiểm tra toàn bộ 10 tệp kiểm thử trong thư mục `tests/`:
1. `tests/v5_1_security_and_ux.test.mjs` (Dòng 63–81):
   - Gọi `createUser('admin.v51')` $\rightarrow$ sinh email `admin.v51.<timestamp>.<random>@tieuhoc.edu.vn`.
   - Gọi `createUser('teacher.v51')` $\rightarrow$ sinh `teacher.v51...`.
   - Tạo lớp `Lớp 2C Thử Nghiệm V5.1`. (Đã tìm thấy **10 lớp trùng tên này** với 10 timestamp khác nhau tương ứng 10 lần chạy test!).
2. `tests/v5_2_lesson_lifecycle.test.mjs` (Dòng 58–78, 519):
   - Tạo `teacher_lifecycle_<timestamp>@emytv.edu.vn`.
   - Tạo `Lớp 2A Khảo Sát V5.2` và `Lớp 2B Chuyển Đến V5.2.1`.
3. `tests/security_and_ai.test.mjs` (Dòng 60–65):
   - Tạo `teacher_sec_<timestamp>@emytv.edu.vn`.
   - Tạo `Lớp 3A - Bảo Mật` (Tìm thấy **4 lớp trùng tên**).
4. `tests/e2e.test.mjs` (Dòng 79):
   - Tạo `Lớp 2A - Thực Nghiệm` (Tìm thấy **3 lớp trùng tên**).
5. `tests/ux_audio_attempt_excel.test.mjs` (Dòng 72, 230–280):
   - Nhập hàng loạt tài khoản giáo viên test từ bảng Excel.
   - Tạo các lớp `Lớp 2B Thử Nghiệm V5`.
6. `tests/persistence_and_recovery.test.mjs`:
   - Tạo `admin.persistence...` và `teacher.persistence...`.

**Kết luận:** 138/140 tài khoản giáo viên và 63/65 lớp học hiện tại **100% là sản phẩm phụ tích lũy của các ca kiểm thử tự động** qua nhiều lần chạy mà không có cơ chế dọn dẹp (teardown).

---

## 6. Phân loại dữ liệu & Những bản ghi BẮT BUỘC PHẢI GIỮ LẠI

Để bảo vệ an toàn tuyệt đối cho bản trình diễn, dữ liệu được phân loại như sau:

### 6.1. Dữ liệu cốt lõi (BẮT BUỘC GIỮ LẠI 100% — KHÔNG ĐƯỢC CHẠM VÀO)
1. **Tài khoản Giáo viên Demo:**
   - UID: `B5H9PeMrZowS3ewPm4BQ8aM4fkU1`
   - Email: `giaovien.tieuhoc@emytv.edu.vn`
   - Tên hiển thị: `giaovien.tieuhoc`
   - Mật khẩu đăng nhập: `Giaovien123456`
   - Dữ liệu gắn liền: Lớp 2C, 5 học sinh, các bài học đã giao, các lượt làm bài.
2. **Lớp học Demo:**
   - Class ID: `OA3tsKnUG6FEaWSmWSE4`
   - Tên lớp: `Lop 2C`
   - Mã lớp: `MXK4FH`
   - Giáo viên phụ trách: `B5H9PeMrZowS3ewPm4BQ8aM4fkU1`
3. **5 Học sinh Demo của Lớp 2C:**
   - `00OgNg0jGYox5gYCU7aM` — Minh Triet (`HS999`)
   - `1Ja12vFY12n1vzzodUcu` — BBao An (`HS7802`)
   - `1W2l6rH4fSCeCCLtID4q` — An Nhien (`HS5349`)
   - `OwJTfKb5fhgfVZTYUTpy` — Hoa Mi (`HS888`)
   - `uMTHwoKaXS1DqXkXTwTU` — ThTho Con (`HS1234`)
4. **Tài khoản Quản trị viên (Admin) Demo:**
   - UID: `vJnpY0TxpP3K2bXTN3NJCq3Gjzsi` (hoặc `qoEP0ZYjJk4FjfrEmQABn4K1z5M3`)
   - Email: `admin.test.1792249843797.w3kj8@tieuhoc.edu.vn`
   - Mật khẩu: `Matkhau123!@#`
5. **Kho học liệu mẫu GDPT 2018 & Âm thanh:**
   - 6 bài đọc mẫu chuẩn (3 bài lớp 2, 3 bài lớp 3).
   - Bài đọc vòng đời `lesson_lifecycle_audit_v521` (V1, V2).
   - Tệp âm thanh tiếng Việt người thật: `giong_doc_mau_tieng_viet.mp3`, `giong_doc_tieng_viet_that.wav`, `giong_doc_ngoc_huyen.wav`.

### 6.2. Dữ liệu nghi ngờ cần xác minh với người dùng
- Giáo viên: `FsBjRpjjGNPck9g7p5Dy5O4FSUy2` (`cophuong@emyeutiengviet.edu.vn`, tên: `cophuong`).
- Lớp học: `pBQlLwUTgxlTP3ceg6mV` (`Lớp 2A - Ban Mai`, mã `9JZVTW`).
- *Lý do:* Có thể là tài khoản do người dùng hoặc giáo viên tự tạo thủ công trong quá trình thử nghiệm giao diện. **Tạm thời giữ nguyên, không xóa**.

---

## 7. Danh sách đề xuất xử lý kỹ thuật (CHƯA THỰC THI — CHỜ PHÊ DUYỆT)

Dưới đây là các phương án kỹ thuật đề xuất để người dùng xem xét, **chưa áp dụng bất kỳ thay đổi nào**:

### Đề xuất 1: Sửa lỗi Sĩ số 0 tại Admin Dashboard (`listAllClassesAdmin`)
- **Hiện trạng:** `listAllClassesAdmin` đọc `data.studentCount || 0`.
- **Giải pháp đề xuất:** Trong `functions/src/index.ts`, nâng cấp hàm `listAllClassesAdmin` để đếm số lượng học sinh thực tế từ `students` theo từng `classId` (hoặc tra cứu từ map `classId -> count` tương tự như cách đếm số lớp của giáo viên `teacherClassCount`).
- **Ưu điểm:** Lớp 2C sẽ hiển thị chuẩn xác **5 em**, và toàn bộ các lớp khác sẽ hiển thị đúng số học sinh thực có mà không cần sửa đổi dữ liệu Firestore.

### Đề xuất 2: Phương án cô lập bộ Test khỏi môi trường Demo (Chống phát sinh tài khoản ảo)
Hiện tại, cả `npm run dev` (Vite) và `npm test` đều trỏ chung vào cùng một Firebase Emulator instance (`em-yeu-tieng-viet-demo`).
Đề xuất 2 giải pháp cô lập:
* **Phương án A (Tách Project ID kiểm thử):** Trong các tệp `tests/*.mjs`, đổi `projectId` sang `emytv-isolated-test`. Firebase Emulator hỗ trợ đa project hoặc tự động cô lập cơ sở dữ liệu theo project ID, giúp dữ liệu test không bao giờ xuất hiện trên `em-yeu-tieng-viet-demo`.
* **Phương án B (Teardown tự động trong test):** Bổ sung hook `after(async () => { ... })` vào cuối mỗi tệp test để tự động xóa sạch các user, class, student mang ID vừa tạo trong ca test đó.

### Đề xuất 3: Phương án dọn dẹp dữ liệu rác (Khi người dùng yêu cầu)
Nếu người dùng đồng ý làm sạch Dashboard Admin về trạng thái chuẩn chỉ gồm dữ liệu Demo chính thống:
* Giữ lại 1 Admin chuẩn, 1 Giáo viên chuẩn (`giaovien.tieuhoc`), 1 Lớp 2C (`MXK4FH`), 5 Học sinh cốt lõi, và các bài đọc GDPT mẫu.
* Lập script dọn dẹp có dry-run, hiển thị danh sách trước khi xóa các tài khoản `*.tieuhoc.edu.vn` mang tiền tố `test`, `export`, `v51`, `v52`.

---

## 8. Bảng đối chiếu trạng thái kiểm toán (PASS / FAIL / NOT VERIFIED)

| Hạng mục kiểm toán | Kết quả | Chi tiết kết luận |
| :--- | :---: | :--- |
| **Xác định Project ID & Emulator ports** | **PASS** | `em-yeu-tieng-viet-demo` (Firestore: 8080, Auth: 9099, Func: 5001) |
| **Truy vấn chỉ đọc 100% các collection** | **PASS** | users (198), classes (65), students (106), lessons (38), attempts (44) |
| **Đối chiếu số lượng GV và Lớp trên Dashboard** | **PASS** | Thống nhất 140 GV và 65 Lớp. Chênh lệch 128/59 là do ảnh chụp trước lượt test |
| **Xác định nguyên nhân Sĩ số Lớp 2C = 0** | **PASS** | Lỗi logic tại `listAllClassesAdmin` đọc `data.studentCount` bị `undefined`. Thực tế Lớp 2C có đủ 5 học sinh trong collection `students` |
| **Xác định nguồn gốc 138 GV & 63 lớp test** | **PASS** | 100% sinh ra từ các ca kiểm thử `tests/*.mjs` chạy dồn vào Emulator |
| **Xác định các bản sao lưu hiện có** | **PASS** | `emulator-data/` và `emulator-data-backup-v5/` (nguyên vẹn từ 17/10/2026) |
| **Bảo toàn dữ liệu — Zero Write Policy** | **PASS** | Tuyệt đối không xóa, không sửa, không reset emulator, không tạo mock data |

---

## 9. Kết luận & Trạng thái dừng công việc

Toàn bộ công tác kiểm toán Mảng 0A đã hoàn thành bằng phương pháp truy vấn chỉ đọc (read-only). Không có bất kỳ thay đổi nào được thực hiện lên cơ sở dữ liệu hoặc mã nguồn hệ thống.

**ĐÃ DỪNG THỰC HIỆN THEO ĐÚNG CHỈ THỊ. KÍNH CHỜ NGƯỜI DÙNG XÁC NHẬN BƯỚC TIẾP THEO.**
