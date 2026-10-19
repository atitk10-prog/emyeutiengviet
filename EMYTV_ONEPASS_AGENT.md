# EM YÊU TIẾNG VIỆT — ONE-PASS HARDENING & ACCEPTANCE (v4.0)

> Dán lệnh trong `START_AGENT.txt` vào Antigravity, đặt toàn bộ tệp của gói này ở thư mục gốc workspace `EMYTV_AGENT_PACK`.
>
> Mục tiêu: một đợt sửa có kế hoạch, có kiểm thử và bằng chứng — **không cam kết một lần sẽ không còn lỗi**. Không phải prompt tạo ứng dụng mới.

## 0. ĐỌC VÀ ĐỐI CHIẾU NGUỒN SỰ THẬT

Trước khi sửa, đọc toàn bộ: `AGENTS.md`, `EMYTV_AGENT_PROMPT.md`, `EMYTV_QA_CHECKLIST.md`, `FIREBASE_CLOUD_AUDIT.md`, `FINAL_RELEASE_AUDIT.md`, `QA_REPORT.md`, `IMPLEMENTATION_STATUS.md`, `UI_UPGRADE_REPORT.md`, `README.md` và `EMYTV_RELEASE_GATES.md`. Đọc cả `EMYTV_SAMPLE_CASES.json`. Đối chiếu **mã nguồn thực** với báo cáo; báo cáo không thay thế kết quả chạy test. Không khởi tạo lại repo, không xóa dữ liệu.

Hiện trạng đã biết từ các báo cáo:
- Web React/TS + Firestore/Auth/Functions Emulator; `.firebaserc` đang dùng demo `em-yeu-tieng-viet-demo`, `web/.env` dùng `VITE_USE_FIREBASE_EMULATOR=true`.
- Firebase Staging **đã được người dùng tạo**: project ID `em-yeu-tieng-viet---staging`; Web App đăng ký; Email/Password và Anonymous được bật; Firestore `(default)` tạo, công bố rule deny-all; Spark, **chưa deploy Cloud Functions**.
- Agent trước đó báo cáo test PASS bằng Emulator; chưa có bằng chứng gọi AI live thành công hay vận hành một ca thật trên Cloud.
- AI adapter gần nhất báo mặc định `gemini-2.5-flash`, fallback `gemini-2.0-flash`; phải sửa chiến lược model.
- Website hiện có SVG icon/mascot; không làm lại thiết kế nếu chưa thấy lỗi trực quan.

## 1. BẮT BUỘC GIỮ AN TOÀN MÔI TRƯỜNG

1. Trước sửa: `git status`, chụp snapshot/commit checkpoint trong repository nếu repo đã được cấu hình và không có thay đổi lạ; tuyệt đối không xóa mất công việc chưa commit. Không in/commit file chứa bí mật.
2. Chưa dùng `firebase deploy`, `firebase use` làm đổi alias mặc định, chưa bật Blaze/billing, chưa thay đổi Cloud Firestore Rules, chưa ghi dữ liệu thật lên Staging/Production. Mọi sửa đổi phục vụ deploy phải chuẩn bị dạng file để được duyệt sau.
3. Emulator là môi trường tích hợp hiện tại; **không trộn Auth Emulator với Firestore Cloud hoặc Functions Cloud** trong các bài kiểm thử mặc định.
4. Tách rõ `local-emulator`, `staging`, `production`. Biến `VITE_USE_FIREBASE_EMULATOR` phải parse nghiêm ngặt, không dùng mặc định 'mọi thứ khác false thành true' thiếu kiểm soát. Ở môi trường cloud thiếu biến quan trọng phải fail-closed với thông báo hữu ích, không tự chạy qua demo.
5. Cấu hình Firebase Web chỉ là định danh; **Gemini API key, Groq key, admin secret và service account key là bí mật**. Không để trong `VITE_*`, frontend, docs, screenshot, log hoặc chat.
6. Với Emulator: hỗ trợ cấu hình Gemini key **chỉ phía functions** bằng `functions/.secret.local` nếu triển khai theo Firebase secrets hoặc cấu hình local được SDK hiện có hỗ trợ (`functions/.env.local` khi thích hợp). Kiểm tra file `.gitignore`; đừng tạo file chứa key với giá trị mẫu giống thật. Viết hướng dẫn cho người dùng tự nhập khóa, không yêu cầu dán khóa vào chat.
7. AI API free tier chỉ dùng **chủ đề học liệu và số liệu tổng hợp giả lập** trong thử nghiệm; không gửi tên, mã riêng, giọng nói hoặc dữ liệu nhận dạng trẻ em cho AI.

## 2. CHỐT MỘT NHÀ CUNG CẤP AI CHO BẢN 4.0

**Chỉ cần Gemini API.** Không yêu cầu Groq/OpenAI ở đợt này, không tự tạo phụ thuộc mới nếu không cần. Nếu kiến trúc sẵn provider abstraction thì giữ interface cho tương lai, nhưng không ưu tiên Groq chưa được yêu cầu.

- Model thử mặc định: `gemini-3.5-flash-lite` (chỉ sau khi API của tài khoản thực xác nhận có quyền truy cập). Model thử nâng chất lượng: `gemini-3.8-flash`.
- Không đặt fallback tự động sang `gemini-2.0-flash` hoặc các model đã ngừng. Không silently fallback sang model tốn phí hoặc nhà cung cấp khác.
- Kiểm tra lại tài liệu SDK và endpoint thực tế. Cấu hình model qua biến môi trường phía server (`GEMINI_MODEL`), có tùy chọn đổi khi kiểm thử.
- Chức năng `getAIStatus` phân biệt 4 trạng thái: `NOT_CONFIGURED`, `READY_UNVERIFIED`, `VERIFIED`, `UNAVAILABLE`; trạng thái VERIFIED chỉ có sau một thử nghiệm thật được phép với phản hồi hợp lệ. Không suy luận VERIFIED vì key không rỗng.
- Endpoint test AI (chỉ giáo viên đã xác thực, giới hạn tần suất và token) cho ra một đoạn học liệu synthetic không chứa PII. Server ghi model, thời điểm, tình trạng, mã lỗi phân loại; không ghi key hoặc nội dung nhạy cảm.
- Xử lý 401/403 (auth/permission), 404 (model), 429 (quota), timeout, 5xx. Chỉ retry ngắn và có giới hạn; trả lỗi rõ ràng, không làm mất bản nháp giáo viên đang soạn.
- AI sinh JSON đúng schema hiện có; Zod kiểm tra; lỗi đáp án/không có căn cứ trong đoạn đọc được báo cần duyệt, không tự xuất bản. Không tiết lộ đáp án cho frontend học sinh khi bắt đầu bài.
- Luồng sinh bài: giáo viên nhập yêu cầu -> AI tạo nháp -> preview/sửa từng câu -> lưu Firestore Emulator -> phê duyệt -> xuất bản phiên bản -> giao bài -> học sinh làm -> backend chấm.
- Nếu chưa có API key, duy trì `manual authoring` và 6 bài mẫu, ghi trạng thái AI chưa có, không gắn nhãn 'AI đang hoạt động'.

## 3. CHỨC NĂNG BẮT BUỘC ĐƯỢC NGHIỆM THU

A. Giáo viên: login, tạo nhiều lớp với `academicYear` (không làm thay đổi dữ liệu cũ), tạo học sinh pseudonym, sinh/cấp lại mã, tự tạo hoặc AI tạo bài, chỉnh sửa nháp, duyệt, xuất bản, phiên bản bất biến, giao bài, phân biệt pre/post, xem dashboard, xuất CSV có UTF-8 BOM.

B. Học sinh: mã lớp + mã riêng; Firebase Anonymous Auth chỉ là xác thực nền, mapping studentId server-side; vào đúng thư viện được giao; văn bản/giải nghĩa/tùy chọn TTS; 3 loại câu hỏi; hint lần 1 không tiết lộ đáp án; sau lần cuối trả đáp án; lưu kết quả lần đầu và sau gợi ý; nộp lại không trùng; có trạng thái mạng/kết nối.

C. Dashboard: khi 0 lượt làm, hiển thị 'Chưa có dữ liệu' (không 0% tiến bộ, không +16%, không biểu đồ tự tạo); N thực tế; chỉ ghép pre/post theo cùng học sinh và bài tương đương; tiến bộ theo điểm phần trăm, không tự tuyên bố tác động nhân quả.

D. Độ tin cậy: refresh, đóng/mở tab, retry network, double-click, timeout, nhiều phiên giáo viên/học sinh, Firestore indexes, schema migrations/versioning, khóa tránh mất dữ liệu; data staging không rò sang demo/prod.

E. TTS: dùng giọng vi-VN nếu có; thiếu voice thì cho học sinh tiếp tục đọc, không đổ lỗi hoặc báo 'giọng chuẩn' khi không đảm bảo.

## 4. RÀ SOÁT BẢO MẬT CẦN THIẾT

- Firestore: rules deny-by-default; test cho đúng các document path, cả nested documents, ownership, `schoolId`/teacherUid. Đáp án, mã học sinh, điểm không thể sửa/đọc từ client trái quyền. Admin SDK trong Functions **bỏ qua Security Rules** nên mỗi function phải tự xác thực + phân quyền.
- `bootstrapTeacherRole`: kiểm tra `email_verified` và cơ chế cấp quyền tin cậy. Không để email tự nhập hoặc tham số từ client trở thành quyền teacher. Không chỉ ẩn UI demo ở production. Test gọi trực tiếp từ anonymous/không auth.
- PIN: PBKDF2 10.000 rounds cần xem xét tăng cấu hình có đo độ trễ, sử dụng thuật toán KDF phù hợp; ưu tiên tăng không phá PIN đang dùng. Giới hạn thử sai **theo nhiều chiều** (IP/tài khoản/mã học sinh/mã lớp) và tránh khóa toàn lớp chỉ vì 1 người nhập sai 5 lần. Dùng expiring counters, logging ít PII.
- `getAIStatus` không làm lộ key; tạo bài bằng AI phải check quyền giáo viên, quota, nội dung đầu vào, timeout.
- Đầu ra AI không được chèn HTML nguy hiểm (XSS); render escaped hoặc sanitize và test với `<script>` như chuỗi dữ liệu. Không đưa khóa giải ra bundle web hoặc Firestore student-readable.
- Seed/screenshot/demo phải ghi rõ dữ liệu giả lập, không dùng dữ liệu cá nhân học sinh.
- Secrets, `.env`, `.secret.local`, JSON service account: xác nhận gitignore; quét repo kiểm tra không commit lộ key.

## 5. BỘ DỮ LIỆU KIỂM THỬ GIÁO DỤC

Đọc `EMYTV_SAMPLE_CASES.json` như **bộ fixture chuẩn độc lập**, không ghi đè 6 bài seed đã có. Map sang Zod schema/mô hình bài hiện tại thay vì cưỡng ép đổi schema.

Kiểm tra mỗi bài:
1. Bài đọc tiếng Việt đủ độ tuổi, chính tả, thông tin rõ.
2. 5 câu/nhiệm vụ theo ba loại, đáp án đúng theo đoạn đọc.
3. Hint đúng tình huống và không lộ đáp án lần đầu.
4. `question.skill`/skillTag đúng nhãn trong hệ thống.
5. Lưu ý kiểm thử chuẩn hóa Unicode tiếng Việt, nút trên mobile, chấm ở server.
6. Negative fixtures: câu hai đáp án cùng đúng; thứ tự mâu thuẫn; thiếu đáp án; JSON sai schema; injection prompt trong nội dung người dùng; không lưu nháp tự động nếu chưa được giáo viên duyệt.

Bộ mẫu dùng để kiểm tra logic và nội dung, không phải minh chứng triển khai với học sinh thật.

## 6. TEST PLAN VÀ BẰNG CHỨNG

Chạy trên máy người dùng (không khẳng định PASS khi không có log):
- `npm run build`
- `node --test tests/rules.test.mjs`
- `node --test tests/e2e.test.mjs`
- `node --test tests/security_and_ai.test.mjs`
- bổ sung bài test fixture `EMYTV_SAMPLE_CASES.json` và test chuyên biệt cho AI/JSON/permissions.
- browser E2E desktop 1440x900 và mobile 390x844: GV tạo lớp -> cấp mã -> giao bài -> HS làm -> dashboard cập nhật; kiểm tra console/network logs và screenshot.
- nếu có key hợp lệ: ít nhất 1 **live Gemini request** và 1 **live generateLessonDraft** với chủ đề giả lập; nếu không có key thì đánh dấu BLOCKED, không fake PASS.
- Kiểm tra 429/401/404/timeout bằng mock theo từng lỗi, có trạng thái hiển thị chính xác.
- Chứng minh dữ liệu persisted khi restart emulator bằng `--export-on-exit`/`--import` nếu cần; không đánh đồng dữ liệu Emulator với Cloud thật.
- Đặt rõ `G1 Core`, `G2 Data & Security`, `G3 AI Live`, `G4 Cloud Staging` ở `FINAL_RELEASE_AUDIT.md`; Gate 4 BLOCKED cho đến khi có quyền Blaze và deploy staging được người dùng cho phép.

## 7. LỘ TRÌNH THỰC HIỆN TRONG MỘT ĐỢT LẬP TRÌNH

P0. Audit lại git/mã/config, chốt danh sách thay đổi; không refactor lan rộng.
P1. Sửa AI model, status, env secret handling, lỗi AI/JSON.
P2. Sửa auth, quyền, PIN rate limits, tránh khóa cả lớp và kiểm tra trạng thái dữ liệu.
P3. Kiểm thử fixture sư phạm; làm rõ tổng kết, dashboard, pre/post và trạng thái loading/empty/error.
P4. Thử browser E2E, unit/rules/integration/live API (nếu đã có key), báo cáo lỗi và hoàn thiện README.

Không thêm feature trang trí mới, AI chatbot mở, chấm phát âm, ảnh/video tạo bằng AI, dashboard mới hay tích hợp Google Sheets hai chiều vào đợt này.

## 8. BÀN GIAO

- Không thay thế báo cáo bằng lời khẳng định '100% PASS' thiếu log.
- Cập nhật `README.md`, `QA_REPORT.md`, `IMPLEMENTATION_STATUS.md`, `FINAL_RELEASE_AUDIT.md`.
- Tạo `ONEPASS_CHANGELOG.md` gồm file thay đổi, lý do, test evidence (lệnh + kết quả), blocked items, ảnh và demo flow.
- Cung cấp hướng dẫn riêng cho người dùng điền Gemini key vào `functions/.secret.local` hoặc vị trí local backend đang dùng, không được in giá trị.
- Tạo `CLOUD_STAGING_DEPLOY_PLAN.md` với thứ tự và rủi ro triển khai nhưng **KHÔNG THỰC HIỆN DEPLOY** khi chưa có quyền người dùng. Project staging `em-yeu-tieng-viet---staging` hiện là Spark; triển khai Cloud Functions yêu cầu Blaze.
- Kết thúc với bảng G1–G4: PASS, FAIL, BLOCKED; mọi BLOCKED phải kèm hành động cụ thể.
