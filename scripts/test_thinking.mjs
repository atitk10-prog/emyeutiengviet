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

async function testWithConfig(modelName, config) {
  const apiKey = getApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Xin chào, trả lời ngắn 1 câu.' }] }],
        generationConfig: config
      })
    });
    const text = await res.text();
    console.log(`[${modelName}] Status: ${res.status}, Time: ${Date.now() - start}ms`);
    console.log(`Response snippet:`, text.slice(0, 300));
  } catch (err) {
    console.error(`[${modelName}] Error:`, err.message);
  }
}

async function main() {
  console.log('Testing gemini-3.8-flash with thinkingBudget: 0...');
  await testWithConfig('gemini-3.8-flash', {
    maxOutputTokens: 200,
    thinkingConfig: { thinkingBudget: 0 }
  });

  console.log('\nTesting gemini-3.8-flash with default thinking and 2048 tokens...');
  await testWithConfig('gemini-3.8-flash', {
    maxOutputTokens: 2048
  });
}

main().catch(console.error);
