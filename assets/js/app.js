/**
 * Warsummary maps — application bootstrap.
 * Renders a vertical list of full-bleed Sentinel-2 scene cards for a fixed set
 * of tracked coordinates. LIVE shows live imagery tiles; ARCHIVE shows imagery
 * downloaded by the "Fetch Sentinel-2 Imagery" GitHub Action.
 */
import { buildSceneCard, observeCard, resetObserver } from './cards.js';
import { TARGETS } from './targets.js';
import { SCENE_PAGE } from './config.js';

const state = {
  mode: 'archive', // 'live' | 'archive'
  locations: [],
  shown: 0,
};

const $ = (id) => document.getElementById(id);

/* ------------------------------ adapters ------------------------------- */
function targetsToLocations() {
  return TARGETS.map((t, i) => ({
    id: t.id,
    name: `TARGET ${String(i + 1).padStart(2, '0')}`,
    lat: t.lat,
    lon: t.lon,
    zoom: t.zoom || 14,
    country: null,
    needsGeocode: true, // resolve place / country
    useGeoName: true,
  }));
}

function manifestToLocations(manifest) {
  return (manifest.scenes || []).map((s) => ({
    id: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    zoom: s.zoom || 14,
    country: s.country,
    date: s.date,
    category: s.category,
    image: s.image, // downloaded JPEG
    needsGeocode: false,
    useGeoName: false,
    // use the exact metadata the downloader recorded
    meta: {
      satName: s.satName,
      ymd: s.acquired || s.date,
      timeUTC: s.timeUTC,
      cloudPct: s.cloudPct,
      sceneId: s.sceneId,
    },
  }));
}

/* ------------------------------- render -------------------------------- */
function appendPage() {
  const feed = $('feed');
  const next = state.locations.slice(state.shown, state.shown + SCENE_PAGE);
  for (const loc of next) {
    const card = buildSceneCard(loc);
    feed.appendChild(card);
    observeCard(card);
  }
  state.shown += next.length;
  $('load-more').hidden = state.shown >= state.locations.length;
  $('count').textContent = `${state.locations.length} targets`;
}

function renderFresh(locations) {
  resetObserver();
  const feed = $('feed');
  feed.innerHTML = '';
  state.locations = locations;
  state.shown = 0;
  if (!locations.length) {
    feed.innerHTML = `<p class="empty">No scenes to display.</p>`;
    $('load-more').hidden = true;
    $('count').textContent = '0 targets';
    return;
  }
  appendPage();
}

function setBanner(msg) {
  const b = $('banner');
  if (!msg) {
    b.hidden = true;
    return;
  }
  b.textContent = msg;
  b.hidden = false;
}

/* -------------------------------- load --------------------------------- */
async function load() {
  const b = boot();
  b.step('Acquiring targets…');

  if (state.mode === 'archive') {
    b.step('Loading downloaded imagery…');
    try {
      const res = await fetch('data/scenes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('manifest ' + res.status);
      const manifest = await res.json();
      if (!manifest.scenes || !manifest.scenes.length) throw new Error('empty');
      setBanner('');
      setStatus(true, `ARCHIVE · ${manifest.provider || 'sentinel-2'} · ${(manifest.generated || '').slice(0, 10)}`);
      renderFresh(manifestToLocations(manifest));
    } catch (err) {
      setStatus(false, 'ARCHIVE · EMPTY');
      setBanner('No downloaded imagery yet. Run the "Fetch Sentinel-2 Imagery" GitHub Action (Actions tab → Run workflow), then reload.');
      renderFresh([]);
    }
    b.done();
    return;
  }

  // live mode — live Sentinel-2 tiles for the tracked targets
  setBanner('');
  setStatus(true, 'LIVE · TRACKED TARGETS');
  b.step('Compositing Sentinel-2 scenes…');
  renderFresh(targetsToLocations());
  b.done();
}

/* --------------------------- header / chrome --------------------------- */
function setStatus(ok, label) {
  const pill = $('status');
  pill.classList.toggle('is-off', !ok);
  $('status-label').textContent = label;
}

function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  document.querySelectorAll('.seg__btn').forEach((btn) =>
    btn.classList.toggle('is-on', btn.dataset.mode === mode)
  );
  load();
}

function startClock() {
  const el = $('clock');
  const tick = () => (el.textContent = new Date().toISOString().slice(11, 19) + ' UTC');
  tick();
  setInterval(tick, 1000);
}

/* ----------------------------- boot screen ----------------------------- */
function boot() {
  const fill = $('boot-fill');
  const status = $('boot-status');
  const el = $('boot');
  let i = 0;
  const total = 3;
  return {
    step(msg) {
      i += 1;
      if (status) status.textContent = msg;
      if (fill) fill.style.width = `${Math.round((i / total) * 100)}%`;
    },
    done() {
      if (fill) fill.style.width = '100%';
      setTimeout(() => el && el.classList.add('is-hidden'), 300);
    },
  };
}

/* -------------------------------- init --------------------------------- */
function main() {
  startClock();
  $('load-more').addEventListener('click', appendPage);
  $('refresh').addEventListener('click', load);
  document.querySelectorAll('.seg__btn').forEach((btn) =>
    btn.addEventListener('click', () => setMode(btn.dataset.mode))
  );
  load();
}

document.addEventListener('DOMContentLoaded', main);
