# BÁO CÁO NGUYÊN NHÂN GỐC TIÊU THỤ FIRESTORE READS BẤT THƯỜNG (ROOT CAUSE REPORT)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI Đọc hiểu Lớp 2–3  
**Môi trường:** Vercel Production (`https://emyeutiengviet-zeta.vercel.app`)  
**Firebase Cũ (Staging):** `em-yeu-tieng-viet---staging`  
**Firebase Mới (Production):** `emyeutiengviet-prod`  
**Ngày kiểm toán:** 28/10/2026  
**Mức độ ưu tiên:** P0 — Khẩn cấp  

---

## 1. TỔNG QUAN HIỆN TRẠNG TRƯỚC KHI XỬ LÝ
Hệ thống chạy trên gói miễn phí **Firebase Spark** (hạn mức đọc 50.000 reads/ngày). Trong quá trình thử nghiệm nội bộ với chỉ một vài người dùng, hệ thống đã phát sinh:
- **Firestore Reads:** Đạt đỉnh **57.000 / 50.000 lượt/ngày**, vượt hạn mức 7.000 lượt.
- **Firestore Writes:** 119 / 20.000 lượt/ngày (hoàn toàn bình thường).
- **Hệ quả trực tiếp:**
  1. Khi giáo viên mở "Xem trước học sinh" (Student Preview Modal), hệ thống bị sập với mã lỗi `8 RESOURCE_EXHAUSTED: Quota exceeded`.
  2. Đăng nhập giáo viên bị treo và có lúc phải chờ **45–60 giây**.
  3. Các tính năng AI tạo đề, tạo câu hỏi và phát âm mẫu bị ngắt kết nối do lỗi cạn kiệt tài nguyên Firestore phụ trợ.

---

## 2. NGUYÊN NHÂN GỐC (ROOT CAUSES IDENTIFIED)

Qua kiểm toán toàn diện mã nguồn backend (`/api`), frontend (`/web`), Firebase Security Rules và nhật ký truy vấn, nhóm kỹ thuật đã phát hiện **5 nguyên nhân gốc** gây ra tình trạng bùng nổ lượt đọc:

### Nguyên nhân 1: Quét toàn bộ Collection học sinh trên Dashboard Quản trị (`AdminDashboard`)
- **Tệp nguồn:** [`api/admin.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/admin.ts)
- **Hàm gây lỗi:** `handleListAllClassesAdmin` và `handleListAcademicYears`.
- **Cơ chế lỗi:** Mỗi lần Admin mở Dashboard hoặc tải danh sách lớp học, backend đã gọi trực tiếp:
  ```ts
  const [classesSnap, studentsSnap, usersSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('students').get(), // QUÉT TOÀN BỘ 200+ HỌC SINH!
    db.collection('users').get()     // QUÉT TOÀN BỘ USERS!
  ]);
  ```
  Để đếm số lượng học sinh của từng lớp, code đã kéo toàn bộ document học sinh về bộ nhớ rồi lọc theo `classId`. Khi có nhiều lớp và nhiều học sinh, mỗi lượt mở trang tiêu thụ hàng trăm lượt đọc không cần thiết.

### Nguyên nhân 2: Không lưu đệm Khóa đáp án riêng tư (`privateAnswerKeys`) và Truy vấn N+1
- **Tệp nguồn:** [`api/attempts.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/attempts.ts)
- **Hàm gây lỗi:** `handleSubmitAnswer` và `handleGetStudentLibrary`.
- **Cơ chế lỗi:** 
  1. Mỗi khi học sinh nộp câu trả lời cho từng câu hỏi (nhiệm vụ đọc hiểu có 5 câu, mỗi câu có 2 lượt trả lời), backend đều thực hiện đọc `privateAnswerKeys` từ Firestore:
     ```ts
     const keyDoc = await db.collection('privateAnswerKeys').doc(lessonVersionId).get();
     ```
     Với 1 học sinh hoàn thành 1 bài 5 câu, số lượt đọc phát sinh lên tới 10–15 lượt chỉ để lấy cùng một bộ đáp án cố định.
  2. Trong `handleGetStudentLibrary`, vòng lặp đã duyệt qua từng bài giao và kéo trực tiếp subcollection `versions` mà không có cache bộ nhớ đệm, nhân số lượt đọc lên gấp nhiều lần.

### Nguyên nhân 3: Rate Limiter đọc kiểm tra Document ngay cả khi Đăng nhập thành công
- **Tệp nguồn:** [`api/_helpers/rateLimiter.ts`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/api/_helpers/rateLimiter.ts)
- **Hàm gây lỗi:** `clearAuthSuccess` / `clearFailedAttempts`.
- **Cơ chế lỗi:** Khi người dùng nhập đúng thông tin đăng nhập, hàm dọn dẹp bộ đếm đăng nhập sai đã thực hiện:
  ```ts
  const doc = await docRef.get();
  if (doc.exists) {
    await docRef.delete();
  }
  ```
  Cả `accountKey` và `ipKey` đều bị đọc 2 lần cho mỗi lần đăng nhập thành công, làm lãng phí 2 reads/login ngay cả khi người dùng không hề nhập sai lần nào.

### Nguyên nhân 4: Vòng lặp cưỡng bức làm mới Token Firebase STS (`getIdTokenResult(true)`)
- **Tệp nguồn:** [`web/src/context/AuthContext.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/context/AuthContext.tsx)
- **Cơ chế lỗi:** Tham số `getIdTokenResult(true)` kích hoạt cưỡng bức làm mới token qua mạng đến máy chủ Google STS mỗi khi component `AuthContext` cập nhật state. Điều này tạo ra độ trễ mạng mạng kép từ 45–60 giây cho mỗi lượt đăng nhập giáo viên, đồng thời kích hoạt các request kiểm tra profile lặp lại.

### Nguyên nhân 5: Xem trước bài học (`Student Preview Modal`) bị gọi trùng lặp
- **Tệp nguồn:** [`web/src/pages/TeacherDashboard.tsx`](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/web/src/pages/TeacherDashboard.tsx)
- **Cơ chế lỗi:** Khi giáo viên click "Xem thử" nhiều lần để kiểm tra các bài đọc, component không lưu đệm dữ liệu bản xem trước đã tải. Mỗi lần mở/đóng modal đều kích hoạt gọi lại API lấy chi tiết bài đọc và subcollection phiên bản.

---

## 3. TÁC ĐỘNG TỔNG HỢP VÀ KẾT LUẬN

| Thành phần | Lượt đọc trước tối ưu (Mỗi thao tác) | Nguyên nhân chính |
| :--- | :--- | :--- |
| **Admin Dashboard** | 240 – 350 reads / lần mở | Quét toàn bộ `students` & `users` collection |
| **Teacher Dashboard** | 35 – 50 reads / lần mở | Tải lại danh sách lớp và học sinh không cache |
| **Xem trước bài học** | 8 – 15 reads / lần bấm | Kéo subcollection version và bài đọc lặp lại |
| **Lượt làm bài học sinh** | 18 – 25 reads / 1 bài 5 câu | Đọc lặp `privateAnswerKeys` từng câu hỏi |
| **Đăng nhập giáo viên** | 4 – 8 reads + treo 45-60s | Rate limiter check + STS token refresh loop |

**Kết luận:** Hệ thống vượt hạn mức 50.000 reads hoàn toàn là do **lỗi kiến trúc truy vấn và thiếu cơ chế caching đa tầng (multi-tier caching)**, không phải do tải người dùng thực tế. Việc chuyển sang Firebase mới là cần thiết để có môi trường sạch cho video dự thi, nhưng **bắt buộc phải giải quyết triệt để các lỗi truy vấn trên trước khi chuyển giao**.
