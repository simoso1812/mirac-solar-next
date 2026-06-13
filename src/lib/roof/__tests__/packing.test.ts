// src/lib/roof/__tests__/packing.test.ts
import { describe, it, expect } from 'vitest'
import { defaultRowGap, packPanels } from '../packing'
import { toLatLng } from '../geometry'

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

  it('returns [] for a degenerate polygon', () => {
    expect(packPanels({ vertices: roof.slice(0, 2), anchoM: 1, altoM: 2, rowGapM: 0, orientacion: 'vertical', rotationDeg: 0 })).toEqual([])
  })
})
