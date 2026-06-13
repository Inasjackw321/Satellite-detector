/**
 * ORBITAL / WAVE2MAP — application bootstrap.
 * Builds a vertical list of full-bleed Sentinel-2 scene cards, sourced either
 * from live NASA EONET disaster locations or a curated showcase set.
 */
import { fetchEvents } from './api.js';
import { buildSceneCard, observeCard, resetObserver } from './cards.js';
import { SHOWCASE_CITIES } from './scenes.js';
import { categoryMeta, SCENE_PAGE } from './config.js';

const state = {
  mode: 'live',     // 'live' | 'showcase'
  locations: [],
  shown: 0,
};

const $ = (id) => document.getElementById(id);

/* ------------------------------ adapters ------------------------------- */
function cleanName(title) {
  const parts = String(title).split(/\s[—–-]\s/);
  return (parts[parts.length - 1] || title).trim();
}

function eventsToLocations(events) {
  return events.map((ev) => {
    const m = categoryMeta(ev.categoryId);
    return {
      id: ev.id,
      name: cleanName(ev.title),
      lat: ev.lat,
      lon: ev.lon,
      zoom: Math.min(13, Math.max(10, m.zoom)),
      country: null,
      date: ev.date,
      category: { id: ev.categoryId, title: ev.categoryTitle, color: m.color, icon: m.icon },
      needsGeocode: true,
      useGeoName: true,
    };
  });
}

function citiesToLocations() {
  return SHOWCASE_CITIES.map((c) => ({
    id: c.name,
    name: c.name,
    lat: c.lat,
    lon: c.lon,
    zoom: c.zoom || 12,
    country: c.country,
    needsGeocode: false,
    useGeoName: false,
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
  $('count').textContent = `${state.locations.length} scenes`;
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
  b.step('Establishing downlink…');

  if (state.mode === 'showcase') {
    setBanner('');
    setStatus(true, 'SHOWCASE');
    b.step('Compositing Sentinel-2 scenes…');
    renderFresh(citiesToLocations());
    b.done();
    return;
  }

  // live mode
  b.step('Querying NASA EONET…');
  const { events, live } = await fetchEvents({ days: 30, limit: 120 });
  b.step('Compositing Sentinel-2 scenes…');

  if (live) {
    setBanner('');
    setStatus(true, 'LIVE · NASA EONET');
    renderFresh(eventsToLocations(events));
  } else {
    setBanner('Live disaster feed unreachable — showing showcase scenes. Toggle to retry.');
    setStatus(false, 'OFFLINE · SHOWCASE');
    renderFresh(citiesToLocations());
  }
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
