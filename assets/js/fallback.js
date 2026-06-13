/**
 * ORBITAL — offline fallback.
 * A small, EONET-shaped sample so the page is never empty when the live NASA
 * feed is blocked or rate-limited. Replaced by live data whenever reachable.
 * Coordinates are [lon, lat] to match EONET's GeoJSON convention.
 */
export const FALLBACK_EVENTS = [
  {
    id: 'SAMPLE_WF_1',
    title: 'Wildfire — Sierra Nevada, California',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'InciWeb', url: 'https://inciweb.nwcg.gov/' }],
    geometry: [
      { magnitudeValue: 18400, magnitudeUnit: 'acres', date: '2026-06-11T18:00:00Z', type: 'Point', coordinates: [-119.42, 37.21] },
    ],
  },
  {
    id: 'SAMPLE_VOL_1',
    title: 'Volcano — Kīlauea, Hawaii',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
    sources: [{ id: 'SIVolcano', url: 'https://volcano.si.edu/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-12T06:30:00Z', type: 'Point', coordinates: [-155.287, 19.421] },
    ],
  },
  {
    id: 'SAMPLE_ST_1',
    title: 'Tropical Cyclone — Bay of Bengal',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
    sources: [{ id: 'JTWC', url: 'https://www.metoc.navy.mil/jtwc/jtwc.html' }],
    geometry: [
      { magnitudeValue: 95, magnitudeUnit: 'kts', date: '2026-06-12T12:00:00Z', type: 'Point', coordinates: [88.4, 15.6] },
    ],
  },
  {
    id: 'SAMPLE_FL_1',
    title: 'Flood — Lower Mekong Basin',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'floods', title: 'Floods' }],
    sources: [{ id: 'GDACS', url: 'https://www.gdacs.org/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-10T09:00:00Z', type: 'Point', coordinates: [105.85, 11.55] },
    ],
  },
  {
    id: 'SAMPLE_WF_2',
    title: 'Wildfire — Northern Territory, Australia',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'MODIS', url: 'https://earthdata.nasa.gov/firms' }],
    geometry: [
      { magnitudeValue: 42000, magnitudeUnit: 'acres', date: '2026-06-11T22:10:00Z', type: 'Point', coordinates: [133.37, -19.49] },
    ],
  },
  {
    id: 'SAMPLE_IC_1',
    title: 'Iceberg A-83 — Weddell Sea',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'seaLakeIce', title: 'Sea and Lake Ice' }],
    sources: [{ id: 'NATICE', url: 'https://usicecenter.gov/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-09T00:00:00Z', type: 'Point', coordinates: [-46.2, -74.1] },
    ],
  },
  {
    id: 'SAMPLE_VOL_2',
    title: 'Volcano — Mount Etna, Sicily',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'volcanoes', title: 'Volcanoes' }],
    sources: [{ id: 'SIVolcano', url: 'https://volcano.si.edu/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-12T03:00:00Z', type: 'Point', coordinates: [14.999, 37.748] },
    ],
  },
  {
    id: 'SAMPLE_ST_2',
    title: 'Severe Storm — Gulf of Mexico',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'severeStorms', title: 'Severe Storms' }],
    sources: [{ id: 'NHC', url: 'https://www.nhc.noaa.gov/' }],
    geometry: [
      { magnitudeValue: 70, magnitudeUnit: 'kts', date: '2026-06-11T15:00:00Z', type: 'Point', coordinates: [-90.1, 25.3] },
    ],
  },
  {
    id: 'SAMPLE_DH_1',
    title: 'Dust Storm — Sahara / Bodélé Depression',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'dustHaze', title: 'Dust and Haze' }],
    sources: [{ id: 'GASP', url: 'https://earthdata.nasa.gov/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-10T11:00:00Z', type: 'Point', coordinates: [17.9, 16.9] },
    ],
  },
  {
    id: 'SAMPLE_WF_3',
    title: 'Wildfire — Amazonas, Brazil',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'wildfires', title: 'Wildfires' }],
    sources: [{ id: 'VIIRS', url: 'https://earthdata.nasa.gov/firms' }],
    geometry: [
      { magnitudeValue: 31200, magnitudeUnit: 'acres', date: '2026-06-12T01:30:00Z', type: 'Point', coordinates: [-62.21, -4.31] },
    ],
  },
  {
    id: 'SAMPLE_LS_1',
    title: 'Landslide — Himalayan Foothills, Nepal',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'landslides', title: 'Landslides' }],
    sources: [{ id: 'GLC', url: 'https://landslides.nasa.gov/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-09T19:00:00Z', type: 'Point', coordinates: [83.98, 28.21] },
    ],
  },
  {
    id: 'SAMPLE_FL_2',
    title: 'Flood — Po Valley, Italy',
    description: 'Sample event (offline fallback).',
    link: 'https://eonet.gsfc.nasa.gov/',
    closed: null,
    categories: [{ id: 'floods', title: 'Floods' }],
    sources: [{ id: 'Copernicus', url: 'https://emergency.copernicus.eu/' }],
    geometry: [
      { magnitudeValue: null, magnitudeUnit: null, date: '2026-06-11T07:45:00Z', type: 'Point', coordinates: [11.34, 44.84] },
    ],
  },
];
