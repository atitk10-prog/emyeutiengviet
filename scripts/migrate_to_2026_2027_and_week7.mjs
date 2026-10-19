import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

const isDryRun = process.argv.includes("--dry-run") || !process.argv.includes("--commit");
const isCommit = process.argv.includes("--commit");

const LESSON_WEEK_MAPPING = {
  "seed-lop2-bai1": { week: 3, semester: 1, title: "Chim sâu nhỏ và vườn cam", grade: 2 },
  "seed-lop2-bai2": { week: 5, semester: 1, title: "Đôi bạn ở xóm Hoa", grade: 2 },
  "seed-lop2-bai3": { week: 16, semester: 1, title: "Dòng suối quê em", grade: 2 },
  "GzNv3vwPMa3VaiQHqNiB": { week: 4, semester: 1, title: "Góc sân xanh mát", grade: 2 },
  "test_audio_lifecycle_lesson": { week: 2, semester: 1, title: "Bài đọc có âm thanh tiếng Việt thật", grade: 2 },
  "lesson_lifecycle_audit_v521": { week: 6, semester: 1, title: "Bông hoa cúc trắng (Vòng đời kiểm thử)", grade: 2 },
  "seed-lop3-bai1": { week: 3, semester: 1, title: "Hương cốm mùa thu", grade: 3 },
  "seed-lop3-bai2": { week: 6, semester: 1, title: "Chuyến thám hiểm của Kiến Đen", grade: 3 },
  "seed-lop3-bai3": { week: 15, semester: 1, title: "Kho báu trong khu vườn của ông", grade: 3 }
};

async function runMigration() {
  console.log("===============================================================================");
  console.log(`MIGRATION NIÊN KHÓA 2026–2027 & TIẾN ĐỘ TUẦN 7 (${isCommit ? "COMMIT THẬT" : "DRY-RUN (CHỈ KIỂM TRA)"})`);
  console.log("===============================================================================\n");

  const now = Date.now();
  const migrationLog = {
    startedAt: new Date().toISOString(),
    isDryRun,
    isCommit,
    changesSummary: {
      academicYearsCreated: 0,
      systemSettingsCreated: 0,
      classesUpdated: 0,
      studentsUpdated: 0,
      lessonsUpdated: 0,
      lessonVersionsUpdated: 0,
      assignmentsUpdated: 0,
      attemptsUpdated: 0,
      preservedRecords: 0
    },
    changeDetails: {
      academicYears: [],
      systemSettings: [],
      classes: [],
      students: [],
      lessons: [],
      assignments: [],
      attempts: []
    }
  };

  // 1. ACADEMIC YEARS
  console.log("[1/6] Chuẩn hóa danh mục Niên khóa (academicYears)...");
  const year2026Data = {
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
  };
  const year2025Data = {
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
  };

  migrationLog.changeDetails.academicYears.push({ action: "set_current", data: year2026Data });
  migrationLog.changeDetails.academicYears.push({ action: "archive", data: year2025Data });
  migrationLog.changesSummary.academicYearsCreated += 2;

  if (isCommit) {
    await db.collection("academicYears").doc("2026-2027").set(year2026Data, { merge: true });
    await db.collection("academicYears").doc("2025-2026").set(year2025Data, { merge: true });
    console.log("  ✓ Đã thiết lập 2026-2027 là isCurrent: true, 2025-2026 là archived.");
  } else {
    console.log("  [DRY-RUN] Sẽ thiết lập 2026-2027 là isCurrent: true, 2025-2026 là archived.");
  }

  // 2. SYSTEM SETTINGS & CURRICULUM PROGRESS (WEEK 7)
  console.log("\n[2/6] Khởi tạo cấu hình tiến độ năm học dùng chung (systemSettings/curriculumProgress)...");
  const progressSettings = {
    currentAcademicYear: "2026-2027",
    currentSemester: 1,
    currentWeek: 7,
    maxWeeks: 35,
    allowEarlyAccess: true,
    notes: "Tiến độ chuẩn hóa năm học 2026–2027: Tuần 7 (Học kỳ I)",
    updatedAt: now,
    updatedBy: "system_admin"
  };
  migrationLog.changeDetails.systemSettings.push({ id: "curriculumProgress", data: progressSettings });
  migrationLog.changesSummary.systemSettingsCreated += 1;

  if (isCommit) {
    await db.collection("systemSettings").doc("curriculumProgress").set(progressSettings, { merge: true });
    console.log("  ✓ Đã lưu cấu hình tiến độ Tuần 7 vào systemSettings/curriculumProgress.");
  } else {
    console.log("  [DRY-RUN] Sẽ lưu cấu hình tiến độ Tuần 7 vào systemSettings/curriculumProgress.");
  }

  // 3. CLASSES
  console.log("\n[3/6] Chuẩn hóa Niên khóa Lớp học (classes)...");
  const classesSnap = await db.collection("classes").get();
  for (const doc of classesSnap.docs) {
    const cData = doc.data();
    const oldYear = cData.academicYear || "undefined";
    const logItem = {
      id: doc.id,
      name: cData.name,
      classCode: cData.classCode,
      grade: cData.grade,
      oldAcademicYear: oldYear,
      newAcademicYear: "2026-2027"
    };
    migrationLog.changeDetails.classes.push(logItem);
    migrationLog.changesSummary.classesUpdated++;

    if (isCommit) {
      await doc.ref.update({
        academicYear: "2026-2027",
        updatedAt: now
      });
      console.log(`  ✓ Lớp "${cData.name}" (${cData.classCode}): ${oldYear} -> 2026-2027`);
    } else {
      console.log(`  [DRY-RUN] Lớp "${cData.name}" (${cData.classCode}): ${oldYear} -> 2026-2027`);
    }
  }

  // 4. STUDENTS
  console.log("\n[4/6] Đồng bộ Niên khóa Học sinh (students)...");
  const studentsSnap = await db.collection("students").get();
  for (const doc of studentsSnap.docs) {
    const sData = doc.data();
    const oldYear = sData.academicYear || "undefined";
    const logItem = {
      id: doc.id,
      studentCode: sData.studentCode,
      displayAlias: sData.displayAlias,
      classId: sData.classId,
      oldAcademicYear: oldYear,
      newAcademicYear: "2026-2027"
    };
    migrationLog.changeDetails.students.push(logItem);
    migrationLog.changesSummary.studentsUpdated++;

    if (isCommit) {
      await doc.ref.update({
        academicYear: "2026-2027",
        updatedAt: now
      });
      console.log(`  ✓ Học sinh "${sData.displayAlias}" (${sData.studentCode}): ${oldYear} -> 2026-2027`);
    } else {
      console.log(`  [DRY-RUN] Học sinh "${sData.displayAlias}" (${sData.studentCode}): ${oldYear} -> 2026-2027`);
    }
  }

  // 5. LESSONS & VERSIONS (MAPPING WEEK 1–35, SEMESTER 1/2)
  console.log("\n[5/6] Chuẩn hóa Kho Bài đọc & Tuần học (lessons & versions)...");
  const lessonsSnap = await db.collection("lessons").get();
  for (const doc of lessonsSnap.docs) {
    const lData = doc.data();
    const mapping = LESSON_WEEK_MAPPING[doc.id] || {
      week: lData.week || 1,
      semester: lData.semester || 1
    };

    const lessonUpdate = {
      week: mapping.week,
      semester: mapping.semester,
      academicYearScope: "shared",
      academicYear: null,
      updatedAt: now
    };

    migrationLog.changeDetails.lessons.push({
      id: doc.id,
      title: lData.title,
      grade: lData.grade,
      oldWeek: lData.week || "undefined",
      newWeek: mapping.week,
      semester: mapping.semester
    });
    migrationLog.changesSummary.lessonsUpdated++;

    if (isCommit) {
      await doc.ref.update(lessonUpdate);
      
      // Update subcollection versions
      const versionsSnap = await doc.ref.collection("versions").get();
      for (const vDoc of versionsSnap.docs) {
        await vDoc.ref.update({
          week: mapping.week,
          semester: mapping.semester,
          academicYearScope: "shared",
          academicYear: null
        });
        migrationLog.changesSummary.lessonVersionsUpdated++;
      }
      console.log(`  ✓ Bài "${lData.title}": gán Tuần ${mapping.week}, Học kỳ ${mapping.semester} (${versionsSnap.size} versions)`);
    } else {
      console.log(`  [DRY-RUN] Bài "${lData.title}": gán Tuần ${mapping.week}, Học kỳ ${mapping.semester}`);
    }
  }

  // 6. ASSIGNMENTS & ATTEMPTS
  console.log("\n[6/6] Chuẩn hóa Bài giao (assignments) & Lượt làm bài (attempts)...");
  const assignmentsSnap = await db.collection("assignments").get();
  for (const doc of assignmentsSnap.docs) {
    const aData = doc.data();
    const lessonInfo = LESSON_WEEK_MAPPING[aData.lessonId] || {};
    const assignWeek = aData.week || lessonInfo.week || 1;
    
    // Check week status: if week > 7 and not early access, set to 'paused'
    let newStatus = aData.status || "active";
    if (assignWeek > 7 && !aData.allowEarlyAccess) {
      newStatus = "paused";
    }

    const logItem = {
      id: doc.id,
      lessonId: aData.lessonId,
      lessonTitle: aData.lessonTitle,
      oldAcademicYear: aData.academicYear || "undefined",
      newAcademicYear: "2026-2027",
      week: assignWeek,
      oldStatus: aData.status,
      newStatus
    };
    migrationLog.changeDetails.assignments.push(logItem);
    migrationLog.changesSummary.assignmentsUpdated++;

    if (isCommit) {
      await doc.ref.update({
        academicYear: "2026-2027",
        week: assignWeek,
        status: newStatus,
        updatedAt: now
      });
      console.log(`  ✓ Bài giao [${doc.id}] ("${aData.lessonTitle || aData.lessonId}"): Tuần ${assignWeek}, Năm 2026-2027, Status: ${newStatus}`);
    } else {
      console.log(`  [DRY-RUN] Bài giao [${doc.id}]: Tuần ${assignWeek}, Năm 2026-2027, Status: ${newStatus}`);
    }
  }

  // Attempts: keep all timestamps, answers, and scores; set academicYear: 2026-2027
  const attemptsSnap = await db.collection("attempts").get();
  for (const doc of attemptsSnap.docs) {
    const attData = doc.data();
    const logItem = {
      id: doc.id,
      studentId: attData.studentId,
      oldAcademicYear: attData.academicYear || "undefined",
      newAcademicYear: "2026-2027",
      completedAt: attData.completedAt,
      firstTryCorrectCount: attData.firstTryCorrectCount,
      finalCorrectCount: attData.finalCorrectCount,
      preservedTimestampsAndScores: true
    };
    migrationLog.changeDetails.attempts.push(logItem);
    migrationLog.changesSummary.attemptsUpdated++;
    migrationLog.changesSummary.preservedRecords++;

    if (isCommit) {
      await doc.ref.update({
        academicYear: "2026-2027",
        updatedAt: now
      });
      console.log(`  ✓ Lượt làm [${doc.id}]: đồng bộ academicYear 2026-2027 (bảo toàn 100% timestamps và điểm)`);
    } else {
      console.log(`  [DRY-RUN] Lượt làm [${doc.id}]: sẽ đồng bộ academicYear 2026-2027 (bảo toàn điểm)`);
    }
  }

  migrationLog.completedAt = new Date().toISOString();

  // Save migration log
  const logDir = path.resolve("backups");
  const logPath = path.join(logDir, `migration_log_${isCommit ? "committed" : "dryrun"}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(logPath, JSON.stringify(migrationLog, null, 2), "utf8");

  console.log("\n===============================================================================");
  console.log(`MIGRATION ${isCommit ? "HOÀN TẤT THÀNH CÔNG (COMMITTED)!" : "KIỂM TRA DRY-RUN THÀNH CÔNG (CHƯA GHI DB)!"}`);
  console.log(`Nhật ký chi tiết: ${logPath}`);
  console.log("===============================================================================\n");
  console.log("Thống kê thay đổi:");
  console.log(` - Lớp học chuyển về 2026-2027: ${migrationLog.changesSummary.classesUpdated}`);
  console.log(` - Học sinh chuyển về 2026-2027: ${migrationLog.changesSummary.studentsUpdated}`);
  console.log(` - Bài đọc chuẩn hóa tuần GDPT 2018: ${migrationLog.changesSummary.lessonsUpdated}`);
  console.log(` - Bài giao đồng bộ năm 2026-2027 & tuần: ${migrationLog.changesSummary.assignmentsUpdated}`);
  console.log(` - Lượt làm bài đồng bộ năm & bảo toàn điểm/timestamps: ${migrationLog.changesSummary.attemptsUpdated}`);

  return migrationLog;
}

runMigration().catch(err => {
  console.error("LỖI MIGRATION:", err);
  process.exit(1);
});
