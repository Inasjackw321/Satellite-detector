/**
 * ORBITAL — configuration
 * Endpoints, imagery layers and category metadata.
 *
 * All services used here are public, key-less and CORS-enabled so the page
 * works as a static GitHub Pages site (the visitor's browser is the client).
 */

export const EONET = {
  // NASA Earth Observatory Natural Event Tracker (EONET) v3
  base: 'https://eonet.gsfc.nasa.gov/api/v3',
  events: 'https://eonet.gsfc.nasa.gov/api/v3/events',
  categories: 'https://eonet.gsfc.nasa.gov/api/v3/categories',
};

/**
 * Selectable basemaps. The default ("s2") is genuine Sentinel-2 imagery
 * (Sentinel-2 cloudless mosaic by EOX). VIIRS is NASA's near-real-time
 * true-colour product — useful for *today's* disasters.
 */
export const BASEMAPS = {
  s2: {
    label: 'Sentinel-2 Cloudless',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    maxZoom: 16,
    attribution:
      'Sentinel-2 cloudless <a href="https://s2maps.eu" target="_blank" rel="noopener">s2maps.eu</a> by EOX (ESA Copernicus)',
  },
  terrain: {
    label: 'Terrain Light',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg',
    maxZoom: 14,
    attribution:
      'Terrain Light <a href="https://maps.eox.at" target="_blank" rel="noopener">EOX</a>',
  },
  viirs: {
    // NASA GIBS near-real-time true colour (VIIRS / SNPP). {time} filled at runtime.
    label: 'NASA VIIRS (NRT)',
    url:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    maxZoom: 9,
    attribution:
      'NASA <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">GIBS</a> · VIIRS/SNPP true colour',
  },
};

/** Place-label + boundary overlay drawn on top of imagery basemaps. */
export const LABELS_OVERLAY = {
  url: 'https://tiles.maps.eox.at/wmts/1.0.0/overlay_bright_3857/default/g/{z}/{y}/{x}.jpg',
  maxZoom: 16,
  attribution: 'Overlay © OpenStreetMap contributors · EOX',
};

/** Dark regional basemap used for the small WAVE2MAP "LOCATION MAP" inset. */
export const LOCATOR = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  subdomains: 'abcd',
  maxZoom: 18,
  zoom: 6,
  attribution: '© OpenStreetMap © CARTO',
};

/**
 * Category styling. Keys are EONET category ids.
 * color drives markers / HUD accents; icon is a glyph; zoom is the preferred
 * close-up zoom for the per-target satellite snapshot.
 */
export const CATEGORIES = {
  wildfires:    { title: 'Wildfires',      color: '#ff5b3a', icon: '🔥', zoom: 11 },
  severeStorms: { title: 'Severe Storms',  color: '#39d0ff', icon: '🌀', zoom: 7  },
  volcanoes:    { title: 'Volcanoes',      color: '#ff3d6e', icon: '🌋', zoom: 11 },
  seaLakeIce:   { title: 'Sea & Lake Ice', color: '#9be7ff', icon: '🧊', zoom: 7  },
  floods:       { title: 'Floods',         color: '#2f7bff', icon: '🌊', zoom: 10 },
  earthquakes:  { title: 'Earthquakes',    color: '#c98a3a', icon: '🟤', zoom: 9  },
  drought:      { title: 'Drought',        color: '#d8c06a', icon: '🏜️', zoom: 7  },
  dustHaze:     { title: 'Dust & Haze',    color: '#c9b48a', icon: '🌫️', zoom: 8  },
  landslides:   { title: 'Landslides',     color: '#b07a4a', icon: '⛰️', zoom: 12 },
  manmade:      { title: 'Manmade',        color: '#9aa6b2', icon: '⚠️', zoom: 11 },
  snow:         { title: 'Snow',           color: '#e7f3ff', icon: '❄️', zoom: 8  },
  tempExtremes: { title: 'Temp Extremes',  color: '#ff8a5b', icon: '🌡️', zoom: 7  },
  waterColor:   { title: 'Water Color',    color: '#36c9b0', icon: '💧', zoom: 8  },
};

export const DEFAULT_CATEGORY = { title: 'Event', color: '#7cf3c0', icon: '📡', zoom: 9 };

export function categoryMeta(id) {
  return CATEGORIES[id] || DEFAULT_CATEGORY;
}

/** How many scene cards to render per "page". */
export const SCENE_PAGE = 8;
