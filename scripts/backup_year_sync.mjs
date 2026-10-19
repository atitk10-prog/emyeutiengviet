import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const projectIds = ["em-yeu-tieng-viet-demo", "em-yeu-tieng-viet"];

async function runBackup() {
  console.log("=== BẮT ĐẦU SAO LƯU AN TOÀN TRƯỚC KHI ĐỒNG BỘ NĂM HỌC ===");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve("backups", `backup_academic_year_sync_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const backupReport = {
    timestamp: new Date().toISOString(),
    purpose: "Backup prior to synchronizing academic year 2026-2027",
    projects: {}
  };

  for (const pid of projectIds) {
    console.log(`\n--- SAO LƯU PROJECT: ${pid} ---`);
    const app = initializeApp({ projectId: pid }, `app_${pid}`);
    const db = getFirestore(app);

    const projectData = {};
    const projectStats = {};

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
      "systemSettings",
      "remediationActivities",
      "usernames",
      "accountSecrets"
    ];

    for (const colName of collections) {
      try {
        const snap = await db.collection(colName).get();
        projectData[colName] = [];
        projectStats[colName] = snap.size;

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

          projectData[colName].push(docData);
        }
        console.log(`  ✓ [${pid}] ${colName}: ${snap.size} documents`);
      } catch (err) {
        console.warn(`  ! [${pid}] Error backing up ${colName}:`, err.message);
      }
    }

    const jsonPath = path.join(backupDir, `dump_${pid}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(projectData, null, 2), "utf8");
    console.log(`  ✓ Đã ghi: ${jsonPath}`);

    backupReport.projects[pid] = {
      stats: projectStats,
      dumpFile: jsonPath
    };
  }

  // Backup emulator-data directory as well
  const emuSource = path.resolve("emulator-data");
  const emuDest = path.join(backupDir, "emulator-data-copy");
  if (fs.existsSync(emuSource)) {
    fs.cpSync(emuSource, emuDest, { recursive: true });
    console.log(`\n✓ Đã sao lưu emulator-data sang: ${emuDest}`);
  }

  const metaPath = path.join(backupDir, "backup_meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(backupReport, null, 2), "utf8");
  console.log(`\n✓ Đã tạo báo cáo sao lưu tại: ${metaPath}`);
  console.log(`================================================================`);
  console.log(`HOÀN TẤT SAO LƯU TẠI: ${backupDir}`);
  console.log(`================================================================\n`);
  return backupDir;
}

runBackup().catch(err => {
  console.error("LỖI SAO LƯU:", err);
  process.exit(1);
});
