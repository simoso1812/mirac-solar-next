// src/lib/roof/__tests__/packing.test.ts
import { describe, it, expect } from 'vitest'
import { defaultRowGap, packPanels, repack } from '../packing'
import { toLatLng, toLocalMeters, pointInPolygon, polygonAreaM2 } from '../geometry'

const origin = { lat: 6.2442, lng: -75.5812 }

describe('defaultRowGap', () => {
  it('losa has a larger gap than flush roofs', () => {
    expect(defaultRowGap('losa')).toBeGreaterThan(defaultRowGap('metalica'))
    expect(defaultRowGap('metalica')).toBe(defaultRowGap('teja'))
  })
})

describe('packPanels', () => {
  // 10m x 10m roof, 1m x 2m panels, flush -> deterministic count.
  const roof = [
    toLatLng({ x: 0, y: 0 }, origin),
    toLatLng({ x: 10, y: 0 }, origin),
    toLatLng({ x: 10, y: 10 }, origin),
    toLatLng({ x: 0, y: 10 }, origin),
  ]

  it('packs the expected number of panels and stays inside the roof', () => {
    const panels = packPanels({
      vertices: roof,
      anchoM: 1,
      altoM: 2,
      rowGapM: 0,
      orientacion: 'vertical',
      rotationDeg: 0,
    })
    // cellW=1.02 (col gap 0.02), cellH=2.0 -> ~9 cols x ~5 rows = ~45
    expect(panels.length).toBeGreaterThanOrEqual(40)
    expect(panels.length).toBeLessThanOrEqual(50)
  })

  it('larger row gap yields fewer panels', () => {
    const flush = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 0 })
    const spaced = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 1, orientacion: 'vertical', rotationDeg: 0 })
    expect(spaced.length).toBeLessThan(flush.length)
  })

  it('rotated packing fits some panels but no more than the unrotated grid', () => {
    const straight = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 0 })
    const rotated = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 45 })
    // Rotating the grid 45 deg leaves edge cells partly off the square roof, so
    // the conservative corner check drops them: still useful (>0) but never more
    // panels than the axis-aligned fit (no over-quoting).
    expect(rotated.length).toBeGreaterThan(0)
    expect(rotated.length).toBeLessThanOrEqual(straight.length)
  })

  it('returns [] for a degenerate polygon', () => {
    expect(packPanels({ vertices: roof.slice(0, 2), anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 0 })).toEqual([])
  })

  it('is deterministic under rotation and every panel stays inside the roof', () => {
    const polyM = roof.map((v) => toLocalMeters(v, origin))
    for (const rotationDeg of [0, 15, 30, 45, 90, -30]) {
      const args = { vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical' as const, rotationDeg }
      const a = packPanels(args)
      const b = packPanels(args)
      expect(a).toEqual(b)
      // Panel centers must land inside the polygon (corners are checked with a
      // 1µm inset during packing; the center is strictly interior).
      for (const p of a) {
        expect(pointInPolygon(toLocalMeters(p, origin), polyM)).toBe(true)
      }
    }
  })

  it('rotating 90 degrees matches swapping the orientation on a square roof', () => {
    // Equivalence holds only when rowGap equals the fixed 0.02 m column gap,
    // since rotating the grid swaps which roof axis each gap runs along.
    const rotated = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0.02, orientacion: 'vertical', rotationDeg: 90 })
    const swapped = packPanels({ vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0.02, orientacion: 'horizontal', rotationDeg: 0 })
    expect(rotated.length).toBe(swapped.length)
  })
})

describe('repack', () => {
  const roof = [
    toLatLng({ x: 0, y: 0 }, origin),
    toLatLng({ x: 10, y: 0 }, origin),
    toLatLng({ x: 10, y: 10 }, origin),
    toLatLng({ x: 0, y: 10 }, origin),
  ]

  it('matches polygonAreaM2 + packPanels on the same inputs', () => {
    const args = { vertices: roof, anchoM: 1, altoM: 2, rowGapM: 0.7, orientacion: 'vertical' as const, rotationDeg: 15 }
    const { areaM2, panels } = repack(args)
    expect(areaM2).toBeCloseTo(polygonAreaM2(roof), 6)
    expect(panels).toEqual(packPanels(args))
  })

  it('returns empty geometry for a degenerate polygon', () => {
    expect(repack({ vertices: roof.slice(0, 2), anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 0 })).toEqual({ areaM2: 0, panels: [] })
  })
})
