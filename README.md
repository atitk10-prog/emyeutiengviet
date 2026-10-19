# EM YÊU TIẾNG VIỆT

> **Khẩu hiệu:** “Mỗi ngày một câu chuyện – Mỗi ngày thêm yêu tiếng Việt”  
> **Đề tài:** Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3.  
> **Phiên bản:** 4.0 Hardened & Acceptance-Ready (Nâng cấp tổng hợp · Gemini 3.5-flash-lite · 100% Vector & Lucide Icons)

---

## 1. Giới thiệu dự án

**EM YÊU TIẾNG VIỆT** là ứng dụng web tương tác được thiết kế chuyên biệt cho giáo viên tiểu học và học sinh lớp 2–3, đặc biệt phù hợp cho các lớp học có điều kiện thiết bị hạn chế hoặc vùng cao:
- **Dành cho Giáo viên:** Hỗ trợ tạo bản nháp bài đọc và câu hỏi bằng AI (Google Gemini `gemini-3.5-flash-lite`), giao diện chỉnh sửa trực tiếp nội dung bài nháp (Inline Draft Editor), soạn bài thủ công, duyệt xuất bản, quản lý lớp theo năm học (`academicYear`), giao bài bất biến phiên bản, theo dõi năng lực đọc hiểu qua 5 kỹ năng cốt lõi và xuất báo cáo CSV/JSON.
- **Dành cho Học sinh:** Giao diện trực quan với linh vật Chim Xanh đồng hành bằng đồ họa vector độc quyền, tùy chỉnh cỡ chữ đọc bài, nghe đọc mẫu bằng giọng nói tiếng Việt, giải nghĩa từ khó tức thời, thực hiện 3 dạng bài tập đọc hiểu (Trắc nghiệm A/B/C, Đúng/Sai, Sắp xếp trình tự) và nhận gợi ý sư phạm khi trả lời chưa chính xác.
- **Tài liệu kiểm toán & báo cáo nghiệm thu:**
  - Nhật ký nâng cấp One-Pass v4.0: [`ONEPASS_CHANGELOG.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/ONEPASS_CHANGELOG.md)
  - Kế hoạch triển khai Cloud Staging: [`CLOUD_STAGING_DEPLOY_PLAN.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/CLOUD_STAGING_DEPLOY_PLAN.md)
  - Báo cáo kiểm toán cuối: [`FINAL_RELEASE_AUDIT.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/FINAL_RELEASE_AUDIT.md)
  - Báo cáo kiểm thử & QA: [`QA_REPORT.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/QA_REPORT.md)
  - Bộ ca kiểm thử sư phạm mẫu: [`EMYTV_SAMPLE_CASES.json`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/EMYTV_SAMPLE_CASES.json)

---

## 2. Ma trận Cổng nghiệm thu (Release Gates G1–G4)

| Cổng nghiệm thu | Mô tả cổng | Trạng thái nghiệm thu | Minh chứng & Điều kiện hoàn tất |
| :--- | :--- | :---: | :--- |
| **G1: Cổng Chức năng cốt lõi (Functional Core Gate)** | Hoàn thiện luồng sư phạm khép kín: Đăng nhập giáo viên, quản lý lớp theo năm học, cấp mã PIN học sinh, soạn bài thủ công & duyệt bài, 6 bài mẫu GDPT, học sinh đọc/nghe, 3 dạng câu hỏi (MCQ, True/False, Sequence), chấm điểm 2 giai đoạn, gợi ý sư phạm và xuất báo cáo UTF-8 BOM CSV. | **PASS** | 10/10 bước E2E test (`tests/e2e.test.mjs`) và 11/11 bài test sư phạm (`tests/pedagogical_fixtures.test.mjs`) vượt qua 100%. |
| **G2: Cổng Bảo mật dữ liệu & Đánh giá (Security & Assessment Gate)** | Quy tắc Firestore Rules Deny-by-default; cách ly tuyệt đối `privateAnswerKeys` và `studentSecrets` khỏi client; băm mã PIN bằng PBKDF2 10.000 vòng; khóa thử lại có mục tiêu chống tấn công vét cạn (không làm tê liệt cả lớp); chống leo thang đặc quyền `bootstrapTeacherRole`. | **PASS** | 6/6 test Rules (`tests/rules.test.mjs`) và 4/4 test bảo mật (`tests/security_and_ai.test.mjs`) xác minh 100%. |
| **G3: Cổng Dịch vụ AI Thực tế (Live AI Service Gate)** | Tích hợp Google Gemini với model hiện hành `gemini-3.5-flash-lite` và `gemini-3.8-flash`; đọc biến môi trường backend `GEMINI_MODEL`; hỗ trợ tệp bí mật `functions/.secret.local`; hiển thị 4 trạng thái AI minh bạch; điểm cuối `testAIConnection` an toàn, chống spam; không fallback sang model đã khai tử. | **READY_UNVERIFIED / CHỜ KHÓA THẬT** *(BLOCKED cho Live Call nếu chưa có key)* | Mã nguồn, Adapter và test endpoint đã sẵn sàng 100%. Khi cung cấp `GEMINI_API_KEY` hợp lệ, hệ thống chuyển tức thời sang trạng thái `VERIFIED`. Không bao giờ báo thành công giả khi thiếu key. |
| **G4: Cổng Triển khai Cloud Staging (Cloud Staging Gate)** | Triển khai hạ tầng thực tế lên Firebase Cloud Staging (`em-yeu-tieng-viet---staging`): Cloud Functions v2, Secret Manager, Firestore Rules, và Hosting. | **BLOCKED** | Tuân thủ cam kết: Dự án Cloud hiện tại ở gói Spark (Free). **Đang tạm dừng đợi người dùng nâng cấp gói Blaze và ra lệnh deploy chính thức.** |

---

## 3. Ngăn xếp công nghệ (Tech Stack)

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Canvas Confetti.
- **Backend:** Firebase Cloud Functions (TypeScript, Node.js 20/22 runtime).
- **Cơ sở dữ liệu:** Google Cloud Firestore (kết nối trực tuyến và qua Firestore Emulator).
- **Xác thực:** Firebase Authentication (Giáo viên Email/Password; Học sinh Anonymous Auth gắn mã bảo mật tại máy chủ).
- **Bảo mật:**
  - Firestore Security Rules: Deny-by-default, cách ly đáp án `privateAnswerKeys` và mã băm `studentSecrets` khỏi client.
  - Mã hóa PIN học sinh: Thuật toán PBKDF2 với **10.000 vòng lặp** và so sánh hằng số thời gian `crypto.timingSafeEqual`.
  - Khóa chống tấn công vét cạn đích danh (Targeted Lockout): Khóa 5 phút theo cặp `cleanClassCode_cleanAccessCode`, không gây ảnh hưởng đến học sinh khác.
  - Kiểm soát quyền: Chặn tài khoản ẩn danh tự cấp quyền `bootstrapTeacherRole` và kiểm tra `email_verified` ở môi trường Production.
- **Trí tuệ nhân tạo:** Adapter Google Gemini (mặc định model **`gemini-3.5-flash-lite`**, lựa chọn chất lượng cao **`gemini-3.8-flash`**, hỗ trợ cấu hình biến môi trường **`GEMINI_MODEL`** và tệp bí mật `functions/.secret.local`) kèm bộ kiểm định định dạng Zod.

---

## 4. Hướng dẫn khởi động môi trường phát triển (Local Emulators)

Để chạy trọn vẹn hệ thống gồm Firebase Local Emulator Suite và Web Dev Server:

### Bước 1: Khởi động Firebase Local Emulator Suite
Mở Terminal 1 (PowerShell trên Windows):
```powershell
# Thiết lập đường dẫn Java 21 và khởi động emulators
$env:JAVA_HOME = "$PSScriptRoot\.jdk21\jdk-21.0.12.1+1-jre"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx firebase-tools emulators:start --only auth,firestore,functions
```
*Các cổng dịch vụ:*
- **Auth Emulator:** `http://127.0.0.1:9099`
- **Firestore Emulator:** `http://127.0.0.1:8080`
- **Functions Emulator:** `http://127.0.0.1:5001`
- **Emulator UI:** `http://127.0.0.1:4000`

### Bước 2: Khởi động Giao diện Web (Frontend)
Mở Terminal 2:
```bash
npm run dev
```
Truy cập ứng dụng tại: **`http://localhost:3000`**

---

## 5. Chạy các bài kiểm thử tự động (Test Suites)

Dự án đã tích hợp đầy đủ 4 bộ kiểm thử tự động với 31 bài test:

```bash
# 1. Chạy TOÀN BỘ 31 bài kiểm thử trong một lệnh
npm run test:all

# Hoặc chạy từng bộ kiểm thử độc lập:
# a. Kiểm tra Firestore Security Rules (6 tests)
npm run test:rules

# b. Kiểm tra Kiểm định Sư phạm & Ca biên từ EMYTV_SAMPLE_CASES.json (11 tests)
npm run test:pedagogical

# c. Kiểm tra Bảo mật, Anti-Brute-Force & Trạng thái AI (4 tests)
npm run test:security

# d. Kiểm tra Toàn diện Luồng Sư phạm End-to-End (10 tests)
npm run test:e2e
```

---

## 6. Kịch bản chạy thử nghiệm (Demo) trong 5 phút

### Phần 1: Giáo viên quản lý, soạn bài và giao bài
1. Mở trình duyệt tại `http://localhost:3000`, bấm **"Tôi là Giáo viên"**.
2. Tại trang Đăng nhập, bấm nút **"Dùng tài khoản Demo Giáo viên (Cô Lan Phương)"**.
3. Tại bảng điều khiển, bấm nút **"Nạp 6 bài đọc mẫu (Lớp 2 & 3)"** ở góc trên bên phải. Hệ thống sẽ ghi 6 bài đọc chuẩn GDPT vào Firestore.
4. Chuyển sang tab **"Soạn & Duyệt bài"**:
   - Quan sát Banner Trạng thái AI (Google Gemini - `gemini-3.5-flash-lite`).
   - Bấm nút **"Kiểm tra kết nối AI"** để chạy thử nghiệm kết nối trực tiếp.
   - Bấm **"Tải khung bài mẫu soạn thủ công"** để xem bản nháp bài đọc.
   - Bấm nút **"Chỉnh sửa nội dung & câu hỏi"** để trải nghiệm chế độ sửa nháp trực tiếp (Inline Editor): sửa tiêu đề, câu chữ bài đọc, các phương án A/B/C, đáp án đúng máy chủ, gợi ý sư phạm.
   - Bấm **"Duyệt & Xuất bản bài học"**.
5. Chuyển sang tab **"Lớp học & Học sinh"**:
   - Bấm **"Tạo Lớp Học Mới"** (ví dụ: *Lớp 2A*, Khối 2, Năm học *2025-2026*).
   - Bấm **"Thêm học sinh & cấp mã pin"** (ví dụ tên: *Sơn Ca*). Hệ thống tự sinh mã bảo mật ngẫu nhiên và hiển thị thẻ đăng nhập (Lưu ý: ghi nhớ Mã lớp và Mã riêng).
6. Chuyển sang tab **"Thư viện bài đọc"**:
   - Bấm **"Giao bài cho lớp"** tại bài đọc *Chim sâu nhỏ và vườn cam*.
   - Chọn lớp *Lớp 2A* vừa tạo và xác nhận giao bài.

### Phần 2: Học sinh đăng nhập và làm bài
1. Bấm **Đăng xuất** ở thanh điều hướng (hoặc mở Cửa sổ ẩn danh mới `Incognito`).
2. Bấm **"Em là Học sinh"** (hoặc truy cập `http://localhost:3000/student/join`).
3. Nhập **Mã Lớp Học** và **Mã Học Sinh** đã cấp ở trên.
4. Vào **Góc đọc sách**, bấm **"Bắt đầu đọc truyện ngay"**:
   - Bấm các mức cỡ chữ **A, A+, A++, A+++** để điều chỉnh văn bản phù hợp tầm mắt.
   - Bấm nút **"Nghe đọc mẫu"** để nghe giọng đọc Web Speech API.
   - Bấm vào từ ngữ màu vàng nổi bật (*thoăn thoắt, gặm nhấm...*) để xem popup giải nghĩa từ.
   - Bấm nút **"Em đã đọc xong – Bắt đầu thử thách!"**.
5. Làm 5 câu hỏi đọc hiểu:
   - *Câu 1:* Chọn thử một đáp án sai để trải nghiệm **Gợi ý sư phạm** mà không bị lộ đáp án chính xác. Sau đó bấm **"Em thử lại lần nữa"** và chọn đáp án đúng.
   - *Câu 2 & 3:* Trắc nghiệm Đúng/Sai và Trắc nghiệm A/B/C.
   - *Câu 4:* Sắp xếp 3 sự việc bằng nút mũi tên Lên/Xuống hoặc kéo thả.
   - *Câu 5:* Câu hỏi liên hệ vận dụng.
6. Bấm **"Chốt bài làm & Nhận sao"** để xem màn hình tổng kết với pháo hoa và bảng điểm phân tách rõ ràng số câu đúng lần 1 và số câu sửa đúng sau gợi ý.

### Phần 3: Giáo viên kiểm tra số liệu và xuất báo cáo
1. Đăng nhập lại vào tài khoản Giáo viên.
2. Tại tab **"Tổng quan & Biểu đồ"**: Xem biểu đồ Recharts cập nhật kết quả thật từ Firestore của học sinh vừa làm (không còn số liệu giả +16%).
3. Tại tab **"Đề xuất củng cố AI"**: Bấm **"Phân tích & Lấy gợi ý"** để nhận kế hoạch củng cố phân hóa 10-15 phút.
4. Tại tab **"Xuất dữ liệu & Báo cáo"**: Bấm **"Tải Báo Cáo CSV"** (tệp tải về mở trực tiếp bằng Microsoft Excel với font tiếng Việt chuẩn).

---

## 7. Kế hoạch triển khai Cloud Staging (`em-yeu-tieng-viet---staging`)

Chi tiết toàn bộ các bước triển khai đám mây được mô tả tại [`CLOUD_STAGING_DEPLOY_PLAN.md`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/CLOUD_STAGING_DEPLOY_PLAN.md).

> [!CAUTION]
> **Cam kết:** Không tự ý nâng cấp gói thanh toán Blaze hoặc deploy lên Cloud Staging khi chưa có sự phê duyệt bằng văn bản từ chủ dự án.

---

## 8. Nguyên tắc an toàn dữ liệu trẻ em

1. **Hạn chế định danh:** Ứng dụng chỉ lưu trữ mã số học sinh và biệt danh do giáo viên cấp (ví dụ: *Họa Mi, Sơn Ca*), không lưu số điện thoại, email hay ảnh đại diện của trẻ.
2. **Không thu âm giọng nói:** Tính năng đọc mẫu chỉ sử dụng Text-to-Speech một chiều qua Web Speech API; không thu âm hay phân tích giọng nói của học sinh.
3. **Bảo mật đáp án tuyệt đối:** Đáp án đúng và logic chấm bài chỉ nằm ở backend (`privateAnswerKeys`), ngăn chặn hoàn toàn việc xem trước đáp án qua DevTools hay truy vấn Firestore client.

---
**EM YÊU TIẾNG VIỆT © 2026** — *Chung tay vì thế hệ mầm non yêu tiếng mẹ đẻ.*
