import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

const isDryRun = process.argv.includes('--dry-run');
const isRollback = process.argv.includes('--rollback');

const saFiles = fs.readdirSync(process.cwd()).filter(f => f.includes('adminsdk') && f.endsWith('.json'));
if (saFiles.length === 0) {
  console.error("Không tìm thấy service account");
  process.exit(1);
}
const saPath = path.join(process.cwd(), saFiles[0]);
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

const app = initializeApp({ credential: cert(sa) }, 'isolate-test-teachers');
const db = getFirestore(app);

// Group B orphan test accounts (0 classes, 0 assignments, 0 attempts)
const GROUP_B_UIDS = [
  '42XzovSkKZ9MxlHOMKH5MA9TmiM1',
  '5SbDIWHVn9F5Klu6IhLaiPyjwvdi',
  'A1BuQAWfVPjRcUH4pWunlvwWxvsA',
  'G6OupjhktDoasSomTgTJtAtkFNyY',
  'IRzcDoHO3ZxAqKlkAr7VDsvcGJFx',
  'LjZJuXx4VR64ajRjvm7YxJbf85mK',
  'Pqm6E71bRqfb4rV7ZKk75NzHDfvY',
  'QqqRW31i0mog7QPv9hIWiqmA7piw',
  'We7uVWjVhchXwZGL8QRBJLVOlCqj',
  'cPojIzyZBbMZoNJCIYFqKrJAz6Id',
  'dZPo41k7tks0wtFSMg2JVFm2x2y8',
  'pI20vpbrZjiHNKA4MSulUTkiBqMb',
  'sWWVj9sFhzdCJ69lvs8YZ1tx2nF4',
  'wwMQbj3rP7I50Joc488aNrDqOnkQ'
];

async function main() {
  console.log(`=== XỬ LÝ CÁCH LY 14 TÀI KHOẢN GIÁO VIÊN KIỂM THỬ (NHÓM B) ===`);
  console.log(`Chế độ: ${isDryRun ? 'DRY-RUN (CHỈ KIỂM TRA)' : isRollback ? 'HOÀN TÁC (ROLLBACK SANG ACTIVE)' : 'THỰC THI (ISOLATE)'}\n`);

  // Verify none of them has classes
  const classesSnap = await db.collection('classes').get();
  const classes = classesSnap.docs.map(d => d.data());

  for (const uid of GROUP_B_UIDS) {
    const classOwned = classes.filter(c => c.teacherUid === uid);
    if (classOwned.length > 0) {
      throw new Error(`[AN TOÀN] UID ${uid} đang sở hữu ${classOwned.length} lớp học! Hủy bỏ.`);
    }
  }
  console.log(`✓ Xác nhận an toàn: Không tài khoản nào trong Nhóm B sở hữu lớp học.`);

  const newStatus = isRollback ? 'active' : 'test_isolated';
  let updatedCount = 0;

  for (const uid of GROUP_B_UIDS) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      console.log(`- UID ${uid}: Không tồn tại trong Firestore`);
      continue;
    }
    const data = userDoc.data();
    console.log(`• [${uid}] ${data.displayName || data.email} (Hiện tại: ${data.status} -> Mới: ${newStatus})`);

    if (!isDryRun) {
      await db.collection('users').doc(uid).update({
        status: newStatus,
        previousStatus: data.status,
        isolatedAt: Date.now()
      });
      updatedCount++;
    }
  }

  console.log(`\n${isDryRun ? '🔍 DRY RUN HOÀN TẤT' : '🎉 ĐÃ CẬP NHẬT TRẠNG THÁI CHO ' + updatedCount + ' TÀI KHOẢN'}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
