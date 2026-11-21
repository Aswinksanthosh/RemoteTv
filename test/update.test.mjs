import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { gitUpdate } from '../src/update.mjs';
import { createServer } from '../src/server.mjs';
import { Auth } from '../src/auth.mjs';
import { Controller } from '../src/controller.mjs';
import { DEFAULTS, sanitizeLevels } from '../src/config.mjs';
import { Tv } from '../src/adb.mjs';

const root = path.join(import.meta.dirname, '..');

function gitFake({ heads = ['aaa', 'bbb'], pullCode = 0, inside = true } = {}) {
  let n = 0;
  return async (file, args) => {
    const a = args.join(' ');
    if (a.includes('--is-inside-work-tree')) return { code: inside ? 0 : 128, stdout: 'true', stderr: '' };
    if (a.includes('rev-parse HEAD')) return { code: 0, stdout: heads[Math.min(n++, heads.length - 1)] + '\n', stderr: '' };
    if (a.includes('pull')) return { code: pullCode, stdout: '', stderr: pullCode ? 'conflict' : '' };
    if (a.includes('log')) return { code: 0, stdout: 'Fix one\nAdd two\n', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
}

test('update: new commits give the change list; same commit says up to date', async () => {
  const r = await gitUpdate('x', gitFake());
  assert.deepEqual(r, { updated: true, changes: ['Fix one', 'Add two'] });
  assert.deepEqual(await gitUpdate('x', gitFake({ heads: ['aaa', 'aaa'] })), { updated: false, changes: [] });
});

test('update: errors are readable', async () => {
  await assert.rejects(gitUpdate('x', gitFake({ pullCode: 1 })), /git pull failed: conflict/);
  await assert.rejects(gitUpdate('x', gitFake({ inside: false })), /not a git clone/);
});

test('laptop asleep for a while: the level is applied again', async () => {
  const c = { ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', adbPath: 'adb' };
  const calls = [];
  const run = async (f, a) => {
    calls.push(a.join(' '));
    if (a.includes('get-state')) return { code: 0, stdout: 'device', stderr: '' };
    if (a.includes('power')) return { code: 0, stdout: 'mWakefulness=Awake', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
  let now = new Date('2026-11-21T17:00:00Z');
  const ctl = new Controller({ cfg: c, tv: new Tv(c, run, async () => {}), now: () => now });
  await ctl.tick();
  const n = calls.length;
  now = new Date('2026-11-21T17:01:00Z'); await ctl.tick();
  assert.equal(calls.length, n);                          // normal minute: nothing
  now = new Date('2026-11-21T19:00:00Z'); await ctl.tick();
  assert.ok(calls.length > n);                            // after a 2 hour gap: applies again
});

test('update endpoint restarts only when something changed', async () => {
  const cfg = { ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', adbPath: 'adb' };
  const controller = new Controller({ cfg, tv: new Tv(cfg, async () => ({ code: 1, stdout: '', stderr: '' }), async () => {}) });
  const auth = new Auth(null);
  const key = auth.addKey();
  let restarted = 0;
  let result = { updated: true, changes: ['x'] };
  const server = createServer({ cfg, controller, auth, sanitizeLevels, version: '9.9', updater: async () => result, restart: () => restarted++ });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = () => fetch(base + '/api/update', { method: 'POST', headers: { 'x-key': key }, body: '{}' });
  try {
    assert.equal((await fetch(base + '/api/update', { method: 'POST', body: '{}' })).status, 401);
    const a = await (await post()).json();
    assert.equal(a.updated, true);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(restarted, 1);
    result = { updated: false, changes: [] };
    await (await post()).json();
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(restarted, 1);
    const st = await (await fetch(base + '/api/state', { headers: { 'x-key': key } })).json();
    assert.equal(st.version, '9.9');
  } finally { server.close(); }
});

test('Windows files: .cmd are plain ASCII with CRLF; installer does the key steps', () => {
  for (const f of ['Install.cmd', 'Pair-Phone.cmd', 'Uninstall.cmd']) {
    const b = fs.readFileSync(path.join(root, f));
    assert.ok(b.every((x) => x < 128), f + ' must be ASCII');
    assert.ok(b.toString().includes('\r\n'), f + ' must use CRLF');
  }
  const ps = fs.readFileSync(path.join(root, 'install.ps1'), 'utf8');
  for (const needle of ['bin\\setup.mjs', 'Register-ScheduledTask', 'New-NetFirewallRule', '100.64.0.0/10', 'start.ps1']) assert.ok(ps.includes(needle), needle);
  const st = fs.readFileSync(path.join(root, 'start.ps1'), 'utf8');
  assert.ok(st.includes('75') && st.includes('remotetv.mjs'));
});

test('experiment: only the picture-mode broadcast, with strictly checked extras', async () => {
  const cfg = { ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', adbPath: 'adb' };
  const calls = [];
  const run = async (f, a) => {
    calls.push(a.join(' '));
    if (a.includes('get-state')) return { code: 0, stdout: 'device', stderr: '' };
    return { code: 0, stdout: 'Broadcast completed: result=0', stderr: '' };
  };
  const tv = new Tv(cfg, run, async () => {});
  const controller = new Controller({ cfg, tv });
  const auth = new Auth(null);
  const key = auth.addKey();
  const server = createServer({ cfg, controller, auth, sanitizeLevels, tv });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (b) => fetch(base + '/api/experiment', { method: 'POST', headers: { 'x-key': key }, body: JSON.stringify(b) });
  try {
    const ok = await post({ type: 'es', key: 'picture_mode', value: 'movie' });
    assert.equal(ok.status, 200);
    assert.ok(calls.some((c) => c.endsWith('--es picture_mode movie') && c.includes('SWITCH_PICTURE_MODE')));
    for (const bad of [{ type: 'es', key: 'a;reboot', value: 'x' }, { type: 'es', key: 'k', value: 'a b' }, { type: 'ei', key: 'k', value: 'abc' }, { type: 'zz', key: 'k', value: '1' }]) {
      assert.equal((await post(bad)).status, 400);
    }
    assert.ok(!calls.some((c) => c.includes('reboot')));
  } finally { server.close(); }
});
