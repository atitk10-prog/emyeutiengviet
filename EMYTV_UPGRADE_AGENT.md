# EM YÊU TIẾNG VIỆT — PROMPT NÂNG CẤP UI/UX & HOÀN THIỆN SẢN PHẨM

**Dành cho Antigravity Coding Agent — đợt chỉnh sửa sau báo cáo ngày 17/10/2026**

## MỆNH LỆNH CHUNG

Bạn là một nhóm chuyên gia gồm: Senior Full-stack Engineer, Firebase Security Engineer, AI Integration Engineer, UX/UI Designer cho giáo dục tiểu học, chuyên gia sư phạm Tiếng Việt lớp 2–3 và QA Automation Engineer.

**Làm việc trực tiếp trên workspace `EMYTV_AGENT_PACK` hiện có, không tạo dự án khác, không xóa/ghi đè hàng loạt mã nguồn đang hoạt động.** Đọc đủ `AGENTS.md`, `EMYTV_AGENT_PROMPT.md`, `EMYTV_QA_CHECKLIST.md`, `IMPLEMENTATION_STATUS.md`, `QA_REPORT.md`, `README.md` và rà soát những module hiện có. Tận dụng cấu trúc `web`, `functions`, `shared`, `tests` đã xây dựng. Không chỉ viết đề xuất hoặc trả lời bằng văn bản; phải trực tiếp sửa source, chạy lệnh, kiểm thử trình duyệt, chụp kết quả, ghi nhận lỗi và cập nhật báo cáo.

Người dùng đã xem ảnh hai màn hình:
- `http://localhost:3000/` — trang chủ có chữ nhiều màu, linh vật chim bằng hình đơn giản, một số emoji ở thẻ/nút, còn nhiều khoảng trống.
- `http://localhost:3000/teacher/dashboard` — giáo viên có biểu đồ trống, 0 lớp/0 lượt làm/0%, nhưng lại xuất hiện chữ `+16% điểm tiến bộ`. Phải xử lý trường hợp không có dữ liệu, tuyệt đối không trình bày chỉ số giả là kết quả thật.

**Mục tiêu:** Nâng cấp từ một bản chạy thử lên web app đẹp, đáng tin cậy, phù hợp học sinh 7–9 tuổi, có AI thật khi được cấu hình, dữ liệu thật, bảo mật, không emoji sơ sài, giữ tính thân thiện và sáng rõ. Không hứa hoặc đánh dấu thành công nếu chưa kiểm chứng.

## 1. KIỂM TRA THỰC TẾ TRƯỚC KHI SỬA

1. Kiểm tra git status / trạng thái working tree. Ghi lại thay đổi hiện có; không tự reset, force clean hay xóa dữ liệu của người dùng.
2. Kiểm tra cấu trúc dự án, script trong package.json, TypeScript, Firebase project, đường dẫn config, chế độ emulator, các API đang dùng và đầu ra test thực.
3. Xem trực tiếp từng màn hình: home, giáo viên đăng nhập, dashboard, lớp/học sinh, thư viện bài, soạn bài AI, gán bài, học sinh đăng nhập, thư viện, đọc, trả lời, tổng kết, gợi ý AI, báo cáo.
4. Dò mọi chữ emoji Unicode và icon được render trong JSX/TSX, kể cả nhãn nút, icon người dùng, logo/chim, KPI, thư viện, toast, kết quả, huy hiệu, linh vật, footer. Lập danh mục `UI_ASSET_AUDIT.md` gồm: component, icon cũ, cách thay, đã kiểm thử hay chưa. Không thay emoji ở dữ liệu bài đọc/văn bản nội dung nếu cần giữ nguyên ý nghĩa; chỉ thay icon UI/trang trí.
5. Thử các tác vụ end-to-end với Firebase Emulator; phân biệt thứ gì đang chạy thật, thứ gì là demo hoặc chưa được kiểm thử.

## 2. THIẾT KẾ LẠI THEO DESIGN SYSTEM NHẤT QUÁN

### 2.1. Tuyệt đối không dùng emoji làm icon hệ thống

- Thay emoji trang trí, logo, icon thẻ bằng **Lucide React SVG** (`BookOpen`, `GraduationCap`, `School`, `LibraryBig`, `NotebookPen`, `Sparkles`, `Headphones`, `Play`, `Volume2`, `VolumeX`, `Puzzle`, `CheckCircle2`, `HelpCircle`, `ArrowRight`, `BarChart3`, `UsersRound`, `ShieldCheck`, `Award`, `Stars` nếu có thật trong version thư viện; nếu không có, chọn icon hợp lệ tương đương). Chỉ import tên thực sự tồn tại trong thư viện.
- Thống nhất kích thước 18–24px cho điều hướng, 24–32px cho thẻ lớn, stroke 1.8–2.2; không trộn nhiều kiểu icon hoặc màu tùy tiện. Có aria-label cho nút chỉ chứa icon.
- Biểu tượng thương hiệu / mascot cần một **SVG/vector minh họa chim xanh nguyên bản** đặt tại `web/public/assets/mascot-bird.svg` (hoặc đường dẫn tương ứng). Ưu tiên tự dựng SVG sạch với hình khối tròn, biểu cảm đáng yêu, dáng cầm sách, nét viền và bóng nhẹ; không dùng emoji chim hệ điều hành, hình từ web không rõ bản quyền, hay icon Lucide đơn thuần để thay linh vật.
- Logo app: biểu tượng sách mở kết hợp chú chim xanh, một phong cách duy nhất. Favicon SVG/PNG đồng bộ. Nếu không có công cụ tạo ảnh, hãy dựng SVG vector trực tiếp. Ảnh thật/illustration phải là tài sản hợp pháp, lưu cục bộ và có văn bản alt mô tả.
- Với tranh cho bài đọc, ưu tiên 6 tranh minh họa đồng bộ về nét/màu/chủ đề, tự tạo hoặc dùng nguồn có quyền; nếu chưa có tranh thì dùng vector/placeholder thẩm mỹ rõ là minh họa, không dùng emoji. Không gọi ảnh random ngoài Internet từ thiết bị học sinh khi tải bài.
- Tránh unicode emoji trong thành phần hiển thị (ngoại trừ nội dung bài học có chủ đích). Không dùng icon SVG quá nhiều làm ứng dụng giống dashboard quản trị thuần túy.

### 2.2. Màu sắc, font, khoảng cách

- Giữ cá tính thương hiệu: xanh trời/xanh ngọc, kem ấm, vàng nhạt; kết hợp trắng và màu chữ xanh than.
- Design tokens nhất quán qua Tailwind/CSS variables: primary `#168ACB`, secondary `#21A89A`, accent `#F4B942`, background `#F7FBFF`, ink `#14263E`; được tinh chỉnh để đạt tương phản WCAG AA. Không dùng màu làm phương tiện duy nhất để nhận biết đúng/sai.
- Font hỗ trợ tiếng Việt đầy đủ. Ưu tiên một font sans hiển thị dễ đọc, hạn chế 2–3 cấp trọng lượng chính; tránh chữ trang trí khó nhận biết dấu.
- Card bo góc 18–24px, bóng mềm tự nhiên, chiều cao hàng/nút thống nhất; spacing theo hệ 8px; responsive 360, 390, 768, 1024, 1440px.
- Giao diện học sinh dùng nút lớn >=44x44px, ưu tiên 48–56px; giáo viên có mật độ vừa phải nhưng không khó đọc.
- Có trạng thái hover/focus-visible/disabled/loading/empty/success/error. Hỗ trợ `prefers-reduced-motion` và điều hướng bàn phím.

### 2.3. Trang chủ — nâng cấp bố cục thật, không làm thành ảnh chụp tĩnh

- Hero gồm cột trái: badge ngắn, tiêu đề “Mỗi ngày một câu chuyện, mỗi ngày thêm yêu tiếng Việt”, đoạn giới thiệu tối đa 2–3 dòng, 2 CTA rõ: “Em là học sinh” / “Tôi là giáo viên”. Cột phải: mascot SVG lớn có sách, thêm 2–3 điểm nhấn minh họa nhẹ (thẻ từ vựng, ngôi sao vector, sách), bố cục cân bằng thay cho khoảng trắng.
- Bỏ emoji trong nút, các thẻ lợi ích và header; sử dụng icon SVG Lucide. Không lạm dụng các nhãn tiếp thị kiểu “Giọng đọc mẫu chuẩn” nếu chỉ dùng Web Speech API tùy thiết bị; thay thành “Nghe bài đọc khi thiết bị hỗ trợ”.
- Thêm dải 3 bước đơn giản bên dưới hero: “Chọn câu chuyện” → “Đọc và khám phá” → “Vượt thử thách”. Thẻ minh họa đủ đẹp nhưng không biến landing page thành website dài rườm rà.
- Header gọn: logo đẹp bên trái, nút hành động bên phải, không đặt trạng thái kỹ thuật Emulator nổi bật với học sinh. Chỉ badge chế độ thử nghiệm nhỏ trong khu vực quản trị; khi production phải ẩn.
- Footer ghi chính xác “Môi trường thử nghiệm” khi đang Emulator; không khẳng định dữ liệu đã lưu trên Firebase Cloud nếu chỉ có dữ liệu local.

### 2.4. Giao diện học sinh — ưu tiên trải nghiệm lớp 2–3

- StudentLibrary: thẻ bài đọc có thumbnail/illustration đẹp, nhãn chủ đề, mức lớp, trạng thái, tiến trình nhỏ; empty state minh họa + hướng dẫn phải làm gì khi chưa có bài giao.
- ReadingMission: bố cục cuốn sách/trang sách, hình minh họa vừa phải, khoảng cách dòng thoáng, nút nghe/dừng bằng SVG, từ khó dễ nhận biết, thanh tiến trình 3 bước rõ ràng; không để chữ chen lên ảnh.
- QuestionCard: câu hỏi lớn, chỉ 1 câu/khung nhìn, tối đa 3 đáp án, icon câu hỏi dạng SVG, nút chạm lớn; đáp án sai cần gợi ý không gây áp lực, điều khiển trên bàn phím/điện thoại; drag-drop phải có nút lên/xuống tương đương.
- MissionCompleted: thay sao emoji bằng `Star` SVG hoặc component vector, dùng phần thưởng có kiểm soát; confetti tối giản, bỏ khi reduced motion. Thể hiện “Đúng ngay lần đầu” và “Đúng sau gợi ý” riêng biệt.
- MascotBird: chuyển từ chim tròn dạng icon/emoji sang mascot vector thống nhất ở Home, StudentLibrary, phản hồi đúng/sai và empty state. Tạo các biến thể trạng thái bằng SVG/CSS hoặc component props, không cần asset phức tạp.

### 2.5. Dashboard giáo viên — cải tổ empty state và tính đúng của dữ liệu

- Tiêu đề, mô tả và các tab được căn lề trên cùng một grid; ẩn bớt viền thừa, làm rõ CTA “Tạo lớp”, “Tạo bài đọc”, “Tạo bằng AI”. Các tab có icon cùng phong cách.
- 4 KPI chỉ đọc từ Firestore / backend đúng quyền; không hardcode giá trị kết quả. Nếu `classCount=0` hoặc `attemptCount=0`, chỉ số không đủ cơ sở nên hiển thị `—` hoặc “Chưa có dữ liệu”, không hiển thị `0%` như thể đã đo được.
- **SỬA NGAY:** bỏ `+16% điểm tiến bộ` hoặc mọi delta/nhãn dương giả khi không có paired assessment hợp lệ. Tiến bộ chỉ tính từ cặp pre/post thực sự tương ứng trên cùng học sinh/cùng tập kỹ năng, có hiển thị N, không cộng bừa tỷ lệ đúng sau gợi ý thành “tiến bộ học tập”. Nếu không đủ mẫu, ghi “Chưa đủ dữ liệu so sánh”.
- Biểu đồ rỗng không hiển thị đồ thị 0% trống kéo dài: tạo `EmptyAnalyticsState` có illustration SVG/icon, mô tả “Chưa có lượt làm bài”, CTA “Tạo lớp học”/“Nạp bài mẫu”/“Giao bài”. Có state loading và lỗi đọc dữ liệu khác biệt.
- Đảm bảo các nút “Nạp 6 bài đọc mẫu” idempotent: bấm lại không nhân bản 6 bài vô hạn; có xác nhận và báo cáo số bài tạo mới/bỏ qua.
- Trang soạn bài AI: mẫu nhập ngắn gọn; nút AI có trạng thái thật (chưa cấu hình/đang tạo/thành công/lỗi), bản nháp phải duyệt mới xuất bản; có preview học sinh.
- Dashboard quản trị không dùng mascot hoạt hình dày đặc; minh họa tiết chế, biểu đồ dễ đọc, một phong cách SVG xuyên suốt.

## 3. SỬA CÁC VẤN ĐỀ NGHIỆP VỤ & BACKEND CÒN NGUY CƠ

### 3.1. Gemini model và adapter

Báo cáo hiện ghi hardcode `gemini-1.5-flash`. **Không dùng model ID cũ hoặc SDK API đã hết hỗ trợ.** Kiểm tra tài liệu Gemini API chính thức và danh sách model có thể gọi bằng tài khoản hiện tại; cập nhật SDK nếu cần. Gợi ý model mới hiện được Google công bố là `gemini-3.8-flash` hoặc một model ổn định hỗ trợ structured JSON phù hợp ngân sách. Model phải cấu hình qua biến môi trường backend (`GEMINI_MODEL`), không hardcode; có kiểm tra model/quota, timeout, thông báo lỗi rõ, log không lộ key.

- `aiAdapter.ts` phải thực sự gọi AI khi backend có key, kiểm tra Zod/schema, có giới hạn độ dài và số câu hỏi. Sử dụng prompt sư phạm Tiếng Việt lớp 2–3, tránh bịa kết quả, rà soát chất lượng bằng giáo viên.
- Nếu không có API key: hiển thị “Chưa cấu hình AI”, cho soạn bài thủ công, không ghi đã tạo thành công bằng AI.
- AI phân tích dữ liệu theo lớp chỉ nhận số liệu đã tổng hợp/ẩn danh, không nhận mã bí mật hay thông tin định danh học sinh.
- Kiểm tra việc tạo câu hỏi đủ 3 dạng và đáp án không lộ ra ngoài frontend trước khi chấm.

### 3.2. Bảo mật vai trò và tài khoản mẫu

- Kiểm tra `bootstrapTeacherRole`: người dùng mới không thể tự gọi Function để nâng quyền giáo viên khi không có danh sách cho phép/quyền admin phù hợp.
- Nút “1-click Đăng nhập Giáo viên Mẫu” chỉ hiện khi `VITE_USE_EMULATORS=true` (và cấu hình phát triển phù hợp), không xuất hiện trong build/production. Tài khoản mẫu chỉ là cho kiểm thử, không cấp quyền trên Firebase Cloud.
- Mã học sinh 6 ký tự có không gian đoán giới hạn: cần rate limit + lockout theo phiên/IP/học sinh, không tiết lộ tồn tại mã; cân nhắc mã ngẫu nhiên dài hơn (8–10 ký tự), có thể in/thay mới. Rà soát hash bằng thuật toán dẫn xuất chậm và muối riêng thay vì chỉ SHA-256 đơn giản khi lưu PIN/mã ngắn; cấu hình phù hợp môi trường Functions.
- Firestore Rules mặc định từ chối, đáp án ở collection riêng do server quản lý; browser không tự ghi điểm.
- Tạo test chống nâng quyền, dùng mã sai lặp nhiều lần, học sinh A đọc học sinh B, giáo viên A đọc lớp B, lộ đáp án.

### 3.3. Đúng dữ liệu và trạng thái

- Không tạo số liệu KPI minh họa trong dashboard thật. Nếu cần seed mock data để kiểm thử thì gắn nhãn rõ và chỉ dùng Emulator.
- Giữ nguyên quan hệ lessonVersion → assignment → attempt; giao bài bất biến phiên bản sau khi xuất bản.
- Hạn chế double submit, idempotent với requestId; verify khi reload/trình duyệt khác cùng hồ sơ.
- Xử lý mất Internet, API timeout, stale auth, function permission-denied, Firestore unavailable; UX báo lỗi thân thiện, không thông báo “Đã lưu” trước server ack.
- TTS browser có thể không có tiếng Việt, không được gọi là “chuẩn” hoặc thông báo như đã thành công; có fallback văn bản.
- Chỉ hiển thị “Firebase Cloud” khi cấu hình production thật; có badge trạng thái kỹ thuật rõ ở khu vực giáo viên/đối tượng quản trị. Emulator không là triển khai chính thức.

## 4. QUY TRÌNH KIỂM THỬ VÀ NGHIỆM THU

1. Chạy `npm run build` và kiểm tra tất cả workspaces, sửa lỗi TypeScript/ESLint (nếu có).
2. Chạy toàn bộ unit tests, Firestore rules tests và e2e tests trên Emulator đang chạy; báo pass/fail thực, không mượn báo cáo cũ.
3. Dùng browser automation để duyệt ít nhất: Home (desktop + mobile); Teacher Login; Dashboard empty state; tạo lớp; tạo học sinh; nạp 6 bài mẫu; giao bài; Student Login; mở bài; TTS fallback; làm 3 loại câu hỏi đúng/sai; hint và retry; hoàn tất; reload; giáo viên xem kết quả; xuất CSV; thử AI khi chưa cấu hình; thử API thực chỉ khi có key và quyền.
4. Kiểm tra Network/Console, API function errors, CORS, Firestore permissions, accessibility keyboard focus; chụp screenshot đối chiếu trước/sau ở 1440x900 và 390x844.
5. Quét source `web/src` để loại bỏ emoji UI; tài liệu kiểm kê số emoji còn lại và lý do (nếu do nội dung bài học). Không thay emoji bằng ký tự đặc biệt cùng kiểu.
6. Test empty state: 0 lớp, 0 học sinh, 0 attempts ⇒ không có số liệu % hoặc tăng trưởng giả. Test sau dữ liệu thật: KPI bằng truy vấn/thuật toán đúng, bằng chứng ít nhất 1 attempt.
7. Seed demo đúng quyền, không nhân đôi bản ghi khi bấm nhiều lần.
8. Test smoke production-build ở local để đảm bảo không phụ thuộc dev server; **không triển khai Firebase production khi chưa có xác nhận/quyền**.

## 5. THỨ TỰ ƯU TIÊN THI CÔNG (THỰC HIỆN, KHÔNG CHỈ LẬP KẾ HOẠCH)

**P0 — Sửa lỗi số liệu và bảo mật quan trọng:** empty KPI, +16% giả, role bootstrap, demo login, PIN, đáp án. Kiểm thử và xác nhận.

**P1 — Thiết kế lại home + branding:** mascot SVG, favicon, loại emoji, hero, CTA, dải 3 bước. Kiểm thử desktop + mobile.

**P2 — Hoàn thiện UI học sinh:** bài đọc, câu hỏi, màn hình kết quả, illustration, animation nhẹ, tiếng Việt, accessibility; bảo toàn tất cả tính năng đang hoạt động.

**P3 — Dashboard và tạo bài AI:** polished dashboard, empty states, new AI model selection, preview, loading/error, gợi ý củng cố, báo cáo.

**P4 — Kiểm thử, sửa, tài liệu bàn giao:** full E2E trên Emulator, smoke test, screenshots, asset audit, QA report, hướng dẫn production có điều kiện, file `UI_UPGRADE_REPORT.md`.

Nếu thiếu API key hoặc cấu hình Cloud, không được dừng toàn bộ dự án: tiếp tục hoàn thiện logic local và báo chính xác những kiểm thử không thể thực hiện.

## 6. FILE CẦN BÀN GIAO SAU LẦN NÂNG CẤP

- Source code đã sửa tại đúng workspace hiện tại.
- `UI_ASSET_AUDIT.md`: checklist emoji/icon/hình minh họa, file mới đã tạo.
- `UI_UPGRADE_REPORT.md`: ảnh before/after, thay đổi, vấn đề phát hiện, test đã chạy và kết quả.
- Cập nhật `QA_REPORT.md`, `IMPLEMENTATION_STATUS.md`, `README.md`, `EMYTV_QA_CHECKLIST.md` trung thực theo lần kiểm tra mới.
- Screenshot desktop+mobile ít nhất trang chủ, dashboard trống, thư viện, câu hỏi và kết quả (nếu chạy được).

**KHÔNG** làm việc với tài sản ngẫu nhiên không rõ quyền, **KHÔNG** thay đổi dữ liệu đánh giá thật cho đẹp, **KHÔNG** báo model Gemini đã gọi thành công khi chưa thử, **KHÔNG** xóa test để build xanh, **KHÔNG** dừng ở mockup.

### LỆNH THỰC THI CUỐI

Ngay bây giờ: đọc lại cấu trúc dự án hiện có; audit code giao diện và dashboard trước; sửa giá trị `+16%` sai; sau đó trực tiếp thay mọi emoji giao diện bằng bộ Lucide Icons + mascot SVG đồng nhất, hoàn thiện toàn bộ các màn hình quan trọng và sửa các lỗi nghiệp vụ; cuối cùng chạy lại test và báo cáo minh bạch. **Không hỏi lại tôi những thông tin đã có trong workspace.**
