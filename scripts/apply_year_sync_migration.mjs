import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);

async function applySyncMigration() {
  console.log("===============================================================================");
  console.log("BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU NIÊN KHÓA 2026–2027 CHO PROJECT em-yeu-tieng-viet-demo");
  console.log("===============================================================================\n");

  const migrationLog = {
    executedAt: new Date().toISOString(),
    projectId: "em-yeu-tieng-viet-demo",
    assignmentsUpdated: 0,
    attemptsUpdated: 0,
    studentsUpdated: 0,
    remediationActivitiesUpdated: 0,
    academicYearsCreated: 0,
    systemSettingsCreated: 0,
    details: {
      assignments: [],
      attempts: [],
      students: [],
      remediationActivities: []
    }
  };

  const now = Date.now();

  // 1. ACADEMIC YEARS & SYSTEM SETTINGS
  console.log("[1/5] Khởi tạo danh mục Niên khóa & Cấu hình tiến độ Tuần 7...");
  const ay2026Ref = db.collection("academicYears").doc("2026-2027");
  await ay2026Ref.set({
    code: "2026-2027",
    name: "Năm học 2026–2027",
    isCurrent: true,
    periodType: "current",
    status: "active",
    description: "Niên khóa chính thức đang vận hành và trình diễn",
    startDate: "2026-08-15",
    endDate: "2027-05-31",
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  const ay2025Ref = db.collection("academicYears").doc("2025-2026");
  await ay2025Ref.set({
    code: "2025-2026",
    name: "Năm học 2025–2026",
    isCurrent: false,
    periodType: "past",
    status: "archived",
    description: "Niên khóa lịch sử",
    startDate: "2025-08-15",
    endDate: "2026-05-31",
    createdAt: now,
    updatedAt: now
  }, { merge: true });
  migrationLog.academicYearsCreated += 2;
  console.log("  ✓ Đã thiết lập academicYears (2026-2027: active/current, 2025-2026: archived).");

  const sysRef = db.collection("systemSettings").doc("curriculumProgress");
  await sysRef.set({
    currentAcademicYear: "2026-2027",
    currentSemester: 1,
    currentWeek: 7,
    maxWeeks: 35,
    allowEarlyAccess: true,
    notes: "Tiến độ chuẩn hóa năm học 2026–2027: Tuần 7 (Học kỳ I)",
    updatedAt: now,
    updatedBy: "system_admin"
  }, { merge: true });
  migrationLog.systemSettingsCreated += 1;
  console.log("  ✓ Đã lưu cấu hình tiến độ Tuần 7 vào systemSettings/curriculumProgress.");

  // 2. ASSIGNMENTS
  console.log("\n[2/5] Đồng bộ academicYear cho Bài giao (assignments)...");
  const assignSnap = await db.collection("assignments").get();
  for (const doc of assignSnap.docs) {
    const a = doc.data();
    if (a.academicYear !== "2026-2027") {
      await doc.ref.update({
        academicYear: "2026-2027",
        updatedAt: now
      });
      migrationLog.assignmentsUpdated++;
      migrationLog.details.assignments.push({
        id: doc.id,
        lessonTitle: a.lessonTitle || a.lessonId,
        classId: a.classId,
        oldYear: a.academicYear || "undefined",
        newYear: "2026-2027"
      });
      console.log(`  ✓ Bài giao [${doc.id}] ("${a.lessonTitle || a.lessonId}"): ${a.academicYear} -> 2026-2027`);
    }
  }

  // 3. ATTEMPTS
  console.log("\n[3/5] Đồng bộ academicYear cho Lượt làm bài (attempts) — BẢO TOÀN 100% ĐIỂM SỐ & TIMESTAMPS...");
  const attemptsSnap = await db.collection("attempts").get();
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of attemptsSnap.docs) {
    const att = doc.data();
    if (att.academicYear !== "2026-2027") {
      batch.update(doc.ref, {
        academicYear: "2026-2027",
        updatedAt: now
      });
      migrationLog.attemptsUpdated++;
      migrationLog.details.attempts.push({
        id: doc.id,
        studentId: att.studentId,
        classId: att.classId,
        completedAt: att.completedAt,
        firstTryCorrectCount: att.firstTryCorrectCount,
        finalCorrectCount: att.finalCorrectCount,
        oldYear: att.academicYear || "undefined",
        newYear: "2026-2027"
      });

      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`  ✓ Đã cập nhật ${migrationLog.attemptsUpdated} lượt làm bài sang academicYear: "2026-2027".`);

  // 4. STUDENTS
  console.log("\n[4/5] Đồng bộ academicYear cho Học sinh (students)...");
  const studentsSnap = await db.collection("students").get();
  batch = db.batch();
  batchCount = 0;

  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    if (s.academicYear !== "2026-2027") {
      batch.update(doc.ref, {
        academicYear: "2026-2027",
        updatedAt: now
      });
      migrationLog.studentsUpdated++;
      migrationLog.details.students.push({
        id: doc.id,
        studentCode: s.studentCode,
        displayAlias: s.displayAlias,
        classId: s.classId,
        oldYear: s.academicYear || "undefined",
        newYear: "2026-2027"
      });

      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }
  console.log(`  ✓ Đã cập nhật ${migrationLog.studentsUpdated} hồ sơ học sinh sang academicYear: "2026-2027".`);

  // 5. REMEDIATION ACTIVITIES
  console.log("\n[5/5] Đồng bộ academicYear cho Hoạt động củng cố (remediationActivities)...");
  const remedSnap = await db.collection("remediationActivities").get();
  for (const doc of remedSnap.docs) {
    const r = doc.data();
    if (r.academicYear !== "2026-2027") {
      await doc.ref.update({
        academicYear: "2026-2027",
        updatedAt: now
      });
      migrationLog.remediationActivitiesUpdated++;
      migrationLog.details.remediationActivities.push({
        id: doc.id,
        title: r.title,
        oldYear: r.academicYear || "undefined",
        newYear: "2026-2027"
      });
      console.log(`  ✓ Hoạt động [${doc.id}] ("${r.title}"): ${r.academicYear} -> 2026-2027`);
    }
  }

  // Save log
  const logPath = path.resolve("backups", `migration_log_sync_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(logPath, JSON.stringify(migrationLog, null, 2), "utf8");

  console.log("\n===============================================================================");
  console.log("MIGRATION ĐỒNG BỘ NĂM HỌC 2026–2027 HOÀN TẤT THÀNH CÔNG!");
  console.log(` - Assignments cập nhật: ${migrationLog.assignmentsUpdated}`);
  console.log(` - Attempts cập nhật: ${migrationLog.attemptsUpdated}`);
  console.log(` - Students cập nhật: ${migrationLog.studentsUpdated}`);
  console.log(` - Remediation Activities cập nhật: ${migrationLog.remediationActivitiesUpdated}`);
  console.log(` - Academic Years tạo mới: ${migrationLog.academicYearsCreated}`);
  console.log(` - System Settings tạo mới: ${migrationLog.systemSettingsCreated}`);
  console.log(`Nhật ký chi tiết: ${logPath}`);
  console.log("===============================================================================\n");
  return migrationLog;
}

applySyncMigration().catch(err => {
  console.error("LỖI MIGRATION:", err);
  process.exit(1);
});
