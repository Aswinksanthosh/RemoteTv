import { qrToConsole } from './qr.mjs';
import { tailscaleAddress } from './cli.mjs';

export function showLink(port, key) {
  const ts = tailscaleAddress();
  const link = `http://${ts || 'localhost'}:${port}/?k=${key}`;
  console.log('\nScan this with the phone Camera (Tailscale must be on), then Add to Home Screen:\n');
  console.log(qrToConsole(link));
  console.log(`\nLink (keep it private):\n  ${link}\n`);
  if (!ts) console.log('Tailscale was not found on this laptop: install it and sign in, or the phone cannot reach the page.\n');
}
