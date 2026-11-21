'use strict';
const key = new URLSearchParams(location.search).get('k') || '';
const $ = (id) => document.getElementById(id);
let state = null;

async function api(path, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-key': key, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('Not paired: open the link from the laptop again');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

function hhmm(iso, tz) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz });
}

function render(s) {
  state = s;
  $('mode').textContent = s.mode + ' (' + s.level + ')';
  const bits = [];
  if (s.paused) bits.push('Schedule paused');
  if (s.override) bits.push('Manual choice until the schedule changes');
  bits.push(s.applied ? 'On TV: ' + s.applied + ' at ' + s.appliedLevel : 'Not applied yet');
  $('detail').textContent = bits.join(' · ');
  $('next').textContent = s.next ? 'Next: ' + s.next.mode + ' at ' + hhmm(s.next.at, s.timezone) : '';
  $('error').textContent = s.lastError || '';
  $('status').textContent = 'TV ' + (s.tv.reachable === null ? 'not checked' : s.tv.reachable ? (s.tv.awake ? 'connected' : 'asleep') : 'not reachable') + (s.busy ? ' · working...' : '');
  $('pause').textContent = s.paused ? 'Resume schedule' : 'Pause schedule';
  document.querySelectorAll('button[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === s.override));
  for (const k of ['day', 'evening', 'night']) {
    const el = $('lv-' + k);
    if (document.activeElement !== el) el.value = s.levels[k];
  }
}

async function run(fn) {
  try { render(await fn()); } catch (e) { $('error').textContent = e.message; }
}

document.querySelectorAll('button[data-mode]').forEach((b) => b.addEventListener('click', () => run(() => api('/api/mode', { mode: b.dataset.mode }))));
$('pause').addEventListener('click', () => run(() => api('/api/paused', { paused: !(state && state.paused) })));
$('save').addEventListener('click', () => run(() => api('/api/levels', { day: Number($('lv-day').value), evening: Number($('lv-evening').value), night: Number($('lv-night').value) })));
run(() => api('/api/state'));
setInterval(() => run(() => api('/api/state')), 5000);
