import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULTS = {
  tvHost: '',            // set with --tv <ip>
  tvPort: 5555,
  adbPath: '',           // empty = find adb automatically
  port: 8793,
  allowLan: false,       // false = only this laptop and your Tailscale devices
  timezone: 'America/Toronto',
  lat: 43.65,
  lon: -79.38,
  levels: { day: 78, evening: 55, night: 30 },
  eveningBeforeSunsetMin: 60,
  nightAfterSunsetMin: 120,
  sliderMax: 100,        // Backlight slider goes 0..sliderMax, one step per key press
  keyChunk: 10,
  keyDelayMs: 150,
  menuDelayMs: 1500,
  exitBacks: 3,
  tickSeconds: 60,
};

export function dataDir() {
  return process.env.REMOTETV_HOME || path.join(os.homedir(), '.remotetv');
}

export function sanitizeLevels(l, base = DEFAULTS.levels) {
  const out = { ...base };
  for (const k of ['day', 'evening', 'night']) {
    const v = Number(l?.[k]);
    if (Number.isInteger(v) && v >= 5 && v <= 100) out[k] = v;
  }
  return out;
}

export function loadConfig(dir = dataDir()) {
  let user = {};
  try { user = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); } catch { /* first run */ }
  const cfg = { ...DEFAULTS, ...user };
  cfg.levels = sanitizeLevels(user.levels);
  return cfg;
}

export function saveConfig(cfg, dir = dataDir()) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(cfg, null, 2));
}
