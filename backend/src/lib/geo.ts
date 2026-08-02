/**
 * PostGIS `geography(Point)` columns come back from PostgREST as EWKB hex
 * (e.g. "0101000020E6100000..."). Decode to { lat, lng } and expose a
 * GeoJSON-ish shape so the frontend can use location.coordinates directly.
 *
 * EWKB point layout (little-endian): 1B byte-order, 4B type (with SRID flag),
 * 4B SRID, 8B x (lng), 8B y (lat).
 */
export function wkbToLatLng(wkbHex: unknown): { lat: number; lng: number } | null {
  if (typeof wkbHex !== 'string' || wkbHex.length < 50) {
    // Already GeoJSON? Pass through.
    const geo = wkbHex as { coordinates?: [number, number] } | null;
    if (geo?.coordinates) return { lng: geo.coordinates[0], lat: geo.coordinates[1] };
    return null;
  }
  try {
    const buf = Buffer.from(wkbHex, 'hex');
    const littleEndian = buf.readUInt8(0) === 1;
    const type = littleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (type & 0x20000000) !== 0;
    const offset = 5 + (hasSrid ? 4 : 0);
    const lng = littleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    const lat = littleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Replace a row's WKB `location` with GeoJSON { type, coordinates } (or null). */
export function withGeoJsonLocation<T extends { location?: unknown }>(row: T): T {
  if (!row || row.location == null) return row;
  const ll = wkbToLatLng(row.location);
  return {
    ...row,
    location: ll ? { type: 'Point', coordinates: [ll.lng, ll.lat] } : null,
  };
}
