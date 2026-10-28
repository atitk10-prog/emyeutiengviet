import fs from 'node:fs';
import path from 'node:path';

function getApiKey() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'functions/.secret.local'),
    path.resolve(process.cwd(), '.secret.local')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(/GEMINI_API_KEY\s*=\s*([^\s#\r\n]+)/);
      if (m && m[1]) return m[1].replace(/["']/g, '').trim();
    }
  }
  return '';
}

async function inspectModel(name, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${name}?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(`Metadata for ${name}:`, JSON.stringify(data, null, 2));
}

async function main() {
  const apiKey = getApiKey();
  await inspectModel('gemini-3.8-flash', apiKey);
  await inspectModel('gemini-3.5-flash-lite', apiKey);
}

main().catch(console.error);
