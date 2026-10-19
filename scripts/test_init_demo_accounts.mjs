import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function testInit() {
  console.log("=== GỌI INIT DEMO ACCOUNTS ===");
  const res = await fetch("http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1/initDemoAccounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: {} })
  });

  const resJson = await res.json();
  console.log("Response:", resJson);

  // Check admin
  const adminDoc = await db.collection("users").doc("admin_demo_account").get();
  console.log("Admin user doc:", adminDoc.exists ? adminDoc.data() : "NOT FOUND");

  // Check teacher
  const teacherDoc = await db.collection("users").doc("teacher_demo_account").get();
  console.log("Teacher user doc:", teacherDoc.exists ? teacherDoc.data() : "NOT FOUND");

  // Check student
  const studentDoc = await db.collection("students").doc("student_demo_hs001").get();
  console.log("Student doc:", studentDoc.exists ? studentDoc.data() : "NOT FOUND");

  // Check usernames mapping
  const adminUserMap = await db.collection("usernames").doc("admin").get();
  const gvUserMap = await db.collection("usernames").doc("giaovien01").get();
  const hsUserMap = await db.collection("usernames").doc("hs001").get();
  console.log("Usernames mapping:", {
    admin: adminUserMap.exists,
    giaovien01: gvUserMap.exists,
    hs001: hsUserMap.exists
  });
}

testInit().catch(console.error);
