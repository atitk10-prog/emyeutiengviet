import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

// Purely read-only investigation script
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = initializeApp({ projectId: "em-yeu-tieng-viet-demo" });
const db = getFirestore(app);
const auth = getAuth(app);

async function audit() {
  console.log("===============================================================================");
  console.log("STARTING READ-ONLY DATA AUDIT OF FIREBASE EMULATOR & ADMIN DATA");
  console.log("Time: " + new Date().toISOString());
  console.log("===============================================================================\n");

  // 1. Connection check
  console.log("1. EMULATOR CONNECTION & ENVIRONMENT:");
  console.log("   - Project ID: em-yeu-tieng-viet-demo");
  console.log("   - Firestore Host: " + process.env.FIRESTORE_EMULATOR_HOST);
  console.log("   - Auth Host: " + process.env.FIREBASE_AUTH_EMULATOR_HOST);

  // 2. Fetch all collections in parallel
  const [
    usersSnap,
    classesSnap,
    studentsSnap,
    lessonsSnap,
    assignmentsSnap,
    attemptsSnap,
    secretsSnap,
    sessionsSnap,
    curriculumSnap
  ] = await Promise.all([
    db.collection("users").get(),
    db.collection("classes").get(),
    db.collection("students").get(),
    db.collection("lessons").get(),
    db.collection("assignments").get(),
    db.collection("attempts").get(),
    db.collection("studentSecrets").get(),
    db.collection("studentSessions").get(),
    db.collection("curriculumNodes").get()
  ]);

  console.log("\n2. FIRESTORE RAW COLLECTION COUNTS:");
  console.log(`   - users: ${usersSnap.size}`);
  console.log(`   - classes: ${classesSnap.size}`);
  console.log(`   - students: ${studentsSnap.size}`);
  console.log(`   - lessons: ${lessonsSnap.size}`);
  console.log(`   - assignments: ${assignmentsSnap.size}`);
  console.log(`   - attempts: ${attemptsSnap.size}`);
  console.log(`   - studentSecrets: ${secretsSnap.size}`);
  console.log(`   - studentSessions: ${sessionsSnap.size}`);
  console.log(`   - curriculumNodes: ${curriculumSnap.size}`);

  // 3. Auth Users count
  let authUsers = [];
  try {
    const listResult = await auth.listUsers(1000);
    authUsers = listResult.users;
    console.log(`   - auth (Firebase Auth Users): ${authUsers.length}`);
  } catch (e) {
    console.error("   - Failed to list Auth users:", e.message);
  }

  // 4. Breakdown of USERS
  const teachers = [];
  const admins = [];
  const otherUsers = [];
  const usersByStatus = {};

  usersSnap.forEach(d => {
    const u = { id: d.id, ...d.data() };
    const status = u.status || "active";
    usersByStatus[status] = (usersByStatus[status] || 0) + 1;

    if (u.role === "teacher") teachers.push(u);
    else if (u.role === "admin") admins.push(u);
    else otherUsers.push(u);
  });

  console.log("\n3. USERS BREAKDOWN:");
  console.log(`   - Teachers (role == 'teacher'): ${teachers.length}`);
  console.log(`     * active: ${teachers.filter(t => t.status !== 'suspended').length}`);
  console.log(`     * suspended: ${teachers.filter(t => t.status === 'suspended').length}`);
  console.log(`   - Admins (role == 'admin'): ${admins.length}`);
  console.log(`   - Other/Unset role: ${otherUsers.length}`);
  console.log(`   - Total users docs: ${usersSnap.size}`);

  // 5. Breakdown of CLASSES
  const classesByYear = {};
  const classesByGrade = {};
  const classIdToStudentCount = {};

  studentsSnap.forEach(s => {
    const cid = s.data().classId;
    if (cid) {
      classIdToStudentCount[cid] = (classIdToStudentCount[cid] || 0) + 1;
    }
  });

  const allClasses = [];
  classesSnap.forEach(d => {
    const c = { id: d.id, ...d.data() };
    const yr = c.academicYear || "Chưa có năm học (unset)";
    classesByYear[yr] = (classesByYear[yr] || 0) + 1;
    const g = c.grade || "unset";
    classesByGrade[g] = (classesByGrade[g] || 0) + 1;
    allClasses.push(c);
  });

  console.log("\n4. CLASSES BREAKDOWN:");
  console.log(`   - Total classes docs: ${classesSnap.size}`);
  console.log("   - Classes by academicYear:", classesByYear);
  console.log("   - Classes by Grade:", classesByGrade);

  // 6. DETAILED INVESTIGATION OF LỚP 2C (MXK4FH)
  console.log("\n===============================================================================");
  console.log("5. ĐIỀU TRA CHI TIẾT LỚP 2C (MÃ MXK4FH):");
  console.log("===============================================================================");
  const classes2C = allClasses.filter(c => 
    (c.classCode && c.classCode.toUpperCase() === "MXK4FH") || 
    (c.name && c.name.toLowerCase().includes("2c"))
  );

  console.log(`Found ${classes2C.length} class(es) matching "2C" or code "MXK4FH":`);
  for (const c of classes2C) {
    console.log(`\n--- Class Document: ${c.id} ---`);
    console.log(`   - name: "${c.name}"`);
    console.log(`   - classCode: "${c.classCode}"`);
    console.log(`   - grade: ${c.grade}`);
    console.log(`   - teacherUid: "${c.teacherUid}"`);
    console.log(`   - academicYear: "${c.academicYear}"`);
    console.log(`   - doc.studentCount field: ${c.studentCount} (typeof: ${typeof c.studentCount})`);
    console.log(`   - doc.status field: ${c.status}`);
    console.log(`   - ACTUAL matching docs in students collection (by classId == '${c.id}'): ${classIdToStudentCount[c.id] || 0}`);
    
    // Check students for this class
    const stInClass = [];
    studentsSnap.forEach(s => {
      if (s.data().classId === c.id) {
        stInClass.push({ id: s.id, ...s.data() });
      }
    });
    console.log(`   - List of ${stInClass.length} students currently bound to this classId:`);
    stInClass.forEach((st, idx) => {
      console.log(`     ${idx + 1}. [${st.id}] Alias: "${st.displayAlias}" | Code: "${st.studentCode}" | Status: "${st.status}"`);
    });
  }

  // Also check if any students have classCode == "MXK4FH" or classId dangling
  const studentsWithMXK4FH = [];
  studentsSnap.forEach(s => {
    if (s.data().classCode === "MXK4FH" || (s.data().classId && !classesSnap.docs.some(cd => cd.id === s.data().classId))) {
      studentsWithMXK4FH.push({ id: s.id, ...s.data() });
    }
  });
  if (studentsWithMXK4FH.length > 0) {
    console.log(`\nNotice: Found ${studentsWithMXK4FH.length} students with dangling classId or matching classCode`);
  }

  // 7. SIMULATE getAdminOverview vs listTeachers vs listAllClassesAdmin
  console.log("\n===============================================================================");
  console.log("6. ĐỐI CHIẾU SỐ LIỆU GETADMINOVERVIEW vs LISTTEACHERS vs LISTALLCLASSESADMIN:");
  console.log("===============================================================================");
  // getAdminOverview logic:
  let ovTeachers = 0;
  let ovActiveTeachers = 0;
  usersSnap.forEach((d) => {
    const u = d.data();
    if (u.role === "teacher") {
      ovTeachers++;
      if (u.status !== "suspended") ovActiveTeachers++;
    }
  });
  console.log(`   - getAdminOverview returns:`);
  console.log(`     * totalTeachers: ${ovTeachers}`);
  console.log(`     * activeTeachers: ${ovActiveTeachers}`);
  console.log(`     * totalClasses: ${classesSnap.size}`);
  console.log(`     * totalStudents: ${studentsSnap.size}`);

  // listTeachers logic:
  const teacherClassCount = {};
  classesSnap.forEach((d) => {
    const tId = d.data().teacherUid;
    teacherClassCount[tId] = (teacherClassCount[tId] || 0) + 1;
  });
  const listTeachersResult = teachers.map((doc) => ({
    uid: doc.id,
    email: doc.email || "Chưa có email",
    displayName: doc.displayName || "Giáo viên",
    status: doc.status || "active",
    classCount: teacherClassCount[doc.id] || 0
  }));
  console.log(`   - listTeachers returns: ${listTeachersResult.length} teachers`);

  // listAllClassesAdmin logic:
  const teacherMap = {};
  usersSnap.forEach((d) => {
    teacherMap[d.id] = d.data().displayName || d.data().email || "Giáo viên";
  });
  const listClassesResult = allClasses.map((c) => ({
    id: c.id,
    name: c.name,
    studentCount: c.studentCount || 0,
    actualStudentsInCollection: classIdToStudentCount[c.id] || 0
  }));
  console.log(`   - listAllClassesAdmin returns: ${listClassesResult.length} classes`);
  
  // Find classes where doc.studentCount != actualStudentsInCollection
  const mismatchedClassCounts = listClassesResult.filter(c => c.studentCount !== c.actualStudentsInCollection);
  console.log(`   - Number of classes where doc.studentCount != actual students in collection: ${mismatchedClassCounts.length} / ${listClassesResult.length}`);
  mismatchedClassCounts.slice(0, 10).forEach(mc => {
    console.log(`     * Class [${mc.id}] "${mc.name}": doc.studentCount=${mc.studentCount} vs actual=${mc.actualStudentsInCollection}`);
  });

  // 8. CLASSIFICATION OF DATA (REAL / DEMO / TEST / UNKNOWN)
  console.log("\n===============================================================================");
  console.log("7. PHÂN LOẠI NGUỒN GỐC TÀI KHOẢN VÀ DỮ LIỆU:");
  console.log("===============================================================================");
  
  // Patterns for test artifacts
  const testPatterns = [
    /test/i,
    /v5/i,
    /sec_/i,
    /export\.\d+/i,
    /unauth\.\d+/i,
    /reader\.\d+/i,
    /manager\.\d+/i,
    /persistence\.\d+/i,
    /testai/i,
    /bảo mật/i,
    /thực nghiệm/i,
    /khảo sát/i,
    /\d{13}/ // timestamp like 1792...
  ];

  const classifiedTeachers = {
    keepProductionOrDemo: [],
    testIdentified: [],
    unknown: []
  };

  teachers.forEach(t => {
    const str = `${t.id} ${t.displayName || ''} ${t.email || ''}`;
    const isTest = testPatterns.some(p => p.test(str));
    
    // Core seed accounts to keep
    const isCoreDemo = (
      t.email === "giaovien.tieuhoc@emytv.edu.vn" || 
      t.id === "B5H9PeMrZowS3ewPm4BQ8aM4fkU1" ||
      t.displayName === "giaovien.tieuhoc" ||
      t.email === "gv.nguyenvana@tieuhoc.edu.vn" ||
      t.email === "gv.tranthib@tieuhoc.edu.vn"
    );

    if (isCoreDemo) {
      classifiedTeachers.keepProductionOrDemo.push(t);
    } else if (isTest) {
      classifiedTeachers.testIdentified.push(t);
    } else {
      classifiedTeachers.unknown.push(t);
    }
  });

  console.log(`Teachers classification:`);
  console.log(`   - Core Production / Demo to KEEP: ${classifiedTeachers.keepProductionOrDemo.length}`);
  classifiedTeachers.keepProductionOrDemo.forEach(t => console.log(`     * [${t.id}] ${t.displayName} (${t.email})`));
  console.log(`   - Identified Test accounts: ${classifiedTeachers.testIdentified.length}`);
  console.log(`   - Unknown / Need Verification: ${classifiedTeachers.unknown.length}`);
  classifiedTeachers.unknown.forEach(t => console.log(`     ? [${t.id}] ${t.displayName} (${t.email})`));

  // Classified Classes
  const classifiedClasses = {
    keepProductionOrDemo: [],
    testIdentified: [],
    unknown: []
  };

  allClasses.forEach(c => {
    const str = `${c.id} ${c.name || ''} ${c.classCode || ''}`;
    const isTest = testPatterns.some(p => p.test(str));
    const isCore = (
      c.id === "OA3tsKnUG6FEaWSmWSE4" || 
      c.classCode === "MXK4FH" || 
      c.name === "Lop 2C" || 
      c.name === "Lớp 2A" || 
      c.name === "Lớp 3A" ||
      c.name === "Lớp 2C - Chân trời sáng tạo"
    );

    if (isCore) {
      classifiedClasses.keepProductionOrDemo.push(c);
    } else if (isTest) {
      classifiedClasses.testIdentified.push(c);
    } else {
      classifiedClasses.unknown.push(c);
    }
  });

  console.log(`\nClasses classification:`);
  console.log(`   - Core Production / Demo to KEEP: ${classifiedClasses.keepProductionOrDemo.length}`);
  classifiedClasses.keepProductionOrDemo.forEach(c => console.log(`     * [${c.id}] ${c.name} (${c.classCode}) - Teacher: ${c.teacherUid}`));
  console.log(`   - Identified Test classes: ${classifiedClasses.testIdentified.length}`);
  console.log(`   - Unknown / Need Verification: ${classifiedClasses.unknown.length}`);
  classifiedClasses.unknown.forEach(c => console.log(`     ? [${c.id}] ${c.name} (${c.classCode}) - Teacher: ${c.teacherUid}`));

  // 9. CHECK BACKUP DIRECTORIES
  console.log("\n===============================================================================");
  console.log("8. KIỂM TRA CÁC BẢN SAO LƯU TRONG THƯ MỤC DỰ ÁN:");
  console.log("===============================================================================");
  const dirsToCheck = [
    "emulator-data",
    "emulator-data-backup",
    "emulator-data-backup-v5",
    "emulator-data-v52",
    "firestore-backups"
  ];

  dirsToCheck.forEach(d => {
    const fullPath = path.resolve(process.cwd(), d);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath);
      console.log(`   - Found directory "${d}": contains ${files.length} items (${files.slice(0, 5).join(", ")}...)`);
    } else {
      console.log(`   - Directory "${d}": not present.`);
    }
  });

  // Save audit data snapshot to a JSON for accurate report generation
  const auditSummary = {
    timestamp: new Date().toISOString(),
    totals: {
      users: usersSnap.size,
      teachers: teachers.length,
      activeTeachers: teachers.filter(t => t.status !== 'suspended').length,
      suspendedTeachers: teachers.filter(t => t.status === 'suspended').length,
      admins: admins.length,
      classes: classesSnap.size,
      students: studentsSnap.size,
      lessons: lessonsSnap.size,
      assignments: assignmentsSnap.size,
      attempts: attemptsSnap.size,
      studentSecrets: secretsSnap.size,
      studentSessions: sessionsSnap.size,
      curriculumNodes: curriculumSnap.size,
      authUsers: authUsers.length
    },
    classes2C,
    mismatchedClassCountsCount: mismatchedClassCounts.length,
    classifiedTeachers: {
      keepCount: classifiedTeachers.keepProductionOrDemo.length,
      testCount: classifiedTeachers.testIdentified.length,
      unknownCount: classifiedTeachers.unknown.length
    },
    classifiedClasses: {
      keepCount: classifiedClasses.keepProductionOrDemo.length,
      testCount: classifiedClasses.testIdentified.length,
      unknownCount: classifiedClasses.unknown.length
    }
  };

  fs.writeFileSync("scripts/audit_results.json", JSON.stringify(auditSummary, null, 2));
  console.log("\n[SUCCESS] Read-only audit completed. Saved summary to scripts/audit_results.json");
}

audit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
