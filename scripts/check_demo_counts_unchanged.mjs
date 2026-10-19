import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function check() {
  const before = JSON.parse(fs.readFileSync("scripts/demo_counts_before.json", "utf8"));

  const [usersSnap, classesSnap, studentsSnap, lessonsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get()
  ]);

  const listAuth = await auth.listUsers(1000);

  const current = {
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

  console.log("=== DEMO COUNTS COMPARISON ===");
  console.log("BEFORE:", JSON.stringify(before.firestoreCounts), "Auth:", before.authAccountsCount);
  console.log("AFTER: ", JSON.stringify(current.firestoreCounts), "Auth:", current.authAccountsCount);

  let unchanged = true;
  for (const [k, v] of Object.entries(before.firestoreCounts)) {
    if (current.firestoreCounts[k] !== v) {
      console.error(`DELTA DETECTED in ${k}: Before=${v}, Now=${current.firestoreCounts[k]}`);
      unchanged = false;
    }
  }
  if (current.authAccountsCount !== before.authAccountsCount) {
    console.error(`DELTA DETECTED in authAccountsCount: Before=${before.authAccountsCount}, Now=${current.authAccountsCount}`);
    unchanged = false;
  }

  if (unchanged) {
    console.log(">>> SUCCESS: Demo environment counts are 100% UNCHANGED! Delta = 0 across all collections and auth accounts.");
  } else {
    console.error(">>> FAILURE: Demo data was contaminated!");
    process.exit(1);
  }
}

check().catch(console.error);
