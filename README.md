# ◉ WAVE2MAP — Sentinel-2 Scene Feed

A static, zero-backend **GitHub Pages** web app that renders a vertical feed of
full-bleed **Sentinel-2** satellite scenes. Each scene is annotated with a clean
metadata panel — location, satellite, acquisition date/time (UTC), cloud cover,
coordinates, an MGRS-style scene ID, and a dark regional locator map.

Two sources feed the list:

- **● Live Disasters** — locations pulled from the **NASA EONET** natural-event
  tracker (wildfires, volcanoes, storms, floods, …), reverse-geocoded for the
  place / country fields.
- **Showcase** — a curated set of visually striking targets (Havana, Venice,
  Dubai, Cape Town, the Grand Canyon …). This is also the automatic fallback if
  the live feed is unreachable, so the page always looks right.

Everything runs in the visitor's browser using **public, key-less** services.

---

## Data & imagery

| Field | Source |
|---|---|
| Satellite imagery (the scene) | [Sentinel-2 cloudless](https://s2maps.eu) WMTS by EOX (ESA Copernicus) |
| Disaster locations | [NASA EONET v3](https://eonet.gsfc.nasa.gov/) events API |
| Place / country | [BigDataCloud](https://www.bigdatacloud.com/) reverse-geocode (client, key-less) |
| Locator inset map | [CARTO](https://carto.com/) dark basemap (© OpenStreetMap) |
| Mapping engine | [Leaflet](https://leafletjs.com) |

No API keys, no build step, no server.

### A note on the scene metadata

EONET tells us *where* and *when* a disaster is, but not the full Sentinel-2
acquisition record. The **satellite (A/B), exact UTC pass time, cloud-cover %
and MGRS scene ID** are generated deterministically per location (seeded from its
name + coordinates) so they're stable and plausible — the UTM zone / latitude
band in the scene ID are computed for real (e.g. Havana → `17Q…`). Coordinates,
location and the imagery itself are genuine.

## Features

- 🛰️ Full-bleed live **Sentinel-2** imagery per scene, centred on the target.
- 🧾 WAVE2MAP metadata panel: location, acquisition block, cloud-cover bar,
  decimal-degree coordinates, scene ID, and a live dark **locator inset**.
- 🔀 **Live Disasters / Showcase** toggle, with graceful offline fallback + banner.
- 🌍 Reverse-geocoded country & place names for live disaster scenes.
- ⚡ Lazy-mounted maps (IntersectionObserver) + "load more" paging for performance.
- 🕒 UTC mission clock, downlink status pill, deep links to Sentinel Hub EO Browser.
- 📱 Responsive (panel reflows below the image on small screens); respects
  `prefers-reduced-motion`.

## Run locally

It's a static site — serve the folder (so ES-module imports load):

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

## Deploy to GitHub Pages

The workflow at `.github/workflows/deploy.yml` publishes the repo root.

1. Push to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. It deploys on pushes to `main` (and `claude/**`); the run summary shows the URL.

No secrets required.

## Project structure

```
index.html                 # app shell (header + scene feed)
.nojekyll
assets/css/styles.css      # WAVE2MAP theme
assets/js/
  config.js                # endpoints, basemaps, locator, category metadata
  format.js                # coordinate (DMS / decimal), UTM/MGRS, time helpers
  api.js                   # NASA EONET fetch + normalisation
  scenes.js                # curated showcase targets (+ offline fallback)
  meta.js                  # deterministic Sentinel-2 scene metadata generator
  geocode.js               # key-less reverse geocoding (place / country)
  cards.js                 # WAVE2MAP scene card: imagery + panel + locator
  app.js                   # state, modes, paging, bootstrap
.github/workflows/deploy.yml
```

## Credits

- Sentinel-2 imagery © ESA Copernicus, mosaic by
  [EOX IT Services GmbH](https://maps.eox.at).
- Disaster data © **NASA EONET** / Earth Observatory.
- Reverse geocoding © **BigDataCloud**. Locator tiles © OpenStreetMap, © CARTO.

Educational / situational-awareness visualisation — not an authoritative
emergency source. The WAVE2MAP styling is an homage to satellite-scene browsers.
