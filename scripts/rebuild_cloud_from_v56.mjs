import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const isDryRun = process.argv.includes('--dry-run');

// 1. Safety environment check
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const saFiles = fs.readdirSync(process.cwd()).filter(f => f.includes('adminsdk') && f.endsWith('.json'));
if (saFiles.length === 0) {
  console.error('Không tìm thấy service account');
  process.exit(1);
}
const saPath = path.join(process.cwd(), saFiles[0]);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

if (sa.project_id !== 'em-yeu-tieng-viet---staging') {
  console.error(`Dự án không đúng mục tiêu! Expected em-yeu-tieng-viet---staging but got: ${sa.project_id}`);
  process.exit(1);
}

const app = initializeApp({ credential: cert(sa) }, 'cloud-rebuild');
const db = getFirestore(app);
const auth = getAuth(app);

// Official Cloud UIDs
const ADMIN_UID = 'fts9esJAKjfOpbABTPF7ru5dgdz1';
const TEACHER_UID = 'B5H9PeMrZowS3ewPm4BQ8aM4fkU1';

// Crypto hashing
function hashPasswordV2(password, salt) {
  return crypto.pbkdf2Sync(password.trim(), salt, 600000, 32, 'sha256').toString('hex');
}
function hashStudentAccessCode(code, salt) {
  return crypto.pbkdf2Sync(code.trim().toUpperCase(), salt, 10000, 32, 'sha256').toString('hex');
}

// Helper to batch delete all documents in a collection
async function clearCollection(colName, exceptDocIds = []) {
  const snap = await db.collection(colName).get();
  console.log(`Clearing [${colName}]: found ${snap.size} documents...`);
  let deletedCount = 0;
  const batchSize = 400;
  let batch = db.batch();
  let countInBatch = 0;

  for (const doc of snap.docs) {
    if (exceptDocIds.includes(doc.id)) {
      continue;
    }
    batch.delete(doc.ref);
    countInBatch++;
    deletedCount++;

    if (countInBatch >= batchSize) {
      if (!isDryRun) await batch.commit();
      batch = db.batch();
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) {
    if (!isDryRun) await batch.commit();
  }

  console.log(`  -> Deleted ${deletedCount} documents from [${colName}].`);
  return deletedCount;
}

// Helper to clear subcollections for a parent collection
async function clearSubcollections(parentColName, subColName) {
  const snap = await db.collection(parentColName).get();
  let deletedCount = 0;
  for (const doc of snap.docs) {
    const subSnap = await doc.ref.collection(subColName).get();
    if (!subSnap.empty) {
      let batch = db.batch();
      let count = 0;
      for (const subDoc of subSnap.docs) {
        batch.delete(subDoc.ref);
        count++;
        deletedCount++;
        if (count >= 400) {
          if (!isDryRun) await batch.commit();
          batch = db.batch();
          count = 0;
        }
      }
      if (count > 0) {
        if (!isDryRun) await batch.commit();
      }
    }
  }
  console.log(`  -> Deleted ${deletedCount} documents from subcollection [${parentColName}/*/${subColName}].`);
  return deletedCount;
}

async function main() {
  console.log('========================================================================');
  console.log('EM YÊU TIẾNG VIỆT — DỰNG LẠI FIREBASE CLOUD TỪ BẢN LOCAL V5.6');
  console.log(`Chế độ: ${isDryRun ? '🔍 DRY-RUN (KIỂM TRA - KHÔNG GHI/XÓA DỮ LIỆU)' : '🚀 LIVE REBUILD (THỰC HIỆN XÓA VÀ NHẬP THẬT)'}`);
  console.log(`Project: ${sa.project_id}`);
  console.log('========================================================================\n');

  // Load baseline dump
  const baselinePath = path.join(process.cwd(), 'backups', 'v56_baseline_dump.json');
  if (!fs.existsSync(baselinePath)) {
    console.error(`Không tìm thấy file baseline dump: ${baselinePath}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  console.log('Tải thành công bản chuẩn V5.6:');
  console.log(`  Classes: ${baseline.collections.classes.length}`);
  console.log(`  Students: ${baseline.collections.students.length}`);
  console.log(`  Lessons: ${baseline.collections.lessons.length}`);
  console.log(`  Assignments: ${baseline.collections.assignments.length}`);
  console.log(`  Attempts: ${baseline.collections.attempts.length}`);
  console.log(`  CurriculumNodes: ${baseline.collections.curriculumNodes.length}\n`);

  // Parse .secret.local for secure credentials
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
  // PHẦN 1: DỌN DẸP DỮ LIỆU CŨ VÀ TÀI KHOẢN TEST TRÊN CLOUD
  // -------------------------------------------------------------
  console.log('\n--- BƯỚC 1: DỌN DẸP SUBCOLLECTIONS CŨ TRÊN CLOUD ---');
  await clearSubcollections('lessons', 'versions');
  await clearSubcollections('attempts', 'responses');

  console.log('\n--- BƯỚC 2: DỌN DẸP CÁC ROOT COLLECTIONS CŨ TRÊN CLOUD ---');
  const collectionsToClear = [
    'assignments',
    'attempts',
    'classes',
    'privateAnswerKeys',
    'remediationActivities',
    'studentSecrets',
    'studentSessions',
    'students',
    'usernames',
    'loginAttempts',
    'lessons'
  ];
  for (const col of collectionsToClear) {
    await clearCollection(col);
  }

  // Users: clear all except ADMIN_UID and TEACHER_UID
  await clearCollection('users', [ADMIN_UID, TEACHER_UID]);
  // AccountSecrets: clear all except ADMIN_UID and TEACHER_UID
  await clearCollection('accountSecrets', [ADMIN_UID, TEACHER_UID]);

  console.log('\n--- BƯỚC 3: DỌN DẸP TÀI KHOẢN FIREBASE AUTH TEST/ORPHAN ---');
  let authUsers = [];
  let pageToken;
  do {
    const list = await auth.listUsers(1000, pageToken);
    authUsers.push(...list.users);
    pageToken = list.pageToken;
  } while (pageToken);

  console.log(`Found ${authUsers.length} total Auth users on Cloud.`);
  let deletedAuthCount = 0;
  for (const u of authUsers) {
    if (u.uid === ADMIN_UID || u.uid === TEACHER_UID) {
      continue;
    }
    console.log(`  Deleting orphan Auth user: [${u.uid}] ${u.email || u.displayName || 'anonymous'}`);
    if (!isDryRun) {
      await auth.deleteUser(u.uid);
    }
    deletedAuthCount++;
  }
  console.log(`  -> Deleted ${deletedAuthCount} orphan/test Auth accounts.`);

  // Ensure Admin & Teacher custom claims
  if (!isDryRun) {
    await auth.setCustomUserClaims(ADMIN_UID, { role: 'admin' });
    await auth.setCustomUserClaims(TEACHER_UID, { role: 'teacher' });
  }
  console.log('  -> Verified custom claims: Admin & Teacher.');

  // -------------------------------------------------------------
  // PHẦN 2: NHẬP DỮ LIỆU CHUẨN V5.6 VÀO CLOUD THEO PHỤ THUỘC
  // -------------------------------------------------------------
  console.log('\n--- BƯỚC 4: THIẾT LẬP USERS, ACCOUNT SECRETS & USERNAMES ---');
  // 1. users
  if (!isDryRun) {
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

    // 2. accountSecrets
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

    // 3. usernames
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
  }
  console.log('  -> Initialized Admin & Teacher users, secrets, and usernames.');

  // 4. curriculumNodes
  console.log('\n--- BƯỚC 5: NHẬP 11 CURRICULUM NODES ---');
  let currBatch = db.batch();
  for (const node of baseline.collections.curriculumNodes) {
    currBatch.set(db.collection('curriculumNodes').doc(node.id), node);
  }
  if (!isDryRun) await currBatch.commit();
  console.log(`  -> Committed ${baseline.collections.curriculumNodes.length} curriculum nodes.`);

  // 5. classes
  console.log('\n--- BƯỚC 6: NHẬP 10 CLASSES CHUẨN (GẮN TEACHER_UID) ---');
  let classBatch = db.batch();
  for (const c of baseline.collections.classes) {
    const classData = {
      ...c,
      teacherUid: TEACHER_UID,
      status: 'active'
    };
    classBatch.set(db.collection('classes').doc(c.id), classData);
  }
  if (!isDryRun) await classBatch.commit();
  console.log(`  -> Committed ${baseline.collections.classes.length} classes.`);

  // 6. students & studentSecrets & student usernames
  console.log('\n--- BƯỚC 7: NHẬP 200 STUDENTS, SECRETS VÀ USERNAMES ---');
  const studentChunks = [];
  for (let i = 0; i < baseline.collections.students.length; i += 100) {
    studentChunks.push(baseline.collections.students.slice(i, i + 100));
  }

  for (const chunk of studentChunks) {
    let sBatch = db.batch();
    for (const s of chunk) {
      sBatch.set(db.collection('students').doc(s.id), {
        ...s,
        status: s.status || 'active'
      });

      // Secret
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

      // Username
      sBatch.set(db.collection('usernames').doc(s.studentCode.toLowerCase()), {
        username: s.studentCode.toLowerCase(),
        role: 'student',
        studentId: s.id,
        uid: s.id,
        classId: s.classId,
        updatedAt: Date.now()
      });
    }
    if (!isDryRun) await sBatch.commit();
  }
  console.log(`  -> Committed ${baseline.collections.students.length} students, secrets & usernames.`);

  // 7. lessons & versions & privateAnswerKeys
  console.log('\n--- BƯỚC 8: NHẬP 20 LESSONS, 21 VERSIONS VÀ 22 PRIVATE ANSWER KEYS ---');
  let lessonBatch = db.batch();
  for (const l of baseline.collections.lessons) {
    lessonBatch.set(db.collection('lessons').doc(l.id), {
      ...l,
      teacherUid: TEACHER_UID
    });
  }
  if (!isDryRun) await lessonBatch.commit();

  // Versions
  for (const [lessonId, versions] of Object.entries(baseline.subcollections.lessonVersions)) {
    let vBatch = db.batch();
    for (const v of versions) {
      vBatch.set(db.collection('lessons').doc(lessonId).collection('versions').doc(v.id), v);
    }
    if (!isDryRun) await vBatch.commit();
  }

  // Private Answer Keys
  let keyBatch = db.batch();
  for (const key of baseline.collections.privateAnswerKeys) {
    keyBatch.set(db.collection('privateAnswerKeys').doc(key.id), key);
  }
  if (!isDryRun) await keyBatch.commit();
  console.log(`  -> Committed 20 lessons, 21 versions, and 22 private answer keys.`);

  // 8. assignments
  console.log('\n--- BƯỚC 9: NHẬP 26 ASSIGNMENTS ---');
  let assignBatch = db.batch();
  for (const a of baseline.collections.assignments) {
    assignBatch.set(db.collection('assignments').doc(a.id), {
      ...a,
      teacherUid: TEACHER_UID
    });
  }
  if (!isDryRun) await assignBatch.commit();
  console.log(`  -> Committed ${baseline.collections.assignments.length} assignments.`);

  // 9. attempts & subcollection responses
  console.log('\n--- BƯỚC 10: NHẬP 403 ATTEMPTS VÀ 1,930 RESPONSES ---');
  const attemptChunks = [];
  for (let i = 0; i < baseline.collections.attempts.length; i += 100) {
    attemptChunks.push(baseline.collections.attempts.slice(i, i + 100));
  }

  for (const chunk of attemptChunks) {
    let attBatch = db.batch();
    for (const att of chunk) {
      attBatch.set(db.collection('attempts').doc(att.id), att);
    }
    if (!isDryRun) await attBatch.commit();
  }

  // Responses subcollection
  let respCount = 0;
  let rBatch = db.batch();
  let rInBatch = 0;

  for (const [attId, responses] of Object.entries(baseline.subcollections.attemptResponses)) {
    for (const r of responses) {
      rBatch.set(db.collection('attempts').doc(attId).collection('responses').doc(r.id), r);
      rInBatch++;
      respCount++;
      if (rInBatch >= 400) {
        if (!isDryRun) await rBatch.commit();
        rBatch = db.batch();
        rInBatch = 0;
      }
    }
  }
  if (rInBatch > 0) {
    if (!isDryRun) await rBatch.commit();
  }
  console.log(`  -> Committed ${baseline.collections.attempts.length} attempts and ${respCount} responses.`);

  // -------------------------------------------------------------
  // PHẦN 3: KIỂM TOÁN VÀ ĐỐI CHIẾU SAU KHI DỰNG LẠI
  // -------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('KIỂM TRA TÍNH TOÀN VẸN VÀ ĐỒNG NHẤT SAU KHI DỰNG LẠI CLOUD');
  console.log('========================================================================');

  const [
    finalUsersSnap,
    finalClassesSnap,
    finalStudentsSnap,
    finalLessonsSnap,
    finalAssignmentsSnap,
    finalAttemptsSnap,
    finalCurriculumSnap,
    finalUsernamesSnap,
    finalSecretsSnap
  ] = await Promise.all([
    db.collection('users').get(),
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('lessons').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get(),
    db.collection('curriculumNodes').get(),
    db.collection('usernames').get(),
    db.collection('accountSecrets').get()
  ]);

  let finalAuth = [];
  pageToken = undefined;
  do {
    const list = await auth.listUsers(1000, pageToken);
    finalAuth.push(...list.users);
    pageToken = list.pageToken;
  } while (pageToken);

  console.log(`- Auth Users: ${finalAuth.length} (Admin: ${finalAuth.filter(u => u.uid === ADMIN_UID).length}, Teacher: ${finalAuth.filter(u => u.uid === TEACHER_UID).length})`);
  console.log(`- Firestore Users: ${finalUsersSnap.size}`);
  console.log(`- Account Secrets: ${finalSecretsSnap.size}`);
  console.log(`- Usernames: ${finalUsernamesSnap.size}`);
  console.log(`- Classes: ${finalClassesSnap.size}`);
  console.log(`- Students: ${finalStudentsSnap.size}`);
  console.log(`- Lessons: ${finalLessonsSnap.size}`);
  console.log(`- Assignments: ${finalAssignmentsSnap.size}`);
  console.log(`- Attempts: ${finalAttemptsSnap.size}`);
  console.log(`- Curriculum Nodes: ${finalCurriculumSnap.size}`);

  const activeTeachers = finalUsersSnap.docs.filter(d => d.data().role === 'teacher');
  const activeAdmins = finalUsersSnap.docs.filter(d => d.data().role === 'admin');
  console.log(`- Active Teachers in Firestore: ${activeTeachers.length}`);
  console.log(`- Active Admins in Firestore: ${activeAdmins.length}`);
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('Lỗi xây dựng lại Cloud:', err);
  process.exit(1);
});
