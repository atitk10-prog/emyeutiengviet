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

const apiKey = getApiKey();

async function testPrompt(model, prompt, options = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const start = Date.now();
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: options.generationConfig || {}
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const duration = Date.now() - start;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      model,
      status: res.status,
      duration,
      ok: res.ok,
      snippet: text.slice(0, 200),
      errorMessage: json?.error?.message
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      model,
      status: err.name === 'AbortError' ? 408 : 0,
      duration: Date.now() - start,
      ok: false,
      errorName: err.name,
      errorMessage: err.message
    };
  }
}

async function run() {
  console.log('Testing ping with 4000ms timeout vs 10000ms timeout...');
  const models = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest'
  ];

  for (const m of models) {
    console.log(`\n--- Ping ${m} (maxOutputTokens: 2, timeout: 5000ms) ---`);
    const r5 = await testPrompt(m, 'Ping', { timeoutMs: 5000, generationConfig: { maxOutputTokens: 2 } });
    console.log(`Result: Status ${r5.status}, Duration: ${r5.duration}ms, Ok: ${r5.ok}`, r5.errorMessage ? `Error: ${r5.errorMessage}` : '');
  }
}

run();
