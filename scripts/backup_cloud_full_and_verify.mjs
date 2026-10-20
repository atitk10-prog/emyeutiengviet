import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Safety check
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

const app = initializeApp({ credential: cert(sa) }, 'cloud-backup-full');
const db = getFirestore(app);
const auth = getAuth(app);

function sha256(data) {
  return crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
}

async function main() {
  console.log('========================================================================');
  console.log('STARTING FULL BACKUP OF FIREBASE CLOUD STAGING (em-yeu-tieng-viet---staging)');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `cloud_backup_pre_v56_rebuild_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Backup destination: ${backupDir}\n`);

  const backupData = {
    metadata: {
      projectId: sa.project_id,
      timestamp: new Date().toISOString(),
      clientEmail: sa.client_email
    },
    authUsers: [],
    collections: {},
    subcollections: {
      lessonVersions: {},
      attemptResponses: {}
    },
    cloudOnlyEntities: [],
    audioReferences: []
  };

  // 1. Export Auth Users
  console.log('[1/4] Exporting Firebase Auth users...');
  let pageToken;
  do {
    const list = await auth.listUsers(1000, pageToken);
    backupData.authUsers.push(...list.users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      customClaims: u.customClaims,
      disabled: u.disabled,
      metadata: u.metadata,
      providerData: u.providerData
    })));
    pageToken = list.pageToken;
  } while (pageToken);
  console.log(`  -> Exported ${backupData.authUsers.length} Auth users.`);

  // 2. Export Firestore Collections
  console.log('[2/4] Exporting Firestore root collections...');
  const collections = await db.listCollections();
  console.log(`  Found collections: ${collections.map(c => c.id).join(', ')}`);

  for (const col of collections) {
    const colName = col.id;
    backupData.collections[colName] = [];
    const snap = await db.collection(colName).get();
    snap.forEach(doc => {
      const data = doc.data();
      backupData.collections[colName].push({
        id: doc.id,
        ...data
      });
      // Check audio
      if (data.audioUrl) {
        backupData.audioReferences.push({ collection: colName, docId: doc.id, audioUrl: data.audioUrl });
      }
    });
    console.log(`  -> [${colName}]: ${snap.size} documents exported.`);

    // Subcollections
    if (colName === 'lessons') {
      for (const doc of snap.docs) {
        const subSnap = await doc.ref.collection('versions').get();
        if (!subSnap.empty) {
          backupData.subcollections.lessonVersions[doc.id] = [];
          subSnap.forEach(subDoc => {
            const subData = subDoc.data();
            backupData.subcollections.lessonVersions[doc.id].push({
              id: subDoc.id,
              ...subData
            });
            if (subData.audioUrl) {
              backupData.audioReferences.push({ collection: 'lessons/versions', lessonId: doc.id, versionId: subDoc.id, audioUrl: subData.audioUrl });
            }
          });
        }
      }
    } else if (colName === 'attempts') {
      for (const doc of snap.docs) {
        const subSnap = await doc.ref.collection('responses').get();
        if (!subSnap.empty) {
          backupData.subcollections.attemptResponses[doc.id] = [];
          subSnap.forEach(subDoc => {
            backupData.subcollections.attemptResponses[doc.id].push({
              id: subDoc.id,
              ...subDoc.data()
            });
          });
        }
      }
    }
  }

  // 3. Identify Cloud-only entities (not present in standard baseline IDs)
  const baselinePrefixes = ['class_2', 'class_3', 'HS', 'lesson_g', 'assign_class_', 'att_demo_'];
  for (const [colName, docs] of Object.entries(backupData.collections)) {
    for (const doc of docs) {
      const isBaseline = baselinePrefixes.some(p => doc.id.startsWith(p));
      if (!isBaseline && colName !== 'curriculumNodes') {
        backupData.cloudOnlyEntities.push({ collection: colName, id: doc.id });
      }
    }
  }
  console.log(`  -> Identified ${backupData.cloudOnlyEntities.length} cloud-only/test entities.`);

  // 4. Write dump file and manifest with checksum
  console.log('[3/4] Writing dump files and computing checksums...');
  const dumpFilePath = path.join(backupDir, 'cloud_firestore_auth_dump.json');
  const dumpStr = JSON.stringify(backupData, null, 2);
  fs.writeFileSync(dumpFilePath, dumpStr, 'utf8');

  const dumpChecksum = sha256(dumpStr);
  const manifest = {
    manifestVersion: '1.0',
    createdAt: new Date().toISOString(),
    projectId: sa.project_id,
    dumpFile: 'cloud_firestore_auth_dump.json',
    dumpSizeBytes: fs.statSync(dumpFilePath).size,
    sha256Checksum: dumpChecksum,
    counts: {
      authUsers: backupData.authUsers.length,
      collections: Object.fromEntries(Object.entries(backupData.collections).map(([k, v]) => [k, v.length])),
      subcollections: {
        lessonVersions: Object.values(backupData.subcollections.lessonVersions).reduce((sum, a) => sum + a.length, 0),
        attemptResponses: Object.values(backupData.subcollections.attemptResponses).reduce((sum, a) => sum + a.length, 0)
      },
      cloudOnlyEntities: backupData.cloudOnlyEntities.length,
      audioReferences: backupData.audioReferences.length
    }
  };

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`  Dump file: ${dumpFilePath} (${(manifest.dumpSizeBytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log(`  SHA256: ${dumpChecksum}`);

  // 5. Verification: Read back and test recovery/integrity
  console.log('[4/4] Verifying backup readability and integrity...');
  const verifyStr = fs.readFileSync(dumpFilePath, 'utf8');
  const verifyChecksum = sha256(verifyStr);
  if (verifyChecksum !== dumpChecksum) {
    throw new Error('Checksum verification failed! Backup file is corrupted.');
  }
  const verifyData = JSON.parse(verifyStr);
  if (verifyData.authUsers.length !== backupData.authUsers.length) {
    throw new Error('Verification failed: Auth users length mismatch');
  }
  for (const [k, v] of Object.entries(backupData.collections)) {
    if ((verifyData.collections[k] || []).length !== v.length) {
      throw new Error(`Verification failed: Collection ${k} length mismatch`);
    }
  }
  console.log('✅ BACKUP INTEGRITY VERIFICATION PASSED 100%!');
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('❌ Cloud backup failed:', err);
  process.exit(1);
});
