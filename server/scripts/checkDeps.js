#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

function run(cmd){ return execSync(cmd, { stdio:'pipe'}).toString(); }

// Simple outdated report
try {
  const out = run('npm outdated --json || echo {}');
  const json = JSON.parse(out || '{}');
  const upgrades = Object.entries(json).map(([name, info]) => ({ name, current: info.current, latest: info.latest, wanted: info.wanted }));
  if (!upgrades.length) {
    console.log('[deps] all up to date');
  } else {
    console.log('[deps] upgrades available:', upgrades);
    fs.writeFileSync('dependency-report.json', JSON.stringify(upgrades, null, 2));
    console.log('dependency-report.json written');
  }
} catch (e) {
  console.error('dependency check failed', e.message);
}