import { spawnSync } from "child_process";

const files = [
  "tests/rules.test.mjs",
  "tests/pedagogical_fixtures.test.mjs",
  "tests/security_and_ai.test.mjs",
  "tests/e2e.test.mjs",
  "tests/admin_and_curriculum.test.mjs",
  "tests/persistence_and_recovery.test.mjs",
  "tests/ux_audio_attempt_excel.test.mjs",
  "tests/v5_1_security_and_ux.test.mjs",
  "tests/v5_2_lesson_lifecycle.test.mjs"
];

console.log("=== EXACT TEST BREAKDOWN PER SUITE ===");
let totalTests = 0;
let totalPass = 0;
let totalFail = 0;

for (const file of files) {
  const res = spawnSync("node", ["--test", file], { encoding: "utf8", env: process.env });
  const lines = res.stdout.split("\n");
  const testLine = lines.find(l => l.startsWith("ℹ tests ") || l.includes("tests "))?.trim() || "";
  const passLine = lines.find(l => l.startsWith("ℹ pass ") || l.includes("pass "))?.trim() || "";
  const failLine = lines.find(l => l.startsWith("ℹ fail ") || l.includes("fail "))?.trim() || "";
  
  // Also collect individual test names
  const testNames = lines
    .filter(l => l.includes("✔ ") || l.includes("✖ "))
    .map(l => l.trim().replace(/^✔\s*/, "[PASS] ").replace(/^✖\s*/, "[FAIL] "));

  console.log(`\nFile: ${file}`);
  console.log(`Summary: ${testLine} | ${passLine} | ${failLine}`);
  testNames.forEach(t => console.log(`   ${t}`));

  const testsMatch = testLine.match(/\d+/);
  const passMatch = passLine.match(/\d+/);
  const failMatch = failLine.match(/\d+/);

  if (testsMatch) totalTests += parseInt(testsMatch[0], 10);
  if (passMatch) totalPass += parseInt(passMatch[0], 10);
  if (failMatch) totalFail += parseInt(failMatch[0], 10);
}

console.log("\n=================================");
console.log(`TOTAL SUM OF PER-FILE RUNS: ${totalTests} tests, ${totalPass} passed, ${totalFail} failed.`);
