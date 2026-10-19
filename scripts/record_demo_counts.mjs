import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function snapshot() {
  const [usersSnap, classesSnap, studentsSnap, lessonsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get()
  ]);

  const listAuth = await auth.listUsers(1000);

  const data = {
    timestamp: new Date().toISOString(),
    projectId: "em-yeu-tieng-viet-demo",
    firestoreCounts: {
      users: usersSnap.size,
      classes: classesSnap.size,
      students: studentsSnap.size,
      lessons: lessonsSnap.size,
      assignments: assignmentsSnap.size,
      attempts: attemptsSnap.size
    },
    authAccountsCount: listAuth.users.length
  };

  fs.writeFileSync("scripts/demo_counts_before.json", JSON.stringify(data, null, 2));
  console.log("=== DEMO COUNTS BEFORE (BASE RECORD) ===");
  console.log(JSON.stringify(data, null, 2));
}

snapshot().catch(console.error);
