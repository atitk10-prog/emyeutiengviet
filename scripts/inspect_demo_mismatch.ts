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
  const attDoc = await db.collection('attempts').doc('att_demo_assign_class_2a_main_hs001').get();
  console.log('Attempt att_demo_assign_class_2a_main_hs001:');
  console.log(JSON.stringify(attDoc.data(), null, 2));

  const respDoc = await db.collection('attempts').doc('att_demo_assign_class_2a_main_hs001').collection('responses').doc('q5').get();
  console.log('Response q5:');
  console.log(JSON.stringify(respDoc.data(), null, 2));

  const keyDoc = await db.collection('privateAnswerKeys').doc(attDoc.data()?.lessonVersionId).get();
  console.log('Key for version:', attDoc.data()?.lessonVersionId);
  console.log(JSON.stringify(keyDoc.data()?.answers?.q5, null, 2));
}

run().catch(console.error);
