import os from 'node:os';

export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const nxt = argv[i + 1];
      if (nxt === undefined || nxt.startsWith('--')) out[a.slice(2)] = true;
      else { out[a.slice(2)] = nxt; i++; }
    } else (out._ ||= []).push(a);
  }
  return out;
}

export function tailscaleAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address)) return i.address;
    }
  }
  return null;
}
