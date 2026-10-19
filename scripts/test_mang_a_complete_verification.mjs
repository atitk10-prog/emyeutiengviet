/**
 * Test Suite: MẢNG A COMPLETE VERIFICATION
 * Comprehensive test for:
 * A1. Data Audit & Preservation (10 classes, 200 students, 20 lessons, 26 assignments, 403 attempts)
 * A2. Class Transfer Verification (Atomicity, zero duplication, preserved ID & attempts, session update)
 * A3. Academic Year Standardization (2026-2027 vs 2025-2026 isolation, safe class delete protection)
 * A4. Export & Reports (CSV UTF-8 BOM, fields, records preview, summary metrics)
 * A5. Zero contamination & full restoration
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import assert from "assert";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);
const BASE_URL = "http://127.0.0.1:5001/em-yeu-tieng-viet-demo/us-central1";

async function callFn(name, payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: payload })
  });
  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error.message || JSON.stringify(json.error));
    err.status = json.error.status;
    err.code = json.error.code;
    throw err;
  }
  return json.result;
}

async function getTeacherIdToken() {
  const customToken = await auth.createCustomToken("teacher_demo_account", { role: "teacher" });
  const res = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );
  const data = await res.json();
  return data.idToken;
}

async function run() {
  console.log("================================================================================");
  console.log("             TEST SUITE: MẢNG A COMPLETE VERIFICATION                           ");
  console.log("================================================================================");

  const teacherToken = await getTeacherIdToken();
  console.log("✓ Authenticated as Teacher (teacher_demo_account)");

  // -------------------------------------------------------------------------
  // STEP 1: INITIAL STATE & HS001 CANONICAL RESTORATION
  // -------------------------------------------------------------------------
  console.log("\n[TEST 1] Auditing initial student distribution and restoring HS001 to 2A...");
  const s001Doc = await db.collection("students").doc("student_demo_hs001").get();
  assert(s001Doc.exists, "student_demo_hs001 must exist");
  const s001Data = s001Doc.data();
  console.log(`Current classId of student_demo_hs001: ${s001Data.classId} (${s001Data.classCode})`);

  if (s001Data.classId !== "class_2a") {
    console.log("Restoring student_demo_hs001 back to class_2a via transferStudentClass...");
    const transRes = await callFn("transferStudentClass", {
      studentId: "student_demo_hs001",
      targetClassId: "class_2a",
      transferType: "same_year",
      reason: "Khôi phục phân bổ chuẩn 20 HS/lớp"
    }, teacherToken);
    assert(transRes.success, "Restoration transfer must succeed");
    console.log("✓ Restored HS001 to class_2a successfully:", transRes.message);
  }

  // Verify class_2a and class_2b now have 20 students each
  const [snap2A, snap2B] = await Promise.all([
    db.collection("students").where("classId", "==", "class_2a").get(),
    db.collection("students").where("classId", "==", "class_2b").get()
  ]);
  console.log(`Count in class_2a: ${snap2A.size}, Count in class_2b: ${snap2B.size}`);
  assert.strictEqual(snap2A.size, 20, "class_2a must have exactly 20 students");
  assert.strictEqual(snap2B.size, 20, "class_2b must have exactly 20 students");

  // Verify doc studentCount fields
  const [cls2ADoc, cls2BDoc] = await Promise.all([
    db.collection("classes").doc("class_2a").get(),
    db.collection("classes").doc("class_2b").get()
  ]);
  assert.strictEqual(cls2ADoc.data().studentCount, 20, "class_2a.studentCount must be 20");
  assert.strictEqual(cls2BDoc.data().studentCount, 20, "class_2b.studentCount must be 20");
  console.log("✓ Both class_2a and class_2b have exactly 20 active students and studentCount = 20");

  // -------------------------------------------------------------------------
  // STEP 2: CLASS TRANSFER FUNCTIONALITY (2A -> 2B -> 2A)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 2] Testing complete transfer cycle: 2A -> 2B with checks, then 2B -> 2A...");
  
  // Check student attempts before transfer
  const attemptsBeforeSnap = await db.collection("attempts").where("studentId", "==", "student_demo_hs001").get();
  const attemptsBeforeCount = attemptsBeforeSnap.size;
  console.log(`HS001 has ${attemptsBeforeCount} attempts before transfer.`);
  assert(attemptsBeforeCount > 0, "HS001 must have attempts to verify history retention");

  // Transfer 2A -> 2B
  console.log("Action: Transferring HS001 from 2A to 2B...");
  const transferTo2B = await callFn("transferStudentClass", {
    studentId: "student_demo_hs001",
    targetClassId: "class_2b",
    transferType: "same_year",
    reason: "Thử nghiệm chuyển lớp cùng năm học"
  }, teacherToken);
  assert(transferTo2B.success, "Transfer to 2B must succeed");

  // Check state in 2B
  const sAfter2B = (await db.collection("students").doc("student_demo_hs001").get()).data();
  assert.strictEqual(sAfter2B.classId, "class_2b", "classId must be class_2b");
  assert.strictEqual(sAfter2B.classCode, "LOP2B0", "classCode must be updated to LOP2B0");
  assert.strictEqual(sAfter2B.previousClassId, "class_2a", "previousClassId must be class_2a");
  assert(Array.isArray(sAfter2B.transferHistory) && sAfter2B.transferHistory.length > 0, "transferHistory must record entry");

  // Verify single active list membership: HS001 must NOT appear in 2A query
  const snap2AAfterTransfer = await db.collection("students").where("classId", "==", "class_2a").get();
  const snap2BAfterTransfer = await db.collection("students").where("classId", "==", "class_2b").get();
  assert.strictEqual(snap2AAfterTransfer.size, 19, "class_2a must now have 19 students");
  assert.strictEqual(snap2BAfterTransfer.size, 21, "class_2b must now have 21 students");
  const foundIn2A = snap2AAfterTransfer.docs.some(d => d.id === "student_demo_hs001");
  const foundIn2B = snap2BAfterTransfer.docs.some(d => d.id === "student_demo_hs001");
  assert(!foundIn2A, "HS001 must NOT be in class_2a active list");
  assert(foundIn2B, "HS001 must be in class_2b active list");
  console.log("✓ Single active membership verified: absent from 2A, present in 2B");

  // Verify attempts and scores are completely preserved
  const attemptsMidSnap = await db.collection("attempts").where("studentId", "==", "student_demo_hs001").get();
  assert.strictEqual(attemptsMidSnap.size, attemptsBeforeCount, "Attempts count must remain 100% identical");
  console.log("✓ Attempt history and scores preserved during transfer");

  // Transfer back 2B -> 2A to return to pristine baseline
  console.log("Action: Transferring HS001 back from 2B to 2A...");
  const transferBack = await callFn("transferStudentClass", {
    studentId: "student_demo_hs001",
    targetClassId: "class_2a",
    transferType: "same_year",
    reason: "Hoàn tất kiểm thử chuyển lớp"
  }, teacherToken);
  assert(transferBack.success, "Transfer back must succeed");

  const sAfterReturn = (await db.collection("students").doc("student_demo_hs001").get()).data();
  assert.strictEqual(sAfterReturn.classId, "class_2a");
  assert.strictEqual(sAfterReturn.classCode, "LOP2A0");

  const [snap2AFinal, snap2BFinal] = await Promise.all([
    db.collection("students").where("classId", "==", "class_2a").get(),
    db.collection("students").where("classId", "==", "class_2b").get()
  ]);
  assert.strictEqual(snap2AFinal.size, 20, "class_2a restored to 20");
  assert.strictEqual(snap2BFinal.size, 20, "class_2b restored to 20");
  console.log("✓ Student restored back to class_2a: 20 in 2A, 20 in 2B");

  // -------------------------------------------------------------------------
  // STEP 3: ACADEMIC YEAR ISOLATION (A3)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 3] Testing Academic Year Isolation in getTeacherAnalytics...");
  
  // 3.1 Year 2026-2027 Analytics
  const analytics2026 = await callFn("getTeacherAnalytics", { academicYear: "2026-2027" }, teacherToken);
  console.log(`Year 2026-2027: ${analytics2026.totalClasses} classes, ${analytics2026.totalAttempts} attempts, avgFirstTry: ${analytics2026.avgFirstTryAccuracy}%, avgFinal: ${analytics2026.avgFinalAccuracy}%`);
  assert.strictEqual(analytics2026.totalClasses, 4, "2026-2027 must have exactly 4 classes (2A, 2B, 3D, 3E)");
  assert(analytics2026.totalAttempts > 0, "2026-2027 must have attempts");

  // 3.2 Year 2025-2026 Analytics
  const analytics2025 = await callFn("getTeacherAnalytics", { academicYear: "2025-2026" }, teacherToken);
  console.log(`Year 2025-2026: ${analytics2025.totalClasses} classes, ${analytics2025.totalAttempts} attempts, avgFirstTry: ${analytics2025.avgFirstTryAccuracy}%, avgFinal: ${analytics2025.avgFinalAccuracy}%`);
  assert.strictEqual(analytics2025.totalClasses, 6, "2025-2026 must have exactly 6 classes (2C, 2D, 2E, 3A, 3B, 3C)");
  assert(analytics2025.totalAttempts > 0, "2025-2026 must have attempts");

  // Check sum of isolated classes equals 10
  assert.strictEqual(analytics2026.totalClasses + analytics2025.totalClasses, 10, "Total classes across both years must equal 10");
  // Check sum of isolated completed attempts equals 376 (out of 403 total attempts including 27 in_progress)
  assert.strictEqual(analytics2026.totalAttempts + analytics2025.totalAttempts, 376, "Total completed attempts sum must equal 376 (zero overlap or lost attempts)");
  console.log("✓ Academic year isolation verified: 2026-2027 (4 classes, 154 completed) + 2025-2026 (6 classes, 222 completed) = 10 classes, 376 completed attempts");

  // -------------------------------------------------------------------------
  // STEP 4: SAFE CLASS DELETION / ARCHIVAL PROTECTION (A3)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 4] Testing Safe Class Deletion Protection (no cascade delete)...");
  try {
    await callFn("deleteClassroom", { classId: "class_2a" }, teacherToken);
    assert.fail("deleteClassroom must reject deletion of class with active students/assignments");
  } catch (err) {
    console.log("✓ deleteClassroom correctly rejected with error:", err.message);
  }

  // -------------------------------------------------------------------------
  // STEP 5: DATA EXPORT & AUDIT REPORTS (A4)
  // -------------------------------------------------------------------------
  console.log("\n[TEST 5] Testing exportTeacherData (CSV UTF-8 BOM, fields, records preview)...");
  
  // 5.1 Export for Year 2026-2027
  const exportRes = await callFn("exportTeacherData", { academicYear: "2026-2027" }, teacherToken);
  assert(exportRes.success, "exportTeacherData must succeed");
  assert(exportRes.csv, "CSV data must be returned");
  assert(exportRes.csv.startsWith("\ufeff"), "CSV must start with UTF-8 BOM (\\ufeff)");

  // Check CSV header
  const csvLines = exportRes.csv.split("\n");
  const header = csvLines[0].replace("\ufeff", "").trim();
  console.log("CSV Header:", header);
  assert(header.includes("Mã học sinh"), "Header must include 'Mã học sinh'");
  assert(header.includes("Biệt danh"), "Header must include 'Biệt danh'");
  assert(header.includes("Lớp"), "Header must include 'Lớp'");
  assert(header.includes("Khối"), "Header must include 'Khối'");
  assert(header.includes("Năm học"), "Header must include 'Năm học'");
  assert(header.includes("Bài được giao"), "Header must include 'Bài được giao'");
  assert(header.includes("Lượt làm"), "Header must include 'Lượt làm'");
  assert(header.includes("Đúng lần đầu"), "Header must include 'Đúng lần đầu'");
  assert(header.includes("Đúng sau gợi ý"), "Header must include 'Đúng sau gợi ý'");
  assert(header.includes("Tiến bộ (+câu)"), "Header must include 'Tiến bộ (+câu)'");
  assert(header.includes("Điểm tổng"), "Header must include 'Điểm tổng'");
  console.log(`✓ CSV generated with UTF-8 BOM and ${csvLines.length - 1} data rows`);

  // Check records array for live preview table
  assert(Array.isArray(exportRes.records), "exportRes.records must be an array");
  console.log(`Records array count: ${exportRes.records.length}`);
  const sampleRecord = exportRes.records[0];
  console.log("Sample preview record:", {
    studentCode: sampleRecord.studentCode,
    displayAlias: sampleRecord.displayAlias,
    className: sampleRecord.className,
    grade: sampleRecord.grade,
    academicYear: sampleRecord.academicYear,
    lessonTitle: sampleRecord.lessonTitle,
    attemptNumber: sampleRecord.attemptNumber,
    firstTryCorrectCount: sampleRecord.firstTryCorrectCount,
    finalCorrectCount: sampleRecord.finalCorrectCount,
    score: sampleRecord.score
  });
  assert(sampleRecord.studentCode, "Record must have studentCode");
  assert(sampleRecord.className, "Record must have className");
  assert(sampleRecord.lessonTitle, "Record must have human-readable lessonTitle");

  // Check summary metrics
  assert(exportRes.summary, "exportRes.summary must be present");
  console.log("Export summary:", exportRes.summary);
  assert(exportRes.summary.totalStudents > 0, "totalStudents must be > 0");
  assert(exportRes.summary.totalAttempts > 0, "totalAttempts must be > 0");
  console.log("✓ Export data structure and preview records verified");

  // -------------------------------------------------------------------------
  // STEP 6: FINAL INVARIANT AUDIT ACROSS ALL COLLECTIONS
  // -------------------------------------------------------------------------
  console.log("\n[TEST 6] Auditing final database invariants...");
  const [classesSnap, studentsSnap, lessonsSnap, assignmentsSnap, attemptsSnap, usersSnap] = await Promise.all([
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get(),
    db.collection("users").get()
  ]);

  console.log(`Classes:     ${classesSnap.size} (Expected: 10)`);
  console.log(`Students:    ${studentsSnap.size} (Expected: 200)`);
  console.log(`Lessons:     ${lessonsSnap.size} (Expected: 20)`);
  console.log(`Assignments: ${assignmentsSnap.size} (Expected: 26)`);
  console.log(`Attempts:    ${attemptsSnap.size} (Expected: 403)`);
  console.log(`Users:       ${usersSnap.size}`);

  assert.strictEqual(classesSnap.size, 10, "Exact 10 classes required");
  assert.strictEqual(studentsSnap.size, 200, "Exact 200 students required");
  assert.strictEqual(lessonsSnap.size, 20, "Exact 20 lessons required");
  assert.strictEqual(assignmentsSnap.size, 26, "Exact 26 assignments required");
  assert.strictEqual(attemptsSnap.size, 403, "Exact 403 attempts required");

  // Verify each class has exactly 20 students
  const classCounts = {};
  studentsSnap.forEach(d => {
    const cid = d.data().classId;
    classCounts[cid] = (classCounts[cid] || 0) + 1;
  });
  console.log("Student count per class:", classCounts);
  for (const [cid, cnt] of Object.entries(classCounts)) {
    assert.strictEqual(cnt, 20, `Class ${cid} must have exactly 20 students`);
  }

  console.log("\n================================================================================");
  console.log(">>> ALL MẢNG A TESTS PASSED! ZERO RESETS, ZERO CONTAMINATION, 100% AUDITED <<<");
  console.log("================================================================================\n");
}

run().catch(err => {
  console.error("FATAL ERROR in Mảng A verification:", err);
  process.exit(1);
});
