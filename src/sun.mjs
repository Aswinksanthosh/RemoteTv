// Sunrise and sunset from the standard "sunrise equation". No network needed.
const rad = Math.PI / 180;

export function ymdInTz(date, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: g('year'), m: g('month'), d: g('day') };
}

// lon: east is positive (Toronto is negative). Returns null near the poles.
export function sunTimesForYmd({ y, m, d }, lat, lon) {
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0);
  const js = n - lon / 360;
  const M = (((357.5291 + 0.98560028 * js) % 360) + 360) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (((M + C + 180 + 102.9372) % 360) + 360) % 360;
  const jt = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinD = Math.sin(L * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  if (cosW > 1 || cosW < -1) return null;
  const w = Math.acos(cosW) / rad;
  const toDate = (j) => new Date((j - 2440587.5) * 86400000);
  return { sunrise: toDate(jt - w / 360), sunset: toDate(jt + w / 360) };
}
