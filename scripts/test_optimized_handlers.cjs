// Benchmark script to test optimized API handlers with real Firestore
const fs = require('fs');
const path = require('path');

// Set service account key from staging file
const saPath = path.resolve(__dirname, '../em-yeu-tieng-viet---staging-firebase-adminsdk-fbsvc-71d403559f.json');
if (fs.existsSync(saPath)) {
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = fs.readFileSync(saPath, 'utf8');
}
process.env.NODE_ENV = 'production';

async function testOptimizedHandlers() {
  console.log('=== TESTING OPTIMIZED BACKEND HANDLERS (STAGING FIRESTORE) ===');
  
  // Dynamic import of compiled or tsx handlers via tsx / ts-node or transpiled
  const { execSync } = require('child_process');
  
  // We can run via npx tsx to execute typescript api handlers directly
  console.log('Running benchmark runner with npx tsx...');
}

testOptimizedHandlers().catch(console.error);
