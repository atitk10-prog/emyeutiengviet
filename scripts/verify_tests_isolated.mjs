import fs from 'fs';
import path from 'path';

const testsDir = path.resolve('tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));

const forbiddenTerms = [
  '5001',
  '8080',
  '9099',
  'em-yeu-tieng-viet-demo'
];

let hasErrors = false;

for (const file of files) {
  if (file === 'test_env.mjs') continue; // test_env.mjs defines protected constants to block them

  const filePath = path.join(testsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      console.error(`[VIOLATION] File ${file} contains forbidden term "${term}"!`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  console.error(">>> FAILURE: Found test files referencing forbidden ports or demo project!");
  process.exit(1);
} else {
  console.log(">>> SUCCESS: 100% of test files are CLEAN! No forbidden ports (5001, 8080, 9099) or demo project references exist in test files.");
}
