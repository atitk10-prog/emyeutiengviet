import fs from "fs";

const data = JSON.parse(fs.readFileSync("emulator-data/auth_export/accounts.json", "utf8"));
console.log("=== TOTAL USERS IN DISK EXPORT ===", data.users.length);

const teachers = data.users.filter(u => u.customAttributes && u.customAttributes.includes('"teacher"'));
const admins = data.users.filter(u => u.customAttributes && u.customAttributes.includes('"admin"'));
const students = data.users.filter(u => u.localId.startsWith("student_"));

console.log("\nTEACHERS IN DISK EXPORT:", teachers.length);
teachers.forEach(t => console.log(`  - [${t.localId}] ${t.email}`));

console.log("\nADMINS IN DISK EXPORT:", admins.length);
admins.forEach(a => console.log(`  - [${a.localId}] ${a.email}`));

console.log("\nSTUDENT AUTH IN DISK EXPORT:", students.length);
students.forEach(s => console.log(`  - [${s.localId}]`));
