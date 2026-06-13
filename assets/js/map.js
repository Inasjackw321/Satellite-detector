/**
 * ORBITAL — main operational map.
 * Builds the global Leaflet theatre, switches Sentinel-2 / VIIRS / terrain
 * basemaps, and plots disaster markers coloured by category.
 */
import { BASEMAPS, LABELS_OVERLAY, categoryMeta } from './config.js';
import { gibsDate } from './format.js';

let map;
let baseLayer;
let labelLayer;
const markerLayer = (typeof L !== 'undefined') ? L.layerGroup() : null;
let onSelect = () => {};

function basemapUrl(key) {
  const def = BASEMAPS[key] || BASEMAPS.s2;
  return def.url.replace('{time}', gibsDate());
}

function makeBaseLayer(key) {
  const def = BASEMAPS[key] || BASEMAPS.s2;
  return L.tileLayer(basemapUrl(key), {
    maxZoom: 18,
    maxNativeZoom: def.maxZoom,
    attribution: def.attribution,
    crossOrigin: true,
    noWrap: false,
  });
}

/** Build a divIcon target marker for a category. */
function targetIcon(color, active) {
  return L.divIcon({
    className: 'tgt-icon',
    html: `<span class="tgt-icon__ring ${active ? 'is-active' : ''}" style="--c:${color}"></span>
           <span class="tgt-icon__dot" style="--c:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function initMap(elementId, onMarkerSelect) {
  onSelect = onMarkerSelect || onSelect;

  map = L.map(elementId, {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    worldCopyJump: true,
    zoomControl: true,
    attributionControl: true,
  });

  baseLayer = makeBaseLayer('s2').addTo(map);
  labelLayer = L.tileLayer(LABELS_OVERLAY.url, {
    maxZoom: 18,
    maxNativeZoom: LABELS_OVERLAY.maxZoom,
    opacity: 0.9,
    crossOrigin: true,
  }).addTo(map);

  markerLayer.addTo(map);
  return map;
}

export function setBasemap(key) {
  if (!map) return;
  const next = makeBaseLayer(key);
  next.addTo(map);
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = next;
  // keep labels above imagery
  if (labelLayer) labelLayer.bringToFront();
}

/** Plot markers for a list of normalised events. Returns count plotted. */
export function plotEvents(events) {
  markerLayer.clearLayers();
  let n = 0;
  for (const ev of events) {
    const meta = categoryMeta(ev.categoryId);
    const active = !ev.closed;
    const marker = L.marker([ev.lat, ev.lon], {
      icon: targetIcon(meta.color, active),
      title: ev.title,
      riseOnHover: true,
    });
    marker.on('click', () => onSelect(ev));
    marker.bindTooltip(
      `${meta.icon} ${ev.title}`,
      { direction: 'top', offset: [0, -10], className: 'tgt-tip' }
    );
    marker.addTo(markerLayer);
    n += 1;
  }
  return n;
}

/** Smoothly move the theatre to a target. */
export function flyTo(ev, zoom = 7) {
  if (!map) return;
  map.flyTo([ev.lat, ev.lon], zoom, { duration: 1.1 });
}

export function getMap() {
  return map;
}
