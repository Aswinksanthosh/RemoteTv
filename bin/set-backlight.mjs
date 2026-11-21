#!/usr/bin/env node
// Test the key-press method by hand:  node bin/set-backlight.mjs 40 [--dry]
import { loadConfig } from '../src/config.mjs';
import { parseArgs } from '../src/cli.mjs';
import { Tv, backlightSteps, resetSteps } from '../src/adb.mjs';

const args = parseArgs(process.argv.slice(2));
const cfg = loadConfig();
if (typeof args.tv === 'string') cfg.tvHost = args.tv;
const word = (args._ || [])[0];
const isReset = word === 'reset';
const target = Number(word);
if (!isReset && !Number.isInteger(target)) { console.error('Usage: node bin/set-backlight.mjs <0-100 | reset> [--tv <ip>] [--dry] [--force]'); process.exit(1); }
if (args.dry) {
  console.log((isReset ? resetSteps(cfg) : backlightSteps(cfg, target)).map((s) => `${s.keys.length} key(s) [${s.keys.join(',')}], wait ${s.wait} ms`).join('\n'));
  process.exit(0);
}
const tv = new Tv(cfg);
if (!(await tv.connect())) { console.error('TV not reachable'); process.exit(1); }
if (!args.force && !(await tv.isAwake())) { console.error('TV is asleep'); process.exit(1); }
if (isReset) await tv.resetBacklight(); else await tv.setBacklight(target);
console.log('Done.');
