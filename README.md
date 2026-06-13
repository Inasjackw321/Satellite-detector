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
- 🔀 **Live Disasters / Showcase / Archive** toggle, with graceful offline fallback + banner.
- ⬇️ **Archive** = real Sentinel-2 imagery **downloaded by a GitHub Action** and committed to the repo (see below).
- 🌍 Reverse-geocoded country & place names for live disaster scenes.
- ⚡ Lazy-mounted maps (IntersectionObserver) + "load more" paging for performance.
- 🕒 UTC mission clock, downlink status pill, deep links to Sentinel Hub EO Browser.
- 📱 Responsive (panel reflows below the image on small screens); respects
  `prefers-reduced-motion`.

## Download imagery with a GitHub Action

The workflow **`.github/workflows/fetch-imagery.yml`** uses NASA data to pull
real Sentinel-2 imagery into the repo:

1. Queries **NASA EONET** for current open disaster locations (falls back to the
   showcase set if EONET is unreachable).
2. For each location, downloads a Sentinel-2 image (`scripts/fetch-imagery.mjs`).
3. Reverse-geocodes the place / country, generates the scene metadata, and writes:
   - `data/scenes/scene-NN.jpg` — the imagery
   - `data/scenes.json` — a manifest the site reads in **Archive** mode
4. Commits and pushes the result.

**Run it:** GitHub → **Actions → Fetch Sentinel-2 Imagery → Run workflow**
(optionally set `limit`, `days`, `width`, `height`). It also runs daily at
06:00 UTC. After it finishes, open the site and pick **ARCHIVE** to view the
downloaded scenes.

Try it locally first (no network writes):

```bash
npm run fetch:imagery               # downloads imagery into data/
DRY_RUN=1 npm run fetch:imagery     # preview the requests it would make
```

### Imagery providers

| Mode | Provider | Needs secrets? | Notes |
|---|---|---|---|
| Default | **EOX Sentinel-2 cloudless** WMS | No | Key-less; cloud-free annual mosaic |
| Optional | **Sentinel Hub** Process API (S2 L2A) | Yes | Fresh, date-filtered, least-cloud imagery |

To enable fresh Sentinel Hub imagery, add repo secrets **`SH_CLIENT_ID`** and
**`SH_CLIENT_SECRET`** (free Copernicus Data Space / Sentinel Hub OAuth client).
With no secrets, the Action uses the key-less EOX cloudless mosaic. Either way it
re-images the *current* disaster locations on each run.

> **Note on git size:** each run overwrites the same `scene-NN.jpg` paths so the
> working tree stays bounded, but binary blobs still accumulate in history. For
> heavy use, consider Git LFS or publishing imagery as workflow artifacts instead.

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
scripts/fetch-imagery.mjs  # NASA EONET → Sentinel-2 image downloader (Node)
data/scenes.json           # manifest written by the Action (Archive mode reads it)
data/scenes/               # downloaded scene-NN.jpg images
.github/workflows/
  deploy.yml               # publish to GitHub Pages
  fetch-imagery.yml        # download Sentinel-2 imagery (manual + daily)
```

## Credits

- Sentinel-2 imagery © ESA Copernicus, mosaic by
  [EOX IT Services GmbH](https://maps.eox.at).
- Disaster data © **NASA EONET** / Earth Observatory.
- Reverse geocoding © **BigDataCloud**. Locator tiles © OpenStreetMap, © CARTO.

Educational / situational-awareness visualisation — not an authoritative
emergency source. The WAVE2MAP styling is an homage to satellite-scene browsers.
