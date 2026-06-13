# Roof Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fullscreen map-based roof designer (launched from the Técnico step) where the user draws roof outlines, auto-fills panels with cubierta-aware density, and the placed-panel total drives the quotation via the existing `override_paneles` seam.

**Architecture:** Pure geometry/packing modules (`src/lib/roof/`) hold all map-free math and are unit-tested. A `RoofDesigner` dialog component uses `@react-google-maps/api` (`drawing`+`geometry` libs) to draw polygons and render panel polygons, then renders an offscreen-canvas JPEG snapshot from Google Static Maps. On "Aplicar" it writes `override_paneles` + a new `technical.diseno_techo` field; the existing live-recompute pattern propagates everything else. The snapshot JPEG is reused verbatim in the web proposal section and a new PDF page.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, zod v4, Zustand persist, `@react-google-maps/api`, `@react-pdf/renderer`, vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-roof-designer-design.md`

---

## File structure

**Create:**
- `src/lib/roof/geometry.ts` — pure: local-meters projection, polygon area, point-in-polygon, Web Mercator pixel projection.
- `src/lib/roof/packing.ts` — pure: `defaultRowGap`, `packPanels`.
- `src/lib/roof/snapshot.ts` — browser-only: render Static Maps + overlays to a JPEG data URL.
- `src/lib/roof/__tests__/geometry.test.ts`
- `src/lib/roof/__tests__/packing.test.ts`
- `src/components/maps-libraries.ts` — shared `MAPS_LIBRARIES` constant.
- `src/components/quotation/roof-designer.tsx` — the fullscreen dialog.
- `src/components/virtual/roof-design-section.tsx` — web proposal section.

**Modify:**
- `src/lib/types.ts` — `RoofArea`, `RoofDesign`, three `TechnicalData` fields.
- `src/lib/schemas.ts` — `roofDesignSchema` + three `technicalSchema` fields.
- `src/lib/defaults.ts` — `initialTechnicalData` gets the three fields.
- `src/components/interactive-map.tsx` — use shared `MAPS_LIBRARIES`.
- `src/components/quotation/step-technical.tsx` — `ancho_m`/`alto_m` inputs + "Diseñar en el mapa" button + designer wiring.
- `src/components/virtual/virtual-quotation.tsx` — render `RoofDesignSection`.
- `src/lib/pdf/proposal-pdf.tsx` — new "Diseño del Techo" page.

---

## Task 1: Shared Maps libraries constant

**Files:**
- Create: `src/components/maps-libraries.ts`
- Modify: `src/components/interactive-map.tsx:14`

- [ ] **Step 1: Create the shared constant**

```ts
// src/components/maps-libraries.ts
import type { Libraries } from '@react-google-maps/api'

// Single source of truth for useJsApiLoader libraries across the app.
// @react-google-maps/api warns/reloads if different mounts pass different arrays.
export const MAPS_LIBRARIES: Libraries = ['places', 'maps', 'drawing', 'geometry']
```

- [ ] **Step 2: Point interactive-map at it**

In `src/components/interactive-map.tsx`, delete the local `libraries` array (line 14) and its use in `useJsApiLoader`. Add the import and use the shared constant:

```ts
import { MAPS_LIBRARIES } from '@/components/maps-libraries'
// ...
const { isLoaded, loadError } = useJsApiLoader({
  googleMapsApiKey: apiKey ?? '',
  libraries: MAPS_LIBRARIES,
})
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/maps-libraries.ts src/components/interactive-map.tsx
git commit -m "feat(roof): shared Maps libraries constant (adds drawing+geometry)"
```

---

## Task 2: Types

**Files:**
- Modify: `src/lib/types.ts` (add new interfaces near `ProposalImage`; extend `TechnicalData`)

- [ ] **Step 1: Add the roof types**

Insert after the `ProposalImage` interface (around line 51):

```ts
export interface RoofPanelPos {
  lat: number
  lng: number
}

export interface RoofArea {
  id: string
  vertices: { lat: number; lng: number }[] // polygon corners (lat/lng)
  area_m2: number
  panels: RoofPanelPos[] // placed panel centers (lat/lng)
  rotation_deg: number // row orientation for this face
  row_gap_m: number // inter-row gap (defaulted from tipo_cubierta, editable)
}

export interface RoofDesign {
  areas: RoofArea[]
  total_panels: number
  total_area_m2: number
  orientacion: 'vertical' | 'horizontal' // panel portrait/landscape
  snapshot_data_url: string | null // rendered JPEG for web + PDF
  updated_at: string // ISO string
}
```

- [ ] **Step 2: Extend `TechnicalData`**

Add three fields to the `TechnicalData` interface (after `modelo_panel`):

```ts
  ancho_m: number // panel width in meters
  alto_m: number // panel height in meters
  diseno_techo: RoofDesign | null // saved roof design; null when never drawn
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: errors ONLY in `defaults.ts` / `schemas.ts` (missing fields) — those are fixed in Tasks 3-4. No errors in `types.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(roof): RoofArea/RoofDesign types + TechnicalData fields"
```

---

## Task 3: Defaults

**Files:**
- Modify: `src/lib/defaults.ts` (`initialTechnicalData`)

- [ ] **Step 1: Add defaults**

In `initialTechnicalData`, after `modelo_panel: ''`, add:

```ts
  ancho_m: 1.13,
  alto_m: 2.38,
  diseno_techo: null,
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: `defaults.ts` errors resolved; `schemas.ts` may still error until Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/lib/defaults.ts
git commit -m "feat(roof): initialTechnicalData defaults for panel dims + design"
```

---

## Task 4: zod schema

**Files:**
- Modify: `src/lib/schemas.ts` (`technicalSchema`, new `roofDesignSchema`)

- [ ] **Step 1: Add the roof design schema above `technicalSchema`**

```ts
const roofAreaSchema = z.object({
  id: z.string(),
  vertices: z.array(z.object({ lat: z.number(), lng: z.number() })),
  area_m2: z.number(),
  panels: z.array(z.object({ lat: z.number(), lng: z.number() })),
  rotation_deg: z.number(),
  row_gap_m: z.number(),
})

export const roofDesignSchema = z.object({
  areas: z.array(roofAreaSchema),
  total_panels: z.number(),
  total_area_m2: z.number(),
  orientacion: z.enum(['vertical', 'horizontal']),
  snapshot_data_url: z.string().nullable(),
  updated_at: z.string(),
})
```

- [ ] **Step 2: Add the three fields to `technicalSchema`**

Inside the `technicalSchema` object (after `modelo_panel: z.string()`), add:

```ts
  ancho_m: z.number().min(0.3, 'Mínimo 0.3 m').max(3, 'Máximo 3 m'),
  alto_m: z.number().min(0.3, 'Mínimo 0.3 m').max(3, 'Máximo 3 m'),
  diseno_techo: roofDesignSchema.nullable(),
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas.ts
git commit -m "feat(roof): zod schema for panel dims + roof design"
```

---

## Task 5: Pure geometry module (TDD)

**Files:**
- Create: `src/lib/roof/geometry.ts`
- Test: `src/lib/roof/__tests__/geometry.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/roof/__tests__/geometry.test.ts`
Expected: FAIL — module `../geometry` not found.

- [ ] **Step 3: Implement `geometry.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/roof/__tests__/geometry.test.ts`
Expected: PASS (all 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/roof/geometry.ts src/lib/roof/__tests__/geometry.test.ts
git commit -m "feat(roof): pure geometry module + tests"
```

---

## Task 6: Pure packing module (TDD)

**Files:**
- Create: `src/lib/roof/packing.ts`
- Test: `src/lib/roof/__tests__/packing.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/roof/__tests__/packing.test.ts`
Expected: FAIL — module `../packing` not found.

- [ ] **Step 3: Implement `packing.ts`**

```ts
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
  for (let cy = minY + cellH / 2; cy + cellH / 2 <= maxY + 1e-9; cy += cellH) {
    for (let cx = minX + cellW / 2; cx + cellW / 2 <= maxX + 1e-9; cx += cellW) {
      // require all four panel corners inside the polygon (panel fully on roof)
      const corners: PointM[] = [
        { x: cx - w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 },
        { x: cx - w / 2, y: cy + h / 2 },
      ]
      if (corners.every((c) => pointInPolygon(c, polyM))) {
        // rotate the center back to true orientation, convert to lat/lng
        centers.push(toLatLng(rotate({ x: cx, y: cy }, rotationDeg), origin))
      }
    }
  }
  return centers
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/roof/__tests__/packing.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all pass (existing calculator golden suite untouched + new roof tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/roof/packing.ts src/lib/roof/__tests__/packing.test.ts
git commit -m "feat(roof): pure panel-packing module + tests"
```

---

## Task 7: Snapshot renderer (browser canvas)

**Files:**
- Create: `src/lib/roof/snapshot.ts`

No unit test (DOM/canvas/network side effects); verified manually in Task 13.

- [ ] **Step 1: Implement `snapshot.ts`**

```ts
// src/lib/roof/snapshot.ts
// Browser-only: composite a Google Static Maps satellite image with the roof
// polygons + panels drawn on top, exported as a JPEG data URL for web + PDF.
import { latLngToWorldPixel, type LatLng } from './geometry'
import type { RoofArea } from '@/lib/types'

const SIZE = 640 // base px (Static Maps max 640; scale=2 -> 1280 effective)
const SCALE = 2

function boundsOf(areas: RoofArea[]): { center: LatLng; zoom: number } {
  const pts = areas.flatMap((a) => a.vertices)
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  // pick the largest zoom that fits the bbox in SIZE px
  let zoom = 21
  for (; zoom > 1; zoom--) {
    const ne = latLngToWorldPixel({ lat: Math.max(...lats), lng: Math.max(...lngs) }, zoom)
    const sw = latLngToWorldPixel({ lat: Math.min(...lats), lng: Math.min(...lngs) }, zoom)
    const w = Math.abs(ne.x - sw.x)
    const h = Math.abs(ne.y - sw.y)
    if (w < SIZE * 0.85 && h < SIZE * 0.85) break
  }
  return { center, zoom }
}

export async function renderRoofSnapshot(
  areas: RoofArea[],
  orientacion: 'vertical' | 'horizontal',
  panelDims: { anchoM: number; altoM: number }
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || areas.length === 0) return null

  const { center, zoom } = boundsOf(areas)
  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${center.lat},${center.lng}&zoom=${zoom}` +
    `&size=${SIZE}x${SIZE}&scale=${SCALE}&maptype=satellite&key=${apiKey}`

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  }).catch(() => null)
  if (!img) return null

  const canvas = document.createElement('canvas')
  canvas.width = SIZE * SCALE
  canvas.height = SIZE * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // world-pixel of the image center; convert any latlng to canvas px.
  const centerWp = latLngToWorldPixel(center, zoom)
  const half = SIZE / 2
  const toCanvas = (p: LatLng) => {
    const wp = latLngToWorldPixel(p, zoom)
    return {
      x: (wp.x - centerWp.x + half) * SCALE,
      y: (wp.y - centerWp.y + half) * SCALE,
    }
  }

  for (const area of areas) {
    // polygon outline
    ctx.beginPath()
    area.vertices.forEach((v, i) => {
      const c = toCanvas(v)
      if (i === 0) ctx.moveTo(c.x, c.y)
      else ctx.lineTo(c.x, c.y)
    })
    ctx.closePath()
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.stroke()

    // panels (small filled squares at their centers)
    ctx.fillStyle = 'rgba(37,99,235,0.85)'
    ctx.strokeStyle = '#93c5fd'
    ctx.lineWidth = 1
    for (const panel of area.panels) {
      const c = toCanvas(panel)
      const s = 4 * SCALE
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s)
      ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.7)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/roof/snapshot.ts
git commit -m "feat(roof): offscreen-canvas snapshot renderer"
```

---

## Task 8: RoofDesigner dialog component

**Files:**
- Create: `src/components/quotation/roof-designer.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from '@react-google-maps/api'
import { MAPS_LIBRARIES } from '@/components/maps-libraries'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, Zap } from 'lucide-react'
import { packPanels, defaultRowGap, type Cubierta, type Orientacion } from '@/lib/roof/packing'
import { polygonAreaM2 } from '@/lib/roof/geometry'
import { toLocalMeters, toLatLng } from '@/lib/roof/geometry'
import { renderRoofSnapshot } from '@/lib/roof/snapshot'
import type { RoofArea, RoofDesign } from '@/lib/types'

interface RoofDesignerProps {
  lat: number
  lng: number
  potenciaPanelW: number
  tipoCubierta: Cubierta
  anchoM: number
  altoM: number
  panelesSugeridos: number // consumption-derived count, shown as reference
  initialDesign: RoofDesign | null
  onApply: (design: RoofDesign) => void
  onClose: () => void
}

let _id = 0
const nextId = () => `area-${Date.now()}-${_id++}`

// Build the 4 lat/lng corners of a panel rectangle for rendering.
function panelCorners(center: { lat: number; lng: number }, w: number, h: number, rotationDeg: number) {
  const r = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  const local = toLocalMeters(center, center) // {0,0}
  void local
  const offs = [
    { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
  ]
  return offs.map((o) => {
    const rx = o.x * cos - o.y * sin
    const ry = o.x * sin + o.y * cos
    return toLatLng({ x: rx, y: ry }, center)
  })
}

export function RoofDesigner({
  lat, lng, potenciaPanelW, tipoCubierta, anchoM, altoM,
  panelesSugeridos, initialDesign, onApply, onClose,
}: RoofDesignerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: MAPS_LIBRARIES,
  })

  const [areas, setAreas] = useState<RoofArea[]>(initialDesign?.areas ?? [])
  const [orientacion, setOrientacion] = useState<Orientacion>(initialDesign?.orientacion ?? 'vertical')
  const [rowGap, setRowGap] = useState<number>(
    initialDesign?.areas[0]?.row_gap_m ?? defaultRowGap(tipoCubierta)
  )
  const [drawing, setDrawing] = useState(true)
  const [saving, setSaving] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)

  const totalPanels = useMemo(() => areas.reduce((s, a) => s + a.panels.length, 0), [areas])
  const totalAreaM2 = useMemo(() => areas.reduce((s, a) => s + a.area_m2, 0), [areas])
  const kwp = (totalPanels * potenciaPanelW) / 1000

  const onPolygonComplete = useCallback((poly: google.maps.Polygon) => {
    const path = poly.getPath()
    const vertices = path.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }))
    poly.setMap(null) // we render our own <Polygon>
    setAreas((prev) => [
      ...prev,
      {
        id: nextId(),
        vertices,
        area_m2: polygonAreaM2(vertices),
        panels: [],
        rotation_deg: 0,
        row_gap_m: rowGap,
      },
    ])
    setDrawing(false)
  }, [rowGap])

  const autoFill = useCallback(() => {
    setAreas((prev) => prev.map((a) => ({
      ...a,
      row_gap_m: rowGap,
      panels: packPanels({
        vertices: a.vertices,
        anchoM, altoM, rowGapM: rowGap, orientacion, rotationDeg: a.rotation_deg,
      }),
    })))
  }, [anchoM, altoM, rowGap, orientacion])

  const deleteArea = useCallback((id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleApply = useCallback(async () => {
    setSaving(true)
    const snapshot = await renderRoofSnapshot(areas, orientacion, { anchoM, altoM })
    const design: RoofDesign = {
      areas,
      total_panels: totalPanels,
      total_area_m2: totalAreaM2,
      orientacion,
      snapshot_data_url: snapshot,
      updated_at: new Date().toISOString(),
    }
    setSaving(false)
    onApply(design)
  }, [areas, orientacion, anchoM, altoM, totalPanels, totalAreaM2, onApply])

  const w = orientacion === 'vertical' ? anchoM : altoM
  const h = orientacion === 'vertical' ? altoM : anchoM

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button type="button" size="sm" variant={drawing ? 'default' : 'outline'} onClick={() => setDrawing(true)}>
          Dibujar techo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={autoFill} disabled={areas.length === 0}>
          <Zap className="mr-1 size-4" /> Auto-llenar paneles
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Orientación</Label>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={orientacion}
            onChange={(e) => setOrientacion(e.target.value as Orientacion)}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Separación filas: {rowGap.toFixed(2)} m</Label>
          <input
            type="range" min={0} max={2} step={0.05} value={rowGap}
            aria-label="Separación entre filas"
            onChange={(e) => setRowGap(Number(e.target.value))}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" className="bg-mirac-red hover:bg-mirac-red-dark" onClick={handleApply} disabled={saving || totalPanels === 0}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Aplicar a la cotización ({totalPanels} paneles)
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat, lng }}
              zoom={20}
              onLoad={(m) => { mapRef.current = m }}
              options={{ mapTypeId: 'satellite', tilt: 0, disableDefaultUI: false, zoomControl: true }}
            >
              {drawing && (
                <DrawingManager
                  onPolygonComplete={onPolygonComplete}
                  options={{
                    drawingControl: false,
                    drawingMode: google.maps.drawing.OverlayType.POLYGON,
                    polygonOptions: { fillColor: '#facc15', fillOpacity: 0.1, strokeColor: '#facc15', strokeWeight: 2 },
                  }}
                />
              )}
              {areas.map((area) => (
                <div key={area.id}>
                  <Polygon
                    paths={area.vertices}
                    options={{ fillColor: '#facc15', fillOpacity: 0.08, strokeColor: '#facc15', strokeWeight: 2 }}
                  />
                  {area.panels.map((p, i) => (
                    <Polygon
                      key={`${area.id}-p-${i}`}
                      paths={panelCorners(p, w, h, area.rotation_deg)}
                      options={{ fillColor: '#2563eb', fillOpacity: 0.85, strokeColor: '#93c5fd', strokeWeight: 0.5, clickable: false }}
                    />
                  ))}
                </div>
              ))}
            </GoogleMap>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-56 shrink-0 space-y-4 border-l p-4">
          <div>
            <p className="text-xs text-muted-foreground">Área total</p>
            <p className="text-lg font-bold">{Math.round(totalAreaM2)} m²</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paneles ubicados</p>
            <p className="text-lg font-bold text-mirac-yellow-dark">{totalPanels}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Potencia ({potenciaPanelW} W)</p>
            <p className="text-lg font-bold">{kwp.toFixed(1)} kWp</p>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">Sugerido por consumo</p>
            <p className="text-sm text-muted-foreground">{panelesSugeridos} paneles</p>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium">Techos ({areas.length})</p>
            {areas.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span>Techo {i + 1}: {a.panels.length}p · {Math.round(a.area_m2)} m²</span>
                <button type="button" aria-label="Borrar techo" onClick={() => deleteArea(a.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck clean; lint zero errors (the known `@react-pdf`/watch warnings may persist elsewhere but this file should be clean).

- [ ] **Step 3: Commit**

```bash
git add src/components/quotation/roof-designer.tsx
git commit -m "feat(roof): RoofDesigner fullscreen dialog component"
```

---

## Task 9: Wire designer into the Técnico step

**Files:**
- Modify: `src/components/quotation/step-technical.tsx`

- [ ] **Step 1: Add imports + state**

At the top with the other imports:

```tsx
import { useState } from 'react'
import { RoofDesigner } from './roof-designer'
import { Map as MapIcon } from 'lucide-react'
import type { RoofDesign } from '@/lib/types'
```

Inside `StepTechnical`, after the `useWatch` block:

```tsx
const [designerOpen, setDesignerOpen] = useState(false)
const anchoM = watched.ancho_m ?? 1.13
const altoM = watched.alto_m ?? 2.38
const disenoTecho = watched.diseno_techo as RoofDesign | null | undefined
const cubierta = (watched.tipo_cubierta ?? 'metalica') as 'metalica' | 'teja' | 'losa'
```

- [ ] **Step 2: Add the panel-dimension inputs**

Inside the `grid gap-4 sm:grid-cols-2` block (after the panel model field, before factor de seguridad), add:

```tsx
<div className="space-y-2">
  <Label htmlFor="ancho_m">Ancho del panel (m)</Label>
  <Input id="ancho_m" type="number" step={0.01} min={0.3} max={3}
    {...register('ancho_m', { valueAsNumber: true })} />
  {errors.ancho_m && <p className="text-sm text-destructive">{errors.ancho_m.message}</p>}
</div>
<div className="space-y-2">
  <Label htmlFor="alto_m">Alto del panel (m)</Label>
  <Input id="alto_m" type="number" step={0.01} min={0.3} max={3}
    {...register('alto_m', { valueAsNumber: true })} />
  {errors.alto_m && <p className="text-sm text-destructive">{errors.alto_m.message}</p>}
</div>
```

- [ ] **Step 3: Add the "Diseñar en el mapa" button + design summary**

After the manual-override block (`</div>` closing the `rounded-lg border p-4` block, around line 198), add:

```tsx
{/* Roof designer */}
<div className="rounded-lg border p-4 space-y-3">
  <div className="flex items-center justify-between">
    <div>
      <Label className="text-sm font-medium">Diseño del techo (opcional)</Label>
      <p className="text-xs text-muted-foreground">
        Dibuja el techo en el mapa para ubicar los paneles reales. El total reemplaza la cantidad.
      </p>
    </div>
    <Button
      type="button"
      variant="outline"
      onClick={() => setDesignerOpen(true)}
      disabled={projectData.lat == null || projectData.lon == null}
    >
      <MapIcon className="mr-2 size-4" />
      Diseñar en el mapa
    </Button>
  </div>
  {projectData.lat == null && (
    <p className="text-xs text-destructive">Primero fija la ubicación en el paso Proyecto.</p>
  )}
  {disenoTecho && disenoTecho.areas.length > 0 && (
    <p className="text-xs text-muted-foreground">
      Diseño guardado: {disenoTecho.total_panels} paneles · {Math.round(disenoTecho.total_area_m2)} m²
      en {disenoTecho.areas.length} techo(s).
    </p>
  )}
</div>
```

- [ ] **Step 4: Render the designer (full-screen) just before the closing `</Card>`**

Before `</CardContent>` (or after it, inside the component return, as a sibling), add:

```tsx
{designerOpen && projectData.lat != null && projectData.lon != null && (
  <RoofDesigner
    lat={projectData.lat}
    lng={projectData.lon}
    potenciaPanelW={potenciaPanel}
    tipoCubierta={cubierta}
    anchoM={anchoM}
    altoM={altoM}
    panelesSugeridos={panelesCalc}
    initialDesign={disenoTecho ?? null}
    onClose={() => setDesignerOpen(false)}
    onApply={(design) => {
      setValue('diseno_techo', design)
      setValue('override_paneles', design.total_panels)
      setDesignerOpen(false)
    }}
  />
)}
```

- [ ] **Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck clean; lint zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/quotation/step-technical.tsx
git commit -m "feat(roof): panel-dimension inputs + designer launch in Tecnico step"
```

---

## Task 10: Web proposal section

**Files:**
- Create: `src/components/virtual/roof-design-section.tsx`
- Modify: `src/components/virtual/virtual-quotation.tsx`

- [ ] **Step 1: Create the section**

```tsx
'use client'

import type { RoofDesign } from '@/lib/types'

interface RoofDesignSectionProps {
  diseno: RoofDesign | null | undefined
  potenciaPanelW: number
}

export function RoofDesignSection({ diseno, potenciaPanelW }: RoofDesignSectionProps) {
  if (!diseno || diseno.areas.length === 0) return null
  const kwp = (diseno.total_panels * potenciaPanelW) / 1000

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Diseño del Techo</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Área total</p>
          <p className="text-lg font-bold">{Math.round(diseno.total_area_m2)} m²</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Paneles ubicados</p>
          <p className="text-lg font-bold">{diseno.total_panels}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Potencia</p>
          <p className="text-lg font-bold">{kwp.toFixed(1)} kWp</p>
        </div>
      </div>
      {diseno.snapshot_data_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={diseno.snapshot_data_url}
          alt="Diseño del techo con paneles"
          className="w-full rounded-lg border"
        />
      )}
    </section>
  )
}
```

- [ ] **Step 2: Wire it into the orchestrator**

In `src/components/virtual/virtual-quotation.tsx`, add the import near the other section imports:

```tsx
import { RoofDesignSection } from './roof-design-section'
```

Render it right after `<SystemDesignSection ... />` (line ~88):

```tsx
<RoofDesignSection
  diseno={proposal.technical.diseno_techo}
  potenciaPanelW={proposal.technical.potencia_panel_w}
/>
```

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/virtual/roof-design-section.tsx src/components/virtual/virtual-quotation.tsx
git commit -m "feat(roof): roof design section in virtual quotation"
```

---

## Task 11: PDF page

**Files:**
- Modify: `src/lib/pdf/proposal-pdf.tsx`

- [ ] **Step 1: Add the "Diseño del Techo" page**

`ProposalPdf` already destructures `technical`. After the battery page block (`r.bateria?.habilitada && (() => { ... })()`, ends ~line 406) and before the images block (~line 631), insert a new page guarded on the snapshot. Match the existing page pattern (background image, `mm()` coordinates, `<Text>`/`<View>`):

```tsx
{technical.diseno_techo?.snapshot_data_url && technical.diseno_techo.areas.length > 0 && (() => {
  const d = technical.diseno_techo!
  const kwp = (d.total_panels * technical.potencia_panel_w) / 1000
  return (
    <Page size="A4" style={styles.page}>
      <Image src={`${BG}/3.jpg`} style={styles.bg} />
      <View style={{ position: 'absolute', top: mm(40), left: mm(15), right: mm(15) }}>
        <Text style={styles.h2}>Diseño del Techo</Text>
        <Image
          src={d.snapshot_data_url!}
          style={{ width: mm(180), height: mm(120), marginTop: mm(6), objectFit: 'contain' }}
        />
        <View style={{ marginTop: mm(8) }}>
          {[
            ['Área total', `${Math.round(d.total_area_m2)} m²`],
            ['Paneles ubicados', `${d.total_panels}`],
            ['Potencia instalada', `${kwp.toFixed(1)} kWp`],
            ['Techos', `${d.areas.length}`],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: mm(1.5) }}>
              <Text style={styles.tableLabel}>{k}</Text>
              <Text style={styles.tableValue}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  )
})()}
```

> NOTE: use the actual style names present in this file (e.g. `styles.h2`, `styles.tableLabel`, `styles.tableValue`). If a name differs, match the closest existing style used on the battery page rather than inventing new ones. Reuse an existing `BG` background number consistent with surrounding pages.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: clean (known `@react-pdf` `<Image>` alt-text warning is pre-existing/acceptable per AGENTS.md).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/proposal-pdf.tsx
git commit -m "feat(roof): Diseno del Techo page in proposal PDF"
```

---

## Task 12: Verify persistence backfill

**Files:**
- Inspect: `src/lib/share.ts:69` (`deepMerge(initialTechnicalData, ...)`)
- Inspect: `src/stores/quotation-store.ts` (`loadProposal` deep-merge)

- [ ] **Step 1: Confirm `fromPayload` covers the new fields**

`share.ts:69` already does `deepMerge(initialTechnicalData, { ...t })`. Since `initialTechnicalData` now includes `ancho_m`, `alto_m`, `diseno_techo: null`, old `/s/` payloads backfill automatically. Read the function to confirm `t` does not strip them and that `deepMerge` recurses (it does for nested objects). No code change expected.

- [ ] **Step 2: Confirm `loadProposal` deep-merges technical**

Open `src/stores/quotation-store.ts`, find `loadProposal`, confirm it deep-merges `technical` against `initialTechnicalData` (same pattern as `advanced`). If it does, no change. If it spreads `technical` raw, add the deep-merge for parity.

- [ ] **Step 3: Confirm store persist `merge`/`version`**

Confirm `quotation-store.ts` persist config deep-merges on rehydrate (per AGENTS.md item 7). If `initialTechnicalData` is the merge base, old localStorage backfills the three fields. No change expected.

- [ ] **Step 4: Typecheck + full test**

Run: `npm run typecheck && npm test`
Expected: clean + all green.

- [ ] **Step 5: Commit (only if a change was needed)**

```bash
git add -A && git commit -m "fix(roof): backfill new technical fields for old persisted/shared state"
```

If no change was needed, skip this commit and note "backfill verified, no change".

---

## Task 13: Final verification

- [ ] **Step 1: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: typecheck clean, lint zero errors, all tests pass, build succeeds.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `npm run dev`, then:
1. New quote → Proyecto: set a location (pin on map).
2. Técnico: set consumo + panel W; set `ancho_m`/`alto_m`; click "Diseñar en el mapa".
3. Draw one roof polygon → "Auto-llenar paneles" → confirm panels appear; change "Separación filas" and re-auto-fill → fewer panels on a bigger gap.
4. Draw a second roof → totals sum; delete a roof → totals update.
5. "Aplicar" → back in Técnico, confirm the override count and the "Diseño guardado" summary; the live preview kWp matches.
6. Finish the wizard → open the virtual quotation → "Diseño del Techo" section shows the snapshot + stats.
7. Download the PDF → "Diseño del Techo" page renders the snapshot image.
8. Reload the page (exercise localStorage backfill) → no crash, design persists.

- [ ] **Step 3: Final commit (if any manual-fix tweaks were made)**

```bash
git add -A && git commit -m "chore(roof): manual-smoke fixes"
```

---

## Self-review notes

- **Spec coverage:** Tier C visual layout (Tasks 6,8), bidirectional/`override_paneles` (Task 9), fullscreen modal from Técnico (Tasks 8-9), editable panel dims (Tasks 2-4,9), cubierta density auto+adjustable (Task 6 `defaultRowGap` + Task 8 row-gap control), multiple roofs (Task 8 `areas[]`), lat/lng storage (Task 2), snapshot reuse web+PDF (Tasks 7,10,11), pure-fn tests (Tasks 5-6), shared libraries array (Task 1), persistence backfill (Task 12). All covered.
- **Type consistency:** `RoofDesign`/`RoofArea` field names identical across types, schema, component, section, PDF. `packPanels` arg names (`anchoM`, `altoM`, `rowGapM`, `orientacion`, `rotationDeg`) consistent between Task 6 definition and Task 8 call. `renderRoofSnapshot(areas, orientacion, {anchoM,altoM})` signature consistent Task 7↔8.
- **Note for executor:** `panelCorners` in Task 8 has an unused `local` var (`void local`) — safe to remove; kept to make the projection origin explicit. PDF style names in Task 11 must be matched to the file's actual `StyleSheet` (flagged inline).
