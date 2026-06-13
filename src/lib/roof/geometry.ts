// src/lib/roof/geometry.ts
// Pure geometry helpers for the roof designer. No Google Maps / DOM here.

export interface LatLng { lat: number; lng: number }
export interface PointM { x: number; y: number } // local meters: x=east, y=north

const M_PER_DEG_LAT = 110_540
const M_PER_DEG_LNG_AT_EQUATOR = 111_320

/** Equirectangular projection to local meters around an origin. */
export function toLocalMeters(p: LatLng, origin: LatLng): PointM {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180)
  return {
    x: (p.lng - origin.lng) * M_PER_DEG_LNG_AT_EQUATOR * cosLat,
    y: (p.lat - origin.lat) * M_PER_DEG_LAT,
  }
}

/** Inverse of toLocalMeters. */
export function toLatLng(m: PointM, origin: LatLng): LatLng {
  const cosLat = Math.cos((origin.lat * Math.PI) / 180)
  return {
    lat: origin.lat + m.y / M_PER_DEG_LAT,
    lng: origin.lng + m.x / (M_PER_DEG_LNG_AT_EQUATOR * cosLat),
  }
}

/** Shoelace area in m² of a lat/lng polygon (projected to local meters). */
export function polygonAreaM2(vertices: LatLng[]): number {
  if (vertices.length < 3) return 0
  const origin = vertices[0]
  const pts = vertices.map((v) => toLocalMeters(v, origin))
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** Ray-casting point-in-polygon in planar meters. */
export function pointInPolygon(p: PointM, polygon: PointM[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Web Mercator world-pixel projection at a given zoom (tileSize 256).
 * Used to place polygons/panels onto a Static Maps raster for the snapshot.
 */
export function latLngToWorldPixel(p: LatLng, zoom: number, tileSize = 256): PointM {
  const scale = tileSize * Math.pow(2, zoom)
  const x = ((p.lng + 180) / 360) * scale
  const sinLat = Math.sin((p.lat * Math.PI) / 180)
  const y =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}
