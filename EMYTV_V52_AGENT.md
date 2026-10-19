# EM YÊU TIẾNG VIỆT — AGENT IMPLEMENTATION BRIEF V5.2

## Mục tiêu, phạm vi và quy tắc

Bạn là kỹ sư Full-stack TypeScript/React/Firebase, chuyên gia an ninh dữ liệu học sinh và thiết kế phần mềm dạy học Tiếng Việt tiểu học.

**BỐI CẢNH KHÔI PHỤC:** IDE từng tự tắt, Agent đã tái kiểm tra và tạo `RECOVERY_STATUS.md`. Theo báo cáo gần nhất: `npm run build` PASS; 3/3 unit tests PASS; 61/61 kiểm thử tổng hợp tuần tự PASS. Báo cáo V5.1 `V5_1_SECURITY_UX_AUDIT.md` chưa hoàn tất; chưa có nút thêm/xóa câu hỏi ở trình biên tập `TeacherDashboard.tsx`. Các kết quả này là thông tin báo cáo cũ: kiểm tra lại trước khi tuyên bố nghiệm thu mới.

**Đích V5.2:** một kho học liệu bài đọc Tiếng Việt có vòng đời khép kín từ AI/thủ công → bản nháp → giáo viên duyệt → xuất bản phiên bản → giao bài → học sinh làm → lưu → thống kê → đề xuất củng cố. Đảm bảo lớp 2–3 chạy ổn định; giữ dữ liệu/cấu trúc để mở rộng lớp 1–5 sau, không nhập SGK chưa thẩm định.

**HÀNG RÀO BẮT BUỘC:**
- Làm trực tiếp trên workspace hiện có, KHÔNG tạo dự án mới; KHÔNG chạy `git init`, `git reset --hard`, `git clean`, lệnh xóa cache hoặc thư mục ngoài dự án.
- Trước chỉnh sửa, thống kê trạng thái mã nguồn, tạo bản sao lưu an toàn các tệp sắp sửa; **không ghi đè** `emulator-data`, `emulator-data-backup-v5`, hoặc bản sao lưu duy nhất. Nếu môi trường không thể sao lưu an toàn, dừng và báo BLOCKED.
- Không xóa dữ liệu cũ, không tự động nâng Blaze, không deploy Firebase Cloud Staging/Production, không gọi Gemini liên tục. Không ghi secrets hoặc mã PIN rõ vào log, tệp kiểm thử, report, Git.
- Không sửa lại những tính năng đã hoạt động của V5.1 trừ khi lỗi liên quan trực tiếp. Sửa tăng dần, chạy build/test sau mỗi nhóm chỉnh sửa. Không tuyên bố 100% nếu chưa kiểm chứng.
- Trước khi chạy `npm run test:all`, kiểm tra script và dùng chế độ test tuần tự nếu suite sử dụng cùng state Emulator. Không chạy test phá dữ liệu lên kho Emulator đang giữ dữ liệu người dùng.

## PHASE 0 — Chốt V5.1 / đảm bảo khả năng phục hồi

1. Đọc `AGENTS.md`, `RECOVERY_STATUS.md`, `UX_ACCOUNT_RELIABILITY_REPORT.md`, `FEATURE_STATUS_MATRIX.md`, `README.md`, `package.json` và các tài liệu quy định trước đó.
2. Đối chiếu source và log mới nhất; hoàn tất `V5_1_SECURITY_UX_AUDIT.md` theo bằng chứng sẵn có, phân biệt PASS/FAIL/BLOCKED/NOT TESTED.
3. Kiểm tra script test song song và sửa **chỉ khi cần** để cho phép thực thi tuần tự, không vô ý loại bỏ test đang có.
4. Lập danh sách endpoint/type/schema UI liên quan: `TeacherDashboard.tsx`, các `functions/src/index.ts`, `shared/src/index.ts`, `firestore.rules`, `firestore.indexes.json`, `StudentLibrary.tsx`, `StudentReview.tsx`, `aiAdapter.ts`. Xác định chính xác hợp đồng dữ liệu trước khi sửa.

## PHASE 1 — Kho bài đọc, chỉnh sửa và lưu

### Giao diện kho giáo viên
- Mỗi thẻ bài có **Xem trước**, **Chỉnh sửa / Tạo bản mới**, **Giao bài**, **Đã giao**, **Lưu trữ**, **Tùy chọn**; có trạng thái bản nháp, đã xuất bản, đã giao, đã lưu trữ.
- Có tìm kiếm và bộ lọc tối thiểu theo khối lớp, chủ điểm, trạng thái, tác giả. Không mất phân trang/dữ liệu khi đổi tab hoặc F5.
- Bấm vào bài để xem toàn văn, danh sách câu hỏi, đáp án (chỉ giáo viên được phép), gợi ý, âm thanh, số phiên bản, thông tin tác giả/thời gian. Có nút **Xem trước như học sinh**, chế độ chỉ đọc, KHÔNG tạo attempt, KHÔNG dùng tài khoản học sinh thật.

### Trình biên tập bài
- Cho chỉnh tiêu đề, khối, chủ điểm, thể loại, mục tiêu, bài đọc, từ khó, câu hỏi và file âm thanh tham chiếu; có `Lưu bản nháp`, `Lưu thay đổi`, `Hủy`, cảnh báo khi rời trang có thay đổi chưa lưu.
- Sau khi lưu phải đọc lại thành công từ backend sau F5/đăng nhập lại. Chống ghi đè thầm lặng giữa hai tab (revision/updatedAt hoặc kiểm soát xung đột tương đương).
- Trường bắt buộc và giới hạn dữ liệu rõ ràng, thông báo lỗi tiếng Việt dễ hiểu; không đưa stack trace, JSON thô lên giao diện.

## PHASE 2 — Quản lý câu hỏi linh hoạt (P0)

- Bổ sung nút `+ Thêm câu hỏi` thật sự hoạt động trong giao diện chỉnh sửa; có thể thêm **trắc nghiệm một đáp án**, **đúng/sai**, **sắp xếp sự việc** — trước hết giữ đúng 3 loại chấm server đang hỗ trợ.
- Cho **sửa, nhân bản, xóa, đổi thứ tự** câu hỏi; trước khi xóa hỏi xác nhận, không để ID/trình tự bị trùng; câu hỏi mới có ID mới ổn định.
- Giao diện chọn dạng câu hỏi và hiển thị các trường đúng theo dạng. Mỗi câu: nội dung, phương án/danh sách sự việc, đáp án, lời giải thích, gợi ý sư phạm, nhãn kỹ năng, mức nhận thức.
- Mặc định đề xuất 5–10 câu/bài; hỗ trợ khoảng 1–20 câu/bài (xác định ràng buộc thực tế sau khi đọc schema), **không còn logic giả định luôn có đúng 5 câu** ở frontend, Cloud Functions, schema, chấm điểm, báo cáo và progress bar.
- Kiểm định: không chấp nhận thiếu đáp án, 2 đáp án đúng ngoài chủ đích, giá trị thứ tự sai, trùng ID, phương án rỗng, hoặc xóa hết câu khi xuất bản.
- Không làm rò `privateAnswerKeys`/đáp án bí mật xuống client học sinh trước lúc được phép xem lại. Cập nhật shared type + backend + UI + tests đồng bộ.
- **Chỉ chuẩn bị kiến trúc** để tương lai thêm ghép cặp/điền từ/chọn tranh, không triển khai các loại này trong V5.2 nếu chưa hoàn tất luồng lõi. Không hiển thị lựa chọn câu hỏi chưa hỗ trợ thật.

## PHASE 3 — Phiên bản bất biến, cập nhật và xóa an toàn (P0)

- Phân biệt lesson (thực thể), draft (bản đang chỉnh), published version (snapshot bất biến), assignment và attempt.
- Bài đã xuất bản nhưng chưa giao: tạo phiên bản mới để sửa; bài đã giao/đã có kết quả: **không sửa đè phiên bản cũ**. Khi cập nhật, tạo draft từ version, sửa → duyệt → publish version mới. Bài/điểm cũ tiếp tục trỏ đúng version cũ.
- Nếu cấu trúc hiện tại có cơ chế snapshot, mở rộng trên đó; không tự thiết kế lại schema/migrate hàng loạt khi chưa cần.
- `Xóa bài`: bản nháp chưa dùng có thể xóa mềm theo chính sách; bài đã giao/chấm điểm chỉ được lưu trữ/ngừng sử dụng, tuyệt đối không xóa lịch sử học sinh hoặc `privateAnswerKeys` còn được tham chiếu.
- Toàn bộ API sửa/xóa/publish phải xác thực giáo viên sở hữu hoặc Admin được ủy quyền ở backend, không chỉ ẩn nút.

## PHASE 4 — Giao bài không trùng, vẫn tái sử dụng được (P0)

- Trong kho hiển thị lớp đã giao, ngày giao, phiên bản, trạng thái. Với cùng `(classId, lessonVersionId, đợt giao/loại nhiệm vụ)` không thể tạo bản ghi trùng do bấm hai lần, F5, request đồng thời hoặc retry; xác thực idempotency/transaction ở backend.
- Nút hiển thị `Đã giao cho lớp ...` nếu là cùng đợt. Cho phép giáo viên **chủ động** tạo đợt luyện tập mới khác khi cần bằng thao tác xác nhận, không cấm vĩnh viễn bài đã từng giao.
- Không chuyển bài `Đã giao` thành `Chưa giao` chỉ vì giáo viên phát hành version mới; trạng thái phải dựa trên assignments thực tế.
- Kiểm thử 2 giáo viên, 2 lớp, một bài giao nhiều lớp, và tình huống bấm nhanh hai lần/đổi tab.

## PHASE 5 — Gemini bổ sung câu hỏi, âm thanh, báo cáo tối thiểu (P1)

- AI có nút `Tạo thêm câu hỏi` cho **bài đang mở**, chọn số lượng nhỏ (ví dụ 1–5), kỹ năng, mức độ, loại câu hỏi trong 3 dạng đã hỗ trợ. AI tạo **bản nháp câu hỏi**, không được tự động thay passage/đã publish, không tự công bố. Giáo viên có thể sửa/xóa trước khi lưu.
- Dùng JSON schema/validation để kiểm tra dữ liệu AI; xử lý parse error và retry có giới hạn, rate limit; không gọi API nếu không cần. Một đáp án sai hoặc mâu thuẫn bài đọc → cảnh báo giáo viên, không mặc định xuất bản.
- Giữ luồng file âm thanh tiếng Việt hiện tại; trong trình biên tập cho nghe thử, cập nhật liên kết file được phép, xóa liên kết có xác nhận. Không đưa MP3/voice model vào Cloud nếu chưa đánh giá Storage, pháp lý, dung lượng. Không có voice vi-VN phải báo rõ, không fallback giọng Anh.
- Trang thống kê: điểm và số lượt theo bài / lớp, số học sinh hoàn thành, đúng lần đầu vs đúng sau gợi ý, kỹ năng cần củng cố; số liệu lấy từ dữ liệu thật của ứng dụng và đúng `versionId`; không sinh chỉ số giả. AI chỉ đề xuất hoạt động từ dữ liệu tổng hợp ẩn danh, giáo viên duyệt. Không tự xếp loại chính thức theo TT27 từ điểm trò chơi.

## PHASE 6 — Nghiệm thu tự động + Browser (P0)

Chạy build `shared/functions/web`; test rules, security, quiz, import/export, E2E, persistence. Thêm unit/integration tests cho CRUD câu hỏi, schema biến đổi 5→8→10 câu, version bất biến, phân quyền chéo, duplicate assignment cạnh tranh, resume/review và không rò đáp án.

**Browser Agent UAT bắt buộc:**
1. GV A tạo/AI sinh một bài lớp 2 có 5 câu → lưu nháp → mở lại sau F5 → thêm 3 câu, đổi thứ tự, xóa 1, thêm 1 → đủ 8 câu và duyệt → xuất bản v1.
2. Xem trước như học sinh; giao v1 cho lớp A; thao tác giao trùng và xác nhận hệ thống không nhân đôi.
3. HS thuộc lớp A đăng nhập PIN → thấy đúng 8 câu, hoàn thành, đăng xuất/F5 → xem lại kết quả, giáo viên xem được dữ liệu.
4. Giáo viên tạo v2 từ bài đã giao, sửa văn bản/đáp án; học sinh cũ xem lại vẫn hiển thị v1; giao v2 theo đợt riêng, dữ liệu lịch sử không thay đổi.
5. Giáo viên B không sửa/xóa bài riêng của giáo viên A; Admin truy cập đúng quyền.
6. Lưu trữ bài đã giao: học sinh giữ được lịch sử; bản chưa giao biến mất khỏi lựa chọn giao mới theo thiết kế, không bị hard delete dữ liệu liên quan.
7. Kiểm tra laptop + viewport điện thoại, thông báo lưu thất bại, không có bài, mất mạng, double-click.

Chỉ dùng tài khoản/dữ liệu giả lập không có thông tin trẻ em thật. Lưu ảnh có tên/ngày và đường dẫn; không ghi token, secret, PIN vào ảnh công khai. **Không khẳng định hoạt động trên Firebase Cloud** khi mới chạy Emulator.

## Kết quả đầu ra và điều kiện DỪNG

Tạo và cập nhật:
- `V5_1_SECURITY_UX_AUDIT.md` (chốt giai đoạn trước).
- `V5_2_IMPLEMENTATION_REPORT.md`: bảng thay đổi tệp, endpoints, dữ liệu, kiểm thử, PASS/FAIL/BLOCKED/NOT TESTED, hạn chế.
- `V5_2_ACCEPTANCE.md`: từng ca UAT, ảnh, số lượng test trước/sau; báo cáo lỗi còn tồn đọng.
- `V5_2_USER_GUIDE.md`: hướng dẫn giáo viên tạo/sửa/thêm câu/giao bài/xem thống kê; học sinh học/xem lại.
- `DEMO_CAPTURE_PLAN.md`: danh sách cảnh thao tác thật để quay video/poster/slide, đánh dấu tính năng demo vs tính năng được nghiệm thu.

Khi hết ngữ cảnh/IDE ngắt, phải duy trì `V5_2_PROGRESS.md` với checklist, tệp đã sửa, bước đang làm và lệnh test tiếp theo. Cập nhật sau mỗi phase, để Agent phiên sau tiếp tục mà không phá dữ liệu.

**Thứ tự ưu tiên để giữ tiến độ:** Ph0 khôi phục → Ph1/2/3/4 (P0) → kiểm thử luồng lõi → Ph5 (P1) → nghiệm thu. Nếu P1 khó hoặc phát sinh rủi ro, đánh dấu BLOCKED/DEFERRED; không đánh đổi ổn định P0 để cố hoàn tất tính năng phụ.

**Chỉ hoàn tất và báo V5.2 PASS** khi giáo viên thực sự mở lại/sửa bài, thêm/xóa câu, phiên bản cũ bất biến, giao không nhân đôi và học sinh xem lại đúng kết quả. Sau nghiệm thu, DỪNG để người dùng phê duyệt trước mọi triển khai Cloud.
