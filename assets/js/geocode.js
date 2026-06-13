/**
 * Warsummary maps — reverse geocoding.
 * Resolves a lat/lon to a place + country using BigDataCloud's free, key-less,
 * CORS-enabled client endpoint. Cached per coarse coordinate; fails soft.
 */
const cache = new Map();

export async function reverseGeocode(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);

  let out = { place: null, country: null };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const j = await res.json();
      out = {
        place: j.city || j.locality || j.principalSubdivision || j.countryName || null,
        country: j.countryName || null,
      };
    }
  } catch (err) {
    /* offline / blocked — keep soft nulls */
  }
  cache.set(key, out);
  return out;
}
