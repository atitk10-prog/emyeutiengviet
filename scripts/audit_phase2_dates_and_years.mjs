import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

async function runDetailedAudit() {
  console.log("===============================================================================");
  console.log("KIỂM TOÁN CHI TIẾT GIAI ĐOẠN 2: NGÀY LÀM BÀI, NĂM HỌC, HỌC KỲ VÀ LỚP HỌC");
  console.log("===============================================================================\n");

  const [classesSnap, studentsSnap, lessonsSnap, assignmentsSnap, attemptsSnap] = await Promise.all([
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get()
  ]);

  console.log(`1. Tổng số documents hiện có:`);
  console.log(`   - Classes: ${classesSnap.size}`);
  console.log(`   - Students: ${studentsSnap.size}`);
  console.log(`   - Lessons: ${lessonsSnap.size}`);
  console.log(`   - Assignments: ${assignmentsSnap.size}`);
  console.log(`   - Attempts: ${attemptsSnap.size}\n`);

  // Map entities
  const classMap = {};
  classesSnap.forEach(d => classMap[d.id] = { id: d.id, ...d.data() });

  const studentMap = {};
  studentsSnap.forEach(d => studentMap[d.id] = { id: d.id, ...d.data() });

  const lessonMap = {};
  lessonsSnap.forEach(d => lessonMap[d.id] = { id: d.id, ...d.data() });

  const assignmentMap = {};
  assignmentsSnap.forEach(d => assignmentMap[d.id] = { id: d.id, ...d.data() });

  console.log("2. Chi tiết 5 lớp học hiện có:");
  for (const c of Object.values(classMap)) {
    const cDate = c.createdAt ? new Date(c.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";
    console.log(`   - [${c.id}] Tên: "${c.name}" | Mã: ${c.classCode} | Khối: ${c.grade} | Năm học ghi trong doc: "${c.academicYear}" | Ngày tạo: ${cDate}`);
  }

  console.log("\n3. Chi tiết 4 bài giao (Assignments):");
  for (const a of Object.values(assignmentMap)) {
    const c = classMap[a.classId];
    const l = lessonMap[a.lessonId];
    const cDate = a.createdAt ? new Date(a.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";
    console.log(`   - [${a.id}] Bài: "${a.lessonTitle || l?.title}" | Lớp: "${c?.name}" (${a.classId}) | Năm học ghi trong assignment: "${a.academicYear}" | Ngày giao: ${cDate}`);
  }

  console.log("\n4. Chi tiết 5 lượt làm bài (Attempts) & Đối chiếu tính nhất quán:");
  const auditResults = [];

  for (const att of attemptsSnap.docs) {
    const aData = att.data();
    const assign = assignmentMap[aData.assignmentId];
    const student = studentMap[aData.studentId];
    // Notice: att might not have classId, or might have classId
    const attClassId = aData.classId || assign?.classId || student?.classId;
    const classObj = classMap[attClassId];

    // Determine completion date
    let completedTs = null;
    if (typeof aData.completedAt === "number") {
      completedTs = aData.completedAt;
    } else if (aData.completedAt && aData.completedAt._seconds) {
      completedTs = aData.completedAt._seconds * 1000;
    } else if (typeof aData.startedAt === "number") {
      completedTs = aData.startedAt;
    }

    const completedVN = completedTs ? new Date(completedTs).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa hoàn thành";
    const completedDateOnly = completedTs ? new Date(completedTs).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "N/A";
    
    // Determine actual Academic Year from completion timestamp:
    // Vietnam school year:
    // 2025-2026: 2025-08-01 to 2026-06-30
    // 2026-2027: 2026-08-01 to 2027-06-30
    let actualYearFromDate = "Không xác định";
    let actualSemesterFromDate = "Không xác định";

    if (completedTs) {
      const d = new Date(completedTs);
      // Convert to Vietnam time
      const vnFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "numeric",
        day: "numeric"
      });
      const parts = vnFormatter.formatToParts(d);
      const year = parseInt(parts.find(p => p.type === "year").value);
      const month = parseInt(parts.find(p => p.type === "month").value);

      if ((year === 2025 && month >= 8) || (year === 2026 && month <= 6)) {
        actualYearFromDate = "2025-2026";
        actualSemesterFromDate = (month >= 8 || month === 1) ? "Học kỳ I" : "Học kỳ II";
      } else if ((year === 2026 && month >= 8) || (year === 2027 && month <= 6)) {
        actualYearFromDate = "2026-2027";
        actualSemesterFromDate = (month >= 8 || month === 1) ? "Học kỳ I" : "Học kỳ II";
      }
    }

    const recordedClassYear = classObj?.academicYear || "Chưa có";
    const recordedAssignYear = assign?.academicYear || "Chưa có";

    // Detect mismatch
    const isMismatch = (completedTs !== null && actualYearFromDate !== recordedClassYear);

    const record = {
      attemptId: att.id,
      studentCode: student?.studentCode || "N/A",
      studentAlias: student?.displayAlias || "N/A",
      classId: attClassId,
      className: classObj?.name || "N/A",
      recordedClassYear,
      recordedAssignYear,
      completedTs,
      completedVN,
      completedDateOnly,
      actualYearFromDate,
      actualSemesterFromDate,
      status: aData.status,
      isMismatch,
      mismatchDetails: isMismatch
        ? `Lớp ghi năm học "${recordedClassYear}", nhưng ngày làm bài thực tế là ${completedVN} (thuộc năm học ${actualYearFromDate} - ${actualSemesterFromDate})`
        : "Khớp năm học"
    };

    auditResults.push(record);
    console.log(`   - [Attempt ${att.id}]`);
    console.log(`     * Học sinh: ${record.studentAlias} (${record.studentCode})`);
    console.log(`     * Lớp: ${record.className} | Năm học ghi trên Lớp: "${recordedClassYear}" | Năm học ghi trên Assignment: "${recordedAssignYear}"`);
    console.log(`     * Thời gian hoàn thành (Giờ VN): ${completedVN}`);
    console.log(`     * Năm học thực tế suy ra từ ngày làm: ${actualYearFromDate} (${actualSemesterFromDate})`);
    console.log(`     * Kết luận: ${isMismatch ? "❌ BẤT THƯỜNG / KHÔNG NHẤT QUÁN" : "✅ HỢP LỆ"}`);
    if (isMismatch) {
      console.log(`       -> Chi tiết: ${record.mismatchDetails}`);
    }
  }

  console.log("\n===============================================================================");
  console.log("5. TỔNG KẾT THỰC TRẠNG:");
  const mismatches = auditResults.filter(r => r.isMismatch);
  console.log(`   - Tổng số attempts: ${auditResults.length}`);
  console.log(`   - Số bản ghi có ngày hợp lệ (khớp năm học): ${auditResults.length - mismatches.length}`);
  console.log(`   - Số bản ghi bất thường (lệch năm học): ${mismatches.length}`);
  console.log("===============================================================================");
}

runDetailedAudit().catch(console.error);
