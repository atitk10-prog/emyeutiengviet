import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const saFiles = fs.readdirSync(process.cwd()).filter(f => f.includes('adminsdk') && f.endsWith('.json'));
if (saFiles.length === 0) {
  console.error("Không tìm thấy service account");
  process.exit(1);
}
const saPath = path.join(process.cwd(), saFiles[0]);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

// Explicitly ensure emulator hosts are NOT set
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const app = initializeApp({ credential: cert(sa) }, 'cloud-backup-current');
const db = getFirestore(app);

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve("backups", `cloud_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`=== BẮT ĐẦU SAO LƯU CLOUD STAGING VÀO: ${backupDir} ===\n`);

  const collections = [
    "users",
    "usernames",
    "accountSecrets",
    "classes",
    "students",
    "lessons",
    "assignments",
    "attempts",
    "curriculumNodes",
    "privateAnswerKeys",
    "studentSecrets",
    "studentSessions",
    "academicYears",
    "loginAttempts"
  ];

  const fullData = {};
  const stats = {};

  for (const colName of collections) {
    try {
      const snap = await db.collection(colName).get();
      fullData[colName] = [];
      stats[colName] = snap.size;

      for (const doc of snap.docs) {
        const docData = { id: doc.id, ...doc.data() };
        
        // Check subcollections
        try {
          const subs = await doc.ref.listCollections();
          if (subs.length > 0) {
            docData._subcollections = {};
            for (const sub of subs) {
              const subSnap = await sub.get();
              docData._subcollections[sub.id] = subSnap.docs.map(sd => ({ id: sd.id, ...sd.data() }));
            }
          }
        } catch (e) {
          // ignore subcollection list errors
        }

        fullData[colName].push(docData);
      }
      console.log(`✓ [Cloud] Collection "${colName}": ${snap.size} documents`);
    } catch (err) {
      console.warn(`! Không thể đọc collection "${colName}":`, err.message);
    }
  }

  const dumpPath = path.join(backupDir, "cloud_firestore_dump.json");
  fs.writeFileSync(dumpPath, JSON.stringify(fullData, null, 2), "utf8");

  const manifestPath = path.join(backupDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    projectId: sa.project_id,
    stats
  }, null, 2), "utf8");

  console.log(`\n🎉 SAO LƯU CLOUD THÀNH CÔNG: ${dumpPath}`);
}

runBackup().catch(err => {
  console.error("Lỗi sao lưu:", err);
  process.exit(1);
});
