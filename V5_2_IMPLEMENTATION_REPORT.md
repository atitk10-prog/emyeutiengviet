# BÁO CÁO THỰC THI & NÂNG CẤP KỸ THUẬT V5.2 — EM YÊU TIẾNG VIỆT
**Dự án:** Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nâng cao năng lực đọc hiểu cho học sinh lớp 2–3  
**Phiên bản:** V5.2 (Nâng cấp toàn diện Vòng đời Bài học, Quản lý Câu hỏi Linh hoạt & Bất biến Phiên bản)  
**Ngày hoàn tất:** 18/10/2026  
**Ngăn xếp kỹ thuật:** React + TypeScript + Vite, Tailwind CSS, Firebase Functions (Node.js), Cloud Firestore, Firebase Auth.

---

## 1. MỤC TIÊU VÀ BỐI CẢNH NÂNG CẤP V5.2

Tiếp nối phiên bản V5.1 về an ninh và độ tin cậy tài khoản, phiên bản V5.2 tập trung giải quyết triệt để 5 bài toán nghiệp vụ sư phạm cốt lõi:
1. **Quản lý kho bài đọc linh hoạt:** Cho phép giáo viên lọc, tìm kiếm, xem trước dưới góc nhìn học sinh mà không sinh rác dữ liệu, và chỉnh sửa bài đã tạo.
2. **Quản lý câu hỏi tùy biến ($1 \le N \le 20$):** Bỏ giới hạn cố định 5 câu/bài; bổ sung bộ công cụ thêm 3 dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Sắp xếp), xóa, nhân bản (clone), và thay đổi thứ tự ($\uparrow \downarrow$).
3. **Cơ chế phiên bản bất biến (Immutable Versioning):** Sửa bài đã xuất bản/giao sẽ tự động tạo version mới (`v2`, `v3`...), giữ nguyên snapshot bài cũ và 100% dữ liệu lịch sử làm bài của học sinh.
4. **Chống giao bài trùng lặp (Duplicate Assignment Prevention):** Ngăn chặn việc bấm giao nhiều lần cùng một phiên bản cho một lớp trong cùng một đợt; có tùy chọn mở đợt kiểm tra mới.
5. **AI tạo thêm câu hỏi và hỗ trợ sư phạm:** Tích hợp AI tạo thêm 1–3 câu hỏi vào bản nháp hiện có, giáo viên toàn quyền duyệt trước khi xuất bản.

---

## 2. CÁC THAY ĐỔI KIẾN TRÚC & MÃ NGUỒN

### 2.1 Mở rộng Schema Dữ liệu (`shared/src/index.ts`)
- **`LessonDraftSchema`:**
  - Thay đổi ràng buộc mảng `questions` từ `length(5)` sang `min(1).max(20)` để hỗ trợ số lượng câu hỏi tùy biến.
- **`Lesson` Entity:**
  - Bổ sung các trường quản lý vòng đời:
    - `currentVersionNumber?: number`: Phiên bản hiện hành (bắt đầu từ 1).
    - `totalVersions?: number`: Tổng số phiên bản đã tạo.
    - `totalQuestions?: number`: Số lượng câu hỏi của phiên bản hiện tại.
    - `assignedClassCount?: number`: Số lớp học đã được giao bài này.
    - `draftData?: any`: Dữ liệu bản nháp đang soạn thảo chưa xuất bản.
- **`Assignment` Entity:**
  - Bổ sung `roundName?: string` (tên đợt giao bài, ví dụ: "Khảo sát đầu năm", "Ôn tập tuần 2").
  - Bổ sung `isDuplicatePrevented?: boolean` để nhận diện bài giao có cơ chế chống trùng.

### 2.2 Mở rộng Backend Cloud Functions (`functions/src/index.ts` & `aiAdapter.ts`)
1. **`saveLessonDraft`:**
   - Xác thực quyền giáo viên sở hữu bài học (`teacherUid === auth.uid`).
   - Lưu trữ bản nháp vào trường `draftData` của tài liệu `lessons/{lessonId}` và cập nhật `status: 'draft'`, `updatedAt: serverTimestamp()`.
2. **`publishLesson`:**
   - Tiếp nhận `lessonId` từ cả `data.lessonId` lẫn `data.draft.lessonId`.
   - Tính toán phiên bản tiếp theo: $V_{new} = V_{current} + 1$.
   - Tạo tài liệu snapshot bất biến: `lessons/{lessonId}/versions/{versionId}`.
   - Tách bộ đáp án bí mật và lưu tại `privateAnswerKeys/{versionId}`, từ chối mọi truy cập từ Client SDK.
   - Cập nhật tài liệu cha `lessons/{lessonId}` sang `status: 'published'`, cập nhật `currentVersionId`, `currentVersionNumber`, `totalQuestions`.
3. **`getTeacherLessons`:**
   - Truy vấn bài học của giáo viên hoặc bài học mẫu hệ sinh thái (`isSystemLesson` hoặc `seed-`).
   - Tính toán và trả về siêu dữ liệu tổng hợp: `assignedClassCount`, `totalQuestions`, `status`, `currentVersionNumber`.
4. **`getLessonDetail`:**
   - Trả về thông tin chi tiết bài học, phiên bản hiện hành, danh sách tất cả các phiên bản cũ (`versionsList`), và bộ đáp án máy chủ bảo mật nếu người gọi là giáo viên sở hữu.
5. **`archiveLesson`:**
   - Chuyển `status` của bài học thành `'archived'`.
   - Bảo toàn 100% dữ liệu lịch sử các đợt làm bài và điểm số của học sinh trong quá khứ.
6. **`deleteDraftLesson`:**
   - Kiểm tra an toàn: Nếu bài đã xuất bản hoặc đã giao cho học sinh (`assignedClassCount > 0` hoặc có assignments), hàm trả về lỗi từ chối và hướng dẫn chuyển sang dùng `archiveLesson`.
7. **`assignLesson` (Chống trùng lặp):**
   - Sử dụng Firestore transaction để kiểm tra xem lớp `classId` đã được giao `lessonVersionId` này trong đợt `roundName` hay chưa.
   - Nếu đã tồn tại và không bật cờ `forceNewRound`, backend từ chối tạo mới và trả về bài giao hiện có kèm cờ `alreadyAssigned: true`.
8. **`generateAdditionalQuestions`:**
   - Nhận nội dung văn bản bài đọc, khối lớp và số câu hỏi cần tạo thêm ($1 \le N \le 3$).
   - Tạo các câu hỏi mới kèm đáp án, gợi ý và giải thích sư phạm chuẩn JSON schema.

### 2.3 Nâng cấp Frontend (`web/src/pages/TeacherDashboard.tsx`)
1. **Kho bài đọc (Library View):**
   - Bộ lọc Khối lớp (Khối 2, Khối 3), Bộ lọc Trạng thái (Tất cả, Đã xuất bản, Bản nháp, Đã lưu trữ), Ô tìm kiếm theo tiêu đề bài đọc.
   - Huy hiệu phiên bản (ví dụ `v1`, `v2`), số lượng câu hỏi, số lớp đã giao.
2. **Modal Xem trước Học sinh (Student Preview Modal):**
   - Mô phỏng chính xác giao diện học sinh làm bài.
   - Tùy chỉnh cỡ chữ đọc (A, A+, A++, A+++).
   - Cho phép làm thử câu hỏi với phản hồi Đúng/Sai và xem gợi ý sư phạm tức thì.
   - Hoàn toàn chạy cục bộ (`read-only`), không ghi dữ liệu hoặc tạo attempt rác vào database.
3. **Bộ công cụ Soạn thảo Câu hỏi Linh hoạt:**
   - Nút `+ Thêm câu hỏi` hỗ trợ 3 dạng: Trắc nghiệm A/B/C, Đúng/Sai, Sắp xếp thứ tự.
   - Nút `Di chuyển lên` ($\uparrow$) và `Di chuyển xuống` ($\downarrow$) để thay đổi trình tự câu hỏi.
   - Nút `Nhân bản` (Clone) để sao chép nhanh câu hỏi tương tự.
   - Nút `Xóa câu hỏi` có xác nhận an toàn.
   - Nút `AI tạo thêm câu hỏi` (1–3 câu).
   - Nút `Lưu bản nháp` và `Duyệt & Xuất bản (vX)`.
4. **Modal Giao bài Cải tiến:**
   - Nhập tên đợt giao bài (`roundName`).
   - Cảnh báo rõ ràng khi lớp đã được giao phiên bản này.
   - Tùy chọn checkbox "Mở đợt luyện tập mới" (`forceNewRound`).

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG

Dự án đã thực hiện kiểm thử tự động toàn diện qua 10 bộ test suites:
- **Suite V5.2 chuyên sâu (`tests/v5_2_lesson_lifecycle.test.mjs`):** **9/9 PASS (100%)**
  1. *Save Draft & Validation:* Lưu nháp thành công, hỗ trợ $N$ câu hỏi linh hoạt.
  2. *Question CRUD & Reordering:* Thêm, sửa, xóa, hoán đổi thứ tự câu hỏi chính xác.
  3. *Publish Version 1:* Tạo snapshot bất biến v1 và bộ đáp án bí mật server-side.
  4. *Duplicate Assignment Prevention:* Chặn giao trùng cùng version cho cùng lớp trong cùng đợt.
  5. *Force New Round:* Cho phép giao đợt mới khi có cờ `forceNewRound`.
  6. *Student Attempt Integrity:* Học sinh làm bài trên snapshot v1 thành công, ghi nhận điểm số đúng.
  7. *Edit & Publish Version 2:* Chỉnh sửa và xuất bản v2 thành công, v1 và kết quả bài làm cũ không bị ảnh hưởng.
  8. *Archive vs Delete Protection:* Bảo vệ bài đã giao không bị hard-delete, hỗ trợ lưu trữ an toàn.
  9. *AI Additional Questions:* Sinh thêm câu hỏi bằng AI thành công với schema hợp lệ.
- **Toàn bộ hệ thống (`npm run test:all`):** **61/61 PASS (100%)**
  - Chạy tuần tự với `--test-concurrency=1`, đảm bảo không xung đột tài nguyên Firestore Emulator.

---

## 4. KẾT LUẬN & ĐÁNH GIÁ CHẤT LƯỢNG

Phiên bản V5.2 đã hoàn thành toàn bộ các yêu cầu đặt ra trong `EMYTV_V52_AGENT.md` và `V5_2_ACCEPTANCE_CHECKLIST.md`. Nền tảng "EM YÊU TIẾNG VIỆT" hiện nay sở hữu quy trình quản lý học liệu sư phạm hoàn chỉnh, bảo vệ dữ liệu học sinh tuyệt đối, và đáp ứng đầy đủ tiêu chí của một ứng dụng giáo dục chất lượng cao.
