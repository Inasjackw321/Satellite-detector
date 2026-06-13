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
const RMERC = 6378137;
const merc2lon = (x) => (x / RMERC) * 180 / Math.PI;
const merc2lat = (y) => (2 * Math.atan(Math.exp(y / RMERC)) - Math.PI / 2) * 180 / Math.PI;

// Interactive options shared by the main scene viewers (zoom via +/- buttons;
// scroll-wheel left off so the page still scrolls over a card).
const VIEW_OPTS = {
  zoomControl: false,
  attributionControl: false,
  dragging: true,
  scrollWheelZoom: false,
  doubleClickZoom: true,
  boxZoom: false,
  keyboard: false,
  touchZoom: true,
  zoomSnap: 0.5,
};
const STATIC_OPTS = { ...VIEW_OPTS, dragging: false, doubleClickZoom: false, touchZoom: false };

const redMarker = (lat, lon, r = 5) =>
  L.circleMarker([lat, lon], { radius: r, color: '#ff3b3b', weight: 2, fillColor: '#ff3b3b', fillOpacity: 0.85 });

/** Live, zoomable Sentinel-2 tile map. */
function buildImage(container, loc) {
  const map = L.map(container, { ...VIEW_OPTS, minZoom: 3, maxZoom: 18 }).setView([loc.lat, loc.lon], loc.zoom || 14);
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.tileLayer(BASEMAPS.s2.url, { maxZoom: 19, maxNativeZoom: BASEMAPS.s2.maxZoom, crossOrigin: true }).addTo(map);
  redMarker(loc.lat, loc.lon).addTo(map);
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/** Zoomable viewer for a downloaded scene, geolocated via its bbox. */
function buildArchiveViewer(container, loc) {
  const [minX, minY, maxX, maxY] = loc.bbox3857;
  const bounds = [
    [merc2lat(minY), merc2lon(minX)],
    [merc2lat(maxY), merc2lon(maxX)],
  ];
  const map = L.map(container, { ...VIEW_OPTS, maxZoom: 22, maxBounds: bounds, maxBoundsViscosity: 0.85 });
  map.fitBounds(bounds, { animate: false }); // set a view before adding layers
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.imageOverlay(loc.image, bounds, { className: 'scene__overlay' }).addTo(map);
  redMarker(loc.lat, loc.lon).addTo(map);
  setTimeout(() => {
    map.invalidateSize();
    map.fitBounds(bounds, { animate: false });
    map.setMinZoom(map.getZoom()); // can't zoom out past the full frame
  }, 80);
  return map;
}

function buildLocator(container, loc) {
  const map = L.map(container, STATIC_OPTS).setView([loc.lat, loc.lon], LOCATOR.zoom);
  L.tileLayer(LOCATOR.url, { subdomains: LOCATOR.subdomains, maxZoom: LOCATOR.maxZoom, crossOrigin: true }).addTo(map);
  L.circleMarker([loc.lat, loc.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#ff3b3b', fillOpacity: 1 }).addTo(map);
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/** Download the scene image as a file. */
async function downloadImage(loc) {
  const base = `${(loc.name || 'scene').replace(/[^\w.-]+/g, '_')}_${loc.date || loc.id || ''}`.replace(/_+$/, '');
  try {
    const res = await fetch(loc.image, { cache: 'no-store' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    window.open(loc.image, '_blank', 'noopener');
  }
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
    ${loc.image ? `<div class="scene__tools"><button class="scene__btn" data-download type="button" title="Download image">⤓ DOWNLOAD</button></div>` : ''}
    <div class="scene__scrim"></div>
    <aside class="scene__panel">${panel(loc, meta)}</aside>
    <div class="scene__wm">WARSUMMARY</div>`;
  el._loc = loc;
  const dl = el.querySelector('[data-download]');
  if (dl) {
    dl.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadImage(loc);
    });
  }
  return el;
}

/* ------------------------- lazy mount on scroll ------------------------- */
function mount(card) {
  if (built.has(card)) return;
  built.add(card);
  const loc = card._loc;
  try {
    const imgEl = card.querySelector('[data-img]');
    if (loc.image && Array.isArray(loc.bbox3857) && loc.bbox3857.length === 4) {
      // Downloaded scene — zoomable viewer geolocated by its bbox.
      buildArchiveViewer(imgEl, loc);
    } else if (loc.image) {
      // Downloaded scene without a bbox — static background.
      imgEl.classList.add('scene__img--static');
      imgEl.style.backgroundImage = `url("${loc.image}")`;
      card.classList.add('is-static');
    } else {
      // Live, zoomable Sentinel-2 tiles.
      buildImage(imgEl, loc);
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
