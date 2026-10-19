import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function analyze() {
  const [usersSnap, classesSnap, studentsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get()
  ]);

  const authUsers = (await auth.listUsers(1000)).users;

  console.log("=== PHÂN TÍCH TOÀN BỘ DỮ LIỆU DEMO HIỆN TẠI ===");
  console.log(`Firestore: Users=${usersSnap.size}, Classes=${classesSnap.size}, Students=${studentsSnap.size}`);
  console.log(`Auth Accounts: ${authUsers.length}`);

  const testUserUids = new Set();
  const demoUserUids = new Set();
  const unidentifiedUserUids = new Set();

  const testClassIds = new Set();
  const demoClassIds = new Set();
  const unidentifiedClassIds = new Set();

  const testRegex = /(test|v51|v52|v5|sec_|e2e|lifecycle|unauth|persistence|gemini|gv\.mai|thay\.hai)/i;

  usersSnap.forEach(doc => {
    const u = doc.data();
    const email = u.email || "";
    const name = u.displayName || "";
    const username = u.username || "";

    if (email === "giaovien.tieuhoc@emytv.edu.vn" || username === "admin" || username === "giaovien01") {
      demoUserUids.add(doc.id);
    } else if (testRegex.test(email) || testRegex.test(name) || testRegex.test(doc.id)) {
      testUserUids.add(doc.id);
    } else {
      unidentifiedUserUids.add(doc.id);
    }
  });

  classesSnap.forEach(doc => {
    const c = doc.data();
    const name = c.name || "";
    const code = c.classCode || "";

    if (code === "MXK4FH" || name.includes("Lop 2C") || name.includes("Lớp 2C")) {
      demoClassIds.add(doc.id);
    } else if (testRegex.test(name) || testRegex.test(c.teacherUid || "")) {
      testClassIds.add(doc.id);
    } else {
      unidentifiedClassIds.add(doc.id);
    }
  });

  const report = {
    summary: {
      totalUsers: usersSnap.size,
      demoUsersCount: demoUserUids.size,
      testUsersCount: testUserUids.size,
      unidentifiedUsersCount: unidentifiedUserUids.size,
      totalClasses: classesSnap.size,
      demoClassesCount: demoClassIds.size,
      testClassesCount: testClassIds.size,
      unidentifiedClassesCount: unidentifiedClassIds.size,
      totalStudents: studentsSnap.size,
      totalAuthAccounts: authUsers.length
    },
    demoUsers: Array.from(demoUserUids),
    unidentifiedUsers: Array.from(unidentifiedUserUids).map(id => {
      const d = usersSnap.docs.find(x => x.id === id)?.data();
      return { id, email: d?.email, displayName: d?.displayName, role: d?.role };
    }),
    unidentifiedClasses: Array.from(unidentifiedClassIds).map(id => {
      const d = classesSnap.docs.find(x => x.id === id)?.data();
      return { id, name: d?.name, code: d?.classCode, teacherUid: d?.teacherUid };
    })
  };

  fs.writeFileSync("scripts/data_analysis_report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("\nUnidentified users sample:", report.unidentifiedUsers.slice(0, 5));
  console.log("Unidentified classes sample:", report.unidentifiedClasses.slice(0, 5));
}

analyze().catch(console.error);
