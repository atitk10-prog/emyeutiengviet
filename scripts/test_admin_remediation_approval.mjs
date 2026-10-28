import fetch from 'node-fetch';
import fs from 'fs';

let adminPass = '';
if (fs.existsSync('.secret.local')) {
  const secretContent = fs.readFileSync('.secret.local', 'utf8');
  for (const line of secretContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('ADMIN_PASSWORD=')) {
      adminPass = trimmed.replace('ADMIN_PASSWORD=', '').trim();
    }
  }
}

const API_KEY = 'AIzaSyDhx3ubazUjmaaNdhmXSD3uDhVD1s0fHCk';
const BASE_URL = 'https://emyeutiengviet-zeta.vercel.app';

async function exchangeCustomToken(customToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  const data = await res.json();
  if (!data.idToken) throw new Error('Failed to exchange custom token: ' + JSON.stringify(data));
  return data.idToken;
}

async function run() {
  console.log('Testing Admin Remediation Approval & Listing on Production...');
  const loginRes = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'accountLogin', data: { username: 'admin', password: adminPass } })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  const idToken = await exchangeCustomToken(loginData.data.token);

  const listRes = await fetch(`${BASE_URL}/api/analytics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'listRemediationActivities', data: { classId: 'all', academicYear: 'all', grade: 'all', status: 'all' } })
  });
  const listData = await listRes.json();
  console.log('Admin list HTTP status:', listRes.status, 'Activities count:', listData.data?.activities?.length);
  if (!listData.success) throw new Error('Admin list failed');
  console.log('✓ Admin successfully listed all remediation activities across classes!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
