// src/lib/roof/packing.ts
// Pure panel-packing. Projects the roof polygon to local meters, packs an
// axis-aligned grid (optionally rotated), keeps cells fully inside the polygon,
// and returns panel centers as lat/lng.
import { toLocalMeters, toLatLng, pointInPolygon, type LatLng, type PointM } from './geometry'

const COL_GAP_M = 0.02 // small frame gap between side-by-side panels

export type Cubierta = 'metalica' | 'teja' | 'losa'
export type Orientacion = 'vertical' | 'horizontal'

export function defaultRowGap(cubierta: Cubierta): number {
  // losa = tilted rows need spacing; metalica/teja = flush mount.
  return cubierta === 'losa' ? 0.7 : 0.02
}

function rotate(p: PointM, deg: number): PointM {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

export interface PackArgs {
  vertices: LatLng[]
  anchoM: number
  altoM: number
  rowGapM: number
  orientacion: Orientacion
  rotationDeg: number
}

export function packPanels(args: PackArgs): LatLng[] {
  const { vertices, anchoM, altoM, rowGapM, orientacion, rotationDeg } = args
  if (vertices.length < 3 || anchoM <= 0 || altoM <= 0) return []

  const origin = vertices[0]
  // Polygon in local meters, rotated by -rotation so we can pack axis-aligned.
  const polyM = vertices.map((v) => rotate(toLocalMeters(v, origin), -rotationDeg))

  // Panel footprint per orientation.
  const w = orientacion === 'vertical' ? anchoM : altoM // along columns (x)
  const h = orientacion === 'vertical' ? altoM : anchoM // along rows (y)
  const cellW = w + COL_GAP_M
  const cellH = h + rowGapM

  const xs = polyM.map((p) => p.x)
  const ys = polyM.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)

  const centers: LatLng[] = []
  // Test corners are inset by 1 micron toward the panel center so a panel sitting
  // flush against the roof edge is counted as inside regardless of sub-nanometer
  // floating-point noise in the polygon projection (otherwise the outermost row
  // is dropped non-deterministically).
  const eps = 1e-6
  const halfW = w / 2 - eps
  const halfH = h / 2 - eps
  for (let cy = minY + cellH / 2; cy + cellH / 2 <= maxY + 1e-9; cy += cellH) {
    for (let cx = minX + cellW / 2; cx + cellW / 2 <= maxX + 1e-9; cx += cellW) {
      // require all four panel corners inside the polygon (panel fully on roof)
      const corners: PointM[] = [
        { x: cx - halfW, y: cy - halfH },
        { x: cx + halfW, y: cy - halfH },
        { x: cx + halfW, y: cy + halfH },
        { x: cx - halfW, y: cy + halfH },
      ]
      if (corners.every((c) => pointInPolygon(c, polyM))) {
        // rotate the center back to true orientation, convert to lat/lng
        centers.push(toLatLng(rotate({ x: cx, y: cy }, rotationDeg), origin))
      }
    }
  }
  return centers
}
