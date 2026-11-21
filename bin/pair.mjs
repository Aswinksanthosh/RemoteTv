#!/usr/bin/env node
// Make a new phone link. The old links stop working unless you pass --add.
import { loadConfig, dataDir } from '../src/config.mjs';
import { parseArgs } from '../src/cli.mjs';
import { Auth } from '../src/auth.mjs';
import { showLink } from '../src/pairing.mjs';

const args = parseArgs(process.argv.slice(2));
showLink(loadConfig().port, new Auth(dataDir()).addKey({ replace: !args.add }));
