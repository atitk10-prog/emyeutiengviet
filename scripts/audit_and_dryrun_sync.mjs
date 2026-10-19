import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);

async function runDryRun() {
  console.log("===============================================================================");
  console.log("BÁO CÁO KIỂM TOÁN VÀ DRY-RUN ĐỒNG BỘ NĂM HỌC 2026–2027 (CHƯA GHI VÀO DB)");
  console.log("===============================================================================\n");

  const dryRunReport = {
    executedAt: new Date().toISOString(),
    projectId: "em-yeu-tieng-viet-demo",
    summary: {
      classesTotal: 0,
      classesAlready2026_2027: 0,
      classesToUpdate: 0,

      assignmentsTotal: 0,
      assignmentsAlready2026_2027: 0,
      assignmentsToUpdate: 0,

      attemptsTotal: 0,
      attemptsCompleted: 0,
      attemptsAlready2026_2027: 0,
      attemptsToUpdate: 0,
      attemptsAnomalousCurrently: 0,
      attemptsAnomalousAfterSync: 0,

      studentsTotal: 0,
      studentsAlready2026_2027: 0,
      studentsToUpdate: 0,

      remediationActivitiesTotal: 0,
      remediationActivitiesToUpdate: 0,

      academicYearsToCreate: 0,
      systemSettingsToCreate: 0
    },
    details: {
      classes: [],
      assignments: [],
      attemptsByClass: {},
      students: [],
      remediationActivities: [],
      academicYears: [],
      systemSettings: []
    }
  };

  // 1. CLASSES
  const classesSnap = await db.collection("classes").get();
  dryRunReport.summary.classesTotal = classesSnap.size;
  const classMap = {};

  for (const doc of classesSnap.docs) {
    const c = doc.data();
    classMap[doc.id] = c;
    const isCurrent = c.academicYear === "2026-2027";
    if (isCurrent) {
      dryRunReport.summary.classesAlready2026_2027++;
    } else {
      dryRunReport.summary.classesToUpdate++;
    }
    dryRunReport.details.classes.push({
      id: doc.id,
      name: c.name,
      grade: c.grade,
      currentYear: c.academicYear || "undefined",
      proposedYear: "2026-2027",
      action: isCurrent ? "keep" : "update"
    });
  }

  // 2. ASSIGNMENTS
  const assignSnap = await db.collection("assignments").get();
  dryRunReport.summary.assignmentsTotal = assignSnap.size;
  const assignMap = {};

  for (const doc of assignSnap.docs) {
    const a = doc.data();
    assignMap[doc.id] = a;
    const isCurrent = a.academicYear === "2026-2027";
    if (isCurrent) {
      dryRunReport.summary.assignmentsAlready2026_2027++;
    } else {
      dryRunReport.summary.assignmentsToUpdate++;
    }
    dryRunReport.details.assignments.push({
      id: doc.id,
      classId: a.classId,
      className: classMap[a.classId]?.name || "N/A",
      lessonTitle: a.lessonTitle || a.lessonId,
      currentYear: a.academicYear || "undefined",
      proposedYear: "2026-2027",
      action: isCurrent ? "keep" : "update"
    });
  }

  // 3. ATTEMPTS
  const attemptsSnap = await db.collection("attempts").get();
  dryRunReport.summary.attemptsTotal = attemptsSnap.size;

  for (const doc of attemptsSnap.docs) {
    const att = doc.data();
    const isCompleted = att.status === "completed";
    if (isCompleted) dryRunReport.summary.attemptsCompleted++;

    const assign = assignMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    const cl = classMap[historicalClassId];

    // Current resolution
    const currentRecordedYear = att.academicYear || assign?.academicYear || cl?.academicYear || "2026-2027";
    let completedTs = att.completedAt;
    if (completedTs && completedTs._seconds) completedTs = completedTs._seconds * 1000;
    if (!completedTs && att.startedAt) completedTs = att.startedAt;

    // Infer year from timestamp (Vietnam calendar)
    let inferredYear = "2026-2027";
    if (completedTs) {
      const d = new Date(completedTs);
      const mo = d.getMonth() + 1;
      const yr = d.getFullYear();
      inferredYear = mo >= 8 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`;
    }

    const isCurrentAnomalous = Boolean(completedTs && inferredYear !== currentRecordedYear);
    if (isCurrentAnomalous) {
      dryRunReport.summary.attemptsAnomalousCurrently++;
    }

    // Proposed resolution after sync (both assign and att will be 2026-2027)
    const proposedRecordedYear = "2026-2027";
    const isProposedAnomalous = Boolean(completedTs && inferredYear !== proposedRecordedYear);
    if (isProposedAnomalous) {
      dryRunReport.summary.attemptsAnomalousAfterSync++;
    }

    const needsUpdate = att.academicYear !== "2026-2027";
    if (needsUpdate) {
      dryRunReport.summary.attemptsToUpdate++;
    } else {
      dryRunReport.summary.attemptsAlready2026_2027++;
    }

    const cName = cl?.name || historicalClassId || "Khác";
    dryRunReport.details.attemptsByClass[cName] = dryRunReport.details.attemptsByClass[cName] || {
      total: 0,
      completed: 0,
      toUpdate: 0,
      currentlyAnomalous: 0
    };
    dryRunReport.details.attemptsByClass[cName].total++;
    if (isCompleted) dryRunReport.details.attemptsByClass[cName].completed++;
    if (needsUpdate) dryRunReport.details.attemptsByClass[cName].toUpdate++;
    if (isCurrentAnomalous) dryRunReport.details.attemptsByClass[cName].currentlyAnomalous++;
  }

  // 4. STUDENTS
  const studentsSnap = await db.collection("students").get();
  dryRunReport.summary.studentsTotal = studentsSnap.size;

  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    const isCurrent = s.academicYear === "2026-2027";
    if (isCurrent) {
      dryRunReport.summary.studentsAlready2026_2027++;
    } else {
      dryRunReport.summary.studentsToUpdate++;
      dryRunReport.details.students.push({
        id: doc.id,
        studentCode: s.studentCode,
        displayAlias: s.displayAlias,
        classId: s.classId,
        className: classMap[s.classId]?.name || "N/A",
        currentYear: s.academicYear || "undefined",
        proposedYear: "2026-2027"
      });
    }
  }

  // 5. REMEDIATION ACTIVITIES
  const remedSnap = await db.collection("remediationActivities").get();
  dryRunReport.summary.remediationActivitiesTotal = remedSnap.size;

  for (const doc of remedSnap.docs) {
    const r = doc.data();
    if (r.academicYear !== "2026-2027") {
      dryRunReport.summary.remediationActivitiesToUpdate++;
      dryRunReport.details.remediationActivities.push({
        id: doc.id,
        title: r.title,
        currentYear: r.academicYear || "undefined",
        proposedYear: "2026-2027"
      });
    }
  }

  // 6. ACADEMIC YEARS & SYSTEM SETTINGS
  const aySnap = await db.collection("academicYears").get();
  if (aySnap.size === 0) {
    dryRunReport.summary.academicYearsToCreate = 2; // 2026-2027 and 2025-2026
    dryRunReport.details.academicYears.push({ id: "2026-2027", isCurrent: true, status: "active" });
    dryRunReport.details.academicYears.push({ id: "2025-2026", isCurrent: false, status: "archived" });
  }

  const sysSnap = await db.collection("systemSettings").get();
  if (sysSnap.size === 0) {
    dryRunReport.summary.systemSettingsToCreate = 1; // curriculumProgress
    dryRunReport.details.systemSettings.push({ id: "curriculumProgress", currentAcademicYear: "2026-2027", currentWeek: 7 });
  }

  // Save report to disk
  const reportPath = path.resolve("backups", `dryrun_sync_report_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(dryRunReport, null, 2), "utf8");

  console.log("TỔNG HỢP KIỂM TOÁN:");
  console.log(` - Lớp học: ${dryRunReport.summary.classesTotal} lớp (Đã là 2026-2027: ${dryRunReport.summary.classesAlready2026_2027}, Cần sửa: ${dryRunReport.summary.classesToUpdate})`);
  console.log(` - Bài đã giao: ${dryRunReport.summary.assignmentsTotal} đợt (Đã là 2026-2027: ${dryRunReport.summary.assignmentsAlready2026_2027}, Cần sửa: ${dryRunReport.summary.assignmentsToUpdate})`);
  console.log(` - Lượt làm bài: ${dryRunReport.summary.attemptsTotal} lượt (${dryRunReport.summary.attemptsCompleted} hoàn thành)`);
  console.log(`   + Số lượt đang bị cảnh báo lệch năm học: ${dryRunReport.summary.attemptsAnomalousCurrently}`);
  console.log(`   + Số lượt cần đồng bộ academicYear: ${dryRunReport.summary.attemptsToUpdate}`);
  console.log(`   + Dự kiến sau khi đồng bộ, số lượt lệch năm học: ${dryRunReport.summary.attemptsAnomalousAfterSync}`);
  console.log(` - Học sinh: ${dryRunReport.summary.studentsTotal} em (Cần đồng bộ niên khóa: ${dryRunReport.summary.studentsToUpdate})`);
  console.log(` - Hoạt động củng cố: ${dryRunReport.summary.remediationActivitiesTotal} (Cần đồng bộ: ${dryRunReport.summary.remediationActivitiesToUpdate})`);
  console.log(` - Niên khóa & Cấu hình tiến độ: ${dryRunReport.summary.academicYearsToCreate} năm học, ${dryRunReport.summary.systemSettingsToCreate} settings`);

  console.log("\nCHI TIẾT LƯỢT LÀM THEO TỪNG LỚP:");
  console.table(dryRunReport.details.attemptsByClass);

  console.log(`\nBáo cáo chi tiết đã lưu tại: ${reportPath}`);
  console.log("===============================================================================\n");
  return dryRunReport;
}

runDryRun().catch(err => {
  console.error("LỖI DRY-RUN:", err);
  process.exit(1);
});
