# BẢNG ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG PHÁT HÀNH (RELEASE READINESS) — EM YÊU TIẾNG VIỆT
**Dự án:** Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản:** V5.2 (Tháng 10/2026)  
**Tiêu chuẩn đánh giá:** [AGENTS.md](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/AGENTS.md) & [V5_2_ACCEPTANCE_CHECKLIST.md](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/V5_2_ACCEPTANCE_CHECKLIST.md)

---

## 1. TỔNG HỢP TRẠNG THÁI BA CẤP ĐỘ PHÁT HÀNH

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. LOCAL DEMO & COMPETITION PRESENTATION:   READY (SẴN SÀNG 100%)         │
│  2. CLOUD STAGING ENVIRONMENT:               CONDITIONALLY READY (CHỜ GCP) │
│  3. SCHOOL PRODUCTION DEPLOYMENT:            REQUIRES INSTITUTIONAL SETUP  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ĐÁNH GIÁ CHI TIẾT THEO TỪNG CẤP ĐỘ

### 2.1 CẤP ĐỘ 1: READY FOR LOCAL DEMO (Trình diễn Cục bộ & Hội thi)
- **Trạng thái:** **SẴN SÀNG 100% (READY)**
- **Môi trường:** Chạy trên máy tính xách tay / máy chiếu thông qua Firebase Local Emulator Suite và Vite Dev Server (`localhost:3000`).
- **Các tiêu chí đã hoàn thành và kiểm chứng thực nghiệm:**
  - [x] **Không phụ thuộc Internet hoặc API trả phí:** Hệ thống có sẵn 6 bài học mẫu chất lượng cao (3 bài lớp 2, 3 bài lớp 3), bộ dữ liệu giả lập đầy đủ lớp học, học sinh và bài tập.
  - [x] **Kiểm thử tự động:** **70/70 test cases độc lập đạt 100% PASS** trong thời gian 19.1 giây.
  - [x] **Giao diện & Trải nghiệm thực tế:** Đã kiểm chứng trọn vẹn qua Browser Subagent cho cả 3 vai trò:
    * *Giáo viên:* Thư viện học liệu, bộ lọc khối 2–3, xem trước học sinh, thêm/xóa/nhân bản/sắp xếp câu hỏi ($1 \le N \le 20$), xuất bản phiên bản v2 bất biến, chống giao trùng bài.
    * *Học sinh:* Đăng nhập bằng mã PIN an toàn, đọc bài, nghe đọc mẫu Web Speech, hoàn thành 3 dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Sắp xếp), nhận gợi ý sư phạm khi làm sai, tổng kết nhận sao vàng.
    * *Quản trị viên (Admin):* Giám sát hệ thống, quản lý tài khoản giáo viên, đặt lại mật khẩu an toàn.
  - [x] **Độ tin cậy dữ liệu:** 100% lưu trữ và truy vấn qua Cloud Firestore Emulator, không dùng mock data tĩnh, chống mất dữ liệu khi tải lại trang (F5).
  - [x] **Chi phí:** Hoàn toàn **0 VNĐ**, không yêu cầu thẻ tín dụng hay gói cước trả phí.

---

### 2.2 CẤP ĐỘ 2: READY FOR CLOUD STAGING (Môi trường Thử nghiệm Đám mây)
- **Trạng thái:** **SẴN SÀNG VỀ MẶT KỸ THUẬT (CONDITIONALLY READY)**
- **Điều kiện hiện tại:**
  - [x] Mã nguồn TypeScript của toàn bộ Monorepo (`shared`, `functions`, `web`) đã build thành công tuyệt đối (Exit code 0), không có lỗi lint hay lỗi kiểu dữ liệu.
  - [x] Đã cấu hình phân tách môi trường trong [firebase.json](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/firebase.json) và [firestore.rules](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/firestore.rules).
  - [x] Bộ Adapter AI hỗ trợ chuyển đổi linh hoạt giữa các dòng mô hình Google Gemini (`gemini-2.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`).
- **Các bước cấu hình cần thiết trước khi triển khai Cloud Staging thật:**
  1. *Kích hoạt dự án Firebase Cloud:* Nâng gói dự án lên **Blaze Plan** (Pay-as-you-go) trên Firebase Console để máy chủ Node.js Cloud Functions hoạt động. *(Hiện tại tuân thủ nghiêm ngặt chỉ thị: KHÔNG tự nâng Blaze, KHÔNG deploy Cloud).*
  2. *Cấu hình Firebase Secrets:* Thiết lập 2 bí mật môi trường thông qua Firebase CLI:
     ```bash
     firebase functions:secrets:set GEMINI_API_KEY
     firebase functions:secrets:set ADMIN_BOOTSTRAP_SECRET
     ```
  3. *Lệnh triển khai chính thức:*
     ```bash
     firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
     ```

---

### 2.3 CẤP ĐỘ 3: READY FOR SCHOOL PRODUCTION (Triển khai Thực tế tại Trường học)
- **Trạng thái:** **CẦN BỔ SUNG QUY TRÌNH THỂ CHẾ & HƯỚNG DẪN VẬN HÀNH (REQUIRES INSTITUTIONAL SETUP)**
- **Đánh giá về tính an toàn & Pháp lý trẻ em:**
  - [x] **Bảo vệ quyền riêng tư học sinh (Child Privacy by Design):** Không thu thập họ tên đầy đủ, ngày sinh, số điện thoại, địa chỉ email hay hình ảnh/khuôn mặt học sinh. Chỉ dùng biệt danh (Display Alias) và mã học sinh.
  - [x] **An toàn mã PIN:** Mã PIN truy cập được băm một chiều với Salt ngẫu nhiên trên Cloud Function. Tuyệt đối không lưu văn bản thô (Zero Plaintext).
  - [x] **Trách nhiệm AI:** AI chỉ đóng vai trò trợ lý sinh bản nháp cho giáo viên và đề xuất củng cố từ dữ liệu ẩn danh. Giáo viên là người chịu trách nhiệm duyệt nội dung trước khi xuất bản tới học sinh. AI không tự quyết định điểm số hay đánh giá học lực lâu dài của trẻ.
- **Các yêu cầu hành chính & hạ tầng cần hoàn tất trước khi đưa vào lớp học thật:**
  1. *Quy chế & Chấp thuận từ Nhà trường / Phụ huynh (Parental Consent):* Văn bản thông qua Hội đồng trường và Ban đại diện cha mẹ học sinh theo quy định của Bộ Giáo dục & Đào tạo.
  2. *Kiểm soát hạn mức chi phí (Budget Cap Alerts):* Cấu hình hạn mức ngân sách Google Cloud (ví dụ: giới hạn 200.000 VNĐ – 500.000 VNĐ/tháng) để kiểm soát chi phí gọi AI khi nhân rộng ra nhiều lớp.
  3. *Tập huấn Giáo viên:* Sử dụng tài liệu [V5_2_USER_GUIDE.md](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/V5_2_USER_GUIDE.md) để tập huấn giáo viên thao tác duyệt bài, xuất bản và theo dõi biểu đồ tiến bộ của học sinh.
  4. *Đường truyền mạng:* Đảm bảo phòng tin học hoặc thiết bị máy tính bảng của học sinh kết nối ổn định; trường hợp mất mạng, hệ thống có chế độ khôi phục phiên học (Attempt Recovery).

---

## 3. CHECKLIST RÀ SOÁT LỖI TỒN ĐỌNG (ZERO CRITICAL DEFECTS)

| Hạng mục rà soát | Tình trạng | Kết luận nghiệm thu |
|:---|:---:|:---|
| Lỗi cú pháp / TypeScript compilation | 0 lỗi | Build thành công 100% |
| Lỗi kiểm thử tự động (Unit / E2E / Rules) | 0 lỗi | **70 / 70 tests PASS (100%)** |
| Lỗi giao bài trùng lặp phiên bản | Đã xử lý triệt để | Backend Transaction + Cảnh báo UI |
| Lỗi xóa mất dữ liệu học sinh | Đã xử lý triệt để | Khóa bất biến Version + Chặn xóa bài đã giao |
| Rò rỉ đáp án hoặc mật khẩu ra ngoài Client | Đã xử lý triệt để | Lưu tại Private Collections Deny-all-client |

---

## 4. KẾT LUẬN VÀ KHUYẾN NGHỊ HÀNH ĐỘNG

Dự án **EM YÊU TIẾNG VIỆT V5.2** đã **đạt chuẩn tuyệt đối để trình diễn, quay phim, chụp ảnh và thuyết minh đề tài tại Hội thi sáng tạo Kỹ thuật / Khoa học Giáo dục**. 

Khuyến nghị Ban đề tài:
1. Giữ nguyên cấu hình máy cục bộ hiện tại (Local Emulator + Vite 3000) phục vụ trình diễn.
2. Sử dụng danh mục minh chứng [DEMO_EVIDENCE_INDEX.md](file:///c:/Users/Hii/Desktop/GITHUB/EMYTV_AGENT_PACK/DEMO_EVIDENCE_INDEX.md) để đưa vào Slide thuyết trình và Video clip dự thi.
3. **Dừng phát triển tính năng mới** theo đúng kế hoạch để tập trung tối đa cho công tác hoàn thiện hồ sơ và luyện tập thuyết trình.
