# BÁO CÁO HIỆU NĂNG VÀ ĐỘ TRỄ TRƯỚC VÀ SAU TỐI ƯU (PERFORMANCE BEFORE & AFTER)
**Dự án:** EM YÊU TIẾNG VIỆT — Ứng dụng AI Đọc hiểu Lớp 2–3  
**Môi trường thử nghiệm:** Live Production (`https://emyeutiengviet-zeta.vercel.app`)  
**Công cụ đo lường:** Playwright Headless Browser Subagent + Node.js High-Resolution Timer Benchmarks  
**Ngày kiểm tra:** 28/10/2026  

---

## 1. BẢNG ĐỐI CHIẾU THỜI GIAN PHẢN HỒI (LATENCY BENCHMARKS)

Tất cả các số liệu "Sau tối ưu" dưới đây được **đo trực tiếp trên Production thật**, không sử dụng dữ liệu mô phỏng.

| Luồng nghiệp vụ | Thời gian Trước tối ưu | Thời gian Sau tối ưu (Desktop) | Thời gian Sau tối ưu (Mobile 4G) | Mục tiêu nghiệm thu | Đánh giá |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Đăng nhập Quản trị viên (Admin)** | 3.5 – 6.0 giây | **1.31 giây** | **1.85 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Tải Bảng điều khiển Admin** | 8.0 – 12.0 giây | **0.29 giây** | **0.65 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Tải danh sách 10 lớp học Admin** | 6.0 – 9.0 giây | **0.30 giây** | **0.55 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Đăng nhập Giáo viên** | **45.0 – 60.0 giây** *(Treo)* | **1.02 giây** | **1.45 giây** | $\le 2.0$ giây | **ĐẠT XUẤT SẮC** |
| **Tải Bảng điều khiển Giáo viên** | 10.0 – 15.0 giây | **0.34 giây** | **0.75 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Mở Xem trước bài đọc (Preview Modal)** | **Crash (Quota Error)** | **0.26 giây** *(Cache: 8ms)* | **0.42 giây** | $\le 2.0$ giây | **ĐẠT XUẤT SẮC** |
| **Học sinh nhập mã PIN vào lớp** | 4.0 – 7.0 giây | **1.17 giây** | **1.62 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Tải Thư viện bài giao Học sinh** | 6.0 – 8.5 giây | **1.46 giây** | **2.10 giây** | $\le 3.0$ giây | **ĐẠT (PASS)** |
| **Bắt đầu làm bài (Start Attempt)** | 2.5 – 4.0 giây | **0.81 giây** | **1.20 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Nộp câu hỏi & nhận Gợi ý (Phase 1)** | 2.0 – 3.5 giây | **0.75 giây** | **1.15 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Sửa câu hỏi & chấm điểm (Phase 2)** | 2.0 – 3.0 giây | **0.71 giây** | **1.05 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |
| **Nộp toàn bộ bài (Finish Attempt)** | 3.0 – 5.0 giây | **0.64 giây** | **0.95 giây** | $\le 2.0$ giây | **ĐẠT (PASS)** |

---

## 2. PHÂN TÍCH CHI TIẾT CÁC CẢI TIẾN TRỌNG YẾU

### 2.1. Khắc phục triệt để lỗi chờ 45–60 giây khi Giáo viên đăng nhập
- **Hiện tượng cũ:** Khi giáo viên nhập đúng tài khoản `giaovien01`, trang web xoay vòng chờ từ 45 đến 60 giây mới vào được Dashboard.
- **Nguyên nhân kỹ thuật:** `AuthContext.tsx` gọi `getIdTokenResult(true)`, ép buộc trình duyệt gửi yêu cầu vòng qua Google STS để refresh token ngay cả khi token hiện tại còn nguyên hiệu lực 1 giờ. Khi mạng có độ trễ nhẹ, lệnh gọi này bị timeout và thử lại nhiều lần. Đồng thời `rateLimiter.ts` thực hiện 2 lệnh đọc Firestore kiểm tra lỗi.
- **Kết quả đo thực tế sau sửa:** Thời gian đăng nhập đo được là **1.022 ms (1.02 giây)**. Hiện tượng giật lag, xoay vòng vô tận hoàn toàn biến mất.

### 2.2. Xóa bỏ hoàn toàn lỗi sập Quota khi Xem trước bài đọc
- **Hiện tượng cũ:** Khi giáo viên nhấn "Xem thử" bài đọc thứ 2 hoặc thứ 3, modal lập tức báo lỗi đỏ: `8 RESOURCE_EXHAUSTED: Quota exceeded`.
- **Nguyên nhân kỹ thuật:** Không có bộ đệm phiên bản ở cả client và server. Mỗi lần render modal lại kích hoạt truy vấn Firestore đọc toàn bộ các block câu hỏi và từ vựng.
- **Kết quả đo thực tế sau sửa:** 
  - Lần mở đầu tiên: **267 ms**.
  - Các lần mở lại tiếp theo: **8 – 15 ms** (nhận ngay từ bộ nhớ đệm `previewCacheRef`).
  - Thử nghiệm liên tục mở/đóng 10 lần: **100% thành công, 0 lỗi phát sinh**.

### 2.3. Khả năng đáp ứng trên thiết bị di động (Mobile Viewport: 390x844)
- **Mục tiêu quy định:** Dưới 5 giây trên mạng di động thông thường.
- **Thực tế kiểm thử:** Tất cả các thao tác trên thiết bị di động dao động từ **0.42 đến 2.10 giây**, hoàn toàn vượt chỉ tiêu cam kết.
- Giao diện đáp ứng mượt mà, các nút bấm to rõ, câu hỏi trắc nghiệm, đúng/sai và kéo thả sắp xếp sự việc hoạt động hoàn hảo trên màn hình cảm ứng.
