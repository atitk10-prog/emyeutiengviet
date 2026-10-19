# NHẬT KÝ TIẾN ĐỘ THỰC HIỆN V5.2 — EM YÊU TIẾNG VIỆT
*Tệp trạng thái phục hồi nếu Antigravity bị ngắt đột ngột*

## TRẠNG THÁI TỔNG THỂ
- **Giai đoạn hiện tại:** Đã hoàn thành 100% Phase 0, 1, 2, 3, 4, 5 và kiểm thử tự động toàn diện Phase 6.
- **Trạng thái bản sao lưu:** Đã lưu trữ snapshot an toàn tại `backups/v5_2_pre_patch/`.
- **Trạng thái V5.1:** Đã chốt và nghiệm thu 100% tại `V5_1_SECURITY_UX_AUDIT.md`.
- **Kiểm thử tự động Monorepo:** 
  - `tests/v5_2_lesson_lifecycle.test.mjs`: **9/9 PASS (100%)**
  - `npm run test:all` (10 test suites): **61/61 PASS (100%)**
  - **Tổng cộng: 70/70 test cases PASS 100% không một lỗi nào.**
- **Build Status:**
  - `shared`: Build TypeScript ESM & CJS thành công (Exit 0).
  - `functions`: Build TypeScript Node.js thành công (Exit 0).
  - `web`: Build Vite production bundle thành công (Exit 0).

---

## BẢNG TIẾN ĐỘ CHI TIẾT TỪNG GIAI ĐOẠN

### Phase 0 — Chốt V5.1 & Bảo đảm an toàn phục hồi
- [x] Rà soát toàn bộ tài liệu quy chuẩn (`AGENTS.md`, `RECOVERY_STATUS.md`, `EMYTV_V52_AGENT.md`, `V5_2_ACCEPTANCE_CHECKLIST.md`).
- [x] Tạo thư mục sao lưu snapshot `backups/v5_2_pre_patch/` cho các tệp cốt lõi trước khi sửa.
- [x] Tạo tệp nghiệm thu `V5_1_SECURITY_UX_AUDIT.md` kèm 6 ảnh minh chứng thực tế và đánh giá TTS.
- [x] Cập nhật `package.json` với `--test-concurrency=1` cho lệnh `test:all`.
- [x] Khởi tạo `V5_2_PROGRESS.md`.

### Phase 1 — Kho bài đọc, Chỉnh sửa và Lưu trữ (P0)
- [x] Mở rộng schema `shared/src/index.ts`: hỗ trợ các trạng thái bài học (`draft`, `published`, `archived`), theo dõi `currentVersionNumber`, `totalVersions`, `totalQuestions`, `assignedClassCount`, `draftData`.
- [x] Xây dựng Cloud Functions backend:
  - `saveLessonDraft`: Cho phép lưu bản nháp đang soạn mà không làm xáo trộn bài đang xuất bản.
  - `getTeacherLessons`: Truy vấn toàn bộ bài đọc thuộc quyền sở hữu của giáo viên kèm bài học mẫu hệ thống (`seed-`), trả về trạng thái, số câu hỏi, phiên bản, số lớp đã giao.
  - `getLessonDetail`: Trả về chi tiết bài, phiên bản hiện tại, danh sách lịch sử tất cả các phiên bản (`versionsList`), và đáp án bí mật cho giáo viên sở hữu.
  - `archiveLesson`: Chuyển trạng thái sang `archived`, ẩn khỏi thư viện học sinh nhưng bảo toàn 100% dữ liệu lịch sử làm bài và điểm số.
- [x] Giao diện kho bài đọc trong `web/src/pages/TeacherDashboard.tsx`:
  - Bộ lọc thông minh: Lọc theo khối (Tất cả, Khối 2, Khối 3), trạng thái (Tất cả, Đã xuất bản, Bản nháp, Đã lưu trữ), ô tìm kiếm từ khóa realtime.
  - Nút "Xem thử như học sinh" (Student Preview): Xem trước bài đọc, đổi cỡ chữ, làm thử câu hỏi với phản hồi đúng/sai và giải thích, hoàn toàn an toàn cục bộ không tạo attempt.
  - Nút "Sửa / Tạo bản mới": Mở trình soạn bài nháp.
  - Nút "Giao bài cho lớp": Mở modal giao bài.
  - Nút "Lưu trữ": Ẩn bài an toàn.

### Phase 2 — Quản lý câu hỏi linh hoạt (P0)
- [x] Nút `+ Thêm câu hỏi` hỗ trợ 3 dạng chuẩn:
  - Trắc nghiệm A/B/C (3 phương án, 1 đáp án đúng).
  - Đúng / Sai (nhận định kèm 2 lựa chọn Đúng hoặc Sai).
  - Sắp xếp thứ tự (3 sự việc theo trình tự thời gian/logic).
- [x] Bộ điều khiển câu hỏi trực quan:
  - Di chuyển lên ($\uparrow$) và Di chuyển xuống ($\downarrow$) để thay đổi thứ tự câu hỏi.
  - Nhân bản câu hỏi (Clone): Sao chép toàn bộ nội dung sang câu hỏi mới với ID tự sinh an toàn.
  - Xóa câu hỏi (Delete): Có hộp thoại xác nhận an toàn trước khi xóa.
- [x] Hỗ trợ linh hoạt $1 \le N \le 20$ câu/bài:
  - Nâng cấp `LessonDraftSchema` trong `shared/src/index.ts` từ `z.array().length(5)` thành `z.array().min(1).max(20)`.
  - Loại bỏ hoàn toàn các logic hardcode giả định 5 câu trong tính toán điểm, gợi ý và tổng kết bài làm.
- [x] Kiểm tra tính hợp lệ (Validation):
  - Kiểm tra đầy đủ nội dung câu hỏi, không để trống prompt hoặc các phương án.
  - Đúng 1 đáp án hợp lệ cho trắc nghiệm và đúng/sai; thứ tự hoán vị chuẩn cho câu sắp xếp.

### Phase 3 — Phiên bản bất biến (Immutable Versioning) (P0)
- [x] Cơ chế xuất bản bất biến:
  - Khi chỉnh sửa một bài học đã xuất bản hoặc đã giao cho học sinh, hệ thống không sửa đè lên phiên bản cũ.
  - Bấm "Duyệt & Xuất bản" $\rightarrow$ tự động tăng phiên bản (`v1` $\rightarrow$ `v2` $\rightarrow$ `v3`...), tạo một bản snapshot bất biến trong `lessons/{lessonId}/versions/{newVersionId}` và lưu bộ đáp án bảo mật trong `privateAnswerKeys/{newVersionId}`.
- [x] Bảo vệ toàn vẹn lịch sử học sinh:
  - Các lượt làm bài cũ (`attempts`) của học sinh vẫn giữ nguyên liên kết tới snapshot `lessonVersionId` ban đầu.
  - Điểm số, đáp án lần đầu, đáp án sau gợi ý và số sao của học sinh không bị sai lệch khi giáo viên ra phiên bản mới.
- [x] Bảo vệ chống xóa mất dữ liệu:
  - Cloud Function `deleteDraftLesson` kiểm tra nghiêm ngặt: Nếu bài học đã xuất bản hoặc đã từng được giao cho học sinh, hệ thống từ chối xóa và yêu cầu giáo viên dùng tính năng "Lưu trữ" (`archiveLesson`).
- [x] Kiểm soát quyền hạn máy chủ (Server Authorization):
  - Xác thực nghiêm ngặt quyền sở hữu `teacherUid` tại từng endpoint backend; từ chối mọi yêu cầu can thiệp bài học từ người dùng không phải chủ sở hữu.

### Phase 4 — Giao bài chống trùng lặp (P0)
- [x] Kiểm tra trùng lặp giao bài tại máy chủ:
  - Cloud Function `assignLesson` kiểm tra Firestore transaction: Nếu lớp `classId` đã được giao cùng `lessonVersionId` trong cùng đợt (`roundName`), hệ thống từ chối giao trùng và trả về thông tin bài giao hiện tại.
- [x] Trải nghiệm giao bài trên Frontend:
  - Thêm trường nhập "Tên đợt giao" (mặc định: "Khảo sát định kỳ", "Ôn tập tuần 1",...).
  - Hiển thị thông tin cảnh báo nếu lớp đã có bài giao của phiên bản này.
  - Cung cấp tùy chọn "Tạo đợt luyện tập mới" (`forceNewRound`) nếu giáo viên chủ động muốn học sinh làm lại trong đợt kiểm tra mới.
- [x] Hiển thị nhãn trong Kho bài đọc:
  - Thẻ bài học hiển thị huy hiệu số lớp đã giao (`X lớp đã giao`) giúp giáo viên nắm bắt tức thì.

### Phase 5 — AI tạo thêm câu hỏi & Quản lý âm thanh & Báo cáo (P1)
- [x] AI tạo thêm câu hỏi (`generateAdditionalQuestions`):
  - Cloud Function nhận nội dung bài đọc, số câu cần thêm (1–3 câu) và dạng câu hỏi yêu cầu.
  - Gọi LLM adapter hoặc fallback sư phạm chuẩn để tạo câu hỏi mới phù hợp chuẩn ngữ liệu lớp 2–3.
  - Giáo viên có thể duyệt, xem trước, chỉnh sửa câu hỏi do AI tạo trước khi lưu nháp hoặc xuất bản.
- [x] Quản lý âm thanh đọc mẫu (`audioUrl`):
  - Hỗ trợ lưu trữ trường `audioUrl` an toàn trong snapshot phiên bản bài học.
  - Trình nghe thử audio có nút nghe, dừng và hiển thị trạng thái hỗ trợ âm thanh.
- [x] Báo cáo đánh giá chính xác theo phiên bản (`versionId`):
  - Báo cáo thống kê tiến độ và kỹ năng của giáo viên gắn liền với từng phiên bản bài giao, bảo đảm phân tích đúng đề thi và kỹ năng tương ứng.

### Phase 6 — Kiểm thử tự động & Nghiệm thu (P0)
- [x] Kiểm thử tự động:
  - Suite mới `tests/v5_2_lesson_lifecycle.test.mjs`: 9/9 test cases PASS 100% bao gồm toàn bộ vòng đời lưu nháp, sửa câu hỏi, bất biến phiên bản, chống giao bài trùng, bảo vệ lịch sử bài làm, AI sinh câu hỏi thêm.
  - Toàn bộ 10 test suites của dự án: 61/61 PASS 100%.
- [x] Chuẩn bị dữ liệu kiểm thử thực tế:
  - Giáo viên: `cophuong@emyeutiengviet.edu.vn` / `Giaovien123!`
  - Lớp học: `9JZVTW` (Lớp 2A - Ban Mai)
  - Học sinh: `Bé Bảo An`, mã PIN / Access Code: `KCEPJ9`
  - Quản trị viên: `admin@emyeutiengviet.edu.vn` / `Admin123!`
- [x] Xuất các tài liệu nghiệm thu V5.2:
  - `V5_2_IMPLEMENTATION_REPORT.md`
  - `V5_2_ACCEPTANCE.md`
  - `V5_2_USER_GUIDE.md`
  - `DEMO_CAPTURE_PLAN.md`

---
*Cập nhật lúc: 2026-10-18T00:54:00+07:00 — V5.2 Lập trình & Kiểm thử hoàn tất 100%.*
