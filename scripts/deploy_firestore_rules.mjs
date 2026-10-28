import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Deploying firestore.rules to emyeutiengviet-prod via Firebase Rules API...');
  const keyPath = path.join(process.cwd(), 'scripts', 'backups', 'emyeutiengviet-prod-adminsdk.json');
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  const auth = new GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']
  });

  const client = await auth.getClient();
  const projectId = 'emyeutiengviet-prod';

  // 1. Create Ruleset
  console.log('Creating ruleset...');
  const createRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    method: 'POST',
    data: {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent
          }
        ]
      }
    }
  });

  const rulesetName = createRes.data.name;
  console.log('Created ruleset:', rulesetName);

  // 2. Release Ruleset for Cloud Firestore
  console.log('Releasing ruleset for cloud.firestore...');
  const releaseRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    method: 'PATCH',
    data: {
      release: {
        name: `projects/${projectId}/releases/cloud.firestore`,
        rulesetName: rulesetName
      }
    }
  });

  console.log('Ruleset successfully released!', releaseRes.data);
}

main().catch(err => {
  console.error('Error deploying rules:', err.response?.data || err.message);
  process.exit(1);
});
