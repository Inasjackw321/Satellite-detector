/**
 * Warsummary maps — configuration.
 * Imagery layers used by the scene cards. All services are public, key-less and
 * CORS-enabled so the page works as a static site (the visitor's browser is the
 * client).
 */

/** Sentinel-2 imagery basemap (Sentinel-2 cloudless mosaic by EOX / ESA). */
export const BASEMAPS = {
  s2: {
    label: 'Sentinel-2 Cloudless',
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
    maxZoom: 16,
    attribution:
      'Sentinel-2 cloudless <a href="https://s2maps.eu" target="_blank" rel="noopener">s2maps.eu</a> by EOX (ESA Copernicus)',
  },
};

/** Dark regional basemap used for the small Warsummary maps "LOCATION MAP" inset. */
export const LOCATOR = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  subdomains: 'abcd',
  maxZoom: 18,
  zoom: 6,
  attribution: '© OpenStreetMap © CARTO',
};

/** How many scene cards to render per "page". */
export const SCENE_PAGE = 8;
