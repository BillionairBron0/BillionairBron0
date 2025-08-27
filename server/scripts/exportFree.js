import fs from 'fs';
import path from 'path';

// Create a minimal free bundle excluding broker creds & advanced analytics.
const root = path.resolve(process.cwd(), '..');
const outDir = path.join(root, 'dist-free');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const includeFiles = [
  'server/src/index.js',
  'server/src/signalEngine.js',
  'server/src/eventValidator.js',
  'server/src/deepseekClient.js',
  'shared/eventSchema.json'
];

for (const rel of includeFiles) {
  const src = path.join(root, rel);
  const dest = path.join(outDir, rel.split('/').slice(1).join('/'));
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, dest);
}

fs.writeFileSync(path.join(outDir, 'README-FREE.md'), `# Free Edition\n\nContains core real-time signal engine without broker execution, persistence, or advanced analytics. Upgrade to PRO for:\n- Broker (Alpaca) integration\n- SQLite persistence & historical query\n- Supertrend indicator & extended confirmations\n- Multi-symbol crypto polling\n- Trend intelligence module\n`);

console.log('Free bundle created at', outDir);