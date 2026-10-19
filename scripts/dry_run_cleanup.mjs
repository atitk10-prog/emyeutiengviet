import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function runDryRun() {
  console.log("=== EM YÊU TIẾNG VIỆT: DRY RUN DATA AUDIT & CLEANUP PROPOSAL ===");
  const [usersSnap, classesSnap, studentsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get()
  ]);

  const authUsers = (await auth.listUsers(1000)).users;

  console.log(`\nTổng số thực tế trong Emulator demo (em-yeu-tieng-viet-demo):`);
  console.log(`- Firestore Users: ${usersSnap.size}`);
  console.log(`- Firestore Classes: ${classesSnap.size}`);
  console.log(`- Firestore Students: ${studentsSnap.size}`);
  console.log(`- Firestore Assignments: ${assignmentsSnap.size}`);
  console.log(`- Firestore Attempts: ${attemptsSnap.size}`);
  console.log(`- Auth Users: ${authUsers.length}`);

  const testRegex = /(test|v51|v52|v5|sec_|e2e|lifecycle|unauth|persistence|gemini|survey|audit|perf|transfer)/i;

  const classified = {
    users: { demo: [], test: [], unidentified: [] },
    classes: { demo: [], test: [], unidentified: [] },
    students: { demo: [], test: [], unidentified: [] }
  };

  usersSnap.forEach(doc => {
    const u = { id: doc.id, ...doc.data() };
    const email = u.email || "";
    const name = u.displayName || "";
    const username = u.username || "";

    if (
      email === "giaovien.tieuhoc@emytv.edu.vn" ||
      email === "admin.demo@emytv.edu.vn" ||
      username === "admin" ||
      username === "giaovien01" ||
      u.id === "admin_demo_uid" ||
      u.id === "giaovien01_uid" ||
      u.id === "B5H9PeMrZowS3ewPm4BQ8aM4fkU1"
    ) {
      classified.users.demo.push(u);
    } else if (testRegex.test(email) || testRegex.test(name) || testRegex.test(doc.id)) {
      classified.users.test.push(u);
    } else {
      classified.users.unidentified.push(u);
    }
  });

  const testUserUidSet = new Set(classified.users.test.map(u => u.id));
  const demoClassIdSet = new Set();

  classesSnap.forEach(doc => {
    const c = { id: doc.id, ...doc.data() };
    const name = c.name || "";
    const code = c.classCode || "";

    if (code === "MXK4FH" || name.includes("Lop 2C") || name.includes("Lớp 2C") || c.id === "OA3tsKnUG6FEaWSmWSE4") {
      classified.classes.demo.push(c);
      demoClassIdSet.add(c.id);
    } else if (testRegex.test(name) || testUserUidSet.has(c.teacherUid || "")) {
      classified.classes.test.push(c);
    } else {
      classified.classes.unidentified.push(c);
    }
  });

  const testClassIdSet = new Set(classified.classes.test.map(c => c.id));

  studentsSnap.forEach(doc => {
    const s = { id: doc.id, ...doc.data() };
    const alias = s.displayAlias || "";
    const code = s.studentCode || "";

    if (code === "HS001" || s.id === "HS001_uid" || demoClassIdSet.has(s.classId)) {
      classified.students.demo.push(s);
    } else if (testClassIdSet.has(s.classId) || testRegex.test(alias) || testRegex.test(code)) {
      classified.students.test.push(s);
    } else {
      classified.students.unidentified.push(s);
    }
  });

  console.log("\n--- KẾT QUẢ PHÂN LOẠI DỮ LIỆU ---");
  console.log(`1. Users (Tổng ${usersSnap.size}):`);
  console.log(`   - DEMO (Giữ lại): ${classified.users.demo.length}`);
  console.log(`   - TEST (Đề xuất xóa): ${classified.users.test.length}`);
  console.log(`   - UNIDENTIFIED (Giữ an toàn, chưa xóa): ${classified.users.unidentified.length}`);

  console.log(`\n2. Classes (Tổng ${classesSnap.size}):`);
  console.log(`   - DEMO (Giữ lại): ${classified.classes.demo.length}`);
  console.log(`   - TEST (Đề xuất xóa): ${classified.classes.test.length}`);
  console.log(`   - UNIDENTIFIED (Giữ an toàn, chưa xóa): ${classified.classes.unidentified.length}`);

  console.log(`\n3. Students (Tổng ${studentsSnap.size}):`);
  console.log(`   - DEMO (Giữ lại): ${classified.students.demo.length}`);
  console.log(`   - TEST (Đề xuất xóa): ${classified.students.test.length}`);
  console.log(`   - UNIDENTIFIED (Giữ an toàn, chưa xóa): ${classified.students.unidentified.length}`);

  console.log("\n--- DỰ KIẾN SAU KHI DỌN DẸP (NẾU ĐƯỢC DUYỆT) ---");
  console.log(`- Firestore Users: ${usersSnap.size} -> ${usersSnap.size - classified.users.test.length}`);
  console.log(`- Firestore Classes: ${classesSnap.size} -> ${classesSnap.size - classified.classes.test.length}`);
  console.log(`- Firestore Students: ${studentsSnap.size} -> ${studentsSnap.size - classified.students.test.length}`);
  console.log("\nTRẠNG THÁI DRY RUN: HOÀN TẤT. CHƯA CÓ BẤT KỲ BẢN GHI NÀO BỊ XÓA.");
}

runDryRun().catch(console.error);
