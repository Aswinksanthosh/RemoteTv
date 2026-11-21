import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const KEY = { HOME: 3, BACK: 4, DOWN: 20, LEFT: 21, RIGHT: 22, OK: 23, SETTINGS: 176 };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function runProcess(file, args, { timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    let out = '', err = '', done = false;
    const finish = (code) => { if (!done) { done = true; resolve({ code, stdout: out, stderr: err }); } };
    let p;
    try { p = spawn(file, args, { windowsHide: true }); } catch (e) { return finish(-1); }
    const t = setTimeout(() => { try { p.kill(); } catch { /* ignore */ } finish(-2); }, timeout);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', () => { clearTimeout(t); finish(-1); });
    p.on('close', (c) => { clearTimeout(t); finish(c); });
  });
}

// Find adb: PATH first, then the winget platform-tools folder on Windows.
export async function findAdb(cfgPath = '', run = runProcess) {
  if (cfgPath) return cfgPath;
  if ((await run('adb', ['version'])).code === 0) return 'adb';
  const base = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  if (base && fs.existsSync(base)) {
    for (const d of fs.readdirSync(base)) {
      if (!d.startsWith('Google.PlatformTools')) continue;
      const exe = path.join(base, d, 'platform-tools', 'adb.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

// The exact button presses proven on the TV: Settings, Down x2, OK (Picture),
// Down x2 (Backlight), then Left to the bottom and Right up to the target.
export function backlightSteps(cfg, target) {
  const t = Math.round(target);
  if (!Number.isInteger(t) || t < 0 || t > cfg.sliderMax) throw new Error('backlight must be 0..' + cfg.sliderMax);
  const steps = [
    { keys: [KEY.SETTINGS], wait: cfg.menuDelayMs },
    { keys: [KEY.DOWN], wait: 400 },
    { keys: [KEY.DOWN], wait: 400 },
    { keys: [KEY.OK], wait: cfg.menuDelayMs },
    { keys: [KEY.DOWN], wait: 400 },
    { keys: [KEY.DOWN], wait: 600 },
  ];
  const rep = (key, n) => {
    for (let i = 0; i < n; i += cfg.keyChunk) {
      steps.push({ keys: Array(Math.min(cfg.keyChunk, n - i)).fill(key), wait: cfg.keyDelayMs });
    }
  };
  rep(KEY.LEFT, cfg.sliderMax);
  rep(KEY.RIGHT, t);
  steps.push({ keys: [], wait: 800 });
  for (let i = 0; i < cfg.exitBacks; i++) steps.push({ keys: [KEY.BACK], wait: 500 });
  return steps;
}

export class Tv {
  constructor(cfg, run = runProcess, pause = sleep) {
    this.cfg = cfg; this.run = run; this.pause = pause; this.adbPath = cfg.adbPath || null;
  }
  get serial() { return `${this.cfg.tvHost}:${this.cfg.tvPort}`; }
  async exe() {
    if (!this.adbPath) this.adbPath = await findAdb('', this.run);
    if (!this.adbPath) throw new Error('adb not found: install it with "winget install Google.PlatformTools"');
    return this.adbPath;
  }
  async adb(args, opts) { return this.run(await this.exe(), ['-s', this.serial, ...args], opts); }
  async connect() {
    if (!this.cfg.tvHost) throw new Error('TV address not set (run with --tv <ip>)');
    await this.run(await this.exe(), ['connect', this.serial]);
    const r = await this.adb(['get-state']);
    return r.code === 0 && /device/.test(r.stdout);
  }
  // Only "asleep" when the TV clearly says so; an unclear answer counts as awake.
  async isAwake() {
    const r = await this.adb(['shell', 'dumpsys', 'power']);
    const w = /mWakefulness=(\w+)/.exec(r.stdout);
    if (w) return w[1] === 'Awake';
    const d = /Display Power: state=(\w+)/.exec(r.stdout);
    if (d) return d[1] === 'ON';
    return true;
  }
  async setBacklight(target) {
    for (const s of backlightSteps(this.cfg, target)) {
      if (s.keys.length) {
        const r = await this.adb(['shell', 'input', 'keyevent', ...s.keys.map(String)]);
        if (r.code !== 0) throw new Error('ADB key press failed: ' + (r.stderr || r.stdout || r.code).toString().trim());
      }
      await this.pause(s.wait);
    }
  }
}
