import fs from 'node:fs';
import path from 'node:path';

function getApiKey() {
  const candidatePaths = [
    path.resolve(process.cwd(), 'functions/.secret.local'),
    path.resolve(process.cwd(), '.secret.local'),
    path.resolve(process.cwd(), '.env.local')
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      const m = content.match(/GEMINI_API_KEY\s*=\s*([^\s#\r\n]+)/);
      if (m && m[1]) return m[1].replace(/["']/g, '').trim();
    }
  }
  return process.env.GEMINI_API_KEY || '';
}

async function listAvailableModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    const data = await res.json();
    return data;
  } catch (err) {
    clearTimeout(t);
    return { error: err.message };
  }
}

async function testModel(modelName, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const startTime = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Xin chào.' }] }],
        generationConfig: { maxOutputTokens: 20 }
      }),
      signal: controller.signal
    });
    clearTimeout(t);
    const latency = Date.now() - startTime;
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    const output = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
    return {
      model: modelName,
      status: res.status,
      statusText: res.statusText,
      latencyMs: latency,
      ok: res.ok,
      outputSnippet: output ? output.trim() : (text.slice(0, 200)),
      errorCode: parsed?.error?.code,
      errorMessage: parsed?.error?.message
    };
  } catch (err) {
    clearTimeout(t);
    return {
      model: modelName,
      status: 0,
      statusText: 'FETCH_ERROR',
      latencyMs: Date.now() - startTime,
      ok: false,
      errorMessage: err.message
    };
  }
}

async function main() {
  const apiKey = getApiKey();
  console.log(`API Key found: ${Boolean(apiKey && apiKey.length > 5)} (length: ${apiKey.length})`);
  if (!apiKey) {
    console.error('No GEMINI_API_KEY found!');
    process.exit(1);
  }

  console.log('\n--- FETCHING AVAILABLE MODELS FROM GOOGLE API ---');
  const modelsList = await listAvailableModels(apiKey);
  if (modelsList.models) {
    console.log(`Found ${modelsList.models.length} models.`);
    const matching = modelsList.models.map(m => m.name.replace('models/', '')).filter(name => name.includes('flash') || name.includes('gemini'));
    console.log('Flash / Gemini models:', matching);
  } else {
    console.log('List models response:', modelsList);
  }

  const modelsToTest = [
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash'
  ];

  console.log('\n--- TESTING SPECIFIC MODELS ---');
  for (const m of modelsToTest) {
    console.log(`Testing: ${m}...`);
    const r = await testModel(m, apiKey);
    console.log(JSON.stringify(r, null, 2));
  }
}

main().catch(console.error);
