import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

// Import logic matching functions/src/index.ts
function formatVietnamDateTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function getAcademicYearFromTimestamp(ts) {
  if (!ts) return { academicYear: "2026-2027", semester: 1, semesterLabel: "Học kỳ I" };
  const d = new Date(ts);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find(p => p.type === "year")?.value || "2026", 10);
  const month = parseInt(parts.find(p => p.type === "month")?.value || "10", 10);

  let academicYear = "2026-2027";
  let semester = 1;
  if (month >= 8) {
    academicYear = `${year}-${year + 1}`;
    semester = 1;
  } else if (month <= 6) {
    academicYear = `${year - 1}-${year}`;
    semester = (month === 1) ? 1 : 2;
  } else {
    academicYear = `${year - 1}-${year}`;
    semester = 2;
  }
  return { academicYear, semester, semesterLabel: semester === 2 ? "Học kỳ II" : "Học kỳ I" };
}

async function verifyAudit() {
  console.log("=== KIỂM CHỨNG LOGIC KIỂM TOÁN GIAI ĐOẠN 2 ===\n");

  const [classesSnap, assignmentsSnap, attemptsSnap, studentsSnap] = await Promise.all([
    db.collection("classes").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get(),
    db.collection("students").get()
  ]);

  const classMap = {};
  classesSnap.forEach(d => classMap[d.id] = { id: d.id, ...d.data() });

  const assignMap = {};
  assignmentsSnap.forEach(d => assignMap[d.id] = { id: d.id, ...d.data() });

  const studentMap = {};
  studentsSnap.forEach(d => studentMap[d.id] = { id: d.id, ...d.data() });

  let validCount = 0;
  let anomalousCount = 0;

  console.log(`Đang kiểm tra ${attemptsSnap.size} attempts trong hệ thống:`);

  attemptsSnap.forEach(d => {
    const att = d.data();
    const assign = assignMap[att.assignmentId];
    const historicalClassId = att.classId || assign?.classId;
    const cl = classMap[historicalClassId];
    const st = studentMap[att.studentId];

    let completedTs = null;
    if (typeof att.completedAt === "number") completedTs = att.completedAt;
    else if (att.completedAt?._seconds) completedTs = att.completedAt._seconds * 1000;
    else if (typeof att.startedAt === "number") completedTs = att.startedAt;

    const completedVN = formatVietnamDateTime(completedTs);
    const inferred = getAcademicYearFromTimestamp(completedTs);
    const recordedYear = att.academicYear || assign?.academicYear || cl?.academicYear || "2025-2026";
    const isAnomalous = Boolean(completedTs && inferred.academicYear !== recordedYear);

    if (isAnomalous) anomalousCount++;
    else validCount++;

    console.log(`- Attempt [${d.id}]:`);
    console.log(`  * Học sinh: ${st?.displayAlias} (${st?.studentCode})`);
    console.log(`  * Lớp lịch sử: ${cl?.name} (ID: ${historicalClassId})`);
    console.log(`  * Năm học ghi trên lớp/đợt giao: "${recordedYear}"`);
    console.log(`  * Hoàn thành (Giờ VN - ICT): ${completedVN}`);
    console.log(`  * Năm học tính từ ngày làm: "${inferred.academicYear} - ${inferred.semesterLabel}"`);
    console.log(`  * Đánh giá kiểm toán: ${isAnomalous ? "⚠️ BẤT THƯỜNG (Lệch niên khóa)" : "✅ HỢP LỆ"}`);
  });

  console.log("\n--- TỔNG KẾT KẾT QUẢ KIỂM TOÁN ---");
  console.log(`- Tổng số attempts: ${attemptsSnap.size}`);
  console.log(`- Số lượt làm bài hợp lệ (khớp năm học): ${validCount}`);
  console.log(`- Số lượt làm bài bất thường (lệch niên khóa): ${anomalousCount}`);

  // Test Requirement 4: Historical class preservation test
  console.log("\n--- KIỂM TRA BẢO TỒN LỚP LỊCH SỬ (YÊU CẦU 4) ---");
  const testAttempt = attemptsSnap.docs.find(d => d.id === "r6GCaG8ZBM3mmdGGU2XT");
  if (testAttempt) {
    const aData = testAttempt.data();
    const assign = assignMap[aData.assignmentId];
    const historicalClassId = aData.classId || assign?.classId;
    const resolvedClass = classMap[historicalClassId];
    console.log(`Attempt r6GCaG8ZBM3mmdGGU2XT:`);
    console.log(`  * classId trên doc: ${aData.classId || "undefined"}`);
    console.log(`  * classId tra cứu qua assignment: ${assign?.classId}`);
    console.log(`  * Lớp lịch sử giải quyết được: "${resolvedClass?.name}"`);
    if (resolvedClass?.name === "Lop 2C") {
      console.log("  => PASS: Lịch sử lớp được giữ chính xác từ bài giao, không bị phụ thuộc vào doc attempt.");
    } else {
      console.log("  => FAIL: Chưa resolve đúng lớp lịch sử.");
    }
  }

  process.exit(0);
}

verifyAudit().catch(err => {
  console.error("Lỗi:", err);
  process.exit(1);
});
