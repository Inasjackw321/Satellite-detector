#!/usr/bin/env node
/**
 * WAVE2MAP — Sentinel-2 imagery downloader.
 *
 * Downloads a Sentinel-2 image for each tracked coordinate (assets/js/targets.js)
 * and writes:
 *   data/scenes/scene-NN.jpg   (the imagery)
 *   data/scenes.json           (manifest the website reads in ARCHIVE mode)
 *
 * Imagery providers:
 *   - default: EOX "Sentinel-2 cloudless" WMTS tiles, stitched (key-less)
 *   - optional: Sentinel Hub Process API for fresh, date-filtered S2 L2A
 *     (enabled automatically when SH_CLIENT_ID / SH_CLIENT_SECRET are set)
 *
 * Tunable via env: LIMIT, WIDTH, HEIGHT, EOX_LAYER, SH_CLIENT_ID,
 * SH_CLIENT_SECRET. Designed to run in GitHub Actions (runners have internet).
 */
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateSceneMeta, cloudLabel } from '../assets/js/meta.js';
import { TARGETS } from '../assets/js/targets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'data', 'scenes');
const MANIFEST = join(ROOT, 'data', 'scenes.json');

const env = process.env;
const LIMIT = clampInt(env.LIMIT, 12, 1, 40);
const WIDTH = clampInt(env.WIDTH, 1024, 256, 2048);
const HEIGHT = clampInt(env.HEIGHT, 768, 256, 2048);
const EOX_LAYER = env.EOX_LAYER || 's2cloudless-2020_3857';
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

/* ----------------------- WMTS tiling (s2cloudless) ---------------------- *
 * tiles.maps.eox.at is a tile cache: it rejects arbitrary WMS GetMap bbox
 * requests (HTTP 400). So we fetch the proven WMTS tiles the website already
 * uses (s2cloudless-2020_3857, GoogleMapsCompatible grid "g") and stitch them
 * into the framed image with sharp.
 */
const WORLD = Math.PI * R; // 20037508.342789244
const EOX_MAX_Z = clampInt(env.EOX_MAX_Z, 16, 6, 18);
const resAt = (z) => (2 * WORLD) / (256 * Math.pow(2, z));

function eoxTileUrl(z, x, y) {
  return `https://tiles.maps.eox.at/wmts/1.0.0/${EOX_LAYER}/default/g/${z}/${y}/${x}.jpg`;
}

/** Pick the zoom whose pixel resolution best fits the bbox into WIDTH px. */
function pickZoom(bb) {
  const widthM = bb[2] - bb[0];
  const resTarget = widthM / WIDTH;
  const z = Math.round(Math.log2((2 * WORLD) / (256 * resTarget)));
  return Math.max(2, Math.min(EOX_MAX_Z, z));
}

/** Global pixel coords (at zoom z) of a projected bbox. */
function bboxToPx(bb, z) {
  const res = resAt(z);
  return {
    px0: (bb[0] + WORLD) / res, // left  (minX)
    px1: (bb[2] + WORLD) / res, // right (maxX)
    py0: (WORLD - bb[3]) / res, // top   (maxY)
    py1: (WORLD - bb[1]) / res, // bottom(minY)
  };
}

/** Plan the tile grid covering a bbox at the chosen zoom. */
function tilePlan(bb) {
  const z = pickZoom(bb);
  const { px0, px1, py0, py1 } = bboxToPx(bb, z);
  const n = Math.pow(2, z);
  const tx0 = Math.floor(px0 / 256);
  const tx1 = Math.floor((px1 - 1) / 256);
  const ty0 = Math.max(0, Math.floor(py0 / 256));
  const ty1 = Math.min(n - 1, Math.floor((py1 - 1) / 256));
  return { z, n, px0, px1, py0, py1, tx0, tx1, ty0, ty1,
    tilesX: tx1 - tx0 + 1, tilesY: ty1 - ty0 + 1 };
}

async function fetchEOXStitched(lat, lon, spanKm) {
  const sharp = (await import('sharp')).default;
  const bb = bbox3857(lat, lon, spanKm);
  const p = tilePlan(bb);
  if (p.tilesX * p.tilesY > 90) throw new Error(`too many tiles (${p.tilesX * p.tilesY})`);

  const composites = [];
  for (let ty = p.ty0; ty <= p.ty1; ty++) {
    for (let tx = p.tx0; tx <= p.tx1; tx++) {
      const X = ((tx % p.n) + p.n) % p.n; // wrap longitude
      const res = await timedFetch(eoxTileUrl(p.z, X, ty), 20000);
      if (!res.ok) continue; // leave background
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue;
      composites.push({ input: buf, left: (tx - p.tx0) * 256, top: (ty - p.ty0) * 256 });
    }
  }
  if (!composites.length) throw new Error('no tiles returned');

  const canvasW = p.tilesX * 256;
  const canvasH = p.tilesY * 256;
  const cropLeft = Math.max(0, Math.round(p.px0 - p.tx0 * 256));
  const cropTop = Math.max(0, Math.round(p.py0 - p.ty0 * 256));
  const cropW = Math.min(canvasW - cropLeft, Math.round(p.px1 - p.px0));
  const cropH = Math.min(canvasH - cropTop, Math.round(p.py1 - p.py0));

  // Pass 1: stitch every tile onto the canvas (composite runs late in sharp's
  // pipeline, so we must finish stitching before cropping).
  const stitched = await sharp({
    create: { width: canvasW, height: canvasH, channels: 3, background: { r: 6, g: 10, b: 16 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  // Pass 2: crop to the exact framed area and normalise to the output size.
  return sharp(stitched)
    .extract({ left: cropLeft, top: cropTop, width: Math.max(1, cropW), height: Math.max(1, cropH) })
    .resize(WIDTH, HEIGHT, { fit: 'fill' })
    .jpeg({ quality: 82 })
    .toBuffer();
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

/* --------------------------------- main --------------------------------- */
async function main() {
  console.log(`WAVE2MAP imagery fetch · limit=${LIMIT} size=${WIDTH}x${HEIGHT}`);

  const source = 'targets';
  let locations = TARGETS.map((t, i) => ({
    id: t.id,
    name: `TARGET ${String(i + 1).padStart(2, '0')}`,
    country: null,
    lat: t.lat,
    lon: t.lon,
    zoom: t.zoom || 14,
    date: null,
    category: null,
  }));
  console.log(`Tracking ${locations.length} fixed targets`);
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
      const p = tilePlan(bb);
      const X = ((p.tx0 % p.n) + p.n) % p.n;
      console.log(`  [${idx}] ${loc.name} (~${span.toFixed(0)} km)`);
      console.log(`        zoom=${p.z}  tiles=${p.tilesX}x${p.tilesY} (${p.tilesX * p.tilesY})  rows ${p.ty0}-${p.ty1} cols ${p.tx0}-${p.tx1}`);
      console.log(`        GET ${eoxTileUrl(p.z, X, p.ty0)}`);
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
        buf = await fetchEOXStitched(loc.lat, loc.lon, span);
      }
    } catch (e) {
      console.warn(`  [${idx}] ${used} failed: ${e.message}${token ? ' — retrying with EOX' : ''}`);
      if (token) {
        try {
          buf = await fetchEOXStitched(loc.lat, loc.lon, span);
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

    // Resolve a place / country label for the target coordinate.
    let name = loc.name;
    let country = loc.country || null;
    if (!country) {
      const g = await geocode(loc.lat, loc.lon);
      country = g.country;
      if (g.place) name = g.place;
    }

    const meta = generateSceneMeta({ id: loc.id, name, lat: loc.lat, lon: loc.lon, date: loc.date });
    scenes.push({
      id: loc.id,
      name,
      country: country || null,
      lat: loc.lat,
      lon: loc.lon,
      zoom: loc.zoom || 14,
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

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
