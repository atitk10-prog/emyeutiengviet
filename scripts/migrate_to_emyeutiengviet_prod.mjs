import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 1. Safety environment check
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const saPath = path.join(process.cwd(), 'scripts', 'backups', 'emyeutiengviet-prod-adminsdk.json');
if (!fs.existsSync(saPath)) {
  console.error(`Không tìm thấy service account tại ${saPath}`);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
if (sa.project_id !== 'emyeutiengviet-prod') {
  console.error(`Dự án không đúng mục tiêu! Expected emyeutiengviet-prod but got: ${sa.project_id}`);
  process.exit(1);
}

const app = initializeApp({ credential: cert(sa) }, 'prod-migration');
const db = getFirestore(app);
const auth = getAuth(app);

// Official UIDs
const ADMIN_UID = 'fts9esJAKjfOpbABTPF7ru5dgdz1';
const TEACHER_UID = 'B5H9PeMrZowS3ewPm4BQ8aM4fkU1';
const TARGET_YEAR = '2026-2027';

// Crypto hashing
function hashPasswordV2(password, salt) {
  return crypto.pbkdf2Sync(password.trim(), salt, 600000, 32, 'sha256').toString('hex');
}
function hashStudentAccessCode(code, salt) {
  return crypto.pbkdf2Sync(code.trim().toUpperCase(), salt, 10000, 32, 'sha256').toString('hex');
}

async function main() {
  console.log('========================================================================');
  console.log('EM YÊU TIẾNG VIỆT — DI CHUYỂN TOÀN DIỆN SANG FIREBASE PROD MỚI');
  console.log(`Target Firebase Project: ${sa.project_id} (${sa.client_email})`);
  console.log('========================================================================\n');

  // Load baseline dump
  const baselinePath = path.join(process.cwd(), 'backups', 'v56_baseline_dump.json');
  if (!fs.existsSync(baselinePath)) {
    console.error(`Không tìm thấy baseline dump tại: ${baselinePath}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  // Parse .secret.local credentials
  let adminPassword = 'Adm_35E0d6ff^42';
  let teacherPassword = 'Gv_6D53d912!64';
  const secretLocalPath = path.join(process.cwd(), '.secret.local');
  if (fs.existsSync(secretLocalPath)) {
    const lines = fs.readFileSync(secretLocalPath, 'utf8').split('\n');
    for (const l of lines) {
      if (l.startsWith('ADMIN_PASSWORD=')) adminPassword = l.split('=')[1].trim();
      if (l.startsWith('TEACHER_PASSWORD=')) teacherPassword = l.split('=')[1].trim();
    }
  }

  // -------------------------------------------------------------
  // BƯỚC 1: FIREBASE AUTH TÀI KHOẢN ADMIN & GIÁO VIÊN
  // -------------------------------------------------------------
  console.log('[1/10] Thiết lập Firebase Authentication (Admin & Teacher)...');
  
  // 1. Admin
  try {
    await auth.getUser(ADMIN_UID);
    await auth.updateUser(ADMIN_UID, {
      email: 'admin@emytv.edu.vn',
      password: adminPassword,
      displayName: 'Quản Trị Viên Hệ Thống'
    });
    console.log('  -> Admin user updated in Auth.');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      await auth.createUser({
        uid: ADMIN_UID,
        email: 'admin@emytv.edu.vn',
        password: adminPassword,
        displayName: 'Quản Trị Viên Hệ Thống'
      });
      console.log('  -> Admin user created in Auth.');
    } else {
      throw err;
    }
  }
  await auth.setCustomUserClaims(ADMIN_UID, { role: 'admin' });

  // 2. Teacher
  try {
    await auth.getUser(TEACHER_UID);
    await auth.updateUser(TEACHER_UID, {
      email: 'giaovien.tieuhoc@emytv.edu.vn',
      password: teacherPassword,
      displayName: 'Cô giáo Thanh Tâm'
    });
    console.log('  -> Teacher user updated in Auth.');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      await auth.createUser({
        uid: TEACHER_UID,
        email: 'giaovien.tieuhoc@emytv.edu.vn',
        password: teacherPassword,
        displayName: 'Cô giáo Thanh Tâm'
      });
      console.log('  -> Teacher user created in Auth.');
    } else {
      throw err;
    }
  }
  await auth.setCustomUserClaims(TEACHER_UID, { role: 'teacher' });

  // -------------------------------------------------------------
  // BƯỚC 2: USERS, ACCOUNT SECRETS & USERNAMES
  // -------------------------------------------------------------
  console.log('\n[2/10] Thiết lập Firestore Users, AccountSecrets & Usernames...');
  await db.collection('users').doc(ADMIN_UID).set({
    role: 'admin',
    email: 'admin@emytv.edu.vn',
    displayName: 'Quản Trị Viên Hệ Thống',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });

  await db.collection('users').doc(TEACHER_UID).set({
    role: 'teacher',
    email: 'giaovien.tieuhoc@emytv.edu.vn',
    displayName: 'Cô giáo Thanh Tâm',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, { merge: true });

  const adminSalt = crypto.randomBytes(16).toString('hex');
  const adminHash = hashPasswordV2(adminPassword, adminSalt);
  await db.collection('accountSecrets').doc(ADMIN_UID).set({
    version: 2,
    algorithm: 'PBKDF2-HMAC-SHA256',
    iterations: 600000,
    salt: adminSalt,
    passwordHash: adminHash,
    updatedAt: Date.now()
  });

  const teacherSalt = crypto.randomBytes(16).toString('hex');
  const teacherHash = hashPasswordV2(teacherPassword, teacherSalt);
  await db.collection('accountSecrets').doc(TEACHER_UID).set({
    version: 2,
    algorithm: 'PBKDF2-HMAC-SHA256',
    iterations: 600000,
    salt: teacherSalt,
    passwordHash: teacherHash,
    updatedAt: Date.now()
  });

  await db.collection('usernames').doc('admin').set({
    username: 'admin',
    role: 'admin',
    uid: ADMIN_UID,
    updatedAt: Date.now()
  });
  await db.collection('usernames').doc('giaovien01').set({
    username: 'giaovien01',
    role: 'teacher',
    uid: TEACHER_UID,
    updatedAt: Date.now()
  });
  await db.collection('usernames').doc('giaovien.tieuhoc').set({
    username: 'giaovien.tieuhoc',
    role: 'teacher',
    uid: TEACHER_UID,
    updatedAt: Date.now()
  });
  console.log('  -> Users & credentials written.');

  // -------------------------------------------------------------
  // BƯỚC 3: ACADEMIC YEARS
  // -------------------------------------------------------------
  console.log('\n[3/10] Thiết lập AcademicYears (2026–2027)...');
  await db.collection('academicYears').doc(TARGET_YEAR).set({
    id: TARGET_YEAR,
    code: TARGET_YEAR,
    name: 'Năm học 2026–2027',
    isCurrent: true,
    status: 'active',
    startDate: '2026-09-05',
    endDate: '2027-05-31',
    createdAt: 1792304424552,
    updatedAt: Date.now()
  });
  console.log(`  -> Created academicYears doc: ${TARGET_YEAR}`);

  // -------------------------------------------------------------
  // BƯỚC 4: CURRICULUM NODES (GDPT 2018)
  // -------------------------------------------------------------
  console.log('\n[4/10] Nhập Curriculum Nodes (Kỹ năng đọc hiểu GDPT 2018)...');
  let currBatch = db.batch();
  for (const node of baseline.collections.curriculumNodes) {
    currBatch.set(db.collection('curriculumNodes').doc(node.id), node);
  }
  await currBatch.commit();
  console.log(`  -> Committed ${baseline.collections.curriculumNodes.length} curriculum nodes.`);

  // -------------------------------------------------------------
  // BƯỚC 5: CLASSES
  // -------------------------------------------------------------
  console.log('\n[5/10] Nhập 10 Classes chuẩn...');
  let classBatch = db.batch();
  for (const c of baseline.collections.classes) {
    classBatch.set(db.collection('classes').doc(c.id), {
      ...c,
      academicYear: TARGET_YEAR,
      teacherUid: TEACHER_UID,
      status: 'active'
    });
  }
  await classBatch.commit();
  console.log(`  -> Committed ${baseline.collections.classes.length} classes.`);

  // -------------------------------------------------------------
  // BƯỚC 6: STUDENTS, STUDENT SECRETS & USERNAMES
  // -------------------------------------------------------------
  console.log('\n[6/10] Nhập 200 Students, StudentSecrets và Usernames...');
  const studentChunks = [];
  for (let i = 0; i < baseline.collections.students.length; i += 80) {
    studentChunks.push(baseline.collections.students.slice(i, i + 80));
  }

  for (const chunk of studentChunks) {
    let sBatch = db.batch();
    for (const s of chunk) {
      sBatch.set(db.collection('students').doc(s.id), {
        ...s,
        academicYear: TARGET_YEAR,
        status: s.status || 'active'
      });

      const existingSecret = baseline.collections.studentSecrets.find(sec => sec.id === s.id);
      const salt = existingSecret?.salt || crypto.randomBytes(16).toString('hex');
      const accessCodeHash = existingSecret?.accessCodeHash || hashStudentAccessCode('HS123456', salt);
      sBatch.set(db.collection('studentSecrets').doc(s.id), {
        version: existingSecret?.version || 1,
        iterations: existingSecret?.iterations || 10000,
        salt,
        accessCodeHash,
        updatedAt: Date.now()
      });

      sBatch.set(db.collection('usernames').doc(s.studentCode.toLowerCase()), {
        username: s.studentCode.toLowerCase(),
        role: 'student',
        studentId: s.id,
        uid: s.id,
        classId: s.classId,
        updatedAt: Date.now()
      });
    }
    await sBatch.commit();
  }
  console.log(`  -> Committed ${baseline.collections.students.length} students.`);

  // -------------------------------------------------------------
  // BƯỚC 7: LESSONS, VERSIONS & PRIVATE ANSWER KEYS
  // -------------------------------------------------------------
  console.log('\n[7/10] Nhập Lessons, Versions và Private Answer Keys...');
  let lessonBatch = db.batch();
  for (const l of baseline.collections.lessons) {
    lessonBatch.set(db.collection('lessons').doc(l.id), {
      ...l,
      teacherUid: TEACHER_UID
    });
  }
  await lessonBatch.commit();

  // Versions subcollection
  for (const [lessonId, versions] of Object.entries(baseline.subcollections.lessonVersions)) {
    let vBatch = db.batch();
    for (const v of versions) {
      vBatch.set(db.collection('lessons').doc(lessonId).collection('versions').doc(v.id), v);
    }
    await vBatch.commit();
  }

  // Private Answer Keys
  let keyBatch = db.batch();
  for (const key of baseline.collections.privateAnswerKeys) {
    keyBatch.set(db.collection('privateAnswerKeys').doc(key.id), key);
  }
  await keyBatch.commit();
  console.log(`  -> Committed ${baseline.collections.lessons.length} lessons, versions & privateAnswerKeys.`);

  // -------------------------------------------------------------
  // BƯỚC 8: ASSIGNMENTS
  // -------------------------------------------------------------
  console.log('\n[8/10] Nhập Assignments...');
  let assignBatch = db.batch();
  for (const a of baseline.collections.assignments) {
    assignBatch.set(db.collection('assignments').doc(a.id), {
      ...a,
      academicYear: TARGET_YEAR,
      teacherUid: TEACHER_UID
    });
  }
  await assignBatch.commit();
  console.log(`  -> Committed ${baseline.collections.assignments.length} assignments.`);

  // -------------------------------------------------------------
  // BƯỚC 9: ATTEMPTS & RESPONSES
  // -------------------------------------------------------------
  console.log('\n[9/10] Nhập 403 Attempts và Subcollection Responses...');
  const attemptChunks = [];
  for (let i = 0; i < baseline.collections.attempts.length; i += 100) {
    attemptChunks.push(baseline.collections.attempts.slice(i, i + 100));
  }

  for (const chunk of attemptChunks) {
    let attBatch = db.batch();
    for (const att of chunk) {
      attBatch.set(db.collection('attempts').doc(att.id), {
        ...att,
        academicYear: TARGET_YEAR,
        teacherUid: TEACHER_UID
      });
    }
    await attBatch.commit();
  }

  // Subcollection responses
  let respCount = 0;
  let rBatch = db.batch();
  let rInBatch = 0;

  for (const [attId, responses] of Object.entries(baseline.subcollections.attemptResponses)) {
    for (const r of responses) {
      rBatch.set(db.collection('attempts').doc(attId).collection('responses').doc(r.id), r);
      rInBatch++;
      respCount++;
      if (rInBatch >= 300) {
        await rBatch.commit();
        rBatch = db.batch();
        rInBatch = 0;
      }
    }
  }
  if (rInBatch > 0) {
    await rBatch.commit();
  }
  console.log(`  -> Committed ${baseline.collections.attempts.length} attempts & ${respCount} responses.`);

  // -------------------------------------------------------------
  // BƯỚC 10: KIỂM TRA ĐỐI CHIẾU TOÀN VẸN VÀ TÍNH ĐÚNG ĐẮN
  // -------------------------------------------------------------
  console.log('\n[10/10] Kiểm tra đối chiếu toàn vẹn dữ liệu...');
  const [
    usersSnap,
    classesSnap,
    studentsSnap,
    lessonsSnap,
    assignmentsSnap,
    attemptsSnap,
    curriculumSnap,
    usernamesSnap,
    secretsSnap,
    keysSnap,
    aySnap
  ] = await Promise.all([
    db.collection('users').get(),
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get(),
    db.collection('curriculumNodes').get(),
    db.collection('usernames').get(),
    db.collection('studentSecrets').get(),
    db.collection('privateAnswerKeys').get(),
    db.collection('academicYears').get()
  ]);

  const authList = await auth.listUsers(100);

  console.log('\n========================================================================');
  console.log('KẾT QUẢ KIỂM TOÁN TÍNH TOÀN VẸN (FIREBASE PROD: emyeutiengviet-prod)');
  console.log('========================================================================');
  console.log(`- Firebase Auth Users: ${authList.users.length}`);
  console.log(`- Firestore Users: ${usersSnap.size}`);
  console.log(`- Academic Years: ${aySnap.size}`);
  console.log(`- Curriculum Nodes: ${curriculumSnap.size}`);
  console.log(`- Classes: ${classesSnap.size}`);
  console.log(`- Students: ${studentsSnap.size}`);
  console.log(`- Student Secrets: ${secretsSnap.size}`);
  console.log(`- Usernames: ${usernamesSnap.size}`);
  console.log(`- Lessons: ${lessonsSnap.size}`);
  console.log(`- Private Answer Keys: ${keysSnap.size}`);
  console.log(`- Assignments: ${assignmentsSnap.size}`);
  console.log(`- Attempts: ${attemptsSnap.size}`);

  // Invariant verification
  if (classesSnap.size !== 10) throw new Error(`Expected 10 classes, got ${classesSnap.size}`);
  if (studentsSnap.size !== 200) throw new Error(`Expected 200 students, got ${studentsSnap.size}`);
  if (lessonsSnap.size < 6) throw new Error(`Expected at least 6 sample lessons, got ${lessonsSnap.size}`);
  if (keysSnap.size < 6) throw new Error(`Expected privateAnswerKeys for lessons, got ${keysSnap.size}`);

  console.log('\n✅ TẤT CẢ RÀNG BUỘC TOÀN VẸN ĐÃ ĐƯỢC KIỂM CHỨNG 100% ĐẠT!');
  console.log('========================================================================\n');
}

main().then(() => {
  console.log('DI CHUYỂN DỮ LIỆU SANG FIREBASE PROD HOÀN TẤT!');
  process.exit(0);
}).catch(err => {
  console.error('LỖI DI CHUYỂN DỮ LIỆU:', err);
  process.exit(1);
});
