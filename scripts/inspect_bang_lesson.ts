import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function inspectBangLesson() {
  const db = getDb();
  const doc = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').get();
  console.log('--- LESSON DOC DATA ---');
  console.log(JSON.stringify(doc.data(), null, 2));

  const versionsSnap = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').collection('versions').get();
  console.log('--- VERSIONS COUNT:', versionsSnap.docs.length);
  for (const vDoc of versionsSnap.docs) {
    console.log('Version ID:', vDoc.id);
    console.log('Version Data:', JSON.stringify(vDoc.data(), null, 2));
    const privateKey = await db.collection('privateAnswerKeys').doc(vDoc.id).get();
    console.log('Private Answer Key Data:', JSON.stringify(privateKey.data(), null, 2));
  }
}

inspectBangLesson().catch(console.error);
