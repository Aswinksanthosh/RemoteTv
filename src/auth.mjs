import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const newKey = () => crypto.randomBytes(24).toString('base64url');
export const hashKey = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');

// The TV controller keeps only a fingerprint of each phone key, never the key itself.
export class Auth {
  constructor(dir) {
    this.file = dir ? path.join(dir, 'auth.json') : null;
    this.hashes = [];
    this.fails = new Map();
    if (this.file) {
      try { this.hashes = JSON.parse(fs.readFileSync(this.file, 'utf8')).hashes || []; } catch { /* first run */ }
    }
  }
  _save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ hashes: this.hashes }));
  }
  hasKeys() { return this.hashes.length > 0; }
  addKey({ replace = false } = {}) {
    const key = newKey();
    this.hashes = replace ? [hashKey(key)] : [...this.hashes, hashKey(key)];
    this._save();
    return key;
  }
  check(key, ip, now = Date.now()) {
    const f = this.fails.get(ip);
    if (f && f.until > now) return false;
    const h = Buffer.from(hashKey(key || ''));
    const ok = this.hashes.some((x) => crypto.timingSafeEqual(Buffer.from(x), h));
    if (ok) { this.fails.delete(ip); return true; }
    const n = (f ? f.n : 0) + 1;
    this.fails.set(ip, { n, until: n >= 5 ? now + 5 * 60000 : 0 });
    return false;
  }
}
