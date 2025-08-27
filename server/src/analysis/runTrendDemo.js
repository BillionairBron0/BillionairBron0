// Simple trend/momentum demo: mock search volume growth & score emerging topics.
// Placeholder for integration with Google Trends / Exploding Topics style APIs.
import fs from 'fs';

const topics = [
  { key: 'ai agents', history: [10,12,15,20,28,35] },
  { key: 'quantum etf', history: [3,3,4,5,8,14] },
  { key: 'carbon capture', history: [18,19,20,21,22,23] },
  { key: 'defi staking', history: [30,29,27,25,24,23] }
];

function compoundGrowth(arr) {
  if (arr.length < 2) return 0;
  const first = arr[0]; const last = arr[arr.length-1];
  return (last - first) / (first || 1);
}

function momentum(arr) {
  if (arr.length < 4) return 0;
  const recent = arr.slice(-3).reduce((a,b)=>a+b,0)/3;
  const prior = arr.slice(-6,-3).reduce((a,b)=>a+b,0)/3;
  return (recent - prior) / (prior || 1);
}

const scored = topics.map(t => ({
  topic: t.key,
  growth: compoundGrowth(t.history),
  momentum: momentum(t.history),
  score: (compoundGrowth(t.history)*0.6 + momentum(t.history)*0.4)
})).sort((a,b)=> b.score - a.score);

console.table(scored);
fs.writeFileSync('trend-report.json', JSON.stringify(scored, null, 2));
console.log('trend-report.json written');