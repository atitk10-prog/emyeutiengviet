import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fetch from "node-fetch";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function testFlow() {
  console.log("=== KIỂM TRA LUỒNG TẠO, LƯU BẢN NHÁP VÀ XUẤT BẢN BÀI ĐỌC ===");

  // 1. Get Teacher Token
  const teacherEmail = "giaovien.tieuhoc@emytv.edu.vn";
  let teacherUser;
  try {
    teacherUser = await auth.getUserByEmail(teacherEmail);
    console.log(`✓ Đã tìm thấy tài khoản giáo viên: ${teacherUser.uid} (${teacherUser.email})`);
  } catch (e) {
    console.error("Không tìm thấy giáo viên:", e);
    return;
  }

  // Create custom token for teacher and exchange for ID token in Auth emulator
  const customToken = await auth.createCustomToken(teacherUser.uid, { role: "teacher" });
  const authRes = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const authData = await authRes.json();
  const idToken = authData.idToken;
  console.log("✓ Đã xác thực thành công ID Token cho giáo viên qua Auth Emulator");

  // 2. Call saveLessonDraft
  console.log("\n--- Bước A: Thử gọi saveLessonDraft ---");
  const testDraft = {
    title: "Góc sân xanh mát",
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
        prompt: "Nhờ được bố con Minh chăm sóc, cây hoa hồng ngày càng xanh tốt.",
        statement: "Nhờ được bố con Minh chăm sóc, cây hoa hồng ngày càng xanh tốt.",
        answer: true,
        hint: "Đọc câu kết thúc của bài đọc.",
        explanation: "Bài đọc nêu rõ nhờ có hai bố con chăm sóc nên cây xanh tốt.",
        skillTag: "noi_dung_chinh",
        difficulty: "nhan_biet"
      },
      {
        id: "q3",
        type: "sequence",
        prompt: "Sắp xếp 3 sự việc theo trình tự thời gian:",
        items: [
          "Minh nhặt lá úa và bố cắt cành khô.",
          "Minh cùng bố ra góc sân chăm sóc hoa.",
          "Minh xách bình tới tưới nước cho cây."
        ],
        answer: [
          "Minh cùng bố ra góc sân chăm sóc hoa.",
          "Minh nhặt lá úa và bố cắt cành khô.",
          "Minh xách bình tới tưới nước cho cây."
        ],
        hint: "Quan sát thứ tự hành động của Minh và bố.",
        explanation: "Đầu tiên ra sân, sau đó nhặt lá tỉa cành, cuối cùng là tưới nước.",
        skillTag: "sap_xep_trinh_tu",
        difficulty: "thong_hieu"
      }
    ]
  };

  const saveRes = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/saveLessonDraft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ data: { draft: testDraft } })
  });

  const saveJson = await saveRes.json();
  console.log("saveLessonDraft status:", saveRes.status);
  console.log("saveLessonDraft response:", JSON.stringify(saveJson, null, 2));

  // 3. Call publishLesson
  console.log("\n--- Bước B: Thử gọi publishLesson với testDraft ---");
  const publishRes = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/publishLesson", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ data: { draft: testDraft } })
  });

  const publishJson = await publishRes.json();
  console.log("publishLesson status:", publishRes.status);
  console.log("publishLesson response:", JSON.stringify(publishJson, null, 2));
}

testFlow().catch(console.error);
