// src/lib/roof/__tests__/geometry.test.ts
import { describe, it, expect } from 'vitest'
import {
  toLocalMeters,
  toLatLng,
  polygonAreaM2,
  pointInPolygon,
  latLngToWorldPixel,
} from '../geometry'

const origin = { lat: 6.2442, lng: -75.5812 }

describe('toLocalMeters / toLatLng round-trip', () => {
  it('returns the original lat/lng within 1e-6', () => {
    const p = { lat: 6.2450, lng: -75.5800 }
    const m = toLocalMeters(p, origin)
    const back = toLatLng(m, origin)
    expect(back.lat).toBeCloseTo(p.lat, 6)
    expect(back.lng).toBeCloseTo(p.lng, 6)
  })
})

describe('polygonAreaM2', () => {
  it('computes ~the area of a ~20m x ~10m rectangle', () => {
    // build a rectangle in meters around origin, convert to lat/lng
    const corners = [
      toLatLng({ x: 0, y: 0 }, origin),
      toLatLng({ x: 20, y: 0 }, origin),
      toLatLng({ x: 20, y: 10 }, origin),
      toLatLng({ x: 0, y: 10 }, origin),
    ]
    expect(polygonAreaM2(corners)).toBeGreaterThan(195)
    expect(polygonAreaM2(corners)).toBeLessThan(205)
  })
})

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
  ]
  it('detects inside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
  })
  it('detects outside', () => {
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
  })
})

describe('latLngToWorldPixel', () => {
  it('moves east -> larger x, north -> smaller y', () => {
    const a = latLngToWorldPixel({ lat: 6.2442, lng: -75.5812 }, 20)
    const east = latLngToWorldPixel({ lat: 6.2442, lng: -75.5800 }, 20)
    const north = latLngToWorldPixel({ lat: 6.2460, lng: -75.5812 }, 20)
    expect(east.x).toBeGreaterThan(a.x)
    expect(north.y).toBeLessThan(a.y)
  })
})
