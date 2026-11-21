#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, saveConfig, dataDir, sanitizeLevels } from '../src/config.mjs';
import { parseArgs } from '../src/cli.mjs';
import { Tv } from '../src/adb.mjs';
import { Controller } from '../src/controller.mjs';
import { Auth } from '../src/auth.mjs';
import { createServer } from '../src/server.mjs';
import { showLink } from '../src/pairing.mjs';
import { gitUpdate, versionInfo } from '../src/update.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const dir = dataDir();
const cfg = loadConfig(dir);
let changed = false;
if (typeof args.tv === 'string') { cfg.tvHost = args.tv; changed = true; }
if (typeof args.adb === 'string') { cfg.adbPath = args.adb; changed = true; }
if (typeof args.port === 'string') { cfg.port = Number(args.port); changed = true; }
if (changed) saveConfig(cfg, dir);
if (!cfg.tvHost) { console.error('Run Install.cmd first, or: node bin/remotetv.mjs --tv <tv-ip>'); process.exit(1); }

const stateFile = path.join(dir, 'state.json');
const tv = new Tv(cfg);
const controller = new Controller({
  cfg, tv,
  saveCfg: (c) => saveConfig(c, dir),
  loadState: () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return {}; } },
  saveState: (s) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(stateFile, JSON.stringify(s)); },
});
const auth = new Auth(dir);
if (!auth.hasKeys()) showLink(cfg.port, auth.addKey());
const version = await versionInfo(root);
const server = createServer({
  cfg, controller, auth, sanitizeLevels, version, tv,
  updater: () => gitUpdate(root),
  restart: () => process.exit(75),   // the launcher (start.ps1) starts it again
});
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.error('Already running on this port.'); process.exit(0); }
  throw e;
});
server.listen(cfg.port, () => console.log(`${new Date().toISOString()} RemoteTv ${version} listening on port ${cfg.port}. Data folder: ${dir}`));
controller.tick();
setInterval(() => controller.tick(), cfg.tickSeconds * 1000);
