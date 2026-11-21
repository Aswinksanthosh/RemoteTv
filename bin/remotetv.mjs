#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, saveConfig, dataDir, sanitizeLevels } from '../src/config.mjs';
import { parseArgs, tailscaleAddress } from '../src/cli.mjs';
import { Tv } from '../src/adb.mjs';
import { Controller } from '../src/controller.mjs';
import { Auth } from '../src/auth.mjs';
import { createServer } from '../src/server.mjs';

const args = parseArgs(process.argv.slice(2));
const dir = dataDir();
const cfg = loadConfig(dir);
let changed = false;
if (typeof args.tv === 'string') { cfg.tvHost = args.tv; changed = true; }
if (typeof args.adb === 'string') { cfg.adbPath = args.adb; changed = true; }
if (typeof args.port === 'string') { cfg.port = Number(args.port); changed = true; }
if (changed) saveConfig(cfg, dir);
if (!cfg.tvHost) { console.error('Set the TV address first:  node bin/remotetv.mjs --tv <tv-ip>'); process.exit(1); }

const stateFile = path.join(dir, 'state.json');
const controller = new Controller({
  cfg, tv: new Tv(cfg),
  saveCfg: (c) => saveConfig(c, dir),
  loadState: () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } },
  saveState: (s) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); },
});
const auth = new Auth(dir);
const host = tailscaleAddress() || 'localhost';
if (!auth.hasKeys()) {
  const key = auth.addKey();
  console.log(`\nPhone link (keep it private):\n  http://${host}:${cfg.port}/?k=${key}\n`);
}
createServer({ cfg, controller, auth, sanitizeLevels }).listen(cfg.port, () => console.log(`RemoteTv listening on port ${cfg.port}. Data folder: ${dir}`));
controller.tick();
setInterval(() => controller.tick(), cfg.tickSeconds * 1000);
