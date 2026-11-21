import { sunTimesForYmd, ymdInTz } from './sun.mjs';

// Day starts at sunrise, evening a bit before sunset, night a while after sunset.
export function eventsAround(now, cfg) {
  const events = [];
  for (const off of [-1, 0, 1]) {
    const when = new Date(now.getTime() + off * 86400000);
    const s = sunTimesForYmd(ymdInTz(when, cfg.timezone), cfg.lat, cfg.lon);
    if (!s) continue;
    events.push({ at: s.sunrise, mode: 'day' });
    events.push({ at: new Date(s.sunset.getTime() - cfg.eveningBeforeSunsetMin * 60000), mode: 'evening' });
    events.push({ at: new Date(s.sunset.getTime() + cfg.nightAfterSunsetMin * 60000), mode: 'night' });
  }
  return events.sort((a, b) => a.at - b.at);
}

export function modeAt(now, cfg) {
  let cur = null;
  let next = null;
  for (const e of eventsAround(now, cfg)) {
    if (e.at <= now) cur = e;
    else { next = e; break; }
  }
  return { mode: cur ? cur.mode : 'night', since: cur ? cur.at : null, next };
}
