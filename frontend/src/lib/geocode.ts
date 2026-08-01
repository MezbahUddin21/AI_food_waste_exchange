/** Free geocoding via Nominatim (OSM). Rate limit: 1 req/sec — debounce callers. */
export async function geocode(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const results = await res.json();
  if (!results?.length) return null;
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    display: results[0].display_name,
  };
}
