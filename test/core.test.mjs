import test from 'node:test';
import assert from 'node:assert/strict';
import { sunTimesForYmd } from '../src/sun.mjs';
import { modeAt } from '../src/schedule.mjs';
import { DEFAULTS, sanitizeLevels } from '../src/config.mjs';
import { backlightSteps, backlightScript, KEY, Tv } from '../src/adb.mjs';
import { Controller } from '../src/controller.mjs';
import { Auth } from '../src/auth.mjs';
import { isAllowedAddress } from '../src/server.mjs';

const cfg = () => ({ ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', autoSchedule: true });
const minutesLocal = (d) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  return Number(p.find((x) => x.type === 'hour').value) * 60 + Number(p.find((x) => x.type === 'minute').value);
};

test('sun times for Toronto are close to published values', () => {
  const nov = sunTimesForYmd({ y: 2026, m: 11, d: 21 }, 43.65, -79.38);
  assert.ok(Math.abs(minutesLocal(nov.sunrise) - (7 * 60 + 11)) <= 8);
  assert.ok(Math.abs(minutesLocal(nov.sunset) - (16 * 60 + 46)) <= 8);
  const jun = sunTimesForYmd({ y: 2026, m: 6, d: 21 }, 43.65, -79.38);
  assert.ok(Math.abs(minutesLocal(jun.sunrise) - (5 * 60 + 36)) <= 8);
  assert.ok(Math.abs(minutesLocal(jun.sunset) - (21 * 60 + 0)) <= 8);
});

test('schedule: day, evening, night in order on a November day', () => {
  const at = (iso) => modeAt(new Date(iso), cfg()).mode;
  assert.equal(at('2026-11-21T17:00:00Z'), 'day');      // 12:00 local
  assert.equal(at('2026-11-21T21:00:00Z'), 'evening'); // 16:00 local
  assert.equal(at('2026-11-22T03:30:00Z'), 'night');   // 22:30 local
  assert.equal(at('2026-11-22T09:00:00Z'), 'night');   // 04:00 local, before sunrise
});

test('levels are validated', () => {
  assert.deepEqual(sanitizeLevels({ day: 80, evening: 2, night: 'x' }), { day: 80, evening: 55, night: 30 });
});

test('backlight key sequence matches the proven one', () => {
  const steps = backlightSteps({ ...cfg(), sliderMax: 100 }, 40);
  const keys = steps.flatMap((s) => s.keys);
  assert.deepEqual(keys.slice(0, 6), [KEY.SETTINGS, KEY.DOWN, KEY.DOWN, KEY.OK, KEY.DOWN, KEY.DOWN]);
  assert.equal(keys.filter((k) => k === KEY.LEFT).length, 100);
  assert.equal(keys.filter((k) => k === KEY.RIGHT).length, 40);
  assert.equal(keys.filter((k) => k === KEY.BACK).length, 3);
  assert.throws(() => backlightSteps(cfg(), 101));
});

function fakeRun(log, { awake = true, connected = true } = {}) {
  return async (file, args) => {
    log.push(args.join(' '));
    if (args.includes('connect')) return { code: 0, stdout: 'connected', stderr: '' };
    if (args.includes('get-state')) return connected ? { code: 0, stdout: 'device', stderr: '' } : { code: 1, stdout: '', stderr: 'no' };
    if (args.includes('power')) return { code: 0, stdout: awake ? 'mWakefulness=Awake' : 'mWakefulness=Asleep', stderr: '' };
    return { code: 0, stdout: '', stderr: '' };
  };
}

function makeController({ awake = true, connected = true, nowIso = '2026-11-21T17:00:00Z' } = {}) {
  const log = [];
  const c = cfg(); c.adbPath = 'adb';
  const tv = new Tv(c, fakeRun(log, { awake, connected }), async () => {});
  let now = new Date(nowIso);
  const ctl = new Controller({ cfg: c, tv, now: () => now });
  return { ctl, log, setNow: (iso) => { now = new Date(iso); } };
}

test('backlight is set by ONE on-device script with only 3 commands', () => {
  const sc = backlightScript(cfg(), 40);
  assert.ok(sc.startsWith('input keyevent 176; sleep 1.2; input keyevent 20 20 23; sleep 1.2; input keyevent 20 20 21 21'));
  assert.equal((sc.match(/input keyevent/g) || []).length, 3);
  assert.ok(!sc.includes('\n'));
});

test('controller applies the schedule once and not again', async () => {
  const { ctl, log } = makeController();
  await ctl.tick();
  assert.equal(ctl.snapshot().applied, 'day');
  const n = log.length;
  await ctl.tick();
  assert.equal(log.length, n);
});

test('controller waits while the TV is asleep and catches up', async () => {
  const log = [];
  const c = cfg(); c.adbPath = 'adb';
  let awake = false;
  const tv = new Tv(c, async (f, a) => fakeRun(log, { awake })(f, a), async () => {});
  const ctl = new Controller({ cfg: c, tv, now: () => new Date('2026-11-21T17:00:00Z') });
  await ctl.tick();
  assert.equal(ctl.snapshot().applied, null);
  awake = true;
  await ctl.tick();
  assert.equal(ctl.snapshot().applied, 'day');
});

test('manual mode lasts until the schedule changes; switching auto off freezes it', async () => {
  const { ctl, setNow } = makeController();
  await ctl.tick();
  await ctl.setMode('night');
  assert.equal(ctl.snapshot().mode, 'night');
  setNow('2026-11-21T21:00:00Z');  // schedule moves to evening
  assert.equal(ctl.snapshot().mode, 'evening');
  await ctl.tick();
  assert.equal(ctl.snapshot().applied, 'evening');
  await ctl.setAuto(false);
  assert.equal(ctl.snapshot().autoOn, false);
  await ctl.tick();
  assert.equal(ctl.snapshot().applied, 'evening');   // nothing changes by itself any more
});

test('manual only (the default): nothing happens until a button is tapped', async () => {
  const log = [];
  const c = { ...DEFAULTS, levels: { ...DEFAULTS.levels }, tvHost: '192.0.2.5', adbPath: 'adb' };
  assert.equal(c.autoSchedule, false);
  const tv = new Tv(c, fakeRun(log), async () => {});
  const ctl = new Controller({ cfg: c, tv, now: () => new Date('2026-11-21T17:00:00Z') });
  await ctl.tick();
  assert.equal(log.length, 0);
  assert.equal(ctl.snapshot().mode, null);
  await ctl.setMode('evening');
  assert.equal(ctl.snapshot().applied, 'evening');
  assert.ok(log.some((l) => l.includes('input keyevent 176')));
  await ctl.setMode('day');
  assert.equal(ctl.snapshot().applied, 'day');       // stays until another tap, even hours later
});

test('controller reports an unreachable TV', async () => {
  const { ctl } = makeController({ connected: false });
  await ctl.tick();
  assert.match(ctl.snapshot().lastError, /not reachable/);
});

test('auth: right key passes, wrong key locks out after 5 tries', () => {
  const a = new Auth(null);
  const key = a.addKey();
  assert.ok(a.check(key, '100.64.0.1'));
  for (let i = 0; i < 5; i++) assert.equal(a.check('bad', '100.64.0.2'), false);
  assert.equal(a.check(a.addKey(), '100.64.0.2'), false);  // locked out
});

test('only loopback and Tailscale addresses are allowed by default', () => {
  assert.ok(isAllowedAddress('127.0.0.1'));
  assert.ok(isAllowedAddress('::ffff:100.101.2.3'));
  assert.equal(isAllowedAddress('192.168.1.5'), false);
  assert.ok(isAllowedAddress('192.168.1.5', true));
  assert.equal(isAllowedAddress('8.8.8.8', true), false);
});
