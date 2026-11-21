#!/usr/bin/env node
// Used by Install.cmd: saves the TV address, checks the TV connection, pairs the phone (QR).
import readline from 'node:readline/promises';
import { loadConfig, saveConfig, dataDir } from '../src/config.mjs';
import { parseArgs } from '../src/cli.mjs';
import { Tv, sleep } from '../src/adb.mjs';
import { Auth } from '../src/auth.mjs';
import { showLink } from '../src/pairing.mjs';

const args = parseArgs(process.argv.slice(2));
const dir = dataDir();
const cfg = loadConfig(dir);
if (typeof args.tv === 'string') cfg.tvHost = args.tv;
if (!cfg.tvHost) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log('TV address: on the TV open Settings > Device & Software > About > Network and read the IP Address.');
  cfg.tvHost = (await rl.question('TV IP address: ')).trim();
  rl.close();
}
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(cfg.tvHost)) { console.error('That is not an IP address like 192.168.1.20'); process.exit(1); }
saveConfig(cfg, dir);

const tv = new Tv(cfg);
try { await tv.exe(); } catch (e) { console.error(e.message); process.exit(2); }
let ok = false;
for (let i = 1; i <= 4 && !ok; i++) {
  console.log(`Connecting to the TV (try ${i} of 4)... If a box "Allow debugging?" appears on the TV, tick "Always allow" and choose OK.`);
  ok = await tv.connect().catch(() => false);
  if (!ok) await sleep(8000);
}
if (!ok) { console.error('Could not reach the TV. Check: TV is on, ADB debugging is ON (Developer Options), same Wi-Fi, correct IP.'); process.exit(3); }
console.log('TV connected.');

const auth = new Auth(dir);
if (!auth.hasKeys() || args.reset) showLink(cfg.port, auth.addKey({ replace: true }));
else console.log('The phone is already paired. To pair a new phone double-click Pair-Phone.cmd.');
