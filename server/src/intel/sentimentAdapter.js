// Placeholder sentiment adapter combining news/headline scoring.
const posWords = ['surge','growth','beat','bull'];
const negWords = ['fall','miss','bear','decline'];

export function scoreHeadline(text) {
  const t = text.toLowerCase();
  let score=0; for (const w of posWords) if (t.includes(w)) score++;
  for (const w of negWords) if (t.includes(w)) score--;
  return score;
}

export function aggregate(headlines) {
  if (!headlines.length) return { avg:0 };
  const scores = headlines.map(scoreHeadline);
  const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
  return { avg, scores };
}