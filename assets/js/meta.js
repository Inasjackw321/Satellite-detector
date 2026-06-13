/**
 * Warsummary maps — synthetic Sentinel-2 scene metadata.
 * Generates stable, plausible acquisition details (satellite, date, UTC pass
 * time, cloud cover, MGRS-style scene id) deterministically from a location so
 * values never flicker between renders.
 */
import { utmZone, mgrsBand } from './format.js';

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG. */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const GRID_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O

/**
 * @param {{id?:string,name?:string,lat:number,lon:number,date?:string}} loc
 */
export function generateSceneMeta(loc) {
  const seed = hashStr(`${loc.id || loc.name || ''}|${loc.lat.toFixed(3)}|${loc.lon.toFixed(3)}`);
  const rng = mulberry32(seed);

  const isB = rng() < 0.5;
  const satCode = isB ? 'S2B' : 'S2A';
  const satName = isB ? 'Sentinel-2B' : 'Sentinel-2A';

  // Acquisition date: the event date if we have one, else within ~45 days.
  let d = loc.date ? new Date(loc.date) : new Date(Date.now() - Math.floor(rng() * 45) * 86400000);
  if (Number.isNaN(d.getTime())) d = new Date();
  const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const ymdC = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

  // Sentinel-2 crosses ~10:30 local solar time → convert to UTC by longitude.
  const localMin = 10 * 60 + 30 + Math.floor(rng() * 22);
  let utcMin = localMin - (loc.lon / 15) * 60;
  utcMin = ((utcMin % 1440) + 1440) % 1440;
  const timeUTC = `${pad(Math.floor(utcMin / 60))}:${pad(Math.floor(utcMin % 60))}:${pad(Math.floor(rng() * 60))}`;

  // Cloud cover skewed toward clear.
  const cloudPct = Math.round(rng() * rng() * 62 * 10) / 10;

  // MGRS-style tile id, e.g. 17QLF
  const tile = `${utmZone(loc.lon)}${mgrsBand(loc.lat)}${GRID_LETTERS[Math.floor(rng() * GRID_LETTERS.length)]}${GRID_LETTERS[Math.floor(rng() * GRID_LETTERS.length)]}`;
  const sceneId = `${satCode}_${tile}_${ymdC}_${1 + Math.floor(rng() * 5)}_L2A`;

  return { satName, ymd, timeUTC, cloudPct, sceneId };
}

export function cloudLabel(pct) {
  if (pct < 10) return 'Clear sky';
  if (pct < 25) return 'Mostly clear';
  if (pct < 50) return 'Partly cloudy';
  if (pct < 75) return 'Cloudy';
  return 'Overcast';
}
