import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const FILES = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };

export function isAllowedAddress(raw, allowLan = false) {
  const a = String(raw || '').replace(/^::ffff:/, '');
  if (a === '::1') return true;
  const m = a.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return /^fd7a:115c:a1e0:/i.test(a);   // Tailscale IPv6
  const o1 = Number(m[1]), o2 = Number(m[2]);
  if (o1 === 127) return true;
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;   // Tailscale
  if (allowLan && (o1 === 10 || (o1 === 172 && o2 >= 16 && o2 <= 31) || (o1 === 192 && o2 === 168))) return true;
  return false;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > 4096) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export function createServer({ cfg, controller, auth, sanitizeLevels, version = '', updater = null, restart = () => {} }) {
  return http.createServer(async (req, res) => {
    try {
      if (!isAllowedAddress(req.socket.remoteAddress, cfg.allowLan)) return send(res, 403, { error: 'forbidden' });
      const url = new URL(req.url, 'http://x');
      if (!url.pathname.startsWith('/api/')) {
        const f = FILES[url.pathname];
        if (!f || req.method !== 'GET') return send(res, 404, 'not found', 'text/plain');
        return send(res, 200, fs.readFileSync(path.join(WEB, f)), TYPES[path.extname(f)]);
      }
      if (!auth.check(req.headers['x-key'], req.socket.remoteAddress)) return send(res, 401, { error: 'unauthorized' });
      const post = req.method === 'POST';
      if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, { ...controller.snapshot(), version });
      if (!post) return send(res, 404, { error: 'not found' });
      const body = await readBody(req);
      if (url.pathname === '/api/mode') return send(res, 200, await controller.setMode(body.mode));
      if (url.pathname === '/api/auto') return send(res, 200, await controller.setAuto(body.auto));
      if (url.pathname === '/api/levels') return send(res, 200, await controller.setLevels(body, sanitizeLevels));
      if (url.pathname === '/api/update') {
        if (!updater) return send(res, 400, { error: 'updates are not available' });
        const r = await updater();
        send(res, 200, { ...r, version });
        if (r.updated) setTimeout(restart, 500);
        return;
      }
      if (url.pathname === '/api/apply') return send(res, 200, await controller.reapply());
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 400, { error: String(e.message || e) });
    }
  });
}
