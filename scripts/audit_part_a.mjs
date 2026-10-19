import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function runAudit() {
  console.log("=== KIỂM TOÁN DỮ LIỆU HIỆN TẠI (PHẦN A) ===");

  // 1. Users / Teachers
  const usersSnap = await db.collection("users").get();
  console.log(`\n1. USERS (${usersSnap.size} bản ghi):`);
  const teachers = [];
  const admins = [];
  usersSnap.forEach(d => {
    const data = d.data();
    if (data.role === "teacher") teachers.push({ id: d.id, ...data });
    else if (data.role === "admin") admins.push({ id: d.id, ...data });
  });
  console.log(`- Số lượng giáo viên: ${teachers.length}`);
  console.log(`- Số lượng admin: ${admins.length}`);

  // Check test vs demo teachers
  const demoTeacher = teachers.find(t => t.id === "teacher_demo_account" || t.username === "giaovien01");
  console.log(`- Giáo viên demo (giaovien01):`, demoTeacher ? `Có (id: ${demoTeacher.id})` : "Không tìm thấy");

  // 2. Classes
  const classesSnap = await db.collection("classes").get();
  console.log(`\n2. CLASSES (${classesSnap.size} bản ghi):`);
  const classesByTeacher = {};
  classesSnap.forEach(d => {
    const data = d.data();
    const tUid = data.teacherUid || "unknown";
    classesByTeacher[tUid] = (classesByTeacher[tUid] || 0) + 1;
  });
  console.log(`- Phân bố lớp học theo teacherUid:`);
  Object.entries(classesByTeacher).slice(0, 10).forEach(([tUid, count]) => {
    console.log(`  * ${tUid}: ${count} lớp`);
  });

  // 3. Students & HS001 Investigation
  const studentsSnap = await db.collection("students").get();
  console.log(`\n3. STUDENTS (${studentsSnap.size} bản ghi):`);
  const hs001Docs = [];
  studentsSnap.forEach(d => {
    const data = d.data();
    if (data.studentCode === "HS001" || data.id === "student_demo_hs001" || data.username === "HS001" || data.username === "hs001") {
      hs001Docs.push({ id: d.id, ...data });
    }
  });
  console.log(`- Tìm kiếm hồ sơ HS001 (${hs001Docs.length} bản ghi tìm thấy):`);
  for (const doc of hs001Docs) {
    const cDoc = doc.classId ? await db.collection("classes").doc(doc.classId).get() : null;
    const cData = cDoc?.data();
    console.log(`  * Doc ID: ${doc.id}`);
    console.log(`    studentCode: ${doc.studentCode}, displayAlias: ${doc.displayAlias}`);
    console.log(`    classId: ${doc.classId} -> Tên lớp: ${cData?.name || "Không tìm thấy"}, Mã lớp: ${cData?.classCode || "N/A"}, teacherUid: ${cData?.teacherUid}`);
  }

  // 4. Linkage checks
  console.log(`\n4. KIỂM TRA LIÊN KẾT:`);
  // Classes linked to non-existent teacher?
  let orphanClasses = 0;
  for (const doc of classesSnap.docs) {
    const cData = doc.data();
    if (cData.teacherUid) {
      const tDoc = await db.collection("users").doc(cData.teacherUid).get();
      if (!tDoc.exists) orphanClasses++;
    }
  }
  console.log(`- Số lớp mồ côi (teacherUid không tồn tại): ${orphanClasses}`);

  // Students linked to non-existent class?
  let orphanStudents = 0;
  for (const doc of studentsSnap.docs) {
    const sData = doc.data();
    if (sData.classId) {
      const cDoc = await db.collection("classes").doc(sData.classId).get();
      if (!cDoc.exists) orphanStudents++;
    }
  }
  console.log(`- Số học sinh mồ côi (classId không tồn tại): ${orphanStudents}`);

  // Assignments & Attempts
  const assignmentsSnap = await db.collection("assignments").get();
  const attemptsSnap = await db.collection("attempts").get();
  console.log(`- Tổng assignments: ${assignmentsSnap.size}`);
  console.log(`- Tổng attempts: ${attemptsSnap.size}`);
  
  let orphanAttempts = 0;
  for (const doc of attemptsSnap.docs) {
    const aData = doc.data();
    const sDoc = aData.studentId ? await db.collection("students").doc(aData.studentId).get() : null;
    if (!sDoc?.exists) orphanAttempts++;
  }
  console.log(`- Số attempts mồ côi (studentId không tồn tại): ${orphanAttempts}`);

  // Lessons
  const lessonsSnap = await db.collection("lessons").get();
  console.log(`- Tổng lessons: ${lessonsSnap.size}`);
  lessonsSnap.forEach(d => {
    const l = d.data();
    console.log(`  * Lesson: "${l.title}" | Grade: ${l.grade} | Status: ${l.status}`);
  });
}

runAudit().catch(console.error);
