import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = initializeApp({ projectId: "em-yeu-tieng-viet" });
const db = getFirestore(app);

async function runRollback(backupJsonPath) {
  if (!backupJsonPath) {
    console.error("Vui lòng cung cấp đường dẫn tệp JSON sao lưu để khôi phục.");
    process.exit(1);
  }

  const resolvedPath = path.resolve(backupJsonPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Không tìm thấy tệp sao lưu: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`=== BẮT ĐẦU ROLLBACK TỪ TỆP: ${resolvedPath} ===\n`);
  const data = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));

  for (const [colName, docs] of Object.entries(data)) {
    if (!Array.isArray(docs)) continue;
    console.log(`Đang khôi phục collection "${colName}" (${docs.length} docs)...`);

    for (const doc of docs) {
      const { id, _subcollections, ...fields } = doc;
      await db.collection(colName).doc(id).set(fields, { merge: true });

      if (_subcollections) {
        for (const [subName, subDocs] of Object.entries(_subcollections)) {
          for (const subDoc of subDocs) {
            const { id: sId, ...sFields } = subDoc;
            await db.collection(colName).doc(id).collection(subName).doc(sId).set(sFields, { merge: true });
          }
        }
      }
    }
    console.log(`✓ Khôi phục xong collection "${colName}".`);
  }

  console.log("\n===============================================================");
  console.log("ROLLBACK HOÀN TẤT THÀNH CÔNG!");
  console.log("===============================================================\n");
}

const targetPath = process.argv[2] || "backups/backup_complete_2026-10-19T00-01-51-816Z/firestore_complete_dump.json";
runRollback(targetPath).catch(err => {
  console.error("LỖI ROLLBACK:", err);
  process.exit(1);
});
