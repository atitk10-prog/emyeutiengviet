import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Ensuring firestore indexes on emyeutiengviet-prod via Firestore API...');
  const keyPath = path.join(process.cwd(), 'scripts', 'backups', 'emyeutiengviet-prod-adminsdk.json');
  const indexesPath = path.join(process.cwd(), 'firestore.indexes.json');
  const indexData = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

  const auth = new GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/datastore']
  });

  const client = await auth.getClient();
  const projectId = 'emyeutiengviet-prod';
  const databasePath = `projects/${projectId}/databases/(default)`;

  for (const idx of indexData.indexes) {
    const colGroup = idx.collectionGroup;
    console.log(`Checking index for ${colGroup}:`, idx.fields.map(f => `${f.fieldPath} ${f.order}`).join(', '));
    try {
      const res = await client.request({
        url: `https://firestore.googleapis.com/v1/${databasePath}/collectionGroups/${colGroup}/indexes`,
        method: 'POST',
        data: {
          queryScope: idx.queryScope,
          fields: idx.fields
        }
      });
      console.log(`  -> Index created:`, res.data.name);
    } catch (err) {
      if (err.response?.status === 409 || err.message?.includes('already exists')) {
        console.log(`  -> Index already exists.`);
      } else {
        console.warn(`  -> Note:`, err.response?.data?.error?.message || err.message);
      }
    }
  }

  console.log('Indexes check complete.');
}

main().catch(e => {
  console.error('Error:', e.message);
});
