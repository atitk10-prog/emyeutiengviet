# MASTER BUILD PROMPT — EM YEU TIENG VIET
**Phiên bản:** 3.0 · **Ngôn ngữ:** Tiếng Việt · **Đầu ra:** Ứng dụng web chạy thật, có mã nguồn, dữ liệu lưu Firebase và kiểm thử.

> **CHỈ THỊ DÀNH CHO CODING AGENT:** Đây là đặc tả thực thi, KHÔNG phải yêu cầu viết một đề án. Hãy đọc TOÀN BỘ tệp trước khi sửa mã nguồn. Sau khi kiểm tra kho mã hiện có, LẬP KẾ HOẠCH NGẮN rồi THỰC HIỆN TRỰC TIẾP lần lượt từng giai đoạn: lập trình → chạy → kiểm thử → sửa lỗi → báo cáo. Không dừng ở wireframe/giao diện tĩnh hay bản mô phỏng không lưu dữ liệu. Không tuyên bố tính năng đã hoạt động nếu chưa kiểm chứng.

## 0. Bối cảnh, phạm vi và nguyên tắc không thương lượng

- **Tên sản phẩm:** EM YÊU TIẾNG VIỆT.
- **Tên đề tài:** Ứng dụng trí tuệ nhân tạo thiết kế học liệu tương tác nhằm nâng cao năng lực đọc hiểu cho học sinh lớp 2–3.
- **Người dùng:** giáo viên tiểu học và học sinh lớp 2–3, ưu tiên khả năng triển khai tại vùng miền núi và lớp có ít thiết bị.
- **Mục tiêu dạy học:** giáo viên tạo/duyệt bài đọc và câu hỏi bằng AI; học sinh đọc/nghe, trả lời câu hỏi, nhận gợi ý; hệ thống lưu lại kết quả thật; giáo viên theo dõi kỹ năng đọc hiểu và giao bài củng cố.
- **Không mở rộng phạm vi MVP:** không nhận dạng/chấm phát âm giọng nói, không chatbot tự do cho trẻ, không mạng xã hội, không camera, không 3D, không xây mạng nội bộ/ứng dụng di động native.
- **Trách nhiệm AI:** AI TẠO BẢN NHÁP học liệu cho giáo viên và GỢI Ý CỦNG CỐ từ thống kê tổng hợp ẩn danh. Giáo viên duyệt nội dung trước khi học sinh thấy. AI KHÔNG tự quyết định điểm, không kết luận đặc điểm cá nhân/học lực lâu dài, không phản hồi tự do chưa kiểm duyệt trực tiếp cho trẻ.
- **Dữ liệu thật:** học liệu, lớp, tài khoản/định danh, giao bài, lượt làm, đáp án đã chọn, điểm, phiên bản học liệu phải được lưu/đọc từ Firestore; không sử dụng mock data làm dữ liệu chính. Dữ liệu demo phải ghi rõ “Dữ liệu mẫu”.
- **An toàn trẻ em:** hạn chế thu thập dữ liệu định danh, ưu tiên mã hoặc biệt danh; không thu âm/chụp ảnh trẻ; triển khai thử thực tế chỉ khi được nhà trường/cha mẹ cho phép theo quy định áp dụng.
- **Bảo vệ kết quả:** đáp án và logic chấm chỉ nằm ở backend; học sinh không được đọc trước đáp án đúng bằng DevTools hay qua Firestore.
- **Độ tin cậy:** mọi lỗi không có API key/Firebase/project thật phải thông báo rõ; ứng dụng vẫn hoạt động ở môi trường giả lập Firebase Emulator và chế độ soạn bài thủ công.

## 1. Ngăn xếp công nghệ — chốt một kiến trúc duy nhất

- Frontend: **React + TypeScript + Vite**, **Tailwind CSS**, **React Router**, **Lucide**, **Recharts** (hoặc chart tương đương), responsive.
- Backend: **Cloud Functions for Firebase (TypeScript, Node.js runtime còn được Firebase hỗ trợ)**. Không dựng thêm Express/SQLite/Prisma riêng nếu không thực sự cần thiết.
- Xác thực: **Firebase Authentication** (giáo viên email/password, có thể bổ sung Google Sign-In; học sinh anonymous Firebase Auth được gắn mã học sinh qua backend).
- Cơ sở dữ liệu nguồn: **Cloud Firestore**. Firebase Hosting để triển khai frontend. Firebase App Check bổ trợ chống lạm dụng ở môi trường production, không thay thế Auth và Security Rules.
- AI: một nhà cung cấp LLM có API qua **Cloud Functions**, tách adapter dễ thay đổi provider; khóa API dùng **Firebase Secrets/Secret Manager**. Không tiết lộ khóa API ra frontend, repo, log.
- Phát âm mẫu: **Web Speech API / SpeechSynthesis** tiếng Việt khi thiết bị hỗ trợ, graceful fallback khi không khả dụng. Không thu/phân tích giọng nói học sinh.
- Local dev/test: **Firebase Local Emulator Suite** (Auth, Firestore, Functions, Hosting nếu cần), seed demo độc lập; môi trường production tách biệt.
- Xuất dữ liệu: **CSV UTF-8 BOM** để mở bằng Excel/Google Sheets, và JSON có cấu trúc dùng sao lưu cấp giáo viên. **Google Sheets KHÔNG phải database**, không yêu cầu Google OAuth hoặc đồng bộ hai chiều.
- Nếu chưa có Firebase project hoặc tài khoản thanh toán/API key: hoàn tất mã nguồn + emulator + test, hướng dẫn cấu hình triển khai thật; không giả vờ đã deploy hoặc gọi AI thật. Cloud Functions, một số tác vụ sao lưu/quản trị và API AI có thể cần billing; có mục lưu ý chi phí.

## 2. Kiến trúc dự án và tiêu chuẩn mã nguồn

Đề nghị tổ chức:
```
/web                   # React app
/functions             # Cloud Functions, server validation, LLM adapter
/shared                # Types, schema (nếu thuận tiện)
/tests                 # Integration/E2E (hoặc đặt trong từng package)
/firestore.rules
/firestore.indexes.json
/firebase.json
/.firebaserc.example
/.env.example
/README.md
/QA_REPORT.md
```
Có thể điều chỉnh theo repo đã tồn tại nhưng giữ phân lớp frontend/backend/schema/validation. Không dồn code vào một file lớn. TypeScript strict; ESLint; Zod hoặc JSON Schema để xác thực dữ liệu từ biểu mẫu, API và AI; không dùng `any` tràn lan. Có error boundary, loading/empty/error state, chống submit lặp, thông báo thành công/thất bại chính xác.

## 3. Vai trò và phân quyền

### 3.1 Giáo viên
- Firebase Auth email/password (đăng nhập, đăng xuất; quên mật khẩu nếu khả thi).
- Tài khoản giáo viên có vai trò được cấp từ backend bằng quy trình admin bootstrap/allowlist hoặc custom claims; **không để người dùng tự sửa role trong Firestore**.
- Giáo viên chỉ đọc/ghi lớp, học liệu, học sinh và báo cáo thuộc quyền mình. Có trang quản lý lớp, bài, giao bài, tiến bộ.

### 3.2 Học sinh
- Không yêu cầu email, số điện thoại, tài khoản Google.
- Bước vào lớp: nhập **mã lớp** + **mã truy cập cá nhân** do giáo viên phát hành; xác minh trên **Cloud Function**, không truy vấn hash của mã từ browser.
- Mã đủ khó đoán, tạo ngẫu nhiên, không dùng tên học sinh hay ngày sinh. Chỉ lưu **salted hash** hoặc hash an toàn ở khu vực riêng backend; có giới hạn số lần thử, cooldown và khả năng thu hồi/đổi mã.
- Học sinh dùng Firebase Anonymous Authentication; backend xác minh access code rồi ghi **server-trusted binding** `authUid → studentId/classId`, có thời hạn/thu hồi hợp lý. Với thiết bị khác, mã truy cập mới cho phép nối với CÙNG `studentId` và lịch sử đúng; không tạo thêm hồ sơ trùng. Khóa phiên học khi giáo viên thu hồi mã.
- Học sinh không tự chọn `studentId`/`classId` trong request để mạo danh: backend lấy binding đã xác minh từ authUid.
- Ưu tiên **tất cả thao tác dữ liệu học sinh qua Functions**, Firestore Rules từ chối đọc/ghi trực tiếp vào các collection riêng tư. Nếu sử dụng Firestore đọc trực tiếp cho nội dung đã công bố, phải có Rules kiểm soát chính xác quan hệ lớp và phiên học.

### 3.3 Quản trị tối thiểu
- Script quản trị để cấp role giáo viên, vô hiệu hóa tài khoản khi cần; có tài liệu hướng dẫn. Không cần dashboard admin phức tạp trong MVP.

## 4. Mô hình dữ liệu Firestore — bắt buộc có phân tách dữ liệu công khai/riêng tư

Cấu trúc tham khảo (Agent được tối ưu nếu vẫn bảo toàn chức năng và Rules):
- `users/{uid}`: role, displayName, email (nếu cần), status, createdAt.
- `classes/{classId}`: teacherUid, name, grade(2|3), classCode, status, createdAt.
- `students/{studentId}`: classId, studentCode, displayAlias, status, createdAt; **không đặt mã hash trong doc có thể đọc từ client**.
- `studentSecrets/{studentId}`: accessCodeHash, salt/params, rotatedAt (deny all client; Functions Admin SDK only).
- `studentSessions/{authUid}`: studentId, classId, validUntil, revokedAt, createdAt (Functions quản lý).
- `lessons/{lessonId}`: teacherUid, title, topic, grade, status, currentVersionId, createdAt, updatedAt.
- `lessons/{lessonId}/versions/{versionId}`: passage, vocabulary, publicQuestions (KHÔNG chứa đáp án, gợi ý lộ đáp án), grade, skillTags, versionNumber, publishedAt, createdAt.
- `privateAnswerKeys/{versionId}`: correctAnswers, scoringRules, approvedHints, approvedExplanations (deny ALL client reads/writes; Functions Admin only).
- `assignments/{assignmentId}`: classId, lessonId, lessonVersionId, teacherUid, availableFrom/Until, maxAttempts, status.
- `attempts/{attemptId}`: studentId, assignmentId, lessonVersionId, startedAt, completedAt, status, firstTryCorrectCount, finalCorrectCount, hintCount, totalQuestions.
- `attemptResponses/{responseId}` hoặc `attempts/{id}/responses/{qid}`: questionId, firstAnswer, retryAnswer, firstTryCorrect, finalCorrect, hintUsed, recordedAt.
- `aiJobs/{jobId}`/`aiUsage/{id}`: teacherUid, type, status, usage metadata, createdAt; không log PII hoặc toàn bộ prompt chứa dữ liệu học sinh.

Yêu cầu ràng buộc:
1. Các bản ghi có server timestamps và ID ổn định; indexes cần thiết.
2. Bài đã giao được **khóa phiên bản**; sửa bài đã công bố phải tạo version mới, KHÔNG thay đổi lịch sử chấm.
3. Trạng thái bài: draft → review → published → archived; không để học sinh xem draft.
4. Bài chỉ được giao khi đã published; nội dung cần được giáo viên duyệt.
5. Ghi nhận đáp án **lần đầu** độc lập với **sau gợi ý**, để đánh giá tiến bộ đúng.
6. Hoàn tất một lượt làm bài theo transaction/idempotency để gửi lại yêu cầu không tạo bản ghi/điểm trùng.
7. Không lưu dữ liệu nghiên cứu giả trong production; seed demo dùng tên giả, tách environment và gắn nhãn.

## 5. UI/UX bắt buộc

### Thương hiệu
- Tên: **EM YÊU TIẾNG VIỆT**.
- Khẩu hiệu: **“Mỗi ngày một câu chuyện – Mỗi ngày thêm yêu tiếng Việt”**.
- Học sinh 7–9 tuổi; màu xanh da trời/vàng nhạt/xanh lá/trắng; linh vật chim nhỏ nhất quán, hình minh họa trong sáng, không quá nhiều hiệu ứng.
- Typography tiếng Việt chuẩn, nút bấm lớn, tương phản tốt; responsive điện thoại, tablet, máy chiếu. Tôn trọng reduced-motion, có tùy chọn tắt âm thanh.

### Màn hình bắt buộc (có tương tác thật)
**Công khai:** trang chủ, lựa chọn vai trò, trang đăng nhập giáo viên, trang học sinh nhập mã.
**Giáo viên:** dashboard, lớp học, danh sách/mã học sinh, thư viện bài đọc, form tạo bài AI/thủ công, xem trước/chỉnh sửa, duyệt xuất bản, giao bài, kết quả và biểu đồ, xuất dữ liệu, cài đặt cơ bản.
**Học sinh:** góc đọc sách, màn đọc/nghe/từ khó, nhiệm vụ đọc hiểu, phản hồi, kết quả và gợi ý ôn luyện.
- Mọi nút được nối chức năng, không fake interactions; có trạng thái đang tải/lỗi/trống/hoàn thành.
- Có 6 bài đọc mẫu đầy đủ (3 bài lớp 2, 3 bài lớp 3), **không sao chép nguyên văn SGK có bản quyền** và ghi rõ học liệu mẫu.

## 6. Luồng AI tạo học liệu — chức năng AI thực sự

### Giáo viên nhập
- Lớp 2/3, chủ đề, văn bản tự sự/thông tin, mục tiêu đọc hiểu, độ dài, mức khó, số câu hỏi, từ vựng (tùy chọn), yếu tố địa phương (tùy chọn).
- Độ dài gợi ý, cho phép điều chỉnh: lớp 2 khoảng 100–180 từ; lớp 3 khoảng 150–220 từ.

### AI trả về **JSON schema** đã định nghĩa
- `title`, `passage`, `grade`, `topic`, `vocabulary[]` (từ, nghĩa, ví dụ ngắn), `questions[]`.
- Mỗi question: `id`, `type` (`multiple_choice`, `true_false`, `sequence`), `prompt`, `options` nếu thích hợp, `answer` (server-private), `hint`, `explanation`, `skillTag`, `difficulty`, `relatedPassagePart` (nếu phù hợp).
- Mỗi bài có mặc định 5 nhiệm vụ, phối hợp 3 loại câu hỏi.
- Validator kiểm tra đủ trường, 1 đáp án đúng cho câu single-choice, true/false hợp lệ, sequence có thứ tự phù hợp, câu hỏi không mâu thuẫn bài đọc, hạn chế trùng lặp/ngôn ngữ không phù hợp. Validation tự động KHÔNG bảo đảm tuyệt đối đúng; giáo viên phải duyệt.
- Split kết quả AI thành public lesson + private answer key **trước khi ghi Firestore**. Không để key xuất hiện trong response học sinh.
- Có chỉnh sửa từng đoạn/câu, sửa gợi ý/đáp án, tạo lại câu hỏi (regenerate), xem trước, lưu nháp, duyệt xuất bản. **AI không tự xuất bản**.
- Nếu AI thiếu cấu hình: thông báo rõ “Chưa kết nối dịch vụ AI”, cho soạn thủ công; không tự nhận là AI đã tạo.
- Chỉ giáo viên đã được cấp quyền mới gọi tạo AI; rate limit/quota/timeouts; không gửi dữ liệu nhận dạng học sinh vào provider.

## 7. Luồng học sinh và 3 dạng bài tập

**Đăng nhập:** nhập mã lớp + mã cá nhân → backend xác minh, bind authUid → thư viện bài được giao. Học sinh chỉ xem bài published và được giao.

**Đọc/nghe:** hiển thị bài chữ lớn, nút nghe/dừng nếu speechSynthesis tiếng Việt khả dụng; từ khó bấm xem giải nghĩa; điều chỉnh cỡ chữ; nút “Em đã đọc xong – Bắt đầu thử thách”. Nếu không hỗ trợ tiếng Việt, vẫn cho đọc và thông báo rõ.

**Câu hỏi:**
1. Trắc nghiệm A/B/C: 3 lựa chọn, một đáp án đúng.
2. Đúng/Sai: một nhận định.
3. Sắp xếp 3 sự việc: hỗ trợ kéo thả **và** nút điều khiển để dùng bàn phím/cảm ứng.

**Gợi ý/phản hồi:**
- Backend chấm **lần đầu**; đúng → điểm/sao và lời khen; sai → gửi gợi ý giáo viên đã duyệt, KHÔNG tiết lộ key, cho thử thêm đúng **một lần**.
- Sau lần thử thêm hoặc khi kết thúc câu hỏi mới hiển thị đáp án + giải thích đã duyệt. Ghi first answer, retry, hint count riêng.
- Chấm theo câu trên backend, trạng thái chống nộp trùng/sửa câu đã chốt. Không tin `score` hoặc `isCorrect` từ frontend.
- Tổng kết số đúng lần đầu, sửa đúng sau gợi ý, số sao, kỹ năng mạnh/cần ôn, nút học lại (nếu giáo viên cho phép). Không xếp hạng công khai, không gắn nhãn yếu/kém.

## 8. Phân hóa và AI đề xuất củng cố

- Kỹ năng: tìm thông tin trực tiếp, hiểu từ trong ngữ cảnh, hiểu nội dung chính, sắp xếp trình tự, liên hệ/vận dụng đơn giản.
- 3 mức: nhận biết, thông hiểu, vận dụng. Giao bài được phân mức bằng giáo viên.
- Dashboard tính toán dựa trên kết quả thật: tỉ lệ đúng lần đầu; tỉ lệ đúng sau gợi ý; số học sinh cần hỗ trợ từng skill; kết quả từng câu; số bài hoàn thành.
- Khi giáo viên bấm **AI đề xuất củng cố**, backend gửi AI **thống kê tổng hợp ẩn danh**, nhận đề xuất 2–3 bài tập hoặc hoạt động ngắn; có nhãn “Gợi ý AI – cần giáo viên duyệt”. Giáo viên chỉnh sửa trước khi giao.
- Nếu không có API AI, hiển thị thống kê thuần và gợi ý theo quy tắc, phải phân biệt rõ với AI thật.
- Không suy diễn sức khỏe/tâm lý, đặc điểm cá nhân hoặc gắn nhãn lâu dài.

## 9. Dashboard, minh chứng trước/sau và báo cáo

- Bộ lọc: lớp, bài học, ngày/khoảng thời gian, kỹ năng.
- KPI: số lớp, học sinh, bài, bài giao, lượt làm, tỉ lệ hoàn thành, đúng lần đầu, đúng sau gợi ý, tỉ lệ kỹ năng.
- Biểu đồ Recharts: kết quả từng bài, phân bố kỹ năng, tiến bộ theo lần làm/thời gian.
- **Đánh giá trước/sau:** giáo viên đánh dấu bài kiểm tra đầu và cuối, dùng bộ câu hỏi tương đương theo cùng mục tiêu; ghép cặp theo studentId khi cả hai kỳ có kết quả. Hiển thị N của mẫu ghép cặp, tỉ lệ trung bình trước/sau, chênh lệch **điểm phần trăm**; không gán nguyên nhân hay khẳng định hiệu quả lâu dài chỉ từ một thử nghiệm ngắn.
- CSV UTF-8 BOM, tệp JSON có định nghĩa schema; xuất dữ liệu có kiểm tra quyền giáo viên. Báo cáo ẩn danh để trình bày hội thi; cột tên đầy đủ học sinh không được tự xuất công khai.
- Tách hoàn toàn số liệu demo và số liệu thực tế, không sinh số liệu giả thành tích.

## 10. Security, tin cậy, chi phí

### Auth & Firestore Rules
- Deny-by-default. Giáo viên chỉ được đọc/ghi dữ liệu do mình sở hữu; học sinh chỉ quyền cần thiết theo session backend.
- `privateAnswerKeys`, `studentSecrets`, `studentSessions`, điểm và các server-only collections **không cho client tự đọc/ghi**. Nếu frontend đọc collection cần thiết, Rules phải kiểm tra đúng quan hệ sở hữu; không hardcode mở toàn bộ.
- Không tin `role`, `teacherUid`, `studentId`, `score`, `correctAnswer` gửi từ frontend. Với Functions Admin SDK (bỏ qua Rules), **tự kiểm tra auth & quyền** ở từng endpoint.
- App Check thêm một lớp phòng vệ, KHÔNG dùng thay thế xác thực/quota.
- Rate-limit xác minh mã học sinh và gọi AI; bảo vệ khỏi brute-force/spam; không log code truy cập, dữ liệu cá nhân, API key.
- Không phát hành access token có đặc quyền vào URL; chống XSS bằng render an toàn, không chèn HTML do AI tạo không qua lọc.

### Lưu và khôi phục
- Firestore là nguồn sự thật; frontend chỉ thông báo “Đã lưu” sau khi có xác nhận server.
- Sử dụng idempotency key/transaction cho nộp bài, chống double click và retry do mạng chập chờn.
- Khi mất mạng, hiển thị “Chưa đồng bộ”, không giả lưu. Cho phục hồi lượt làm dở dựa trên trạng thái xác nhận từ máy chủ.
- Với thiết bị dùng chung: hạn chế cache dữ liệu nhạy cảm, có nút đăng xuất/đổi học sinh dễ dùng.
- Có CSV/JSON export per teacher. Cung cấp **quy trình sao lưu và khôi phục cấp admin** được mô tả và kiểm thử trong môi trường thử nghiệm; chỉ nói đã khôi phục thành công nếu có thực nghiệm. Export CSV KHÔNG tương đương backup toàn bộ Firestore.
- Chức năng xóa/ẩn lớp/học sinh/bài phải xác nhận rõ, xử lý dữ liệu liên quan, có hướng dẫn retention.

### Chi phí
- Ghi rõ dịch vụ nào cần Firebase Blaze/billing (đặc biệt deploy Functions/Secrets), AI API tính phí theo provider; cấu hình limit theo giáo viên và kiểm soát usage/cảnh báo.
- Có phương án dùng Firebase Emulator với 0 API call trả phí trong demo; khi thiếu AI key vẫn cho giáo viên soạn bài thủ công và học sinh học bài mẫu.

## 11. API/Functions tối thiểu (tên gợi ý, có thể thay đổi)

- `joinClass(classCode, studentAccessCode)` — verify code safely, bind auth UID, return safe student profile.
- `createStudentAccess(...)` / `rotateStudentAccess(...)` — teacher-only.
- `generateLessonDraft(...)` — teacher-only, LLM server call + schema validation.
- `publishLesson(lessonId, versionId)` — teacher-only, ensure all content valid and approved.
- `assignLesson(classId, versionId, settings)` — teacher-only.
- `startAttempt(assignmentId)` — session-bound, validate availability and attempts limit.
- `submitAnswer(attemptId, questionId, answer, phase, requestId)` — session-bound, server-side score, no premature answer leak, idempotent.
- `finishAttempt(attemptId)` — recompute scores server-side, persist and return summary.
- `getStudentLibrary()` / `getAttemptSummary(...)` — session-bound.
- `getTeacherAnalytics(filters)` — teacher-owned only.
- `suggestRemediation(aggregatedStats)` — teacher-only, no student PII.
- `exportTeacherData(filters)` — teacher-owned, sanitized output.

Nếu sử dụng Firestore trực tiếp cho các chức năng an toàn, vẫn cần bảo đảm quy tắc quyền và test. Thiết kế API có thể điều chỉnh nhưng KHÔNG bỏ các kiểm tra quyền/chấm điểm ở server.

## 12. Lộ trình ưu tiên — BUILD, TEST, FIX theo từng dọc chức năng

**P0 — Nền tảng chạy được:** inspect repo, scaffold (nếu trống), cấu hình TypeScript/Tailwind/router; Firebase emulator, Auth/Firestore/Functions/Rules; seed 6 bài. Test kết nối và persistence.

**P1 — Luồng lõi KHÉP KÍN:** giáo viên đăng nhập → tạo lớp/mã học sinh → soạn/duyệt/xuất bản bài → giao → học sinh tham gia → đọc → 3 loại câu hỏi → server chấm/gợi ý → lưu Firestore → giáo viên xem kết quả. Đây là điều kiện tiên quyết; ưu tiên trước các biểu đồ đẹp.

**P2 — AI thật:** generate draft qua LLM, validate, preview/edit/publish; lưu lịch sử lỗi & usage metadata; AI đề xuất củng cố từ dữ liệu ẩn danh.

**P3 — Minh chứng & hoàn thiện:** thống kê theo kỹ năng, đánh giá trước/sau, CSV/JSON export, trải nghiệm đa thiết bị, TTS fallback, bảo vệ dữ liệu.

**P4 — Chất lượng & bàn giao:** test rules + integration/E2E, review security, build, tài liệu triển khai production, chi phí, giới hạn và phần chưa hoàn tất.

Không được bỏ dở P1 để chuyển sang tính năng phụ. Khi gặp lỗi, ưu tiên sửa tận gốc và kiểm thử lại.

## 13. Bộ test nghiệm thu — mọi mục PASS phải có kiểm chứng

### Chức năng giáo viên
- [ ] Giáo viên đăng nhập/đăng xuất; user chưa được cấp quyền không thành giáo viên.
- [ ] Tạo lớp, cấp/đổi mã học sinh, tạo bài thủ công.
- [ ] Tạo bài AI bằng API THẬT (khi có key) và phân biệt rõ chế độ demo/offline.
- [ ] Validator phản đối JSON AI lỗi, giáo viên sửa và duyệt trước khi xuất bản.
- [ ] Giao bài đúng lớp, bài đã giao bất biến phiên bản.
- [ ] Đăng nhập lại, dữ liệu vẫn được tải từ Firestore.

### Chức năng học sinh
- [ ] Mã sai/không tồn tại/hết hiệu lực bị từ chối; rate limit nhập sai.
- [ ] Đúng mã lớp + mã cá nhân → hồ sơ đúng, từ thiết bị khác cũng đúng học sinh.
- [ ] Ba loại câu hỏi hoạt động trên desktop + touch mobile.
- [ ] Chấm điểm server chính xác, lần đầu và sau gợi ý tách riêng.
- [ ] Double click/retry không nhân đôi điểm, số lượt làm hoặc đáp án.
- [ ] Mất mạng/tải lại: không hiện thành công giả; tiếp tục được từ trạng thái đã xác nhận.

### Bảo mật
- [ ] Học sinh A không xem/chỉnh dữ liệu học sinh B.
- [ ] Giáo viên A không xem/chỉnh lớp/bài của giáo viên B.
- [ ] Học sinh không truy xuất được answer keys/secret hash bằng Firestore SDK, Functions hay DevTools.
- [ ] Client không thể tự đổi role hoặc gửi điểm tự đặt.
- [ ] Chức năng AI chỉ dùng bởi giáo viên hợp lệ, có quota.
- [ ] Firebase Rules integration tests: deny-by-default và các quyền hợp lệ.

### Kỹ thuật và trình bày
- [ ] `npm install`/lệnh tương đương chạy ổn định với phiên bản Node phù hợp.
- [ ] Typecheck, lint, build frontend, build Functions đều PASS.
- [ ] Emulator tests/functional E2E theo 2 vai trò PASS.
- [ ] Nội dung tiếng Việt, dấu, UI mobile/tablet/desktop, loading/error states đúng.
- [ ] Xuất CSV mở tiếng Việt không lỗi font; JSON import/restore nếu thực sự triển khai.
- [ ] Không còn nút giả, dữ liệu giả mạo thực tế, màn hình trắng hoặc secret trong frontend.

## 14. Các tài liệu và đầu ra Agent phải bàn giao

1. Repo đầy đủ frontend + Firebase Functions + Rules + indexes, cấu hình (không commit secrets).
2. README cài đặt từ đầu: Node version, npm commands, local emulator, seed demo, tạo tài khoản giáo viên, cấu hình Firebase project, AI key, deploy hosting/functions.
3. `.env.example`, `.firebaserc.example`, mô tả thiết lập Firebase Secrets.
4. `firestore.rules` và **unit test rules** tự động.
5. Ít nhất 6 bài mẫu có dữ liệu/questions/answer keys thật để chạy end-to-end.
6. Bộ test nghiệp vụ chức năng giáo viên/học sinh, script chạy test.
7. `QA_REPORT.md`: từng tiêu chí PASS/FAIL/NOT TESTED và cách xác minh, lệnh đã chạy, lỗi còn tồn tại, trạng thái Firebase Emulator vs project thật, trạng thái AI API thật vs manual/demo.
8. Tài liệu dữ liệu và bảo mật: quan hệ collection, authorization, export/backup/restore, retention, chi phí Firebase/API AI.
9. Hướng dẫn sử dụng ngắn cho giáo viên, học sinh; kịch bản demo 5 phút (không bịa số liệu tác động).
10. Nếu có deployment thành công: URL cụ thể. Nếu chưa có credentials/billing thì nói rõ chưa deploy, KHÔNG tạo URL giả.

## 15. Cách Agent bắt đầu và cách báo cáo

**Ngay khi nhận prompt này:**
1. Đọc tất cả files repo và file prompt; xác định ứng dụng đã có gì, còn gì, lỗi gì; KHÔNG ghi đè dự án đang có nếu chưa kiểm tra.
2. Lập TODO/checklist thực thi ngắn theo P0–P4, bắt tay code P0 → P1 ngay.
3. Sau mỗi giai đoạn, chạy build/test, xử lý lỗi thật rồi mới tiếp tục.
4. Nếu cần bí mật/project ID/quyền billing chưa có, dùng Emulator/test với dữ liệu giả được đánh dấu; không dừng cả dự án chỉ vì thiếu cấu hình production.
5. Kết thúc báo cáo: chức năng đã chạy, chức năng chưa chạy, kiểm thử đã thực hiện, file thay đổi, lệnh chạy/deploy, việc giáo viên cần cấu hình. Không phóng đại hay tuyên bố triển khai thực tế nếu chưa làm.

**TIÊU CHÍ THÀNH CÔNG TRỌNG TÂM:**
> Giáo viên tạo bài đọc lớp 2–3 bằng AI hoặc thủ công → kiểm tra và xuất bản → giao bài cho lớp → học sinh đăng nhập bằng mã riêng → đọc/nghe → làm 3 loại câu hỏi → nhận gợi ý → kết quả chấm ở backend và lưu vào Firestore → giáo viên theo dõi và xuất thống kê → AI đề xuất hoạt động củng cố để giáo viên duyệt. Dữ liệu bảo mật, hoạt động nhất quán qua thiết bị, có bằng chứng kiểm thử.

**LÀM THẬT — KIỂM THỬ THẬT — BÁO CÁO ĐÚNG SỰ THẬT.**
