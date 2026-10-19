const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'em-yeu-tieng-viet-demo' });
}

const db = admin.firestore();

async function runTests() {
  console.log('=== TEST PACKAGE B: HOÀN THIỆN KHO HỌC LIỆU V5.4 ===\n');

  // Test 1: Count lessons by grade and semester
  const lessonsSnap = await db.collection('lessons').get();
  console.log(`[TEST 1] Total lessons: ${lessonsSnap.size}`);
  if (lessonsSnap.size !== 20) {
    throw new Error(`Expected 20 lessons, found ${lessonsSnap.size}`);
  }

  const counts = { '2_1': 0, '2_2': 0, '3_1': 0, '3_2': 0 };
  const lessonList = [];
  lessonsSnap.forEach((doc) => {
    const d = doc.data();
    const key = `${d.grade}_${d.semester || 1}`;
    counts[key] = (counts[key] || 0) + 1;
    lessonList.push({ id: doc.id, title: d.title, grade: d.grade, semester: d.semester, week: d.week, genre: d.genre, currentVersionId: d.currentVersionId });
  });

  console.log('Lesson distribution:', counts);
  if (counts['2_1'] !== 5 || counts['2_2'] !== 5 || counts['3_1'] !== 5 || counts['3_2'] !== 5) {
    throw new Error(`Distribution mismatch: ${JSON.stringify(counts)}`);
  }
  console.log('✅ TEST 1 PASSED: Exactly 5 lessons per grade and semester (20 total).');

  // Test 2: Check 10 original lessons preserved
  const originalIds = [
    'lesson_g2_01', 'lesson_g2_02', 'lesson_g2_03', 'lesson_g2_04', 'lesson_g2_05',
    'lesson_g3_01', 'lesson_g3_02', 'lesson_g3_03', 'lesson_g3_04', 'lesson_g3_05'
  ];
  for (const oid of originalIds) {
    const doc = await db.collection('lessons').doc(oid).get();
    if (!doc.exists) {
      throw new Error(`Original lesson ${oid} missing!`);
    }
  }
  console.log('✅ TEST 2 PASSED: All 10 original lessons preserved.');

  // Test 3: Check privateAnswerKeys exist for all 20 lessons
  let missingKeys = 0;
  for (const l of lessonList) {
    const pKeyDoc = await db.collection('privateAnswerKeys').doc(l.currentVersionId).get();
    if (!pKeyDoc.exists) {
      console.error(`Missing privateAnswerKey for ${l.id} (${l.currentVersionId})`);
      missingKeys++;
    }
  }
  if (missingKeys > 0) {
    throw new Error(`Missing ${missingKeys} private answer keys!`);
  }
  console.log('✅ TEST 3 PASSED: All 20 lessons have valid private answer keys.');

  // Test 4: Check student counts and attempts preserved
  const studentsSnap = await db.collection('students').get();
  console.log(`[TEST 4] Total students: ${studentsSnap.size}`);
  if (studentsSnap.size !== 200) {
    throw new Error(`Expected 200 students, found ${studentsSnap.size}`);
  }

  const attemptsSnap = await db.collection('attempts').get();
  console.log(`[TEST 4] Total attempts: ${attemptsSnap.size}`);
  if (attemptsSnap.size < 397) {
    throw new Error(`Expected at least 397 attempts, found ${attemptsSnap.size}`);
  }
  console.log('✅ TEST 4 PASSED: 200 students and 397+ attempts preserved.');

  // Test 5: Check academic years of classes
  const classesSnap = await db.collection('classes').get();
  const yearMap = {};
  classesSnap.forEach(d => {
    yearMap[d.data().name] = d.data().academicYear;
  });
  console.log('Class academic years:', yearMap);
  const expectedYears = {
    '2A': '2026-2027', '2B': '2026-2027', '3D': '2026-2027', '3E': '2026-2027',
    '2C': '2025-2026', '2D': '2025-2026', '2E': '2025-2026',
    '3A': '2025-2026', '3B': '2025-2026', '3C': '2025-2026'
  };
  for (const [cName, yr] of Object.entries(expectedYears)) {
    const key = `Lớp ${cName}`;
    if (yearMap[key] !== yr) {
      throw new Error(`Academic year mismatch for class ${cName}: expected ${yr}, got ${yearMap[key]}`);
    }
  }
  console.log('✅ TEST 5 PASSED: Academic year allocations 100% strictly preserved.');

  console.log('\n🎉 ALL DATABASE INTEGRITY TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
