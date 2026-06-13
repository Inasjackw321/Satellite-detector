# ◉ Warsummary maps — Sentinel-2 Scene Feed

A static, zero-backend **GitHub Pages** web app that renders a vertical feed of
full-bleed **Sentinel-2** satellite scenes for a **fixed set of tracked
coordinates**. Each scene is annotated with a clean metadata panel — location,
satellite, acquisition date/time (UTC), cloud cover, coordinates, scene ID, and
a dark regional locator map.

Two views of the same tracked targets:

- **● Live** — live Sentinel-2 imagery tiles, centred on each tracked coordinate,
  reverse-geocoded for the place / country fields.
- **Archive** — the **latest** Sentinel-2 imagery (any cloud cover) **downloaded
  and AI-enhanced by a GitHub Action**, committed to the repo (see below).

The tracked coordinates live in **`assets/js/targets.js`** — edit that one file
to change what the site (and the downloader) tracks.

---

## Data & imagery

| Field | Source |
|---|---|
| Tracked coordinates | `assets/js/targets.js` (hand-edited) |
| Latest imagery (Archive) | **Sentinel Hub / Copernicus Data Space** — most-recent S2 L2A, any cloud cover |
| Fallback imagery | [Sentinel-2 cloudless](https://s2maps.eu) WMTS by EOX (key-less mosaic) |
| AI enhancement | [UpscalerJS](https://upscalerjs.com) (ESRGAN, TensorFlow.js) — free, local |
| Place / country | [BigDataCloud](https://www.bigdatacloud.com/) reverse-geocode (key-less) |
| Locator inset map | [CARTO](https://carto.com/) dark basemap (© OpenStreetMap) |
| Mapping engine | [Leaflet](https://leafletjs.com) |

The website itself needs no API keys. The downloader uses free Copernicus Data
Space credentials for "latest" imagery (see below).

## Features

- 🛰️ Full-bleed **Sentinel-2** imagery per scene, centred on the target.
- 🆕 **Archive** fetches the **latest** acquisition regardless of cloud cover,
  with the **real** date / cloud-cover / scene-id from the Copernicus catalog.
- 🤖 Each downloaded image is run through a **free AI enhancer** (ESRGAN).
- 🧾 Metadata panel: location, acquisition block, cloud-cover bar, decimal-degree
  coordinates, scene ID, and a live dark **locator inset**.
- 🔀 **Live / Archive** toggle.
- 🌍 Reverse-geocoded country & place names for each tracked coordinate.
- ⚡ Lazy-mounted maps (IntersectionObserver) + "load more" paging.
- 📱 Responsive; respects `prefers-reduced-motion`.

## Changing the tracked targets

Edit `assets/js/targets.js`:

```js
export const TARGETS = [
  { id: 'T01', lat: 25.124279, lon: 51.315937, zoom: 14 },
  // … add / remove / edit coordinates here …
];
```

Both the website and the imagery downloader read this same list.

## Download the latest imagery with a GitHub Action

The workflow **`.github/workflows/fetch-imagery.yml`** downloads imagery for every
tracked coordinate into the repo:

1. Reads the targets from `assets/js/targets.js`.
2. For each, fetches the **latest** Sentinel-2 L2A scene — **any cloud cover** —
   (`scripts/fetch-imagery.mjs`), using the real acquisition date/cloud/scene-id
   from the Copernicus catalog.
3. Runs the image through the **free AI enhancer** (`scripts/enhance.mjs`).
4. Reverse-geocodes the place / country and writes:
   - `data/scenes/scene-NN.jpg` — the imagery
   - `data/scenes.json` — a manifest the site reads in **Archive** mode
5. Commits and pushes the result.

**Run it:** GitHub → **Actions → Fetch Sentinel-2 Imagery → Run workflow**.
It also runs daily at 06:00 UTC. Then open the site and pick **ARCHIVE**.

### Enabling "latest, any cloud" imagery (free)

To fetch the latest dated imagery you need free **Copernicus Data Space
Ecosystem** OAuth credentials:

1. Create a free account at <https://dataspace.copernicus.eu/>.
2. Create an OAuth client (Sentinel Hub → User settings → OAuth clients).
3. Add them as repo secrets **`SH_CLIENT_ID`** and **`SH_CLIENT_SECRET`**.

Without these secrets the Action falls back to the key-less EOX **cloudless
mosaic** (which is a fixed composite, not "latest").

### AI enhancement

On by default; the heavy ML deps are listed under `optionalDependencies`, so if
they fail to install the run still succeeds and keeps the original images.
Disable it with the repo/Actions variable **`AI_ENHANCE=0`**.

Try it locally:

```bash
npm install                         # sharp (required) + AI deps (optional)
npm run fetch:imagery               # downloads imagery into data/
DRY_RUN=1 npm run fetch:imagery     # preview the plan (no network, no deps needed)
```

> **Note on git size:** each run overwrites the same `scene-NN.jpg` paths so the
> working tree stays bounded, but binary blobs accumulate in history. For heavy
> use, consider Git LFS or publishing imagery as workflow artifacts.

## Run the site locally

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
3. It deploys on pushes to `main`; the run summary shows the URL.

## Project structure

```
index.html                 # app shell (header + scene feed)
.nojekyll
assets/css/styles.css      # theme
assets/js/
  targets.js               # the fixed list of tracked coordinates
  config.js                # imagery basemaps + locator config
  format.js                # coordinate / UTM / MGRS / time helpers
  meta.js                  # deterministic scene metadata generator (fallback)
  geocode.js               # key-less reverse geocoding (place / country)
  cards.js                 # scene card: imagery + panel + locator
  app.js                   # state, modes, paging, bootstrap
scripts/
  fetch-imagery.mjs        # latest-Sentinel-2 downloader for the targets
  enhance.mjs              # free AI image enhancer (ESRGAN / TensorFlow.js)
data/scenes.json           # manifest written by the Action (Archive reads it)
data/scenes/               # downloaded scene-NN.jpg images
.github/workflows/
  deploy.yml               # publish to GitHub Pages
  fetch-imagery.yml        # download + AI-enhance imagery (manual + daily)
```

## Credits

- Sentinel-2 imagery © ESA Copernicus (Copernicus Data Space / EOX mosaic).
- AI super-resolution via UpscalerJS (ESRGAN).
- Reverse geocoding © BigDataCloud. Locator tiles © OpenStreetMap, © CARTO.
