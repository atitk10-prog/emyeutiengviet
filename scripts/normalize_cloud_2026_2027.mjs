import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const saFiles = fs.readdirSync(process.cwd()).filter(f => f.includes('adminsdk') && f.endsWith('.json'));
const sa = JSON.parse(fs.readFileSync(path.join(process.cwd(), saFiles[0]), 'utf8'));
const app = initializeApp({ credential: cert(sa) }, 'cloud-normalize-2026-2027');
const db = getFirestore(app);

const TEACHER_UID = 'B5H9PeMrZowS3ewPm4BQ8aM4fkU1';
const TARGET_YEAR = '2026-2027';

async function backupCloudData() {
  console.log('[1/5] Backing up Cloud collections before normalization...');
  const [classesSnap, studentsSnap, assignmentsSnap, attemptsSnap, aySnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get(),
    db.collection('academicYears').get()
  ]);

  const backupData = {
    timestamp: new Date().toISOString(),
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    students: studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    assignments: assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts: attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    academicYears: aySnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };

  const backupPath = path.join(process.cwd(), 'backups', 'cloud_pre_2026_normalization_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`Saved backup to ${backupPath} (${backupData.classes.length} classes, ${backupData.students.length} students, ${backupData.assignments.length} assignments, ${backupData.attempts.length} attempts).`);
}

async function dryRun() {
  console.log('\n[2/5] Running DRY-RUN verification...');

  const classesSnap = await db.collection('classes').get();
  console.log(`Classes to update to ${TARGET_YEAR}: ${classesSnap.size}`);

  const studentsSnap = await db.collection('students').get();
  console.log(`Students to update to ${TARGET_YEAR}: ${studentsSnap.size}`);

  const assignSnap = await db.collection('assignments').get();
  console.log(`Assignments to update to ${TARGET_YEAR}: ${assignSnap.size}`);

  const attemptsSnap = await db.collection('attempts').get();
  console.log(`Attempts to update to ${TARGET_YEAR}: ${attemptsSnap.size}`);

  // Foreign key / invariant checks
  const classIdSet = new Set(classesSnap.docs.map(d => d.id));
  const studentIdSet = new Set(studentsSnap.docs.map(d => d.id));
  const assignmentIdSet = new Set(assignSnap.docs.map(d => d.id));

  let brokenAssignmentClasses = 0;
  assignSnap.forEach(d => {
    if (!classIdSet.has(d.data().classId)) brokenAssignmentClasses++;
  });

  let brokenAttemptAssignments = 0;
  let brokenAttemptStudents = 0;
  let brokenAttemptClasses = 0;
  attemptsSnap.forEach(d => {
    const a = d.data();
    if (!assignmentIdSet.has(a.assignmentId)) brokenAttemptAssignments++;
    if (!studentIdSet.has(a.studentId)) brokenAttemptStudents++;
    if (a.classId && !classIdSet.has(a.classId)) brokenAttemptClasses++;
  });

  console.log('Invariant Checks:');
  console.log(`- Broken Assignment -> Class: ${brokenAssignmentClasses}`);
  console.log(`- Broken Attempt -> Assignment: ${brokenAttemptAssignments}`);
  console.log(`- Broken Attempt -> Student: ${brokenAttemptStudents}`);
  console.log(`- Broken Attempt -> Class: ${brokenAttemptClasses}`);

  if (brokenAssignmentClasses > 0 || brokenAttemptAssignments > 0 || brokenAttemptStudents > 0 || brokenAttemptClasses > 0) {
    throw new Error('Dry-run failed foreign key invariants check!');
  }
  console.log('DRY-RUN PASSED 100% INVARIANTS!');
}

async function applyNormalization() {
  console.log('\n[3/5] Applying normalization to Cloud Firestore...');

  // 1. Classes: 10 docs
  const classesSnap = await db.collection('classes').get();
  let bClasses = db.batch();
  classesSnap.forEach(d => {
    bClasses.update(d.ref, {
      academicYear: TARGET_YEAR,
      studentCount: 20,
      teacherUid: TEACHER_UID,
      updatedAt: Date.now()
    });
  });
  await bClasses.commit();
  console.log(`Updated ${classesSnap.size} classes to ${TARGET_YEAR} with studentCount = 20.`);

  // 2. Students: 200 docs
  const studentsSnap = await db.collection('students').get();
  let bStudents = db.batch();
  let opCount = 0;
  for (const d of studentsSnap.docs) {
    const s = d.data();
    const updatePayload = {
      academicYear: TARGET_YEAR,
      updatedAt: Date.now()
    };
    if (d.id === 'student_demo_hs001') {
      updatePayload.classId = 'class_2a';
      updatePayload.classCode = 'LOP2A0';
      updatePayload.previousClassId = null;
      updatePayload.transferredAt = null;
    }
    bStudents.update(d.ref, updatePayload);
    opCount++;
    if (opCount >= 400) {
      await bStudents.commit();
      bStudents = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) {
    await bStudents.commit();
  }
  console.log(`Updated ${studentsSnap.size} students to ${TARGET_YEAR} (HS001 restored to class_2a).`);

  // 3. Assignments: 26 docs
  const assignSnap = await db.collection('assignments').get();
  let bAssign = db.batch();
  assignSnap.forEach(d => {
    bAssign.update(d.ref, {
      academicYear: TARGET_YEAR,
      teacherUid: TEACHER_UID,
      updatedAt: Date.now()
    });
  });
  await bAssign.commit();
  console.log(`Updated ${assignSnap.size} assignments to ${TARGET_YEAR}.`);

  // 4. Attempts: 403 docs
  const attemptsSnap = await db.collection('attempts').get();
  let bAttempts = db.batch();
  opCount = 0;
  for (const d of attemptsSnap.docs) {
    bAttempts.update(d.ref, {
      academicYear: TARGET_YEAR,
      teacherUid: TEACHER_UID,
      updatedAt: Date.now()
    });
    opCount++;
    if (opCount >= 400) {
      await bAttempts.commit();
      bAttempts = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) {
    await bAttempts.commit();
  }
  console.log(`Updated ${attemptsSnap.size} attempts to ${TARGET_YEAR}.`);

  // 5. Academic Years collection
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
  console.log(`Created/updated academicYears doc: ${TARGET_YEAR}`);
}

async function verifyInvariantsPostApply() {
  console.log('\n[4/5] Verifying post-apply invariants in Cloud Firestore...');
  const [classesSnap, studentsSnap, assignSnap, attemptsSnap] = await Promise.all([
    db.collection('classes').get(),
    db.collection('students').get(),
    db.collection('assignments').get(),
    db.collection('attempts').get()
  ]);

  const classCounts = {};
  studentsSnap.forEach(d => {
    const cid = d.data().classId;
    classCounts[cid] = (classCounts[cid] || 0) + 1;
  });

  console.log('Students per class:');
  classesSnap.forEach(d => {
    console.log(`  ${d.id} (${d.data().name}): ${classCounts[d.id] || 0} students (year: ${d.data().academicYear})`);
  });

  const nonTargetClasses = classesSnap.docs.filter(d => d.data().academicYear !== TARGET_YEAR).length;
  const nonTargetStudents = studentsSnap.docs.filter(d => d.data().academicYear !== TARGET_YEAR).length;
  const nonTargetAssigns = assignSnap.docs.filter(d => d.data().academicYear !== TARGET_YEAR).length;
  const nonTargetAttempts = attemptsSnap.docs.filter(d => d.data().academicYear !== TARGET_YEAR).length;

  console.log('Year Audit:');
  console.log(`- Non-2026-2027 Classes: ${nonTargetClasses}`);
  console.log(`- Non-2026-2027 Students: ${nonTargetStudents}`);
  console.log(`- Non-2026-2027 Assignments: ${nonTargetAssigns}`);
  console.log(`- Non-2026-2027 Attempts: ${nonTargetAttempts}`);

  if (nonTargetClasses !== 0 || nonTargetStudents !== 0 || nonTargetAssigns !== 0 || nonTargetAttempts !== 0) {
    throw new Error('Post-apply verification failed: some records do not have academicYear 2026-2027!');
  }

  // Check every class has exactly 20 students
  for (const d of classesSnap.docs) {
    if (classCounts[d.id] !== 20) {
      throw new Error(`Class ${d.id} does not have 20 students! It has ${classCounts[d.id]}`);
    }
  }

  console.log('ALL 10 CLASSES HAVE EXACTLY 20 STUDENTS! 100% INVARIANTS SATISFIED!');
}

async function main() {
  await backupCloudData();
  await dryRun();
  await applyNormalization();
  await verifyInvariantsPostApply();
  console.log('\n[5/5] NORMALIZATION COMPLETED SUCCESSFULLY!');
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR:', e); process.exit(1); });
