# EM YEU TIENG VIET — IMPLEMENTATION PROMPT v5.0
## Sửa dứt điểm trải nghiệm học sinh, giọng đọc, câu hỏi, quản lý tài khoản và lưu kết quả

**NHIỆM VỤ CHO ANTIGRAVITY CODING AGENT**

Bạn là nhóm kỹ sư Full-stack React + TypeScript, Firebase Auth/Firestore/Functions, chuyên gia UX tiểu học, kiểm thử và bảo mật. Hãy **đọc toàn bộ tài liệu của workspace hiện tại**, trong đó có `AGENTS.md`, `EMYTV_AGENT_PROMPT.md`, các báo cáo nghiệm thu gần nhất, `firebase.json`, `firestore.rules`, các cấu trúc `web/src`, `functions/src` và file checklist đi kèm `EMYTV_ACCEPTANCE_CHECKLIST.md`. Sau đó trực tiếp **kiểm tra nguyên nhân, sửa mã nguồn và kiểm thử từng luồng**. Không xây dựng lại dự án, không vô tình mất dữ liệu Emulator, không đổi cấu trúc Firebase tùy tiện, không giả vờ PASS.

## A. Bằng chứng lỗi qua trải nghiệm thực tế (phải tái hiện)

1. Bài đọc tiếng Việt đang được **đọc bằng giọng tiếng Anh** trên thiết bị một số người dùng.
2. Các câu hỏi được hiển thị nối tiếp trong trang dài; học sinh phải cuộn xuống; không có các nút `Kiểm tra đáp án`, `Thử lại`, `Câu tiếp theo` theo logic cần thiết.
3. Không có tín hiệu âm thanh đúng/sai khi thao tác.
4. Mã học sinh và PIN không được cấp/xem lại/đặt lại một cách rõ ràng; giáo viên dễ mất mã sau khi đóng hộp thoại.
5. Chưa có **nhập/xuất Excel** danh sách học sinh và quản lý giáo viên/tài khoản theo quyền.
6. Bài đã làm xong không xem lại được; khi số lượt làm hết, hệ thống hiện `Không thể mở bài học` dù người dùng chỉ muốn xem lịch sử. Cần phân biệt `xem lại` với `làm lượt mới`, và xác định có bị mất bài làm thật hay chỉ chặn bởi `maxAttempts`.
7. Giao diện đôi khi hiển thị lỗi Gemini: `Expected double-quoted property name in JSON` kèm đoạn JSON dài, mặc dù báo cáo trước đã cho PASS.
8. Ảnh giao diện giáo viên hiển thị tài khoản `admin` ở trang `Bảng điều khiển giáo viên` — cần kiểm tra lại điều hướng và phân quyền ba vai trò.
9. Lời văn AI có thể chưa tự nhiên; câu hỏi và đáp án phải gắn với văn bản đã được giáo viên duyệt.

**BẮT BUỘC**: Bắt đầu bằng kiểm kê mã nguồn/endpoint, xác định trường hợp lỗi thực tế, ghi test tái hiện, sửa nguyên nhân và chạy lại test. Không sửa bằng cách hardcode kết quả, tắt bảo mật, tăng vô hạn lượt làm hoặc viết số liệu giả.

## B. Nghe đọc mẫu tiếng Việt: GIỮ, KHÔNG BỎ

- Kiểm tra `AudioReader.tsx` và luồng Web Speech API. Lấy danh sách giọng thực tế bằng `speechSynthesis.getVoices()`; xử lý event `voiceschanged` vì giọng có thể nạp sau khi mở trang.
- Chỉ chọn voice có `lang` là `vi-VN` hoặc voice tiếng Việt phù hợp; đặt `utterance.lang = 'vi-VN'`; kiểm tra giọng được chọn thực sự tồn tại. **Không tự fallback sang giọng en-US/en-GB** để phát âm văn bản tiếng Việt.
- Ưu tiên bản ghi âm tiếng Việt đã được giáo viên cung cấp nếu có; nếu chưa có giọng tiếng Việt/âm thanh hợp lệ, hiện thông báo ngắn: `Thiết bị chưa có giọng đọc tiếng Việt. Em vẫn có thể đọc bài hoặc nhờ cô giáo hỗ trợ.` Không nói “đọc mẫu chuẩn” khi phát âm sai.
- Có nút Nghe, Tạm dừng/Tiếp tục, Dừng, tốc độ Chậm/Vừa, và trạng thái đang phát; không phát tự động khi tải trang. Hủy giọng khi đổi bài/chuyển màn hình. Không gửi văn bản học sinh hoặc dữ liệu cá nhân lên dịch vụ TTS bên ngoài khi chưa được phép.
- Thiết kế có thể bổ sung tải lên MP3 do giáo viên đọc về sau, nhưng đợt này không được phụ thuộc dịch vụ TTS trả phí; nếu thiếu hạ tầng lưu file, báo rõ tính năng còn chờ, không dựng nút giả.

## C. Trò chơi từng câu — không cuộn dài

- Mỗi màn hình chỉ hiện một câu hỏi, số câu `1/5`, thanh tiến độ, loại câu hỏi tiếng Việt, vùng đáp án và vùng gợi ý.
- Với lựa chọn trắc nghiệm/Đúng-Sai/sắp xếp, nút **Kiểm tra đáp án** bị vô hiệu cho đến khi đã có lựa chọn/sắp xếp đủ. Không tạo hoặc gửi một câu trả lời rỗng. Người dùng không thể bấm `Tiếp` để bỏ qua câu chưa hoàn tất (trừ khi giáo viên chủ động thiết kế loại bài cho phép bỏ qua trong tương lai).
- Khi đáp án ĐÚNG ở lần đầu: gọi backend xác nhận; hiện giải thích ngắn, animation tinh tế và âm thanh hai nốt vui ngắn; hiện nút **Câu tiếp theo**. Không tự cuộn hoặc tự chuyển quá nhanh.
- Khi SAI ở lần đầu: server lưu câu trả lời đầu, trả về gợi ý không tiết lộ đáp án; âm thanh trầm nhẹ; cho **Thử lại một lần**. Không cho `Câu tiếp theo` ngay khi chưa hoàn tất lượt thử theo logic.
- Khi SAI lần hai: server ghi trạng thái, sau đó hiện đáp án đúng/giải thích đã được duyệt và nút **Câu tiếp theo**. Không quy lỗi cho học sinh. Nếu thử lại đúng, phân biệt rõ `đúng sau gợi ý` với `đúng lần đầu`.
- Câu cuối dùng nút `Hoàn thành bài`, chỉ kích hoạt khi server xác nhận tất cả nhiệm vụ đã có kết quả hợp lệ.
- Câu trắc nghiệm: chọn 1/3; Đúng/Sai: chọn 1/2; Sắp xếp: thao tác bằng chạm và bằng nút lên/xuống, bắt buộc sắp xếp đủ mục. Giao diện mobile 390px không cuộn quá xa để tìm nút; dùng thanh thao tác gần đáy phần câu hỏi hoặc sticky footer an toàn với màn hình nhỏ.
- Nút `Xem lại đoạn đọc` cho phép xem bài đọc/đoạn liên quan mà **không làm mất câu đang trả lời**. Tránh gửi trùng khi double-click; idempotency key cho mỗi câu, xử lý mạng chậm.
- Dùng Web Audio API hoặc file âm thanh nhỏ riêng cho tín hiệu ĐÚNG/SAI; đảm bảo phát khi người dùng đã tương tác (trình duyệt có thể chặn autoplay), âm lượng dịu, khác biệt dễ nhận biết, có nút bật/tắt. Âm thanh là hỗ trợ, không phải dấu hiệu duy nhất: luôn kèm chữ/icon; không cần file nhạc bên ngoài, không dùng tiếng người bằng tiếng Anh.

## D. Kết quả và lượt làm bài — phân biệt “Xem lại” / “Làm lại”

- Truy vết `getStudentLibrary`, `startAttempt`, `submitAnswer`, `finishAttempt`, `maxAttempts` và các collection `attempts/attemptResponses` (đổi tên theo mã thật nếu khác).
- Thẻ bài học của học sinh hiển thị `Chưa làm`, `Đang làm`, `Đã hoàn thành`, `Đã hết lượt`; hiển thị `Lượt đã sử dụng / tối đa` đúng dữ liệu backend.
- Nút `Tiếp tục bài đang làm` mở đúng attempt đang dở (không tạo mới); tải lại trang không tăng lượt đã dùng.
- Nút `Xem kết quả` / `Xem lại bài đã làm` **luôn được phép cho attempt thuộc về học sinh đó** kể cả khi maxAttempts=3 đã hết. Màn xem lại READ-ONLY: văn bản đã làm, từng câu, câu trả lời học sinh, đáp án đã được phép tiết lộ sau hoàn thành, giải thích, điểm lần đầu và điểm sau gợi ý, thời điểm nộp, lịch sử các lượt trước.
- Nút `Làm lại` chỉ hiển thị/kích hoạt nếu số lượt completed+in-progress theo quy tắc còn cho phép. Nếu hết lượt, hiện `Em đã dùng hết 3 lượt. Em vẫn có thể xem lại bài; hãy hỏi cô nếu muốn được giao thêm lượt.` + nút `Xem lại`.
- Nếu giáo viên đổi `maxAttempts` hoặc giao bài mới, giữ lịch sử cũ, không reset âm thầm; chỉ backend có quyền cập nhật. Không tăng `attempt count` lúc chỉ xem bài đọc hoặc xem kết quả.
- Cần kiểm thử riêng tình huống có dữ liệu E2E mẫu cũ khiến học sinh mới tưởng mình làm hết lượt. Dữ liệu test phải tách/đánh dấu, không ảnh hưởng tài khoản học sinh thực.
- Bảo toàn quyền riêng tư: học sinh A không đọc được attempt của học sinh B, admin/giáo viên chỉ xem theo phân quyền, chấm điểm luôn ở backend.

## E. Quản lý mã học sinh, PIN, tài khoản giáo viên và Excel

**Phân biệt ba dữ liệu:** mã lớp (`classCode`) để tìm lớp; mã học sinh (`studentCode`/ID) có thể xem lại; **PIN bí mật** chỉ hiện khi cấp mới/đặt lại, không thể “xem lại” nếu đã băm an toàn.

- Trong màn quản lý lớp và học sinh: luôn hiển thị mã lớp, mã học sinh, tên hiển thị/biệt danh, trạng thái và các nút có thể bấm: `Sao chép mã lớp`, `Cấp lại PIN`, `In thẻ đăng nhập`, `Tải danh sách`, `Thêm học sinh`, `Nhập Excel`, `Xuất Excel`.
- Khi vừa tạo học sinh: hiện mã lớp + mã học sinh + PIN mới **một lần** trong modal xác nhận, nút sao chép và in/thẻ. Không lưu PIN plaintext ở Firestore hoặc log; trường hợp mất PIN thì **cấp lại PIN mới** và vô hiệu hóa PIN cũ/phiên cũ khi phù hợp. Không cho giáo viên nhìn lại mã PIN cũ từ hash. Không ép học sinh nhớ email/mật khẩu.
- Khi cấp PIN hàng loạt: hiển thị/download một lần danh sách mã đăng nhập dạng bảo mật cho giáo viên được ủy quyền, cảnh báo chứa mã nhạy cảm, yêu cầu lưu ở nơi an toàn; không lưu tệp plaintext công khai trên Hosting/Firestore. Phải có cơ chế tải lại bằng cách cấp PIN mới, không bằng giải mã hash.
- Cho phép **nhập .xlsx** danh sách học sinh từ mẫu có cột `studentCode`, `displayName`, `classCode` hoặc chọn lớp trước khi nhập, `academicYear`; nếu file chỉ có tên và mã, có thể phát sinh mã học sinh theo quy tắc đảm bảo duy nhất. File mẫu cần có hướng dẫn tiếng Việt, tên cột rõ, một sheet ví dụ, kiểm tra dữ liệu trước khi ghi.
- Validate file: phần mở rộng/kích thước/số dòng hợp lý, loại bỏ công thức nguy hiểm/giá trị bất thường, không nhận tệp thực thi, chuẩn hóa khoảng trắng/Unicode, bắt lỗi trùng trong file và trùng Firestore, cảnh báo dòng lỗi, có preview và xác nhận. Ghi hàng loạt qua backend theo batch/chunk có kiểm soát, không commit nửa chừng mà báo toàn bộ thành công; hỗ trợ retry an toàn. Không tự tạo nhiều HS trùng khi tải cùng file 2 lần.
- Xuất `.xlsx` danh sách học sinh: mã lớp, mã học sinh, biệt danh/tên, trạng thái, năm học, kết quả tổng hợp theo quyền; **không xuất hash/PIN cũ**. CSV có UTF-8 BOM có thể giữ là tùy chọn.
- Admin quản lý giáo viên: nhập .xlsx từ mẫu email, tên hiển thị, trạng thái/nhóm được cấp quyền; có preview + xác nhận + xử lý trùng; tạo tài khoản/invite/reset password bằng backend an toàn, không xuất mật khẩu giáo viên và không tự đặt role từ frontend. Xuất Excel danh sách theo quyền.
- **Đổi mật khẩu giáo viên**: có `Đổi mật khẩu`/`Quên mật khẩu`, sử dụng luồng Firebase Authentication phù hợp (gửi email đặt lại, xác thực lại khi đổi mật khẩu). Admin không “xem mật khẩu cũ” của giáo viên.
- Nếu chưa có danh sách email thực cho teacher, test bằng domain test/sandbox, không gửi email thật ngoài ý muốn.
- Tài khoản `admin` phải vào dashboard Admin riêng; nếu có tính năng xem giao diện Giáo viên thì phải hiển thị rõ `Chế độ xem giáo viên (Admin)` và được kiểm soát backend, không đổi role bằng cách sửa LocalStorage/frontend.

## F. Củng cố Gemini AI và chất lượng ngữ liệu

- Tái hiện lỗi screenshot: `Expected double-quoted property name in JSON ...`. Đọc kỹ adapter, SDK/API, schema hiện tại và các trạng thái UI.
- Dùng cơ chế xuất JSON có cấu trúc/schema được SDK/model thực tế hỗ trợ; kiểm tra JSON đầy đủ; validate schema Zod và điều kiện sư phạm; hạn chế thao tác sửa bằng regex tùy tiện có thể làm lệch câu hỏi/đáp án. Nếu lỗi định dạng, thử tạo lại tối đa 1 lần có kiểm soát (tránh dùng quá nhiều hạn mức) hoặc cho giáo viên chọn `Thử lại`; không tự tuyên bố tạo thành công khi đang lỗi.
- Thông báo cho giáo viên bằng tiếng Việt ngắn gọn, ví dụ `AI trả về bài chưa đúng định dạng. Vui lòng thử lại hoặc chuyển sang soạn thủ công.`, hiển thị mã lỗi để hỗ trợ, nhưng **không hiển thị JSON thô dài, bí mật, token hoặc prompt cá nhân** trong thông báo.
- Kiểm tra loại văn bản (truyện/thơ/thông tin); tránh sửa tự động ảnh hưởng đến đáp án; trường hợp nội dung thay đổi phải tạo lại/đối chiếu câu hỏi, khóa chấm và lý giải. Nhân hóa được phép trong văn học, không áp dụng cấm đoán máy móc.
- Giáo viên phải duyệt trước xuất bản; snapshot/phiên bản bài học không thay đổi lịch sử attempt cũ.
- Không sử dụng dữ liệu cá nhân trẻ em trong prompt Gemini. Giữ `gemini-3.5-flash-lite` chỉ nếu đang có quyền sử dụng và đã thử thành công; tránh gọi API live quá nhiều chỉ để kiểm thử UI.

## G. Dữ liệu và môi trường

- Tiếp tục làm trên Firebase Emulator trong đợt này; duy trì `.env.local` và `.secret.local`, giữ secrets nằm ngoài Git; không sửa Firebase Cloud Staging, không deploy, không nâng Blaze, không kích hoạt billing.
- Trước mọi migration thay đổi schema: sao lưu Emulator riêng có timestamp, kiểm chứng đọc lại, thiết kế chuyển đổi dữ liệu cũ, không xóa `emulator-data` khi chưa backup. Không dùng `--force` vào bản backup duy nhất.
- Bắt buộc kiểm thử backend authorization ở các Cloud Functions dùng Admin SDK: Admin SDK không bị Firestore Security Rules ràng buộc; phải kiểm tra quyền ở server cho từng hành động.
- Lỗi hiển thị dữ liệu và quyền truy cập phân biệt rạch ròi: `Chưa được giao bài`, `Đã hết lượt nhưng có kết quả`, `Chưa đồng bộ`, `Phiên hết hạn`, `Không có quyền`, `Chưa có giọng tiếng Việt`.
- Không chạy lệnh xóa Temp/cache toàn máy hoặc thay đổi những thư mục ngoài workspace.

## H. Thứ tự triển khai, không thêm chức năng ngoài phạm vi

P0. Chạy backup, rà soát endpoints, tái hiện lỗi bằng ảnh/Browser Agent; thêm test hồi quy.
P1. Sửa dữ liệu bài làm, trạng thái assignment/attempt, xem lại kết quả sau khi hết lượt; bảo vệ lịch sử cũ.
P2. Cải thiện trình tự một câu mỗi lần, retry, âm thanh đúng/sai và TTS tiếng Việt.
P3. Hoàn thiện mã HS/PIN, Excel import-export học sinh/giáo viên, đổi/đặt lại mật khẩu, Admin role UI.
P4. Harden Gemini JSON, việt hóa thông báo và các nhãn, kiểm thử build/tests/UI browser.

Sau mỗi giai đoạn, chạy TypeScript/build và test liên quan, xác nhận hoạt động UI thật. Nếu việc nào chưa thực hiện được, ghi BLOCKED/FAIL với lý do, không gắn PASS giả.

## I. Kết quả phải bàn giao

- `UX_ACCOUNT_RELIABILITY_REPORT.md`: lỗi gốc, thay đổi file, nguyên nhân, cách chạy/kiểm thử, ảnh minh chứng, phần chưa đạt.
- `FEATURE_STATUS_MATRIX.md`: tất cả nút/luồng chính, kèm trạng thái REAL-PASS / FAIL / BLOCKED.
- `STUDENT_TEACHER_MANUAL.md`: thao tác Admin, giáo viên, học sinh, mã lớp/PIN, Excel, nghe đọc, nộp và xem lại bài.
- Hai mẫu Excel tải từ ứng dụng: `mau_nhap_hoc_sinh.xlsx`, `mau_nhap_giao_vien.xlsx` (đúng schema đang thực thi, không phải file giả).
- Bộ test mới cho TTS/no-vi voice, âm thanh, retry 2 lần, nút Tiếp, khôi phục attempt, đã hết lượt nhưng xem lại, cấp PIN mới, Excel hợp lệ/sai/trùng, tài khoản teacher reset, AI JSON hỏng, phân quyền, Firestore persistence.
- Browser Agent: thử Desktop 1440x900 và Mobile 390x844; chạy thật end-to-end từ Admin → Giáo viên → Học sinh → kết quả xem lại, chụp ảnh trước/sau.

**Định nghĩa hoàn thành:** học sinh đăng nhập được bằng mã, làm 5 câu theo nút Tiếp, nhận âm thanh phản hồi (khi không tắt âm), xem lại được bài đã hoàn thành sau F5 và hết lượt; giáo viên xuất/nhập Excel và đặt lại PIN an toàn; tài khoản giáo viên khôi phục mật khẩu; chỉ phát giọng đọc tiếng Việt hoặc thông báo không hỗ trợ; Gemini xử lý JSON lỗi an toàn; dữ liệu Firestore và phân quyền kiểm chứng. Không được chốt hoàn thành chỉ vì build PASS.

**BẮT ĐẦU TRỰC TIẾP:** đọc workspace, lập bảng lỗi tái hiện, backup, sửa mã theo P0–P4 và kiểm thử. Không chỉ phân tích hay viết báo cáo. Không cần yêu cầu người dùng xác nhận những quyết định nghiệp vụ đã nêu, trừ khi cần quyền thực sự để thao tác dịch vụ trả phí hoặc production.
