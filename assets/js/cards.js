/**
 * ORBITAL — satellite target gallery.
 * Each card is a live Sentinel-2 mini-map (lazy-instantiated on scroll) with a
 * mission-style HUD drawn on top: corner brackets, target reticle, and a data
 * readout (category, status, coordinates, acquisition time, magnitude).
 */
import { BASEMAPS, LABELS_OVERLAY, categoryMeta, GALLERY_PAGE } from './config.js';
import { formatLatLon, formatDate, timeAgo, gibsDate, esc } from './format.js';

let galleryEl;
let loadMoreBtn;
let onOpen = () => {};
let currentList = [];
let shown = 0;
let observer;
const liveMaps = new WeakMap(); // card -> leaflet instance

/** Build a non-interactive (or interactive) Sentinel-2 mini-map in container. */
export function buildMiniMap(container, ev, { interactive = false, basemap = 's2' } = {}) {
  const def = BASEMAPS[basemap] || BASEMAPS.s2;
  const meta = categoryMeta(ev.categoryId);
  const map = L.map(container, {
    center: [ev.lat, ev.lon],
    zoom: meta.zoom,
    zoomControl: interactive,
    attributionControl: false,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    touchZoom: interactive,
    fadeAnimation: true,
  });

  L.tileLayer(def.url.replace('{time}', gibsDate()), {
    maxZoom: 18,
    maxNativeZoom: def.maxZoom,
    crossOrigin: true,
  }).addTo(map);

  L.tileLayer(LABELS_OVERLAY.url, {
    maxZoom: 18,
    maxNativeZoom: LABELS_OVERLAY.maxZoom,
    opacity: 0.85,
    crossOrigin: true,
  }).addTo(map);

  // target ring on the exact coordinate
  L.circleMarker([ev.lat, ev.lon], {
    radius: 9,
    color: meta.color,
    weight: 2,
    fillColor: meta.color,
    fillOpacity: 0.18,
  }).addTo(map);

  // Leaflet sometimes needs a nudge after the container animates in.
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/** HUD markup overlaid on the imagery. */
function hud(ev) {
  const meta = categoryMeta(ev.categoryId);
  const status = ev.closed ? 'CLOSED' : 'ACTIVE';
  const mag =
    ev.magnitudeValue != null
      ? `${ev.magnitudeValue} ${esc(ev.magnitudeUnit || '')}`.trim()
      : '—';
  const shortId = esc(String(ev.id)).slice(0, 16);

  return `
    <div class="hud" style="--c:${meta.color}">
      <span class="hud__corner hud__corner--tl"></span>
      <span class="hud__corner hud__corner--tr"></span>
      <span class="hud__corner hud__corner--bl"></span>
      <span class="hud__corner hud__corner--br"></span>
      <span class="hud__scan"></span>

      <div class="hud__top">
        <span class="hud__cat">${meta.icon} ${esc(ev.categoryTitle)}</span>
        <span class="hud__status ${ev.closed ? 'is-closed' : 'is-active'}">● ${status}</span>
      </div>

      <div class="hud__reticle">
        <span class="hud__cross hud__cross--h"></span>
        <span class="hud__cross hud__cross--v"></span>
        <span class="hud__ring"></span>
      </div>

      <div class="hud__bottom">
        <div class="hud__title">${esc(ev.title)}</div>
        <div class="hud__grid mono">
          <span class="hud__k">LAT/LON</span><span class="hud__v">${formatLatLon(ev.lat, ev.lon)}</span>
          <span class="hud__k">ACQ</span><span class="hud__v">${formatDate(ev.date)} · ${timeAgo(ev.date)}</span>
          <span class="hud__k">MAGNITUDE</span><span class="hud__v">${mag}</span>
          <span class="hud__k">SENSOR</span><span class="hud__v">SENTINEL-2 MSI</span>
        </div>
      </div>

      <div class="hud__id mono">ID ${shortId}</div>
      <button class="hud__open" type="button">◎ INSPECT</button>
    </div>`;
}

function makeCard(ev) {
  const meta = categoryMeta(ev.categoryId);
  const card = document.createElement('article');
  card.className = 'target';
  card.style.setProperty('--c', meta.color);
  card.dataset.id = ev.id;
  card.innerHTML = `<div class="target__map" aria-hidden="true"></div>${hud(ev)}`;

  const open = () => onOpen(ev);
  card.querySelector('.hud__open').addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });
  card.addEventListener('click', open);
  card._event = ev;
  return card;
}

function ensureObserver() {
  if (observer) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        observer.unobserve(card);
        if (liveMaps.has(card)) continue;
        const mapEl = card.querySelector('.target__map');
        try {
          const m = buildMiniMap(mapEl, card._event, { interactive: false });
          liveMaps.set(card, m);
          card.classList.add('is-loaded');
        } catch (err) {
          console.warn('mini-map failed', err);
        }
      }
    },
    { rootMargin: '200px' }
  );
}

function appendPage() {
  ensureObserver();
  const next = currentList.slice(shown, shown + GALLERY_PAGE);
  for (const ev of next) {
    const card = makeCard(ev);
    galleryEl.appendChild(card);
    observer.observe(card);
  }
  shown += next.length;
  loadMoreBtn.hidden = shown >= currentList.length;
}

export function initGallery(galleryId, loadMoreId, openHandler) {
  galleryEl = document.getElementById(galleryId);
  loadMoreBtn = document.getElementById(loadMoreId);
  onOpen = openHandler || onOpen;
  loadMoreBtn.addEventListener('click', appendPage);
}

/** Render a fresh list of events into the gallery. */
export function renderGallery(events) {
  // tear down existing maps to free resources
  galleryEl.querySelectorAll('.target').forEach((card) => {
    const m = liveMaps.get(card);
    if (m) m.remove();
    liveMaps.delete(card);
  });
  if (observer) observer.disconnect();
  observer = null;

  galleryEl.innerHTML = '';
  currentList = events;
  shown = 0;

  if (!events.length) {
    galleryEl.innerHTML = `<p class="gallery__empty">No targets match the current filters.</p>`;
    loadMoreBtn.hidden = true;
    return;
  }
  appendPage();
}
