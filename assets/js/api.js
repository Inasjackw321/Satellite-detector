/**
 * ORBITAL — data layer.
 * Fetches live disaster events from NASA EONET and normalises them into a flat
 * shape the UI can consume. Falls back to a small bundled sample if the live
 * feed is unreachable, so the page always renders something meaningful.
 */
import { EONET } from './config.js';
import { FALLBACK_EVENTS } from './fallback.js';

/**
 * Reduce an EONET geometry array to a single representative point.
 * Handles Point and Polygon, prefers the most recent entry.
 */
function latestPoint(geometry) {
  if (!Array.isArray(geometry) || geometry.length === 0) return null;

  // newest first
  const sorted = [...geometry].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const g = sorted[0];
  let lat = null;
  let lon = null;

  if (g.type === 'Point' && Array.isArray(g.coordinates)) {
    [lon, lat] = g.coordinates;
  } else if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    // centroid of the first ring
    const ring = g.coordinates[0] || [];
    if (ring.length) {
      let sx = 0;
      let sy = 0;
      for (const [x, y] of ring) {
        sx += x;
        sy += y;
      }
      lon = sx / ring.length;
      lat = sy / ring.length;
    }
  }

  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  return {
    lat,
    lon,
    date: g.date,
    magnitudeValue: g.magnitudeValue ?? null,
    magnitudeUnit: g.magnitudeUnit ?? null,
    points: geometry.length,
  };
}

/** Flatten a raw EONET event into the UI model. */
function normalize(ev) {
  const pt = latestPoint(ev.geometry);
  if (!pt) return null;
  const category = ev.categories?.[0] || { id: 'unknown', title: 'Event' };
  return {
    id: ev.id,
    title: ev.title,
    description: ev.description || '',
    link: ev.link,
    closed: Boolean(ev.closed),
    categoryId: category.id,
    categoryTitle: category.title,
    sources: (ev.sources || []).map((s) => ({ id: s.id, url: s.url })),
    ...pt,
  };
}

/**
 * Fetch live events.
 * @param {{days?:number, status?:string, limit?:number}} opts
 * @returns {Promise<{events:Object[], live:boolean}>}
 */
export async function fetchEvents({ days = 20, status = 'all', limit = 400 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (days) params.set('days', String(days));
  if (status && status !== 'all') params.set('status', status);

  const url = `${EONET.events}?${params.toString()}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors' });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`EONET ${res.status}`);
    const data = await res.json();
    const events = (data.events || [])
      .map(normalize)
      .filter(Boolean);
    if (!events.length) throw new Error('empty feed');
    return { events, live: true };
  } catch (err) {
    console.warn('[ORBITAL] live feed unavailable, using fallback:', err.message);
    const events = FALLBACK_EVENTS.map(normalize).filter(Boolean);
    return { events, live: false };
  }
}
