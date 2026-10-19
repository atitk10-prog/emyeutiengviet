import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

const classes = await db.collection("classes").get();
console.log("=== CLASSES IN EMULATOR ===");
classes.forEach(c => console.log(`ID: ${c.id} | Name: ${c.data().name} | Code: ${c.data().classCode} | Teacher: ${c.data().teacherUid}`));

const teachers = await db.collection("users").where("role", "==", "teacher").get();
console.log("\n=== TEACHERS IN EMULATOR ===");
teachers.forEach(t => console.log(`ID: ${t.id} | Name: ${t.data().displayName} | Email: ${t.data().email} | Status: ${t.data().status}`));

const admins = await db.collection("users").where("role", "==", "admin").get();
console.log("\n=== ADMINS IN EMULATOR ===");
admins.forEach(a => console.log(`ID: ${a.id} | Name: ${a.data().displayName} | Email: ${a.data().email}`));

const students = await db.collection("students").where("classId", "==", "OA3tsKnUG6FEaWSmWSE4").get();
console.log("\n=== STUDENTS IN LOP 2C ===");
students.forEach(s => console.log(`ID: ${s.id} | Name: ${s.data().displayAlias} | Code: ${s.data().studentCode} | Status: ${s.data().status}`));

