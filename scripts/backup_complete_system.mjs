import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

async function runCompleteBackup() {
  console.log("=== BẮT ĐẦU SAO LƯU TOÀN DIỆN HỆ THỐNG TRƯỚC MIGRATION ===\n");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve("backups", `backup_complete_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const collections = [
    "classes",
    "students",
    "lessons",
    "assignments",
    "attempts",
    "curriculumNodes",
    "users",
    "privateAnswerKeys",
    "studentSecrets",
    "studentSessions",
    "loginAttempts",
    "academicYears",
    "systemSettings"
  ];

  const fullData = {};
  const stats = {};

  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    fullData[colName] = [];
    stats[colName] = snap.size;

    for (const doc of snap.docs) {
      const docData = { id: doc.id, ...doc.data() };
      
      // Check subcollections
      const subs = await doc.ref.listCollections();
      if (subs.length > 0) {
        docData._subcollections = {};
        for (const sub of subs) {
          const subSnap = await sub.get();
          docData._subcollections[sub.id] = subSnap.docs.map(sd => ({ id: sd.id, ...sd.data() }));
        }
      }

      fullData[colName].push(docData);
    }
    console.log(`✓ Đã sao lưu collection "${colName}": ${snap.size} documents`);
  }

  // Write full JSON dump
  const jsonPath = path.join(backupDir, "firestore_complete_dump.json");
  fs.writeFileSync(jsonPath, JSON.stringify(fullData, null, 2), "utf8");
  console.log(`\n✓ Đã ghi tệp Firestore dump: ${jsonPath}`);

  // Copy emulator-data
  const emuSource = path.resolve("emulator-data");
  const emuDest = path.join(backupDir, "emulator-data-copy");
  if (fs.existsSync(emuSource)) {
    fs.cpSync(emuSource, emuDest, { recursive: true });
    console.log(`✓ Đã sao lưu bản sao thư mục emulator-data sang: ${emuDest}`);
  }

  // Copy audio files manifest
  const audioSource = path.resolve("persistent_storage", "audio");
  const audioFiles = fs.existsSync(audioSource) ? fs.readdirSync(audioSource) : [];
  fs.writeFileSync(path.join(backupDir, "audio_manifest.json"), JSON.stringify({
    audioCount: audioFiles.length,
    files: audioFiles
  }, null, 2), "utf8");
  console.log(`✓ Đã ghi manifest tệp âm thanh (${audioFiles.length} tệp)`);

  // Write backup metadata
  const metaPath = path.join(backupDir, "backup_meta.json");
  const meta = {
    timestamp: new Date().toISOString(),
    purpose: "Pre-migration to Academic Year 2026-2027 & Week 7 progress",
    stats,
    jsonPath,
    emuDest
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");

  console.log(`\n===============================================================`);
  console.log(`SAO LƯU TOÀN DIỆN THÀNH CÔNG TẠI: ${backupDir}`);
  console.log(`===============================================================\n`);
  return { backupDir, jsonPath, meta };
}

runCompleteBackup().catch(err => {
  console.error("LỖI SAO LƯU:", err);
  process.exit(1);
});
