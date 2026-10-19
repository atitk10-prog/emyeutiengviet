import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

async function runComprehensiveAudit() {
  console.log("=== BẮT ĐẦU KIỂM TOÁN VÀ XUẤT MANIFEST TOÀN DIỆN (PRE-MIGRATION) ===\n");

  const [
    classesSnap,
    studentsSnap,
    lessonsSnap,
    assignmentsSnap,
    attemptsSnap,
    curriculumNodesSnap,
    usersSnap,
    privateKeysSnap,
    studentSecretsSnap,
    studentSessionsSnap
  ] = await Promise.all([
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get(),
    db.collection("curriculumNodes").get(),
    db.collection("users").get(),
    db.collection("privateAnswerKeys").get(),
    db.collection("studentSecrets").get(),
    db.collection("studentSessions").get()
  ]);

  const manifest = {
    timestamp: new Date().toISOString(),
    environment: "emulator",
    counts: {
      classes: classesSnap.size,
      students: studentsSnap.size,
      lessons: lessonsSnap.size,
      assignments: assignmentsSnap.size,
      attempts: attemptsSnap.size,
      curriculumNodes: curriculumNodesSnap.size,
      users: usersSnap.size,
      privateAnswerKeys: privateKeysSnap.size,
      studentSecrets: studentSecretsSnap.size,
      studentSessions: studentSessionsSnap.size,
      lessonVersions: 0,
      attemptResponses: 0
    },
    entities: {
      classes: [],
      students: [],
      lessons: [],
      assignments: [],
      attempts: [],
      curriculumNodes: []
    },
    auditFindings: {
      classesByYear: {},
      studentsByClass: {},
      orphanedStudents: [],
      assignmentsByYear: {},
      assignmentsByWeek: {},
      attemptsByYear: {},
      inconsistentDates: []
    }
  };

  // 1. Classes
  for (const doc of classesSnap.docs) {
    const data = doc.data();
    manifest.entities.classes.push({ id: doc.id, ...data });
    const yr = data.academicYear || "undefined";
    manifest.auditFindings.classesByYear[yr] = (manifest.auditFindings.classesByYear[yr] || 0) + 1;
  }

  // 2. Students
  const validClassIds = new Set(classesSnap.docs.map(d => d.id));
  for (const doc of studentsSnap.docs) {
    const data = doc.data();
    manifest.entities.students.push({ id: doc.id, ...data });
    if (!validClassIds.has(data.classId)) {
      manifest.auditFindings.orphanedStudents.push({ id: doc.id, studentCode: data.studentCode, classId: data.classId });
    }
    manifest.auditFindings.studentsByClass[data.classId] = (manifest.auditFindings.studentsByClass[data.classId] || 0) + 1;
  }

  // 3. Lessons & Lesson Versions
  for (const doc of lessonsSnap.docs) {
    const data = doc.data();
    const versionsSnap = await doc.ref.collection("versions").get();
    manifest.counts.lessonVersions += versionsSnap.size;
    const versions = versionsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
    manifest.entities.lessons.push({ id: doc.id, ...data, versions });
  }

  // 4. Assignments
  const lessonMap = new Map(manifest.entities.lessons.map(l => [l.id, l]));
  for (const doc of assignmentsSnap.docs) {
    const data = doc.data();
    manifest.entities.assignments.push({ id: doc.id, ...data });
    const yr = data.academicYear || "undefined";
    manifest.auditFindings.assignmentsByYear[yr] = (manifest.auditFindings.assignmentsByYear[yr] || 0) + 1;
    
    // Find lesson week if available
    const lesson = lessonMap.get(data.lessonId);
    const wk = data.week || lesson?.week || "unknown";
    manifest.auditFindings.assignmentsByWeek[wk] = (manifest.auditFindings.assignmentsByWeek[wk] || 0) + 1;
  }

  // 5. Attempts & Responses
  const assignMap = new Map(manifest.entities.assignments.map(a => [a.id, a]));
  const classMap = new Map(manifest.entities.classes.map(c => [c.id, c]));
  const studentMap = new Map(manifest.entities.students.map(s => [s.id, s]));

  for (const doc of attemptsSnap.docs) {
    const data = doc.data();
    const responsesSnap = await doc.ref.collection("responses").get();
    manifest.counts.attemptResponses += responsesSnap.size;
    const responses = responsesSnap.docs.map(r => ({ id: r.id, ...r.data() }));

    const assign = assignMap.get(data.assignmentId);
    const student = studentMap.get(data.studentId);
    const classId = data.classId || assign?.classId || student?.classId;
    const cls = classMap.get(classId);

    // Timestamp check
    let ts = null;
    if (typeof data.completedAt === "number") {
      ts = data.completedAt;
    } else if (data.completedAt && data.completedAt._seconds) {
      ts = data.completedAt._seconds * 1000;
    } else if (typeof data.startedAt === "number") {
      ts = data.startedAt;
    } else if (data.startedAt && data.startedAt._seconds) {
      ts = data.startedAt._seconds * 1000;
    }

    const dateVN = ts ? new Date(ts).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";
    let actualYear = "unknown";
    if (ts && !isNaN(ts)) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric" }).formatToParts(d);
        const y = parseInt(parts.find(p => p.type === "year").value);
        const m = parseInt(parts.find(p => p.type === "month").value);
        actualYear = ((y === 2026 && m >= 8) || (y === 2027 && m <= 6)) ? "2026-2027" : ((y === 2025 && m >= 8) || (y === 2026 && m <= 6)) ? "2025-2026" : "other";
      }
    }

    manifest.auditFindings.attemptsByYear[actualYear] = (manifest.auditFindings.attemptsByYear[actualYear] || 0) + 1;

    if (cls && cls.academicYear && cls.academicYear !== actualYear) {
      manifest.auditFindings.inconsistentDates.push({
        attemptId: doc.id,
        studentId: data.studentId,
        studentName: student?.displayAlias,
        classId,
        className: cls?.name,
        classAcademicYear: cls?.academicYear,
        attemptDateVN: dateVN,
        actualYearFromDate: actualYear
      });
    }

    manifest.entities.attempts.push({ id: doc.id, ...data, responses, calculatedActualYear: actualYear, dateVN });
  }

  // 6. Curriculum Nodes
  for (const doc of curriculumNodesSnap.docs) {
    manifest.entities.curriculumNodes.push({ id: doc.id, ...doc.data() });
  }

  // Write manifest and summary report
  const backupDir = path.resolve("backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const manifestPath = path.join(backupDir, `pre_migration_manifest_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`✓ Đã xuất manifest đầy đủ: ${manifestPath}`);
  console.log("\n--- TỔNG KẾT KIỂM TOÁN HIỆN TRẠNG ---");
  console.log(`Số lớp: ${manifest.counts.classes}`);
  console.log(`Phân bố năm học của các lớp:`, manifest.auditFindings.classesByYear);
  console.log(`Số học sinh: ${manifest.counts.students}`);
  console.log(`Số học sinh mồ côi (không thuộc lớp nào): ${manifest.auditFindings.orphanedStudents.length}`);
  console.log(`Số bài đọc: ${manifest.counts.lessons} (với ${manifest.counts.lessonVersions} phiên bản)`);
  console.log(`Số bài giao (Assignments): ${manifest.counts.assignments}`);
  console.log(`Phân bố năm học của assignments:`, manifest.auditFindings.assignmentsByYear);
  console.log(`Phân bố tuần học của assignments:`, manifest.auditFindings.assignmentsByWeek);
  console.log(`Số lượt làm bài (Attempts): ${manifest.counts.attempts} (với ${manifest.counts.attemptResponses} câu trả lời chi tiết)`);
  console.log(`Phân bố năm học của attempts (dựa theo ngày làm thực tế):`, manifest.auditFindings.attemptsByYear);
  console.log(`Số bản ghi có ngày làm bài lệch niên khóa lớp: ${manifest.auditFindings.inconsistentDates.length}`);

  console.log("\nChi tiết các lớp học:");
  for (const c of manifest.entities.classes) {
    console.log(` - ID: ${c.id} | Tên: ${c.name} | Mã: ${c.classCode} | Khối: ${c.grade} | Năm học: ${c.academicYear} | Sĩ số: ${c.studentCount} | Học sinh thật trong DB: ${manifest.auditFindings.studentsByClass[c.id] || 0}`);
  }

  console.log("\nChi tiết các bài đọc và tuần học:");
  for (const l of manifest.entities.lessons) {
    console.log(` - ID: ${l.id} | Tiêu đề: "${l.title}" | Khối: ${l.grade} | Học kỳ: ${l.semester || 1} | Tuần: ${l.week || 'chưa gán'} | Scope: ${l.academicYearScope || 'shared'} | Năm: ${l.academicYear || 'null'} | Trạng thái: ${l.status}`);
  }

  console.log("\nChi tiết các bài giao (Assignments):");
  for (const a of manifest.entities.assignments) {
    const l = lessonMap.get(a.lessonId);
    const c = classMap.get(a.classId);
    console.log(` - ID: ${a.id} | Lớp: "${c?.name}" | Bài: "${a.lessonTitle || l?.title}" (Tuần ${l?.week || '?'}) | Năm học: ${a.academicYear} | Status: ${a.status}`);
  }

  return manifest;
}

runComprehensiveAudit().catch(err => {
  console.error("LỖI KIỂM TOÁN:", err);
  process.exit(1);
});
