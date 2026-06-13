/**
 * Warsummary maps — scene card.
 * Renders a full-bleed Sentinel-2 image with the Warsummary maps metadata panel
 * overlaid: location, acquisition (satellite / date / UTC time / country),
 * cloud cover, coordinates, scene id and a dark regional locator inset.
 * Maps are lazy-instantiated on scroll; live locations are reverse-geocoded.
 */
import { BASEMAPS, LOCATOR } from './config.js';
import { decDeg, esc } from './format.js';
import { generateSceneMeta, cloudLabel } from './meta.js';
import { reverseGeocode } from './geocode.js';

let observer;
const built = new WeakSet();

/* --------------------------- leaflet builders --------------------------- */
const STATIC_OPTS = {
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  touchZoom: false,
  zoomSnap: 0.25,
};

function buildImage(container, loc) {
  const map = L.map(container, STATIC_OPTS).setView([loc.lat, loc.lon], loc.zoom || 12);
  L.tileLayer(BASEMAPS.s2.url, {
    maxZoom: 18,
    maxNativeZoom: BASEMAPS.s2.maxZoom,
    crossOrigin: true,
  }).addTo(map);
  L.circleMarker([loc.lat, loc.lon], {
    radius: 5,
    color: '#ff3b3b',
    weight: 2,
    fillColor: '#ff3b3b',
    fillOpacity: 0.85,
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

function buildLocator(container, loc) {
  const map = L.map(container, STATIC_OPTS).setView([loc.lat, loc.lon], LOCATOR.zoom);
  L.tileLayer(LOCATOR.url, {
    subdomains: LOCATOR.subdomains,
    maxZoom: LOCATOR.maxZoom,
    crossOrigin: true,
  }).addTo(map);
  L.circleMarker([loc.lat, loc.lon], {
    radius: 6,
    color: '#ffffff',
    weight: 2,
    fillColor: '#ff3b3b',
    fillOpacity: 1,
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/* ------------------------------- markup -------------------------------- */
function panel(loc, meta) {
  const cloudTxt = `${meta.cloudPct.toFixed(1)}% — ${cloudLabel(meta.cloudPct)}`;
  const cloudW = Math.max(2, Math.min(100, meta.cloudPct));
  const cat = loc.category;

  return `
    <div class="wm-brand"><span class="wm-dot"></span> WARSUMMARY MAPS</div>
    ${cat ? `<div class="wm-tag" style="--c:${cat.color}">${cat.icon} ${esc(cat.title)}</div>` : ''}

    <section class="wm-sec">
      <div class="wm-lbl">LOCATION</div>
      <div class="wm-loc" data-loc>${esc(loc.name || '—')}</div>
    </section>

    <section class="wm-sec">
      <div class="wm-lbl">ACQUISITION</div>
      <div class="wm-kv"><span>SATELLITE</span><b>${esc(meta.satName)}</b></div>
      <div class="wm-kv"><span>DATE</span><b>${esc(meta.ymd)}</b></div>
      <div class="wm-kv"><span>TIME UTC</span><b>${esc(meta.timeUTC)}</b></div>
      <div class="wm-kv"><span>COUNTRY</span><b data-country>${esc(loc.country || '—')}</b></div>
    </section>

    <section class="wm-sec">
      <div class="wm-lbl">CLOUD COVER</div>
      <div class="wm-bar"><span style="width:${cloudW}%"></span></div>
      <div class="wm-cloud">${esc(cloudTxt)}</div>
    </section>

    <section class="wm-sec">
      <div class="wm-lbl">COORDINATES</div>
      <div class="wm-kv"><span>LAT</span><b>${decDeg(loc.lat, true)}</b></div>
      <div class="wm-kv"><span>LON</span><b>${decDeg(loc.lon, false)}</b></div>
    </section>

    <section class="wm-sec">
      <div class="wm-lbl">SCENE ID</div>
      <div class="wm-scene">${esc(meta.sceneId)}</div>
    </section>

    <section class="wm-sec wm-sec--map">
      <div class="wm-lbl">LOCATION MAP</div>
      <div class="wm-locator" data-locator aria-hidden="true"></div>
    </section>

    <div class="wm-foot">
      <span>Sentinel-2 L2A · ESA / Copernicus</span>
    </div>`;
}

export function buildSceneCard(loc) {
  const meta = loc.meta || generateSceneMeta(loc);
  const el = document.createElement('article');
  el.className = 'scene';
  el.innerHTML = `
    <div class="scene__img" data-img></div>
    <span class="scene__pin" aria-hidden="true"></span>
    <div class="scene__scrim"></div>
    <aside class="scene__panel">${panel(loc, meta)}</aside>
    <div class="scene__wm">WARSUMMARY</div>`;
  el._loc = loc;
  return el;
}

/* ------------------------- lazy mount on scroll ------------------------- */
function mount(card) {
  if (built.has(card)) return;
  built.add(card);
  const loc = card._loc;
  try {
    if (loc.image) {
      // Downloaded (ARCHIVE) scene — show the static JPEG, no live tiles.
      const img = card.querySelector('[data-img]');
      img.classList.add('scene__img--static');
      img.style.backgroundImage = `url("${loc.image}")`;
      card.classList.add('is-static');
    } else {
      buildImage(card.querySelector('[data-img]'), loc);
    }
    buildLocator(card.querySelector('[data-locator]'), loc);
    card.classList.add('is-loaded');
  } catch (err) {
    console.warn('[Warsummary maps] scene mount failed', err);
  }

  // Resolve country / nicer place name for tracked targets.
  if (loc.needsGeocode) {
    reverseGeocode(loc.lat, loc.lon).then(({ place, country }) => {
      if (country) {
        const c = card.querySelector('[data-country]');
        if (c) c.textContent = country;
      }
      if (place && loc.useGeoName) {
        const l = card.querySelector('[data-loc]');
        if (l) l.textContent = place;
      }
    });
  }
}

function ensureObserver() {
  if (observer) return;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          observer.unobserve(e.target);
          mount(e.target);
        }
      }
    },
    { rootMargin: '300px 0px' }
  );
}

/** Register a freshly-appended card for lazy mounting. */
export function observeCard(card) {
  ensureObserver();
  observer.observe(card);
}

export function resetObserver() {
  if (observer) observer.disconnect();
  observer = null;
}
