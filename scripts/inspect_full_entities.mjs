import fs from "fs";
import path from "path";

const backupDir = path.resolve("./backups");
const files = fs.readdirSync(backupDir).filter(f => f.startsWith("firestore_backup_")).sort().reverse();
const latestBackup = path.join(backupDir, files[0]);
const data = JSON.parse(fs.readFileSync(latestBackup, "utf8"));

console.log("=== TOÀN BỘ 5 ATTEMPTS ===");
for (const att of data.attempts) {
  console.log(JSON.stringify(att, null, 2));
}

console.log("\n=== TOÀN BỘ 4 ASSIGNMENTS ===");
for (const a of data.assignments) {
  console.log(JSON.stringify(a, null, 2));
}

console.log("\n=== TOÀN BỘ 5 CLASSES ===");
for (const c of data.classes) {
  console.log(JSON.stringify(c, null, 2));
}

console.log("\n=== TOÀN BỘ 8 STUDENTS ===");
for (const s of data.students) {
  console.log(JSON.stringify(s, null, 2));
}
