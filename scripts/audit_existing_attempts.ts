import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function auditAttempts() {
  const db = getDb();
  console.log('=== AUDITING ATTEMPTS AND RESPONSES IN FIRESTORE ===');

  const attemptsSnap = await db.collection('attempts').get();
  console.log(`Total attempts: ${attemptsSnap.size}`);

  let totalResponses = 0;
  let mismatchedGrading = 0;
  const suspiciousAttempts: any[] = [];

  // Cache answer keys by versionId
  const keyCache: Record<string, any> = {};

  for (const doc of attemptsSnap.docs) {
    const att = doc.data();
    const versionId = att.lessonVersionId;
    if (!versionId) continue;

    if (!keyCache[versionId]) {
      const kDoc = await db.collection('privateAnswerKeys').doc(versionId).get();
      keyCache[versionId] = kDoc.exists ? kDoc.data()?.answers : null;
    }

    const keyData = keyCache[versionId];
    if (!keyData) continue;

    const respSnap = await db.collection('attempts').doc(doc.id).collection('responses').get();
    for (const rDoc of respSnap.docs) {
      totalResponses++;
      const resp = rDoc.data();
      const qId = resp.questionId || rDoc.id;
      const expected = keyData[qId];
      if (!expected) continue;

      const correctAns = expected.correctAnswer !== undefined ? expected.correctAnswer : expected.answer;
      
      // Check first answer
      if (resp.firstAnswer !== undefined) {
        const isActuallyCorrect = String(resp.firstAnswer).trim().toUpperCase() === String(correctAns).trim().toUpperCase();
        if (resp.firstTryCorrect !== isActuallyCorrect) {
          mismatchedGrading++;
          suspiciousAttempts.push({
            attemptId: doc.id,
            questionId: qId,
            studentAns: resp.firstAnswer,
            recordedFirstTryCorrect: resp.firstTryCorrect,
            correctAns,
            isActuallyCorrect
          });
        }
      }
    }
  }

  console.log(`Total responses audited: ${totalResponses}`);
  console.log(`Mismatched responses found: ${mismatchedGrading}`);
  if (suspiciousAttempts.length > 0) {
    console.log('Sample suspicious attempts:', JSON.stringify(suspiciousAttempts.slice(0, 10), null, 2));
  }
}

auditAttempts().catch(console.error);
