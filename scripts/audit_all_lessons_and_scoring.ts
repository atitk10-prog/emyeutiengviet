import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function auditAllLessons() {
  const db = getDb();
  console.log('=== AUDITING ALL LESSONS IN FIRESTORE ===');

  const lessonsSnap = await db.collection('lessons').get();
  console.log(`Total lessons: ${lessonsSnap.size}`);

  const report = {
    totalLessons: lessonsSnap.size,
    lessonsWithDraftData: 0,
    lessonsWithVersions: 0,
    totalQuestionsAudited: 0,
    issues: [] as string[],
    mcqLetterAnswers: 0,
    mcqTextAnswers: 0,
    mcqIndexAnswers: 0,
    tfBooleanAnswers: 0,
    tfStringAnswers: 0,
    seqIndexAnswers: 0,
    seqTextAnswers: 0,
    hintLeakage: [] as any[],
    undefinedPrompts: [] as any[],
    missingKeys: [] as any[]
  };

  for (const doc of lessonsSnap.docs) {
    const l = doc.data();
    const lessonId = doc.id;

    if (l.draftData) {
      report.lessonsWithDraftData++;
      const draftQuestions = l.draftData.questions || [];
      draftQuestions.forEach((q: any, idx: number) => {
        report.totalQuestionsAudited++;
        if (!q.prompt && !q.statement) {
          report.undefinedPrompts.push({ lessonId, source: 'draft', qIdx: idx, id: q.id });
        }
        // Audit MCQ
        if (q.type === 'multiple_choice') {
          const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
          if (['A', 'B', 'C', 'D'].includes(String(ans).trim().toUpperCase())) {
            report.mcqLetterAnswers++;
          } else if (typeof ans === 'number') {
            report.mcqIndexAnswers++;
          } else {
            report.mcqTextAnswers++;
          }
        }
        // Audit Sequence
        if (q.type === 'sequence') {
          const ans = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
          if (Array.isArray(ans)) {
            if (typeof ans[0] === 'number') report.seqIndexAnswers++;
            else report.seqTextAnswers++;
          }
        }
        // Audit Hint leakage
        if (q.hint) {
          const hintLower = String(q.hint).toLowerCase();
          const ans = String(q.correctAnswer || q.answer || '').toLowerCase();
          if (ans.length > 3 && hintLower.includes(ans)) {
            report.hintLeakage.push({ lessonId, title: l.title, qId: q.id, hint: q.hint, answer: ans });
          }
        }
      });
    }

    // Check versions
    const vSnap = await db.collection('lessons').doc(lessonId).collection('versions').get();
    if (!vSnap.empty) {
      report.lessonsWithVersions++;
      for (const vDoc of vSnap.docs) {
        const v = vDoc.data();
        const keyDoc = await db.collection('privateAnswerKeys').doc(vDoc.id).get();
        const keyData = keyDoc.exists ? keyDoc.data()?.answers : null;

        if (!keyData) {
          report.missingKeys.push({ lessonId, versionId: vDoc.id, title: v.title });
        }

        const publicQuestions = v.publicQuestions || [];
        publicQuestions.forEach((q: any, idx: number) => {
          if (!q.prompt && !q.statement) {
            report.undefinedPrompts.push({ lessonId, versionId: vDoc.id, source: 'version', qIdx: idx, id: q.id });
          }
          const pAns = keyData ? (keyData[q.id] || keyData[`q${idx + 1}`]) : null;
          if (pAns) {
            const ans = pAns.correctAnswer !== undefined ? pAns.correctAnswer : pAns.answer;
            if (q.type === 'multiple_choice') {
              if (['A', 'B', 'C', 'D'].includes(String(ans).trim().toUpperCase())) {
                report.mcqLetterAnswers++;
              } else if (typeof ans === 'number') {
                report.mcqIndexAnswers++;
              } else {
                report.mcqTextAnswers++;
              }
            } else if (q.type === 'sequence') {
              if (Array.isArray(ans)) {
                if (typeof ans[0] === 'number') report.seqIndexAnswers++;
                else report.seqTextAnswers++;
              }
            } else if (q.type === 'true_false') {
              if (typeof ans === 'boolean') report.tfBooleanAnswers++;
              else report.tfStringAnswers++;
            }

            if (pAns.hint) {
              const hintLower = String(pAns.hint).toLowerCase();
              const ansStr = String(ans).toLowerCase();
              if (ansStr.length > 3 && hintLower.includes(ansStr)) {
                report.hintLeakage.push({ lessonId, versionId: vDoc.id, title: v.title, qId: q.id, hint: pAns.hint, answer: ansStr });
              }
            }
          }
        });
      }
    }
  }

  console.log('\n--- AUDIT SUMMARY ---');
  console.log(`Lessons with draftData: ${report.lessonsWithDraftData}`);
  console.log(`Lessons with versions: ${report.lessonsWithVersions}`);
  console.log(`Missing privateAnswerKeys: ${report.missingKeys.length}`);
  if (report.missingKeys.length > 0) {
    console.log('Missing keys:', report.missingKeys);
  }
  console.log(`Undefined prompts found: ${report.undefinedPrompts.length}`);
  if (report.undefinedPrompts.length > 0) {
    console.log('Undefined prompts:', report.undefinedPrompts);
  }
  console.log(`MCQ letter answers (A/B/C): ${report.mcqLetterAnswers}`);
  console.log(`MCQ index answers (0/1/2): ${report.mcqIndexAnswers}`);
  console.log(`MCQ text answers: ${report.mcqTextAnswers}`);
  console.log(`Sequence index answers [1, 2, 0]: ${report.seqIndexAnswers}`);
  console.log(`Sequence text answers: ${report.seqTextAnswers}`);
  console.log(`True/False boolean answers: ${report.tfBooleanAnswers}`);
  console.log(`True/False string answers: ${report.tfStringAnswers}`);
  console.log(`Potential hint leakages: ${report.hintLeakage.length}`);
  if (report.hintLeakage.length > 0) {
    console.log('Hint leakage details:', JSON.stringify(report.hintLeakage.slice(0, 5), null, 2));
  }
}

auditAllLessons().catch(console.error);
