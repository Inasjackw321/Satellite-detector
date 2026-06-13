/** ORBITAL — small pure formatting helpers. */

/** Convert a decimal degree to DMS with hemisphere suffix. */
export function toDMS(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = Math.round((minFull - min) * 60);
  return `${deg}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″${hemi}`;
}

export function formatLatLon(lat, lon) {
  return `${toDMS(lat, true)}  ${toDMS(lon, false)}`;
}

export function formatLatLonDecimal(lat, lon) {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/** Human "time since" from an ISO date string. */
export function timeAgo(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.max(0, (Date.now() - then) / 1000);
  const units = [
    ['y', 31536000],
    ['mo', 2592000],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];
  for (const [label, secs] of units) {
    if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  }
  return 'just now';
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

/** Date stamp for NASA GIBS layers (uses yesterday in UTC for full coverage). */
export function gibsDate() {
  const d = new Date(Date.now() - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/** Decimal degrees with hemisphere, e.g. "23.1323° N" (matches WAVE2MAP). */
export function decDeg(value, isLat) {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(4)}° ${hemi}`;
}

/** UTM zone number for a longitude (1–60). */
export function utmZone(lon) {
  const norm = (((lon + 180) % 360) + 360) % 360;
  return Math.floor(norm / 6) + 1;
}

/** MGRS latitude band letter (C–X, excluding I and O). */
export function mgrsBand(lat) {
  const bands = 'CDEFGHJKLMNPQRSTUVWX';
  const i = Math.floor((clamp(lat, -80, 83.999) + 80) / 8);
  return bands[clamp(i, 0, bands.length - 1)];
}

/** Escape text destined for innerHTML. */
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}
