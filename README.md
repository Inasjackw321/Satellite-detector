# ◎ ORBITAL — Disaster Intelligence

A static, zero-backend **GitHub Pages** web app that pulls live natural-disaster
events from **NASA EONET** and projects each one onto real **Sentinel-2**
satellite imagery, with a mission-control HUD overlaid on every target.

> Open the deployed page and it immediately downlinks the latest global
> disasters (wildfires, volcanoes, storms, floods, ice, dust, landslides …),
> plots them on a Sentinel-2 world map, and renders a gallery of
> satellite "targets" — each a live close-up image with coordinates, acquisition
> time, magnitude and status drawn directly on the imagery.

---

## What it does

| Capability | How |
|---|---|
| **Find disasters** | [NASA EONET v3](https://eonet.gsfc.nasa.gov/) events API (key-less, CORS-enabled) |
| **Show satellite imagery** | [Sentinel-2 cloudless](https://s2maps.eu) WMTS by EOX (ESA Copernicus) |
| **Near-real-time imagery (optional)** | [NASA GIBS](https://earthdata.nasa.gov/gibs) VIIRS/SNPP true colour |
| **Place labels / borders** | EOX bright overlay |
| **Mapping** | [Leaflet](https://leafletjs.com) |

Every data source is **public, free, and requires no API key**, so the whole
thing runs entirely in the visitor's browser — perfect for GitHub Pages.

## Features

- 🛰️ **Global theatre map** on a Sentinel-2 basemap with animated, category-coloured target markers.
- 🎯 **Satellite target gallery** — each card is a live Sentinel-2 mini-map with a
  HUD drawn on it: corner brackets, target reticle, scan line, and a data readout
  (category, ACTIVE/CLOSED status, lat/lon in DMS, acquisition time, magnitude, sensor).
- 🧭 **Detail inspector** — click any target for a larger interactive map, full
  metadata, and deep links to the NASA EONET record, the original source, and
  Sentinel Hub EO Browser.
- 🔎 **Filters** by disaster category, a name search, and a time window (7d → 1yr).
- 🌐 **Switchable imagery**: Sentinel-2 cloudless · NASA VIIRS (NRT) · Terrain.
- 📊 Live **stats**, an **event feed**, a UTC mission clock, and a downlink status pill.
- 🛟 **Offline fallback** — a bundled sample dataset so the page is never empty if
  the live feed is blocked or rate-limited.
- 📱 Responsive, dark mission-control theme; respects `prefers-reduced-motion`.

## Run it locally

It's a static site — no build, no dependencies to install. Just serve the folder:

```bash
# any static server works; here are two
python3 -m http.server 8000
# or
npx serve .
```

Then open <http://localhost:8000>. (Use a server rather than opening the file
directly so the ES-module imports load correctly.)

## Deploy to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

1. Push this repository to GitHub.
2. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.
3. The workflow runs on pushes to `main` (and `claude/**` branches) and publishes
   the site. Its summary shows the live URL.

No secrets or environment variables are required.

## Project structure

```
index.html                 # app shell
.nojekyll                  # serve asset folders verbatim
assets/css/styles.css      # mission-control theme + HUD
assets/js/
  config.js                # endpoints, basemaps, category metadata
  format.js                # coordinate / time helpers (DMS, time-ago)
  api.js                   # EONET fetch + normalisation (+ fallback)
  fallback.js              # bundled sample events
  map.js                   # main Leaflet theatre + markers
  cards.js                 # satellite target gallery + HUD + mini-maps
  ui.js                    # filters, stats, feed, legend, modal, clock
  app.js                   # state + bootstrap
.github/workflows/deploy.yml
```

## Notes & credits

- Sentinel-2 imagery © ESA Copernicus, mosaic by
  [EOX IT Services GmbH](https://maps.eox.at) (CC BY-NC-SA 4.0 for the cloudless
  layer — fine for this non-commercial demo).
- Disaster data courtesy of **NASA EONET** / Earth Observatory.
- Near-real-time imagery from **NASA GIBS**.

This is an educational / situational-awareness visualisation, **not** an
authoritative emergency source. Always defer to official agencies.
