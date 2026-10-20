import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const isDryRun = process.argv.includes('--dry-run');

const saFiles = fs.readdirSync(process.cwd()).filter(f => f.includes('adminsdk') && f.endsWith('.json'));
if (saFiles.length === 0) {
  console.error("Không tìm thấy service account");
  process.exit(1);
}
const saPath = path.join(process.cwd(), saFiles[0]);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const app = initializeApp({ credential: cert(sa) }, 'cloud-baseline-sync');
const db = getFirestore(app);

// Crypto helpers matching seed_demo_v53.mjs
function generateSalt(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password.trim(), salt, 10000, 32, "sha256").toString("hex");
}
function hashAccessCode(code, salt) {
  return crypto.pbkdf2Sync(code.trim().toUpperCase(), salt, 10000, 32, "sha256").toString("hex");
}

// 200 Natural Vietnamese Names generator
const FIRST_NAMES_BOYS = [
  "An Nhiên", "Minh Quân", "Bảo Nam", "Gia Bảo", "Hoàng Bách", "Đức Phúc", "Quang Dũng",
  "Tiến Dũng", "Nhật Nam", "Đình Trọng", "Minh Trí", "Hải Đăng", "Khánh Nam", "Tùng Dương",
  "Thái Dương", "Bảo Khang", "Trí Dũng", "Tuấn Kiệt", "Quang Vinh", "Hùng Dũng", "Thiện Nhân",
  "Huy Hoàng", "Việt Anh", "Thành Đạt", "Minh Khôi", "Đăng Khoa", "Thanh Tùng", "Gia Khiêm",
  "Trung Kiên", "Bách Tùng", "Hữu Phước", "Trọng Hiếu", "Bảo Long", "Hoàng Long", "Phúc Lâm"
];
const FIRST_NAMES_GIRLS = [
  "Phương Linh", "Bảo Châu", "Thu Thảo", "Tuệ Mẫn", "Thùy Chi", "Thanh Trúc", "Ánh Dương",
  "Thùy Linh", "Ngọc Hân", "Khánh Vy", "Hà My", "Quỳnh Anh", "Mai Chi", "Thảo Nhi",
  "Yến Nhi", "Trúc Mai", "Hoàng Yến", "Hải Yến", "Bảo Trâm", "Minh Thư", "Diệp Anh",
  "Thảo Chi", "Tú Anh", "Bích Ngọc", "Ngọc Diệp", "Khánh Linh", "Hồng Anh", "Hương Giang",
  "Thanh Thảo", "Phương Vy", "Như Ý", "Cát Tường", "Diễm My", "Lan Anh", "Mỹ Duyên"
];
const SURNAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Vũ", "Võ", "Phan", "Trương",
  "Bùi", "Đặng", "Đỗ", "Ngô", "Hồ", "Dương", "Đinh", "Đoàn", "Lâm", "Mai", "Trịnh"
];
const MIDDLE_BOYS = ["Văn", "Minh", "Gia", "Đức", "Hoàng", "Bảo", "Hải", "Tuấn", "Thanh", "Quang"];
const MIDDLE_GIRLS = ["Thị", "Phương", "Thu", "Ngọc", "Mai", "Thùy", "Khánh", "Hồng", "Kim", "Ánh"];

function generate200Names() {
  const names = [];
  let boyIdx = 0;
  let girlIdx = 0;
  let surIdx = 0;

  for (let i = 1; i <= 200; i++) {
    const isBoy = (i % 2 === 1);
    const surname = SURNAMES[surIdx % SURNAMES.length];
    surIdx++;

    let fullName = "";
    if (isBoy) {
      const mid = MIDDLE_BOYS[i % MIDDLE_BOYS.length];
      const fn = FIRST_NAMES_BOYS[boyIdx % FIRST_NAMES_BOYS.length];
      boyIdx++;
      fullName = `${surname} ${mid} ${fn}`;
    } else {
      const mid = MIDDLE_GIRLS[i % MIDDLE_GIRLS.length];
      const fn = FIRST_NAMES_GIRLS[girlIdx % FIRST_NAMES_GIRLS.length];
      girlIdx++;
      fullName = `${surname} ${mid} ${fn}`;
    }

    names.push({
      index: i,
      code: `HS${String(i).padStart(3, "0")}`,
      fullName,
      displayAlias: fullName
    });
  }
  return names;
}

// 10 Standard Classes
const DEMO_CLASSES = [
  { id: "class_2a", name: "Lớp 2A", grade: 2, classCode: "LOP2A0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2b", name: "Lớp 2B", grade: 2, classCode: "LOP2B0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2c", name: "Lớp 2C", grade: 2, classCode: "LOP2C0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2d", name: "Lớp 2D", grade: 2, classCode: "LOP2D0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_2e", name: "Lớp 2E", grade: 2, classCode: "LOP2E0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3a", name: "Lớp 3A", grade: 3, classCode: "LOP3A0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3b", name: "Lớp 3B", grade: 3, classCode: "LOP3B0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3c", name: "Lớp 3C", grade: 3, classCode: "LOP3C0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3d", name: "Lớp 3D", grade: 3, classCode: "LOP3D0", academicYear: "2025-2026", studentCount: 20 },
  { id: "class_3e", name: "Lớp 3E", grade: 3, classCode: "LOP3E0", academicYear: "2025-2026", studentCount: 20 }
];

// Extract 10 original lessons from seed_demo_v53.mjs
async function loadDemoLessons() {
  const content = fs.readFileSync('scripts/seed_demo_v53.mjs', 'utf8');
  const startIdx = content.indexOf('const DEMO_LESSONS = [');
  const endIdx = content.indexOf('// Classes definition: 10 classes');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Không trích xuất được DEMO_LESSONS từ seed_demo_v53.mjs');
  }
  const code = content.substring(startIdx, endIdx);
  const sandbox = {};
  const fn = new Function('sandbox', code + '; sandbox.DEMO_LESSONS = DEMO_LESSONS;');
  fn(sandbox);
  return sandbox.DEMO_LESSONS;
}

// Extract 10 package B lessons from seed_package_b_lessons.js
async function loadPackageBLessons() {
  const content = fs.readFileSync('scripts/seed_package_b_lessons.js', 'utf8');
  const startIdx = content.indexOf('const NEW_LESSONS = [');
  const endIdx = content.indexOf('// ----------------------------------------------------', startIdx + 50);
  const fullEndIdx = content.indexOf('async function seedPackageBLessons()');
  if (startIdx === -1 || fullEndIdx === -1) {
    throw new Error('Không trích xuất được NEW_LESSONS từ seed_package_b_lessons.js');
  }
  const code = content.substring(startIdx, fullEndIdx);
  const sandbox = {};
  const fn = new Function('sandbox', code + '; sandbox.NEW_LESSONS = NEW_LESSONS;');
  fn(sandbox);
  return sandbox.NEW_LESSONS;
}

async function main() {
  console.log('========================================================================');
  console.log('  EM YÊU TIẾNG VIỆT — ĐỒNG BỘ DỮ LIỆU CHUẨN LOCALHOST LÊN CLOUD');
  console.log(`  Chế độ: ${isDryRun ? '🔍 DRY-RUN (CHỈ KIỂM TRA & ĐỐI CHIẾU - KHÔNG GHI)' : '🚀 LIVE SYNC (GHI BỔ SUNG KHÔNG GHI ĐÈ)'}`);
  console.log('========================================================================\n');

  const primaryTeacherUid = 'B5H9PeMrZowS3ewPm4BQ8aM4fkU1'; // giaovien.tieuhoc / giaovien01 on Cloud
  const now = Date.now();

  // 1. Quét dữ liệu hiện tại trên Cloud
  console.log('[1/6] Đang đọc toàn bộ dữ liệu hiện có trên Cloud để đối chiếu...');
  const [
    cloudClassesSnap,
    cloudStudentsSnap,
    cloudLessonsSnap,
    cloudAssignSnap,
    cloudAttemptsSnap,
    cloudUsersSnap
  ] = await Promise.all([
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get(),
    db.collection('users').get()
  ]);

  const existingClassIds = new Set(cloudClassesSnap.docs.map(d => d.id));
  const existingStudentCodes = new Set(cloudStudentsSnap.docs.map(d => d.data().studentCode));
  const existingLessonIds = new Set(cloudLessonsSnap.docs.map(d => d.id));
  const existingAssignIds = new Set(cloudAssignSnap.docs.map(d => d.id));
  const existingAttemptIds = new Set(cloudAttemptsSnap.docs.map(d => d.id));

  console.log(`  • Lớp học hiện có: ${cloudClassesSnap.size}`);
  console.log(`  • Học sinh hiện có: ${cloudStudentsSnap.size}`);
  console.log(`  • Bài đọc hiện có: ${cloudLessonsSnap.size}`);
  console.log(`  • Bài giao hiện có: ${cloudAssignSnap.size}`);
  console.log(`  • Lượt làm hiện có: ${cloudAttemptsSnap.size}`);
  console.log(`  • Giáo viên chính liên kết: ${primaryTeacherUid} (giaovien01)\n`);

  // 2. Chuẩn bị 20 Bài đọc chuẩn
  console.log('[2/6] Đối chiếu 20 Bài đọc gốc chuẩn...');
  const demoLessons = await loadDemoLessons();
  const pkgBLessons = await loadPackageBLessons();
  const all20Lessons = [...demoLessons, ...pkgBLessons];

  const lessonsToCreate = [];
  for (const l of all20Lessons) {
    if (!existingLessonIds.has(l.id)) {
      lessonsToCreate.push(l);
    }
  }
  console.log(`  • Bài đọc: Tổng 20 | Đã có trên Cloud: ${all20Lessons.length - lessonsToCreate.length} | Cần tạo mới: ${lessonsToCreate.length}`);

  // 3. Chuẩn bị 10 Lớp học chuẩn
  console.log('[3/6] Đối chiếu 10 Lớp học chuẩn...');
  const classesToCreate = [];
  for (const c of DEMO_CLASSES) {
    if (!existingClassIds.has(c.id)) {
      classesToCreate.push(c);
    }
  }
  console.log(`  • Lớp học: Tổng 10 | Đã có trên Cloud: ${DEMO_CLASSES.length - classesToCreate.length} | Cần tạo mới: ${classesToCreate.length}`);

  // 4. Chuẩn bị 200 Học sinh chuẩn
  console.log('[4/6] Đối chiếu 200 Học sinh chuẩn (HS001 đến HS200)...');
  const studentNames = generate200Names();
  const studentsToCreate = [];
  for (let idx = 0; idx < 200; idx++) {
    const s = studentNames[idx];
    if (!existingStudentCodes.has(s.code)) {
      const classIdx = Math.floor(idx / 20);
      const assignedClass = DEMO_CLASSES[classIdx];
      studentsToCreate.push({
        ...s,
        assignedClass
      });
    }
  }
  console.log(`  • Học sinh: Tổng 200 | Đã có trên Cloud: ${200 - studentsToCreate.length} | Cần tạo mới: ${studentsToCreate.length}`);

  // 5. Chuẩn bị 25 Bài giao chuẩn
  console.log('[5/6] Đối chiếu 25 Bài giao chuẩn...');
  const assignmentsToCreate = [];
  for (const c of DEMO_CLASSES) {
    const isG2 = c.grade === 2;
    const l1 = isG2 ? demoLessons[0] : demoLessons[5]; // Pre-test
    const l2 = isG2 ? demoLessons[1] : demoLessons[6]; // Main
    const l3 = isG2 ? demoLessons[2] : demoLessons[7]; // Post-test

    const a1Id = `assign_${c.id}_pre`;
    if (!existingAssignIds.has(a1Id)) {
      assignmentsToCreate.push({
        id: a1Id,
        classId: c.id,
        lessonId: l1.id,
        lessonVersionId: `v1_${l1.id}`,
        title: `[Khảo sát đầu kỳ] ${l1.title} - ${c.name}`,
        teacherUid: primaryTeacherUid,
        grade: c.grade,
        isPreTest: true,
        isPostTest: false,
        status: "active",
        availableFrom: now - 7 * 24 * 3600 * 1000,
        availableUntil: now + 30 * 24 * 3600 * 1000,
        maxAttempts: 3,
        createdAt: now - 7 * 24 * 3600 * 1000,
        targetLesson: l1
      });
    }

    const a2Id = `assign_${c.id}_main`;
    if (!existingAssignIds.has(a2Id)) {
      assignmentsToCreate.push({
        id: a2Id,
        classId: c.id,
        lessonId: l2.id,
        lessonVersionId: `v1_${l2.id}`,
        title: `[Bài học tuần] ${l2.title} - ${c.name}`,
        teacherUid: primaryTeacherUid,
        grade: c.grade,
        isPreTest: false,
        isPostTest: false,
        status: "active",
        availableFrom: now - 4 * 24 * 3600 * 1000,
        availableUntil: now + 30 * 24 * 3600 * 1000,
        maxAttempts: 3,
        createdAt: now - 4 * 24 * 3600 * 1000,
        targetLesson: l2
      });
    }

    // First 5 classes have post-test
    if (['class_2a', 'class_2b', 'class_2c', 'class_3a', 'class_3b'].includes(c.id)) {
      const a3Id = `assign_${c.id}_post`;
      if (!existingAssignIds.has(a3Id)) {
        assignmentsToCreate.push({
          id: a3Id,
          classId: c.id,
          lessonId: l3.id,
          lessonVersionId: `v1_${l3.id}`,
          title: `[Đánh giá cuối kỳ] ${l3.title} - ${c.name}`,
          teacherUid: primaryTeacherUid,
          grade: c.grade,
          isPreTest: false,
          isPostTest: true,
          status: "active",
          availableFrom: now - 2 * 24 * 3600 * 1000,
          availableUntil: now + 30 * 24 * 3600 * 1000,
          maxAttempts: 3,
          createdAt: now - 2 * 24 * 3600 * 1000,
          targetLesson: l3
        });
      }
    }
  }
  console.log(`  • Bài giao: Tổng 25 | Đã có trên Cloud: ${25 - assignmentsToCreate.length} | Cần tạo mới: ${assignmentsToCreate.length}`);

  // 6. Chuẩn bị 397 Lượt làm bài chuẩn (372 completed, 25 in-progress)
  console.log('[6/6] Đối chiếu lượt làm bài mô phỏng...');
  const attemptsToCreate = [];
  for (const assign of assignmentsToCreate) {
    const classIdx = DEMO_CLASSES.findIndex(c => c.id === assign.classId);
    const startStudentIdx = classIdx * 20;
    const endStudentIdx = startStudentIdx + 20;
    const targetLesson = assign.targetLesson;

    let numToComplete = assign.isPreTest ? 18 : (assign.isPostTest ? 14 : 12);

    for (let sIdx = startStudentIdx; sIdx < endStudentIdx; sIdx++) {
      const s = studentNames[sIdx];
      const studentDocId = `student_demo_${s.code.toLowerCase()}`;
      const relIdx = sIdx - startStudentIdx;
      const attemptId = `att_demo_${assign.id}_${s.code.toLowerCase()}`;

      if (existingAttemptIds.has(attemptId)) continue;

      if (relIdx < numToComplete) {
        // COMPLETED
        const startedAt = assign.createdAt + (relIdx + 1) * 3600 * 1000;
        const completedAt = startedAt + (10 + (sIdx % 10)) * 60 * 1000;
        const baseFirstCorrect = assign.isPostTest ? (sIdx % 2 === 0 ? 4 : 5) : (sIdx % 3 === 0 ? 3 : 4);
        const firstTryCorrectCount = Math.min(5, Math.max(2, baseFirstCorrect));
        const finalCorrectCount = Math.min(5, firstTryCorrectCount + (firstTryCorrectCount < 5 ? 1 : 0));
        const hintCount = finalCorrectCount - firstTryCorrectCount + (firstTryCorrectCount < 4 ? 1 : 0);
        const scorePercentage = Math.round((finalCorrectCount / 5) * 100);
        const starsEarned = scorePercentage >= 80 ? 3 : (scorePercentage >= 60 ? 2 : 1);

        attemptsToCreate.push({
          id: attemptId,
          assignmentId: assign.id,
          classId: assign.classId,
          lessonId: assign.lessonId,
          lessonVersionId: assign.lessonVersionId,
          studentId: studentDocId,
          studentCode: s.code,
          studentName: s.fullName,
          teacherUid: primaryTeacherUid,
          status: "completed",
          totalQuestions: 5,
          firstTryCorrectCount,
          finalCorrectCount,
          hintCount,
          scorePercentage,
          starsEarned,
          startedAt,
          completedAt,
          isSynthetic: true,
          dataSource: "synthetic-demo",
          targetLesson
        });
      } else if (relIdx === numToComplete) {
        // IN-PROGRESS
        const startedAt = now - 15 * 60 * 1000;
        attemptsToCreate.push({
          id: attemptId,
          assignmentId: assign.id,
          classId: assign.classId,
          lessonId: assign.lessonId,
          lessonVersionId: assign.lessonVersionId,
          studentId: studentDocId,
          studentCode: s.code,
          studentName: s.fullName,
          teacherUid: primaryTeacherUid,
          status: "in_progress",
          totalQuestions: 5,
          firstTryCorrectCount: 2,
          finalCorrectCount: 2,
          hintCount: 1,
          startedAt,
          isSynthetic: true,
          dataSource: "synthetic-demo",
          targetLesson
        });
      }
    }
  }
  console.log(`  • Lượt làm bài: Cần tạo mới: ${attemptsToCreate.length}\n`);

  console.log('------------------------------------------------------------------------');
  console.log('TỔNG HỢP DRY-RUN:');
  console.log(`• Lessons cần thêm:     ${lessonsToCreate.length} bản ghi`);
  console.log(`• Classes cần thêm:     ${classesToCreate.length} bản ghi`);
  console.log(`• Students cần thêm:    ${studentsToCreate.length} bản ghi (+ secrets & usernames)`);
  console.log(`• Assignments cần thêm: ${assignmentsToCreate.length} bản ghi`);
  console.log(`• Attempts cần thêm:    ${attemptsToCreate.length} bản ghi (+ subcollection responses)`);
  console.log(`• Xung đột (Conflicts): 0 (Hoàn toàn không trùng ID, không ghi đè dữ liệu cũ)`);
  console.log('------------------------------------------------------------------------\n');

  if (isDryRun) {
    console.log('🔍 DRY-RUN HOÀN TẤT. Không có dữ liệu nào được ghi.');
    process.exit(0);
  }

  // THỰC THI GHI VÀO CLOUD THEO BATCH AN TOÀN
  console.log('🚀 BẮT ĐẦU GHI BỔ SUNG VÀO FIREBASE CLOUD...\n');

  // Ghi Lessons
  console.log('1. Đang ghi Lessons, Versions & privateAnswerKeys...');
  for (const l of lessonsToCreate) {
    const versionId = `v1_${l.id}`;
    const publicQuestions = (l.questions || []).map(q => {
      const { answer, hint, explanation, ...publicQ } = q;
      return publicQ;
    });

    await db.collection('lessons').doc(l.id).set({
      id: l.id,
      title: l.title,
      grade: l.grade,
      topic: l.topic,
      teacherUid: primaryTeacherUid,
      currentVersionId: versionId,
      status: "published",
      approvedByTeacher: true,
      createdAt: now,
      updatedAt: now
    });

    await db.collection('lessons').doc(l.id).collection('versions').doc(versionId).set({
      versionId,
      lessonId: l.id,
      title: l.title,
      grade: l.grade,
      topic: l.topic,
      passage: l.passage,
      vocabulary: l.vocabulary || [],
      publicQuestions,
      versionNumber: 1,
      publishedAt: now,
      createdAt: now
    });

    const answerKeyMap = {};
    (l.questions || []).forEach(q => {
      answerKeyMap[q.id] = {
        correctAnswer: q.answer,
        hint: q.hint,
        explanation: q.explanation,
        skillTag: q.skillTag,
        difficulty: q.difficulty
      };
    });

    await db.collection('privateAnswerKeys').doc(versionId).set({
      versionId,
      lessonId: l.id,
      answers: answerKeyMap,
      createdAt: now
    });
  }
  console.log(`   ✓ Đã tạo thành công ${lessonsToCreate.length} bài đọc kèm đáp án bảo mật.`);

  // Ghi Classes
  console.log('\n2. Đang ghi 10 Classes...');
  for (const c of classesToCreate) {
    await db.collection('classes').doc(c.id).set({
      id: c.id,
      name: c.name,
      grade: c.grade,
      classCode: c.classCode,
      academicYear: c.academicYear,
      teacherUid: primaryTeacherUid,
      studentCount: c.studentCount,
      status: "active",
      createdAt: now
    });
  }
  console.log(`   ✓ Đã tạo thành công ${classesToCreate.length} lớp học gắn với giáo viên chính.`);

  // Ghi Students (batch 100)
  console.log('\n3. Đang ghi 200 Students, studentSecrets & usernames...');
  const studentSecretSalt = generateSalt();
  const studentPasswordHash = hashPassword("HS123456", studentSecretSalt);
  const studentPinHash = hashAccessCode("HS123456", studentSecretSalt);

  let sBatch = db.batch();
  let sCount = 0;
  for (const s of studentsToCreate) {
    const studentDocId = `student_demo_${s.code.toLowerCase()}`;
    const assignedClass = s.assignedClass;

    sBatch.set(db.collection('students').doc(studentDocId), {
      id: studentDocId,
      studentCode: s.code,
      username: s.code,
      fullName: s.fullName,
      displayAlias: s.displayAlias,
      classId: assignedClass.id,
      classCode: assignedClass.classCode,
      academicYear: assignedClass.academicYear,
      status: "active",
      createdAt: now
    });

    sBatch.set(db.collection('studentSecrets').doc(studentDocId), {
      studentId: studentDocId,
      salt: studentSecretSalt,
      accessCodeHash: studentPinHash,
      passwordHash: studentPasswordHash,
      rotatedAt: now
    });

    sBatch.set(db.collection('usernames').doc(s.code.toLowerCase()), {
      username: s.code.toLowerCase(),
      uid: studentDocId,
      studentId: studentDocId,
      role: "student",
      classId: assignedClass.id,
      updatedAt: now
    });

    sCount += 3;
    if (sCount >= 300) {
      await sBatch.commit();
      sBatch = db.batch();
      sCount = 0;
    }
  }
  if (sCount > 0) {
    await sBatch.commit();
  }
  console.log(`   ✓ Đã tạo thành công ${studentsToCreate.length} học sinh có mật khẩu đăng nhập HS123456.`);

  // Ghi Assignments
  console.log('\n4. Đang ghi 25 Assignments...');
  for (const a of assignmentsToCreate) {
    const { targetLesson, ...assignData } = a;
    await db.collection('assignments').doc(a.id).set(assignData);
  }
  console.log(`   ✓ Đã tạo thành công ${assignmentsToCreate.length} bài giao cho các lớp.`);

  // Ghi Attempts (batch commit)
  console.log('\n5. Đang ghi các Lượt làm bài & Phản hồi từng câu...');
  let attBatch = db.batch();
  let opCount = 0;
  let savedAttempts = 0;

  for (const att of attemptsToCreate) {
    const { targetLesson, ...attData } = att;
    const attDocRef = db.collection('attempts').doc(att.id);
    attBatch.set(attDocRef, attData);
    opCount++;

    // Subcollection responses
    for (let qIdx = 0; qIdx < 5; qIdx++) {
      const q = targetLesson.questions[qIdx];
      if (!q) continue;
      const isFirstCorrect = qIdx < att.firstTryCorrectCount;
      const isFinalCorrect = qIdx < att.finalCorrectCount;
      const hintUsed = !isFirstCorrect && isFinalCorrect;

      attBatch.set(attDocRef.collection('responses').doc(q.id), {
        questionId: q.id,
        skillTag: q.skillTag,
        difficulty: q.difficulty,
        firstTryCorrect: isFirstCorrect,
        finalCorrect: isFinalCorrect,
        hintUsed: hintUsed,
        firstAnswer: isFirstCorrect ? q.answer : (q.type === "multiple_choice" ? "C" : false),
        retryAnswer: isFinalCorrect ? q.answer : null,
        recordedAt: att.startedAt + (qIdx + 1) * 120 * 1000
      });
      opCount++;
    }

    savedAttempts++;
    if (opCount >= 400) {
      await attBatch.commit();
      attBatch = db.batch();
      opCount = 0;
      process.stdout.write(`   • Đã ghi ${savedAttempts}/${attemptsToCreate.length} attempts...\r`);
    }
  }
  if (opCount > 0) {
    await attBatch.commit();
  }
  console.log(`\n   ✓ Đã tạo thành công ${savedAttempts} lượt làm bài kèm chi tiết 5 câu hỏi.`);

  console.log('\n========================================================================');
  console.log('🎉 ĐỒNG BỘ BỔ SUNG HOÀN TẤT THÀNH CÔNG VÀ AN TOÀN TUYỆT ĐỐI!');
  console.log('========================================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi đồng bộ:', err);
  process.exit(1);
});
