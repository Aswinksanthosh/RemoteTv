import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from '../src/server.mjs';
import { Auth } from '../src/auth.mjs';
import { Controller } from '../src/controller.mjs';
import { DEFAULTS, sanitizeLevels } from '../src/config.mjs';
import { Tv } from '../src/adb.mjs';

test('API needs the key; page files are plain', async () => {
  const cfg = { ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', adbPath: 'adb' };
  const tv = new Tv(cfg, async () => ({ code: 1, stdout: '', stderr: '' }), async () => {});
  const controller = new Controller({ cfg, tv });
  const auth = new Auth(null);
  const key = auth.addKey();
  const server = createServer({ cfg, controller, auth, sanitizeLevels });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/state')).status, 401);
    const ok = await fetch(base + '/api/state', { headers: { 'x-key': key } });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).mode, null);   // manual only: nothing chosen yet
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    assert.match(await page.text(), /^<!doctype html>/i);   // real HTML, not a JSON Buffer
    assert.match(await (await fetch(base + '/app.js')).text(), /^'use strict'/);
    const bad = await fetch(base + '/api/mode', { method: 'POST', headers: { 'x-key': key }, body: JSON.stringify({ mode: 'x' }) });
    assert.equal(bad.status, 400);
  } finally { server.close(); }
});

test('page rules: no inline script or style, no outside address, no innerHTML', () => {
  const web = path.join(import.meta.dirname, '..', 'src', 'web');
  const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  assert.ok(!/<script(?![^>]*\bsrc=)/i.test(html));
  assert.ok(!/<style|\sstyle=/i.test(html));
  for (const f of fs.readdirSync(web)) {
    const t = fs.readFileSync(path.join(web, f), 'utf8');
    assert.ok(!/https?:\/\//.test(t.replace('http://x', '')), f + ' has an outside address');
    assert.ok(!/innerHTML/.test(t), f + ' uses innerHTML');
  }
});

test('repo holds no personal data', () => {
  const root = path.join(import.meta.dirname, '..');
  const bad = [/\b10\.0\.0\.\d+\b/, /\b4C:6B:/i, /GNH41/];
  for (const dir of ['src', 'bin', 'test']) {
    for (const f of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      const p = path.join(root, dir, f);
      if (!fs.statSync(p).isFile() || f.endsWith('server.test.mjs') || f.includes('vendor')) continue;
      const t = fs.readFileSync(p, 'utf8');
      for (const re of bad) assert.ok(!re.test(t), `${f} matches ${re}`);
    }
  }
});
