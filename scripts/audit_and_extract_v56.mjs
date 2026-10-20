import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const app = initializeApp({ projectId: 'em-yeu-tieng-viet-demo' });
const db = getFirestore(app);
const auth = getAuth(app);

async function main() {
  console.log('=== AUDITING AND EXTRACTING V5.6 BASELINE FROM EMULATOR ===');
  
  // 1. List all root collections
  const collections = await db.listCollections();
  console.log('Root collections found:', collections.map(c => c.id));
  
  const fullDump = {
    metadata: {
      source: 'backups/emulator_backup_final_release_ready',
      extractedAt: new Date().toISOString()
    },
    authUsers: [],
    collections: {},
    subcollections: {
      lessonVersions: {},
      attemptResponses: {}
    }
  };

  // 2. Extract Auth Users
  try {
    let pageToken;
    do {
      const list = await auth.listUsers(1000, pageToken);
      fullDump.authUsers.push(...list.users.map(u => ({
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        customClaims: u.customClaims,
        disabled: u.disabled,
        metadata: u.metadata
      })));
      pageToken = list.pageToken;
    } while (pageToken);
  } catch (err) {
    console.error('Error listing auth users:', err.message);
  }
  console.log(`Auth users count: ${fullDump.authUsers.length}`);

  // 3. Extract each collection
  for (const col of collections) {
    const colName = col.id;
    const snap = await db.collection(colName).get();
    fullDump.collections[colName] = [];
    snap.forEach(doc => {
      fullDump.collections[colName].push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log(`Collection [${colName}]: ${snap.size} documents`);

    // Handle subcollections
    if (colName === 'lessons') {
      for (const doc of snap.docs) {
        const subSnap = await doc.ref.collection('versions').get();
        if (!subSnap.empty) {
          fullDump.subcollections.lessonVersions[doc.id] = [];
          subSnap.forEach(subDoc => {
            fullDump.subcollections.lessonVersions[doc.id].push({
              id: subDoc.id,
              ...subDoc.data()
            });
          });
        }
      }
    } else if (colName === 'attempts') {
      for (const doc of snap.docs) {
        const subSnap = await doc.ref.collection('responses').get();
        if (!subSnap.empty) {
          fullDump.subcollections.attemptResponses[doc.id] = [];
          subSnap.forEach(subDoc => {
            fullDump.subcollections.attemptResponses[doc.id].push({
              id: subDoc.id,
              ...subDoc.data()
            });
          });
        }
      }
    }
  }

  // 4. Summarize subcollection counts
  const totalLessonVersions = Object.values(fullDump.subcollections.lessonVersions).reduce((sum, arr) => sum + arr.length, 0);
  const totalAttemptResponses = Object.values(fullDump.subcollections.attemptResponses).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Subcollection [lessonVersions]: ${totalLessonVersions} documents across ${Object.keys(fullDump.subcollections.lessonVersions).length} lessons`);
  console.log(`Subcollection [attemptResponses]: ${totalAttemptResponses} documents across ${Object.keys(fullDump.subcollections.attemptResponses).length} attempts`);

  // 5. Analyze Academic Years
  const academicYears = new Set();
  (fullDump.collections.classes || []).forEach(c => {
    if (c.academicYear) academicYears.add(c.academicYear);
  });
  console.log('\nAcademic Years in classes:', Array.from(academicYears));

  const yearsInAssignments = new Set();
  (fullDump.collections.assignments || []).forEach(a => {
    if (a.academicYear) yearsInAssignments.add(a.academicYear);
  });
  console.log('Academic Years in assignments:', Array.from(yearsInAssignments));

  const yearsInAttempts = new Set();
  (fullDump.collections.attempts || []).forEach(a => {
    if (a.academicYear) yearsInAttempts.add(a.academicYear);
  });
  console.log('Academic Years in attempts:', Array.from(yearsInAttempts));

  // 6. Analyze Users
  const admins = (fullDump.collections.users || []).filter(u => u.role === 'admin');
  const teachers = (fullDump.collections.users || []).filter(u => u.role === 'teacher');
  console.log(`\nUsers: Admins = ${admins.length}, Teachers = ${teachers.length}, Total = ${(fullDump.collections.users || []).length}`);
  teachers.forEach(t => console.log(`  Teacher: [${t.id}] ${t.displayName} (${t.email}) status=${t.status}`));
  admins.forEach(a => console.log(`  Admin: [${a.id}] ${a.displayName} (${a.email}) status=${a.status}`));

  // 7. Analyze Audio URLs
  const audioUrls = new Set();
  for (const l of (fullDump.collections.lessons || [])) {
    if (l.audioUrl) audioUrls.add(l.audioUrl);
  }
  for (const versions of Object.values(fullDump.subcollections.lessonVersions)) {
    for (const v of versions) {
      if (v.audioUrl) audioUrls.add(v.audioUrl);
    }
  }
  console.log(`\nAudio URLs found in lessons: ${audioUrls.size}`);
  audioUrls.forEach(url => console.log(`  - ${url}`));

  // 8. Write dump to disk
  const dumpPath = path.join(process.cwd(), 'backups', 'v56_baseline_dump.json');
  fs.writeFileSync(dumpPath, JSON.stringify(fullDump, null, 2), 'utf8');
  console.log(`\nFull V5.6 baseline dump written to: ${dumpPath} (${(fs.statSync(dumpPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
