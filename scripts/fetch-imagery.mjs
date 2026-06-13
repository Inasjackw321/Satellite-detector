#!/usr/bin/env node
/**
 * WAVE2MAP — Sentinel-2 imagery downloader.
 *
 * Uses NASA EONET (natural-event tracker) to find current disaster locations,
 * then downloads a Sentinel-2 image for each area and writes:
 *   data/scenes/scene-NN.jpg   (the imagery)
 *   data/scenes.json           (manifest the website reads in ARCHIVE mode)
 *
 * Imagery providers:
 *   - default: EOX "Sentinel-2 cloudless" WMS (key-less, no account needed)
 *   - optional: Sentinel Hub Process API for fresh, date-filtered S2 L2A
 *     (enabled automatically when SH_CLIENT_ID / SH_CLIENT_SECRET are set)
 *
 * Tunable via env: LIMIT, DAYS, WIDTH, HEIGHT, EOX_LAYER, SH_CLIENT_ID,
 * SH_CLIENT_SECRET. Designed to run in GitHub Actions (runners have internet).
 */
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateSceneMeta, cloudLabel } from '../assets/js/meta.js';
import { SHOWCASE_CITIES } from '../assets/js/scenes.js';
import { categoryMeta } from '../assets/js/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'data', 'scenes');
const MANIFEST = join(ROOT, 'data', 'scenes.json');

const env = process.env;
const LIMIT = clampInt(env.LIMIT, 12, 1, 40);
const DAYS = clampInt(env.DAYS, 30, 1, 365);
const WIDTH = clampInt(env.WIDTH, 1024, 256, 2048);
const HEIGHT = clampInt(env.HEIGHT, 768, 256, 2048);
const EOX_LAYER = env.EOX_LAYER || 's2cloudless-2020';
const SH_ID = env.SH_CLIENT_ID || '';
const SH_SECRET = env.SH_CLIENT_SECRET || '';
const DRY = env.DRY_RUN === '1' || env.DRY_RUN === 'true';

function clampInt(v, def, lo, hi) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timedFetch(url, ms, opts = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ----------------------------- web mercator ----------------------------- */
const R = 6378137;
const lonToX = (lon) => (lon * Math.PI) / 180 * R;
const latToY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;

function bbox3857(lat, lon, spanKm) {
  const cx = lonToX(lon);
  const cy = latToY(Math.max(-85, Math.min(85, lat)));
  const halfY = (spanKm * 1000) / 2;
  const halfX = (halfY * WIDTH) / HEIGHT;
  return [cx - halfX, cy - halfY, cx + halfX, cy + halfY];
}
function spanForZoom(z) {
  return Math.max(10, Math.min(160, 14 * Math.pow(2, 13 - (z || 12))));
}

/* -------------------------------- EONET --------------------------------- */
function cleanName(t) {
  const p = String(t).split(/\s[—–-]\s/);
  return (p[p.length - 1] || t).trim();
}

async function fetchEonet() {
  const url = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${DAYS}&limit=200`;
  const res = await timedFetch(url, 15000);
  if (!res.ok) throw new Error('EONET ' + res.status);
  const data = await res.json();
  const out = [];
  for (const ev of data.events || []) {
    const g = (ev.geometry || [])
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!g) continue;
    let lon;
    let lat;
    if (g.type === 'Point') {
      [lon, lat] = g.coordinates;
    } else if (g.type === 'Polygon') {
      const ring = g.coordinates[0] || [];
      if (!ring.length) continue;
      let sx = 0;
      let sy = 0;
      for (const [x, y] of ring) {
        sx += x;
        sy += y;
      }
      lon = sx / ring.length;
      lat = sy / ring.length;
    } else continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const cat = ev.categories?.[0] || { id: 'unknown', title: 'Event' };
    const m = categoryMeta(cat.id);
    out.push({
      id: ev.id,
      name: cleanName(ev.title),
      lat,
      lon,
      date: g.date,
      zoom: Math.min(13, Math.max(10, m.zoom)),
      category: { id: cat.id, title: cat.title, color: m.color, icon: m.icon },
    });
  }
  return out;
}

/* ---------------------------- reverse geocode --------------------------- */
async function geocode(lat, lon) {
  try {
    const res = await timedFetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      9000
    );
    if (!res.ok) return { place: null, country: null };
    const j = await res.json();
    return {
      place: j.city || j.locality || j.principalSubdivision || null,
      country: j.countryName || null,
    };
  } catch {
    return { place: null, country: null };
  }
}

/* ---------------------------- imagery providers ------------------------- */
async function sentinelHubToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SH_ID,
    client_secret: SH_SECRET,
  });
  const res = await fetch('https://services.sentinel-hub.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('SH token ' + res.status);
  return (await res.json()).access_token;
}

const EVALSCRIPT = `//VERSION=3
function setup(){return {input:["B02","B03","B04"],output:{bands:3}};}
function evaluatePixel(s){return [2.5*s.B04, 2.5*s.B03, 2.5*s.B02];}`;

async function fetchSentinelHub(token, bb, fromISO, toISO) {
  const payload = {
    input: {
      bounds: {
        bbox: bb,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: { from: fromISO, to: toISO },
            maxCloudCoverage: 40,
            mosaickingOrder: 'leastCC',
          },
        },
      ],
    },
    output: {
      width: WIDTH,
      height: HEIGHT,
      responses: [{ identifier: 'default', format: { type: 'image/jpeg' } }],
    },
    evalscript: EVALSCRIPT,
  };
  const res = await fetch('https://services.sentinel-hub.com/api/v1/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('SH process ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

function eoxUrl(bb) {
  const u = new URL('https://tiles.maps.eox.at/wms');
  u.search = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetMap',
    layers: EOX_LAYER,
    styles: '',
    srs: 'EPSG:3857',
    bbox: bb.join(','),
    width: String(WIDTH),
    height: String(HEIGHT),
    format: 'image/jpeg',
  }).toString();
  return u.toString();
}

async function fetchEOX(bb) {
  const res = await timedFetch(eoxUrl(bb), 30000);
  if (!res.ok) throw new Error('EOX ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error('EOX returned a non-JPEG response');
  }
  return buf;
}

/* --------------------------------- main --------------------------------- */
async function main() {
  console.log(`WAVE2MAP imagery fetch · limit=${LIMIT} days=${DAYS} size=${WIDTH}x${HEIGHT}`);

  let locations = [];
  let source = 'eonet';
  try {
    locations = await fetchEonet();
    if (!locations.length) throw new Error('no open events');
    console.log(`NASA EONET: ${locations.length} disaster locations`);
  } catch (e) {
    console.warn(`EONET unavailable (${e.message}) — using showcase locations`);
    source = 'showcase';
    locations = SHOWCASE_CITIES.map((c) => ({
      id: slug(c.name),
      name: c.name,
      country: c.country,
      lat: c.lat,
      lon: c.lon,
      zoom: c.zoom || 12,
      date: null,
      category: null,
    }));
  }
  locations = locations.slice(0, LIMIT);

  let provider = SH_ID && SH_SECRET ? 'sentinel-hub' : 'eox-s2cloudless';
  let token = null;
  if (provider === 'sentinel-hub') {
    try {
      token = await sentinelHubToken();
      console.log('Sentinel Hub: authenticated (fresh L2A imagery)');
    } catch (e) {
      console.warn(`Sentinel Hub auth failed (${e.message}) — using EOX cloudless`);
      provider = 'eox-s2cloudless';
    }
  } else {
    console.log('Provider: EOX Sentinel-2 cloudless (key-less)');
  }

  if (!DRY) {
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });
  }

  const scenes = [];
  let i = 0;
  for (const loc of locations) {
    i += 1;
    const idx = String(i).padStart(2, '0');
    const file = `scene-${idx}.jpg`;
    const span = spanForZoom(loc.zoom);
    const bb = bbox3857(loc.lat, loc.lon, span);

    if (DRY) {
      console.log(`  [${idx}] ${loc.name} (~${span.toFixed(0)} km)`);
      console.log(`        bbox3857=[${bb.map((n) => Math.round(n)).join(', ')}]`);
      console.log(`        GET ${eoxUrl(bb)}`);
      continue;
    }

    let buf = null;
    let used = provider;
    try {
      if (token) {
        const to = loc.date ? new Date(loc.date) : new Date();
        const from = new Date(to.getTime() - 45 * 86400000);
        buf = await fetchSentinelHub(token, bb, from.toISOString(), to.toISOString());
      } else {
        buf = await fetchEOX(bb);
      }
    } catch (e) {
      console.warn(`  [${idx}] ${used} failed: ${e.message}${token ? ' — retrying with EOX' : ''}`);
      if (token) {
        try {
          buf = await fetchEOX(bb);
          used = 'eox-s2cloudless';
        } catch (e2) {
          console.warn(`  [${idx}] EOX also failed: ${e2.message}`);
        }
      }
    }
    if (!buf) {
      console.warn(`  [${idx}] skipped ${loc.name}`);
      continue;
    }
    await writeFile(join(OUT_DIR, file), buf);

    // Enrich place / country for disaster points that lack them.
    let name = loc.name;
    let country = loc.country || null;
    if (!country) {
      const g = await geocode(loc.lat, loc.lon);
      country = g.country;
      if (g.place) name = g.place;
    }

    const meta = generateSceneMeta({ name, lat: loc.lat, lon: loc.lon, date: loc.date });
    scenes.push({
      id: loc.id,
      name,
      country: country || null,
      lat: loc.lat,
      lon: loc.lon,
      zoom: loc.zoom || 12,
      date: loc.date || meta.ymd,
      category: loc.category,
      image: `data/scenes/${file}`,
      provider: used,
      bbox3857: bb.map((n) => Math.round(n)),
      satName: meta.satName,
      acquired: meta.ymd,
      timeUTC: meta.timeUTC,
      cloudPct: meta.cloudPct,
      cloudLabel: cloudLabel(meta.cloudPct),
      sceneId: meta.sceneId,
    });
    console.log(`  [${idx}] ${name} — ${(buf.length / 1024).toFixed(0)} KB (${used}, ~${span.toFixed(0)} km)`);
    await sleep(300);
  }

  if (DRY) {
    console.log('\nDRY_RUN — no images downloaded, manifest untouched.');
    return;
  }

  const manifest = {
    generated: new Date().toISOString(),
    source,
    provider,
    width: WIDTH,
    height: HEIGHT,
    count: scenes.length,
    scenes,
  };
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote ${scenes.length} scene(s) → data/scenes.json`);
  if (!scenes.length) {
    console.error('No imagery downloaded — leaving manifest empty.');
    process.exitCode = 1;
  }
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
