import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function run() {
  const db = getDb();
  const doc = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').get();
  console.log('=== Kzpw4eVXHPLMfsYQY7m2 draftData.questions ===');
  console.log(JSON.stringify(doc.data()?.draftData?.questions, null, 2));

  console.log('\n=== Kzpw4eVXHPLMfsYQY7m2 versions[0] ===');
  const vSnap = await db.collection('lessons').doc('Kzpw4eVXHPLMfsYQY7m2').collection('versions').get();
  for (const vDoc of vSnap.docs) {
    console.log(JSON.stringify(vDoc.data(), null, 2));
  }
}

run().catch(console.error);
