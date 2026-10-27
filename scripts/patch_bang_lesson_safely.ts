import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function patchBangLessonSafely() {
  const db = getDb();
  const lessonId = 'Kzpw4eVXHPLMfsYQY7m2';
  const versionId = 'DGETJp55NmsROk4IDliI';

  console.log(`=== BẮT ĐẦU VÁ DỮ LIỆU BÀI: ${lessonId} ===`);

  // 1. BACKUP ORIGINAL DATA
  const backupDir = path.resolve(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const lessonDoc = await db.collection('lessons').doc(lessonId).get();
  const versionDoc = await db.collection('lessons').doc(lessonId).collection('versions').doc(versionId).get();
  const privateKeyDoc = await db.collection('privateAnswerKeys').doc(versionId).get();

  const backupData = {
    timestamp: new Date().toISOString(),
    lesson: lessonDoc.data(),
    version: versionDoc.data(),
    privateKey: privateKeyDoc.data()
  };

  const backupFile = path.join(backupDir, `backup_lesson_${lessonId}_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[1] Đã sao lưu bản gốc an toàn tại: ${backupFile}`);

  // 2. PREPARE REFINED QUESTIONS FOR DRAFT
  const currentDraft = lessonDoc.data()?.draftData || lessonDoc.data()?.draft || {};
  const currentQuestions = currentDraft.questions || [];

  const sequenceItems = [
    'Cây bàng non vươn mình đón ánh nắng mai',
    'Gió xuân thì thầm nhắc nhở về vỏ chai nhựa',
    'Bạn Na nhặt chiếc vỏ chai bỏ vào thùng rác'
  ];

  const updatedDraftQuestions = currentQuestions.map((q: any) => {
    if (q.id === 'q3') {
      return {
        ...q,
        prompt: "Từ 'mơn mởn' trong bài đọc dùng để chỉ sức sống tươi non của những chiếc lá bàng non.",
        statement: "Từ 'mơn mởn' trong bài đọc dùng để chỉ sức sống tươi non của những chiếc lá bàng non."
      };
    }
    if (q.id === 'q4') {
      return {
        ...q,
        prompt: 'Ở đoạn cuối bài đọc, cây bàng non vẫn cảm thấy buồn bã và héo úa.',
        statement: 'Ở đoạn cuối bài đọc, cây bàng non vẫn cảm thấy buồn bã và héo úa.'
      };
    }
    if (q.id === 'q5') {
      return {
        ...q,
        prompt: 'Sắp xếp các sự việc sau theo đúng trình tự diễn biến trong bài đọc:',
        items: sequenceItems,
        answer: [0, 1, 2] // Sắp xếp theo đúng trình tự 1 -> 2 -> 3
      };
    }
    return q;
  });

  // 3. PREPARE REFINED PUBLIC QUESTIONS FOR VERSION
  const currentPublicQuestions = versionDoc.data()?.publicQuestions || [];
  const updatedPublicQuestions = currentPublicQuestions.map((q: any) => {
    if (q.id === 'q3') {
      return {
        ...q,
        prompt: "Từ 'mơn mởn' trong bài đọc dùng để chỉ sức sống tươi non của những chiếc lá bàng non."
      };
    }
    if (q.id === 'q4') {
      return {
        ...q,
        prompt: 'Ở đoạn cuối bài đọc, cây bàng non vẫn cảm thấy buồn bã và héo úa.'
      };
    }
    if (q.id === 'q5') {
      return {
        ...q,
        prompt: 'Sắp xếp các sự việc sau theo đúng trình tự diễn biến trong bài đọc:',
        items: sequenceItems
      };
    }
    return q;
  });

  // 4. PREPARE REFINED PRIVATE KEY
  const currentAnswers = privateKeyDoc.data()?.answers || {};
  const updatedAnswers = {
    ...currentAnswers,
    q5: {
      ...currentAnswers.q5,
      correctAnswer: [0, 1, 2]
    }
  };

  // 5. UPDATE FIRESTORE (TRANSACTIONALLY / SAFE BATCH)
  const batch = db.batch();

  batch.update(db.collection('lessons').doc(lessonId), {
    'draftData.questions': updatedDraftQuestions,
    updatedAt: Date.now()
  });

  batch.update(db.collection('lessons').doc(lessonId).collection('versions').doc(versionId), {
    publicQuestions: updatedPublicQuestions,
    updatedAt: Date.now()
  });

  batch.update(db.collection('privateAnswerKeys').doc(versionId), {
    answers: updatedAnswers
  });

  await batch.commit();
  console.log(`[2] Đã cập nhật thành công bài ${lessonId} và version ${versionId}.`);
  console.log('=== HOÀN TẤT VÁ DỮ LIỆU AN TOÀN ===');
}

patchBangLessonSafely().catch(console.error);
