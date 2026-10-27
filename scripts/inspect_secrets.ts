import fs from 'fs';
import path from 'path';

const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

import { getDb } from '../api/_helpers/firebaseAdmin';

async function inspectSecrets() {
  const db = getDb();

  const adminSec = await db.collection('accountSecrets').doc('fts9esJAKjfOpbABTPF7ru5dgdz1').get();
  console.log('Admin Secret:', adminSec.data());

  const gvSec = await db.collection('accountSecrets').doc('B5H9PeMrZowS3ewPm4BQ8aM4fkU1').get();
  console.log('Teacher Secret:', gvSec.data());

  const stuSec = await db.collection('studentSecrets').doc('student_demo_hs002').get();
  console.log('Student Secret:', stuSec.data());
}

inspectSecrets().catch(console.error);
