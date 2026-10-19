import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fetch from "node-fetch";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function runVerification() {
  console.log("==================================================================");
  console.log("   KIỂM CHỨNG TOÀN DIỆN P0: LƯU BẢN NHÁP & DUYỆT XUẤT BẢN BÀI ĐỌC   ");
  console.log("==================================================================");

  // 1. Get Teacher Token
  const teacherEmail = "giaovien.tieuhoc@emytv.edu.vn";
  const teacherUser = await auth.getUserByEmail(teacherEmail);
  console.log(`[AUTH] Giáo viên: ${teacherUser.uid} (${teacherUser.email})`);

  const customToken = await auth.createCustomToken(teacherUser.uid, { role: "teacher" });
  const authRes = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const { idToken } = await authRes.json();
  console.log("[AUTH] ✓ ID Token hợp lệ đã sẵn sàng.");

  // 2. Draft Lesson "Góc sân xanh mát" with 5 questions matching Gemini's output
  // Note: Question 2 & Question 5 are true_false with options: ["Đúng", "Sai"] (the exact error cause)
  const testDraft = {
    title: "Góc sân xanh mát (Kiểm định P0)",
    passage: "Buổi sáng, Minh cùng bố ra góc sân nhỏ để chăm sóc cây hoa hồng. Cây hoa được trồng trong một chiếc chậu đất to. Hôm qua, trời mưa to làm đất bắn lên gốc cây. Minh cẩn thận nhặt những chiếc lá úa rơi rụng dưới đất rồi lấy khăn lau sạch chậu. Bố dùng chiếc kéo nhỏ cắt bỏ mấy cành khô. Sau đó, Minh vui vẻ xách bình tới tưới nước cho cây. Nhờ có hai bố con chăm sóc, cây hoa hồng ngày càng xanh tốt và nở những bông hoa đỏ thắm.",
    grade: 2,
    semester: 1,
    week: 1,
    topic: "Bảo vệ môi trường và yêu thiên nhiên",
    genre: "narrative",
    academicYearScope: "specific",
    academicYear: "2026-2027",
    vocabulary: [
      {
        word: "lá úa",
        meaning: "Lá cây đã già, chuyển sang màu vàng hoặc nâu và sắp rụng",
        example: "Minh nhặt những chiếc lá úa rơi rụng dưới đất."
      }
    ],
    questions: [
      {
        id: "q1",
        type: "multiple_choice",
        prompt: "Minh cùng bố làm gì ở góc sân nhỏ vào buổi sáng?",
        options: ["Chăm sóc cây hoa hồng", "Quét dọn sân nhà", "Trồng thêm cây chậu mới"],
        answer: "A",
        hint: "Xem câu mở đầu của bài đọc.",
        explanation: "Minh cùng bố ra góc sân nhỏ chăm sóc cây hoa hồng.",
        skillTag: "thong_tin_truc_tiep",
        difficulty: "nhan_biet"
      },
      {
        id: "q2",
        type: "true_false",
        prompt: "Minh và bố ra góc sân để chơi đá bóng.",
        statement: "Minh và bố ra góc sân để chơi đá bóng.",
        options: ["Đúng", "Sai"], // <--- AI output with options
        answer: false,
        hint: "Đọc kỹ câu đầu tiên trong bài đọc nhé.",
        explanation: "Minh cùng bố ra góc sân để chăm sóc cây hoa hồng, không phải đá bóng.",
        skillTag: "thong_tin_truc_tiep",
        difficulty: "nhan_biet"
      },
      {
        id: "q3",
        type: "sequence",
        prompt: "Sắp xếp 3 sự việc sau theo đúng trình tự diễn ra trong bài đọc:",
        items: [
          "Minh nhặt lá úa và bố tỉa cành khô.",
          "Minh cùng bố ra góc sân nhỏ.",
          "Minh xách bình tưới nước cho cây hoa."
        ],
        answer: [
          "Minh cùng bố ra góc sân nhỏ.",
          "Minh nhặt lá úa và bố tỉa cành khô.",
          "Minh xách bình tưới nước cho cây hoa."
        ],
        hint: "Quan sát hành động nào diễn ra trước, hành động nào sau.",
        explanation: "Thứ tự: Ra góc sân -> Nhặt lá và tỉa cành -> Tưới nước cho cây.",
        skillTag: "sap_xep_trinh_tu",
        difficulty: "thong_hieu"
      },
      {
        id: "q4",
        type: "multiple_choice",
        prompt: "Từ 'lá úa' trong bài đọc có nghĩa là gì?",
        options: ["Lá cây già và vàng úa sắp rụng", "Lá non mới nhú trên cành", "Lá cây tươi tốt mướt mát"],
        answer: "A",
        hint: "Nhớ lại màu sắc của lá già vào mùa thu hoặc khi sắp rụng.",
        explanation: "Lá úa là lá cây đã già, chuyển màu vàng hoặc nâu và sắp rụng.",
        skillTag: "tu_trong_ngu_canh",
        difficulty: "thong_hieu"
      },
      {
        id: "q5",
        type: "true_false",
        prompt: "Nhờ có hai bố con chăm sóc, cây hoa hồng ngày càng xanh tốt và nở hoa đỏ thắm.",
        statement: "Nhờ có hai bố con chăm sóc, cây hoa hồng ngày càng xanh tốt và nở hoa đỏ thắm.",
        options: ["Đúng", "Sai"], // <--- AI output with options
        answer: true,
        hint: "Đọc câu văn cuối cùng của bài đọc.",
        explanation: "Câu cuối nêu rõ kết quả: cây ngày càng xanh tốt và nở hoa đỏ thắm.",
        skillTag: "noi_dung_chinh",
        difficulty: "nhan_biet"
      }
    ]
  };

  let createdLessonId = null;
  let createdVersionId = null;

  try {
    // 3. Test saveLessonDraft
    console.log("\n[TEST 1] Gọi Cloud Function: saveLessonDraft...");
    const saveRes = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/saveLessonDraft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ data: { draft: testDraft } })
    });
    const saveJson = await saveRes.json();
    console.log(`[TEST 1] HTTP Status: ${saveRes.status}`);
    if (saveRes.status !== 200 || !saveJson.result?.success) {
      throw new Error(`saveLessonDraft thất bại: ${JSON.stringify(saveJson)}`);
    }
    createdLessonId = saveJson.result.lessonId;
    console.log(`[TEST 1] ✓ LƯU BẢN NHÁP THÀNH CÔNG! Lesson ID: ${createdLessonId}`);

    // Verify Firestore doc for draft
    const draftDoc = await db.collection("lessons").doc(createdLessonId).get();
    if (!draftDoc.exists || draftDoc.data()?.status !== "draft") {
      throw new Error("Tài liệu bài đọc chưa được ghi đúng trạng thái 'draft' trong Firestore!");
    }
    console.log("[TEST 1] ✓ Xác nhận tài liệu Firestore có trạng thái: 'draft'");

    // 4. Test publishLesson
    console.log("\n[TEST 2] Gọi Cloud Function: publishLesson (với 5 câu hỏi AI có options trên true_false)...");
    const publishRes = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/publishLesson", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        data: {
          lessonId: createdLessonId,
          draft: {
            ...testDraft,
            lessonId: createdLessonId
          }
        }
      })
    });
    const publishJson = await publishRes.json();
    console.log(`[TEST 2] HTTP Status: ${publishRes.status}`);
    if (publishRes.status !== 200 || !publishJson.result?.success) {
      throw new Error(`publishLesson thất bại: ${JSON.stringify(publishJson)}`);
    }
    createdVersionId = publishJson.result.versionId;
    console.log(`[TEST 2] ✓ XUẤT BẢN THÀNH CÔNG! Version: v${publishJson.result.versionNumber}, VersionId: ${createdVersionId}`);

    // 5. Verify Firestore Integrity & Security Separation
    console.log("\n[TEST 3] Kiểm tra tính toàn vẹn và phân tách bảo mật trên Firestore...");
    const publishedDoc = await db.collection("lessons").doc(createdLessonId).get();
    const pData = publishedDoc.data();
    if (pData?.status !== "published" || pData?.currentVersionId !== createdVersionId) {
      throw new Error("Trạng thái bài học trong Firestore chưa chuyển thành 'published'!");
    }
    console.log("[TEST 3] ✓ Lessons doc đã cập nhật status: 'published', currentVersionId đồng bộ");

    const versionDoc = await db.collection("lessons").doc(createdLessonId).collection("versions").doc(createdVersionId).get();
    const vData = versionDoc.data();
    if (!versionDoc.exists || vData?.publicQuestions.length !== 5) {
      throw new Error("Phiên bản bài học chưa được tạo đúng 5 câu hỏi công khai!");
    }

    // Verify true_false public question does NOT contain options
    const tfQuestion = vData.publicQuestions.find(q => q.type === "true_false");
    if (tfQuestion.options !== undefined) {
      throw new Error("Câu hỏi true_false vẫn còn options thừa sau khi chuẩn hóa!");
    }
    console.log("[TEST 3] ✓ Câu hỏi true_false đã được làm sạch triệt để (options đã bị xóa, không còn gây lỗi)");

    // Verify private answers key isolation
    const keyDoc = await db.collection("privateAnswerKeys").doc(createdVersionId).get();
    if (!keyDoc.exists || Object.keys(keyDoc.data()?.answers || {}).length !== 5) {
      throw new Error("Khóa đáp án riêng tư privateAnswerKeys không tồn tại hoặc không đủ 5 câu!");
    }
    console.log("[TEST 3] ✓ Khóa đáp án riêng tư privateAnswerKeys được bảo vệ an toàn độc lập (đủ 5 câu)");

    // 6. Test getTeacherLessons function
    console.log("\n[TEST 4] Gọi getTeacherLessons để xác nhận bài học mới hiển thị trong thư viện...");
    const getLessonsRes = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/getTeacherLessons", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({ data: { status: "all" } })
    });
    const getLessonsJson = await getLessonsRes.json();
    console.log(`[TEST 4] HTTP Status: ${getLessonsRes.status}`);
    const lessonsList = getLessonsJson.result?.lessons || [];
    const foundPublished = lessonsList.some(l => l.id === createdLessonId);
    console.log(`[TEST 4] Tổng số bài học trả về cho giáo viên: ${lessonsList.length}`);
    console.log(`[TEST 4] ✓ Bài học vừa xuất bản có trong danh sách thư viện: ${foundPublished}`);
    if (!foundPublished) {
      throw new Error("Bài học mới chưa xuất hiện trong danh sách getTeacherLessons!");
    }

    console.log("\n==================================================================");
    console.log("   TẤT CẢ CÁC BƯỚC KIỂM TRA ĐỀU ĐẠT CHUẨN 100% PASS!             ");
    console.log("==================================================================");
  } finally {
    // Clean up test lesson to keep emulator database pristine
    if (createdLessonId) {
      console.log(`\n[CLEANUP] Dọn dẹp tài liệu kiểm định tạm thời: ${createdLessonId}...`);
      if (createdVersionId) {
        await db.collection("lessons").doc(createdLessonId).collection("versions").doc(createdVersionId).delete();
        await db.collection("privateAnswerKeys").doc(createdVersionId).delete();
      }
      await db.collection("lessons").doc(createdLessonId).delete();
      console.log("[CLEANUP] ✓ Đã dọn dẹp sạch sẽ, giữ nguyên dữ liệu gốc của hệ thống.");
    }
  }
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ KIỂM CHỨNG THẤT BẠI:", err);
    process.exit(1);
  });
