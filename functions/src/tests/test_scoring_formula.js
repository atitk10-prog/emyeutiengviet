// Test scoring formula logic
function computeAttemptScores(firstTryCorrect, finalCorrect, totalQuestions) {
  const primaryScore = Number(((firstTryCorrect / totalQuestions) * 10).toFixed(1));
  const finalScore = Number(((finalCorrect / totalQuestions) * 10).toFixed(1));
  const progressCount = Math.max(0, finalCorrect - firstTryCorrect);
  const progressPercentagePoints = Number((((finalCorrect - firstTryCorrect) / totalQuestions) * 100).toFixed(1));
  const firstTryScorePercentage = Math.round((firstTryCorrect / totalQuestions) * 100);
  const finalScorePercentage = Math.round((finalCorrect / totalQuestions) * 100);

  return {
    primaryScore,
    finalScore,
    progressCount,
    progressPercentagePoints,
    firstTryScorePercentage,
    finalScorePercentage,
    progressLabel: progressCount > 0 ? `+${progressCount} câu (+${progressPercentagePoints}% pp)` : '0 câu'
  };
}

// Test 1: 3/5 first try, 4/5 after hint
const t1 = computeAttemptScores(3, 4, 5);
console.log('Test 1 (3/5 -> 4/5):', t1);
if (t1.primaryScore !== 6.0 || t1.finalScore !== 8.0 || t1.progressCount !== 1 || t1.progressPercentagePoints !== 20.0) {
  throw new Error('Test 1 failed!');
}

// Test 2: 4/5 first try, 5/5 after hint
const t2 = computeAttemptScores(4, 5, 5);
console.log('Test 2 (4/5 -> 5/5):', t2);
if (t2.primaryScore !== 8.0 || t2.finalScore !== 10.0 || t2.progressCount !== 1 || t2.progressPercentagePoints !== 20.0) {
  throw new Error('Test 2 failed!');
}

// Test 3: non-5 questions (4 questions: 3/4 -> 4/4)
const t3 = computeAttemptScores(3, 4, 4);
console.log('Test 3 (3/4 -> 4/4):', t3);
if (t3.primaryScore !== 7.5 || t3.finalScore !== 10.0 || t3.progressCount !== 1 || t3.progressPercentagePoints !== 25.0) {
  throw new Error('Test 3 failed!');
}

// Test 4: Weighted vs Unweighted
const attempts = [
  { firstTry: 3, final: 4, total: 5 },
  { firstTry: 8, final: 10, total: 10 }
];
const totalFirst = attempts.reduce((s, a) => s + a.firstTry, 0);
const totalQ = attempts.reduce((s, a) => s + a.total, 0);
const weightedAccuracy = Math.round((totalFirst / totalQ) * 100);
const unweightedAvg = Math.round(attempts.reduce((s, a) => s + (a.firstTry / a.total) * 100, 0) / attempts.length);
console.log(`Test 4 Weighted: ${weightedAccuracy}% vs Unweighted: ${unweightedAvg}% (Formula properly avoids unweighted average: ${weightedAccuracy !== unweightedAvg})`);

console.log('ALL FORMULA TESTS PASSED SUCCESSFULLY!');
