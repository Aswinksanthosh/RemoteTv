import { runProcess } from './adb.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Update = git pull in the folder the program runs from, then restart (exit code 75).
export async function gitUpdate(root, run = runProcess) {
  const git = (args) => run('git', ['-C', root, ...args], { timeout: 60000 });
  const inside = await git(['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0) throw new Error('This folder is not a git clone, so it cannot update itself');
  const before = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  const pull = await git(['pull', '--ff-only']);
  if (pull.code !== 0) throw new Error('git pull failed: ' + (pull.stderr || pull.stdout || 'no output').trim().slice(0, 300));
  const after = (await git(['rev-parse', 'HEAD'])).stdout.trim();
  if (before === after) return { updated: false, changes: [] };
  const log = await git(['log', '--pretty=format:%s', '-n', '10', `${before}..${after}`]);
  return { updated: true, changes: log.stdout.split(/\r?\n/).filter(Boolean) };
}

export async function versionInfo(root, run = runProcess) {
  let v = '0';
  try { v = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version; } catch { /* ignore */ }
  const h = await run('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { timeout: 10000 });
  return h.code === 0 && h.stdout.trim() ? `${v} (${h.stdout.trim()})` : v;
}
