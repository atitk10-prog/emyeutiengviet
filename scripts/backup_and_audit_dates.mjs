import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

async function backupAndAudit() {
  console.log("=== BƯỚC 1: SAO LƯU DỮ LIỆU FIRESTORE ===");
  const backupDir = path.resolve("./backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = ["users", "classes", "students", "studentSecrets", "studentSessions", "lessons", "assignments", "attempts"];
  const backupData = {};

  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    backupData[colName] = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      // Handle subcollections for lessons (versions)
      if (colName === "lessons") {
        const versionsSnap = await doc.ref.collection("versions").get();
        const versions = versionsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
        backupData[colName].push({ id: doc.id, ...data, versions });
      } else {
        backupData[colName].push({ id: doc.id, ...data });
      }
    }
    console.log(`- Đã sao lưu collection '${colName}': ${backupData[colName].length} bản ghi`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `firestore_backup_${timestamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`=> ĐÃ LƯU BẢN SAO LƯU AN TOÀN TẠI: ${backupFile}\n`);

  console.log("=== BƯỚC 2: KIỂM TOÁN TẬP TRUNG LỚP 2C VÀ CÁC LƯỢT LÀM BÀI 2025-2026 ===");
  // Look at classes
  const classes = backupData["classes"];
  console.log("\n--- DANH SÁCH LỚP HỌC ---");
  for (const c of classes) {
    console.log(`Lớp: ${c.name} | ID: ${c.id} | Khối: ${c.grade} | Năm học: ${c.academicYear} | Sĩ số: ${c.studentCount} | Status: ${c.status}`);
  }

  // Look at assignments
  const assignments = backupData["assignments"];
  console.log(`\n--- DANH SÁCH BÀI GIAO (ASSIGNMENTS) (${assignments.length}) ---`);
  const assignMap = new Map();
  for (const a of assignments) {
    assignMap.set(a.id, a);
    const dateStr = a.createdAt ? new Date(a.createdAt).toISOString() : "Không có";
    console.log(`Assignment ID: ${a.id} | ClassId: ${a.classId} | LessonId: ${a.lessonId} | Year: ${a.academicYear} | Round: ${a.roundName} | CreatedAt: ${a.createdAt} (${dateStr})`);
  }

  // Look at attempts
  const attempts = backupData["attempts"];
  console.log(`\n--- DANH SÁCH LƯỢT LÀM BÀI (ATTEMPTS) (${attempts.length}) ---`);
  
  let validCount = 0;
  let anomalousCount = 0;
  const anomalies = [];

  for (const att of attempts) {
    const assign = assignMap.get(att.assignmentId);
    const classObj = classes.find(c => c.id === att.classId);
    const startedDate = att.startedAt ? new Date(att.startedAt) : null;
    const completedDate = att.completedAt ? new Date(att.completedAt) : null;
    const startedStr = startedDate ? startedDate.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";
    const completedStr = completedDate ? completedDate.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";

    const assignYear = assign?.academicYear;
    const classYear = classObj?.academicYear;

    // Check year consistency
    let isAnomalous = false;
    let reason = [];

    // If year is 2025-2026, date should typically be between Sep 2025 and May/Jun 2026
    if (classYear === "2025-2026" || assignYear === "2025-2026") {
      if (completedDate && completedDate.getFullYear() === 2026 && completedDate.getMonth() >= 8) { // Sept or Oct 2026
        isAnomalous = true;
        reason.push(`Lớp/Bài giao năm 2025-2026 nhưng ngày làm bài là ${completedStr} (thuộc năm học 2026-2027)`);
      }
    }

    if (isAnomalous) {
      anomalousCount++;
      anomalies.push({
        attemptId: att.id,
        studentId: att.studentId,
        classId: att.classId,
        className: classObj?.name,
        classYear,
        assignmentId: att.assignmentId,
        assignYear,
        startedAt: att.startedAt,
        completedAt: att.completedAt,
        startedStr,
        completedStr,
        reasons: reason
      });
      console.log(`[BẤT THƯỜNG] Attempt ${att.id}: Lớp ${classObj?.name} (${classYear}) | Assignment Year: ${assignYear} | Started: ${startedStr} | Completed: ${completedStr} => Lý do: ${reason.join("; ")}`);
    } else {
      validCount++;
    }
  }

  console.log(`\n=== TỔNG KẾT KIỂM TOÁN SƠ BỘ ===`);
  console.log(`- Tổng số attempts: ${attempts.length}`);
  console.log(`- Hợp lệ: ${validCount}`);
  console.log(`- Bất thường về ngày/năm học: ${anomalousCount}`);

  // Write audit details to JSON
  fs.writeFileSync(path.join(backupDir, `audit_report_${timestamp}.json`), JSON.stringify({
    timestamp,
    totalAttempts: attempts.length,
    validCount,
    anomalousCount,
    anomalies
  }, null, 2), "utf8");
}

backupAndAudit().catch(console.error);
