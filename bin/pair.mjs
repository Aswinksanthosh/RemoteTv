#!/usr/bin/env node
// Make a new phone link. The old links stop working unless you pass --add.
import { loadConfig, dataDir } from '../src/config.mjs';
import { parseArgs, tailscaleAddress } from '../src/cli.mjs';
import { Auth } from '../src/auth.mjs';

const args = parseArgs(process.argv.slice(2));
const cfg = loadConfig();
const key = new Auth(dataDir()).addKey({ replace: !args.add });
console.log(`\nPhone link (keep it private):\n  http://${tailscaleAddress() || 'localhost'}:${cfg.port}/?k=${key}\n`);
