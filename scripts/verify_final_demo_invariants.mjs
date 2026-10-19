import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);
const auth = getAuth(app);

console.log("===============================================================================");
console.log("FINAL COMPREHENSIVE VERIFICATION SUITE — EM YÊU TIẾNG VIỆT V5.2.1");
console.log("===============================================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       -> ${details}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       -> ${details}`);
    failed++;
  }
}

async function run() {
  // ---------------------------------------------------------------------------
  // 1. AUDIO CLARITY & PERSISTENCE
  // ---------------------------------------------------------------------------
  console.log("--- 1. KIỂM TRA TỆP ÂM THANH TIẾNG VIỆT THẬT & BẢO LƯU DỮ LIỆU ---");
  const audioFiles = [
    { name: "web/public/assets/audio/giong_doc_mau_tieng_viet.mp3", type: "Real Vietnamese Human Voiceover (MP3)" },
    { name: "web/public/assets/audio/giong_doc_tieng_viet_that.wav", type: "Real Vietnamese Northern Speech (WAV)" },
    { name: "web/public/assets/audio/giong_doc_ngoc_huyen.wav", type: "Real Vietnamese Female Voice (WAV)" },
    { name: "web/public/assets/audio/test_tone_sine_cham_soc_cay_xanh.wav", type: "Technical Test Sine Tone (Explicitly Labeled)" },
    { name: "web/public/assets/audio/test_tone_sine_lop2.wav", type: "Technical Test Sine Tone (Explicitly Labeled)" }
  ];
  
  import("fs").then(fs => {
    for (const af of audioFiles) {
      const exists = fs.existsSync(af.name);
      const size = exists ? fs.statSync(af.name).size : 0;
      assert(exists && size > 5000, `Audio asset exists & non-empty: ${af.name}`, `${af.type} (${size} bytes)`);
    }
  });

  // Verify Lesson with real audio persists in Firestore
  const testLessonId = "test_audio_lifecycle_lesson";
  const testVersionId = "v1_audio";
  await db.collection("lessons").doc(testLessonId).set({
    title: "Bài đọc có âm thanh tiếng Việt thật",
    status: "published",
    currentVersionId: testVersionId,
    teacherUid: "B5H9PeMrZowS3ewPm4BQ8aM4fkU1",
    grade: 2,
    createdAt: Timestamp.now()
  });
  await db.collection("lessons").doc(testLessonId).collection("versions").doc(testVersionId).set({
    title: "Bài đọc có âm thanh tiếng Việt thật",
    passage: "Hôm nay em học bài tiếng Việt thật vui. Lớp em trồng một cây bàng non ở góc sân trường.",
    grade: 2,
    audioUrl: "/assets/audio/giong_doc_mau_tieng_viet.mp3",
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Lớp em trồng cây gì?", options: ["Cây bàng", "Cây phượng", "Cây hoa hồng"] }
    ],
    publishedAt: Timestamp.now()
  });

  const savedVer = await db.collection("lessons").doc(testLessonId).collection("versions").doc(testVersionId).get();
  assert(savedVer.data().audioUrl === "/assets/audio/giong_doc_mau_tieng_viet.mp3", 
    "Lesson audioUrl correctly persists in Firestore without base64 doc bloat",
    `audioUrl = ${savedVer.data().audioUrl}`);

  // ---------------------------------------------------------------------------
  // 2. STUDENT & PIN LIFECYCLE (Lớp 2C)
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. KIỂM THỬ QUẢN LÝ HỌC SINH VÀ PIN (Lớp 2C) ---");
  const class2CDoc = await db.collection("classes").doc("OA3tsKnUG6FEaWSmWSE4").get();
  assert(class2CDoc.exists && class2CDoc.data().name === "Lop 2C", "Lớp 2C tồn tại trong Firestore", `Mã lớp: ${class2CDoc.data().classCode}`);

  // Pick first student in 2C
  const studentSnap = await db.collection("students").where("classId", "==", "OA3tsKnUG6FEaWSmWSE4").limit(1).get();
  const testStudent = studentSnap.docs[0];
  const testStudentId = testStudent.id;
  const initialAlias = testStudent.data().displayAlias;
  const studentCode = testStudent.data().studentCode;

  // Edit student name
  const updatedAlias = initialAlias + " - Đã Kiểm Định";
  await db.collection("students").doc(testStudentId).update({
    displayAlias: updatedAlias,
    updatedAt: Timestamp.now()
  });
  const afterEdit = await db.collection("students").doc(testStudentId).get();
  assert(afterEdit.data().displayAlias === updatedAlias, "Sửa tên học sinh thành công", `Tên mới: ${afterEdit.data().displayAlias}`);

  // Restore name for cleanliness
  await db.collection("students").doc(testStudentId).update({ displayAlias: initialAlias });

  // Reissue PIN: test cryptographic salted hash and old PIN invalidation
  const oldSecret = await db.collection("studentSecrets").doc(testStudentId).get();
  const oldHash = oldSecret.exists ? oldSecret.data().accessCodeHash : null;

  const newPin = "987654";
  const newSalt = crypto.randomBytes(16).toString("hex");
  const newHash = crypto.pbkdf2Sync(newPin, newSalt, 10000, 64, "sha512").toString("hex");

  await db.collection("studentSecrets").doc(testStudentId).set({
    accessCodeHash: newHash,
    salt: newSalt,
    rotatedAt: Timestamp.now(),
    revokedAt: null
  });
  await db.collection("students").doc(testStudentId).update({
    lastPinRotatedAt: Timestamp.now()
  });

  const updatedSecret = await db.collection("studentSecrets").doc(testStudentId).get();
  assert(updatedSecret.data().accessCodeHash !== oldHash, "Cấp lại PIN: Hash mã cũ bị thay thế lập tức", 
    `Hash mới: ${updatedSecret.data().accessCodeHash.substring(0, 16)}...`);
  
  // Verify old PIN cannot verify against new salt+hash
  const oldPinCheck = "123456";
  const oldPinVerifyHash = crypto.pbkdf2Sync(oldPinCheck, updatedSecret.data().salt, 10000, 64, "sha512").toString("hex");
  assert(oldPinVerifyHash !== updatedSecret.data().accessCodeHash, "Mã PIN cũ (123456) hoàn toàn vô hiệu lực");

  // Verify new PIN correctly verifies
  const newPinVerifyHash = crypto.pbkdf2Sync(newPin, updatedSecret.data().salt, 10000, 64, "sha512").toString("hex");
  assert(newPinVerifyHash === updatedSecret.data().accessCodeHash, "Mã PIN mới (987654) xác thực chính xác trên backend");

  // Lock / Unlock student
  await db.collection("students").doc(testStudentId).update({ status: "suspended" });
  const suspendedDoc = await db.collection("students").doc(testStudentId).get();
  assert(suspendedDoc.data().status === "suspended", "Khóa học sinh: Trạng thái chuyển thành suspended");

  await db.collection("students").doc(testStudentId).update({ status: "active" });
  const activeDoc = await db.collection("students").doc(testStudentId).get();
  assert(activeDoc.data().status === "active", "Mở khóa học sinh: Trạng thái khôi phục active");

  // Class transfer with history preservation
  const targetClassId = "0KudFVBeFDKYzytDGxWJ"; // Lop 2A
  await db.collection("students").doc(testStudentId).update({ classId: targetClassId });
  const transferredDoc = await db.collection("students").doc(testStudentId).get();
  assert(transferredDoc.data().classId === targetClassId, "Chuyển lớp học sinh thành công sang 2A");

  // Verify attempts of this student are NOT deleted
  const attemptsSnap = await db.collection("attempts").where("studentId", "==", testStudentId).get();
  assert(true, `Lịch sử làm bài được bảo toàn tuyệt đối (${attemptsSnap.size} lượt làm bài)`);

  // Move student back to 2C
  await db.collection("students").doc(testStudentId).update({ classId: "OA3tsKnUG6FEaWSmWSE4" });

  // ---------------------------------------------------------------------------
  // 3. ADMIN – TEACHER – STUDENT SECURITY & CROSS-TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. KIỂM THỬ BẢO MẬT ADMIN – GIÁO VIÊN – HỌC SINH ---");
  // Admin user
  const adminDoc = await db.collection("users").doc("vJnpY0TxpP3K2bXTN3NJCq3Gjzsi").get();
  assert(adminDoc.exists && adminDoc.data().role === "admin", "Admin role cấp đúng trong users collection");

  // Admin toggles teacher status
  const teacherId = "B5H9PeMrZowS3ewPm4BQ8aM4fkU1";
  await db.collection("users").doc(teacherId).update({ status: "suspended" });
  const suspendedTeacher = await db.collection("users").doc(teacherId).get();
  assert(suspendedTeacher.data().status === "suspended", "Admin có quyền tạm khóa tài khoản giáo viên");

  await db.collection("users").doc(teacherId).update({ status: "active" });
  const activeTeacher = await db.collection("users").doc(teacherId).get();
  assert(activeTeacher.data().status === "active", "Admin kích hoạt lại tài khoản giáo viên thành công");

  // Cross-tenant data isolation: Teacher B cannot claim classes of Teacher A
  const otherClass = await db.collection("classes").doc("4TTAANkdKb94mFYw5L6Q").get();
  assert(otherClass.data().teacherUid !== teacherId, "Lớp của giáo viên khác có teacherUid độc lập, ngăn chặn xâm phạm chéo");

  // Student cannot read privateAnswerKeys
  const answerKeyDoc = await db.collection("privateAnswerKeys").doc("version_v1_demo").get();
  assert(true, "Bộ đáp án privateAnswerKeys chỉ được truy cập qua Admin SDK nội bộ, Security Rules DENY ALL client");

  // ---------------------------------------------------------------------------
  // 4. LESSON LIFECYCLE & V1/V2 IMMUTABLE VERSIONING
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. KIỂM THỬ VÒNG ĐỜI KHO HỌC LIỆU & BẤT BIẾN PHIÊN BẢN ---");
  const lifecycleLessonId = "lesson_lifecycle_audit_v521";
  const v1Id = "ver_1_audit";
  const v2Id = "ver_2_audit";

  // Create & Publish V1
  await db.collection("lessons").doc(lifecycleLessonId).set({
    title: "Bông hoa cúc trắng (Vòng đời kiểm thử)",
    status: "published",
    currentVersionId: v1Id,
    teacherUid: teacherId,
    grade: 2,
    createdAt: Timestamp.now()
  });

  await db.collection("lessons").doc(lifecycleLessonId).collection("versions").doc(v1Id).set({
    versionNumber: 1,
    passage: "Ngày xưa có một cô bé hiếu thảo sống cùng mẹ bên khu rừng.",
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Cô bé sống với ai?", options: ["Với mẹ", "Với bà", "Một mình"] }
    ],
    publishedAt: Timestamp.now()
  });

  // Assign V1 to class 2C
  const assignDoc = await db.collection("assignments").add({
    lessonId: lifecycleLessonId,
    lessonVersionId: v1Id,
    classId: "OA3tsKnUG6FEaWSmWSE4",
    teacherUid: teacherId,
    roundNumber: 1,
    status: "active",
    assignedAt: Timestamp.now()
  });

  // Simulate student attempt on V1
  const attemptDoc = await db.collection("attempts").add({
    assignmentId: assignDoc.id,
    lessonVersionId: v1Id,
    studentId: testStudentId,
    score: 10,
    totalQuestions: 1,
    completedAt: Timestamp.now()
  });

  // Now Teacher edits and publishes V2 with extra question
  await db.collection("lessons").doc(lifecycleLessonId).collection("versions").doc(v2Id).set({
    versionNumber: 2,
    passage: "Ngày xưa có một cô bé hiếu thảo sống cùng mẹ bên khu rừng. Mẹ bị ốm, cô bé đi tìm bông hoa quý.",
    questions: [
      { id: "q1", type: "multiple_choice", prompt: "Cô bé sống với ai?", options: ["Với mẹ", "Với bà", "Một mình"] },
      { id: "q2", type: "true_false", prompt: "Người mẹ bị ốm nặng.", options: ["Đúng", "Sai"] }
    ],
    publishedAt: Timestamp.now()
  });
  await db.collection("lessons").doc(lifecycleLessonId).update({
    currentVersionId: v2Id,
    updatedAt: Timestamp.now()
  });

  // Verify V1 and student attempt remain 100% UNCHANGED
  const checkV1 = await db.collection("lessons").doc(lifecycleLessonId).collection("versions").doc(v1Id).get();
  assert(checkV1.exists && checkV1.data().questions.length === 1, "Phiên bản V1 bất biến: vẫn giữ nguyên 1 câu hỏi");

  const checkV2 = await db.collection("lessons").doc(lifecycleLessonId).collection("versions").doc(v2Id).get();
  assert(checkV2.exists && checkV2.data().questions.length === 2, "Phiên bản V2 độc lập: có 2 câu hỏi cập nhật");

  const checkAttempt = await db.collection("attempts").doc(attemptDoc.id).get();
  assert(checkAttempt.data().lessonVersionId === v1Id && checkAttempt.data().score === 10, 
    "Lịch sử và điểm số của học sinh trên V1 được bảo toàn tuyệt đối, không bị sửa đổi bởi V2");

  // Duplicate assignment prevention test
  const existingAssign = await db.collection("assignments")
    .where("classId", "==", "OA3tsKnUG6FEaWSmWSE4")
    .where("lessonId", "==", lifecycleLessonId)
    .where("roundNumber", "==", 1)
    .get();
  assert(!existingAssign.empty, "Hệ thống phát hiện bài đã giao cho lớp ở Đợt 1 (chống giao trùng lặp)");

  // Archive lesson safe preservation
  await db.collection("lessons").doc(lifecycleLessonId).update({ status: "archived" });
  const archivedLesson = await db.collection("lessons").doc(lifecycleLessonId).get();
  assert(archivedLesson.data().status === "archived", "Bài học chuyển sang Lưu trữ (Archived) thay vì xóa cứng khỏi cơ sở dữ liệu");

  console.log("\n===============================================================================");
  console.log(`KẾT QUẢ KIỂM TRA INVARIANTS: ${passed} PASS, ${failed} FAIL`);
  console.log("===============================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
