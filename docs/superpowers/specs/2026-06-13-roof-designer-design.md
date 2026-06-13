# Roof Designer — Design Spec

Date: 2026-06-13
Branch base: `feat/audit-hardening`
Author: Simon (simon@mirac.energy), with Claude

## Summary

Add a **roof designer** to the Mirac Solar quote flow: a fullscreen, map-based tool
where the user draws one or more roof outlines on a satellite image, the app
auto-fills each outline with panel rectangles (density adjusted by roof type), and
the resulting **physical panel count** drives the quotation. The design is captured
as an image and shown in both the web proposal and the PDF.

This is **Tier C** of the capability range discussed: visual panel layout — more than
just measuring area, less than full tilt/azimuth/shading modeling (Tier D, explicitly
out of scope).

## Decisions (locked during brainstorming)

1. **Scope = Tier C** — draw roof, auto-place adjustable panel rectangles, real panel
   count flows to the proposal and PDF. Not just area measurement; not full
   shading/azimuth modeling.
2. **Sizing relationship = bidirectional, layout wins** — the wizard still suggests a
   panel count from consumption; when the designer is used, the placed-panel total
   overrides it. When the designer is skipped, today's consumption-based sizing stands
   unchanged.
3. **Placement = fullscreen modal launched from the Técnico step** — optional (quick
   quotes skip it), roomy canvas, leaves the existing 5-step wizard intact.
4. **Panel dimensions = two editable fields with smart defaults** — `ancho_m` /
   `alto_m` on the Técnico step, defaulting to a typical modern panel, editable per
   quote to match the datasheet.
5. **Density by roof type = automatic, adjustable** — `tipo_cubierta` sets a default
   inter-row gap (losa = spaced tilted rows, metálica/teja = flush), with a control to
   fine-tune the gap.
6. **Multiple roof areas** — several independent polygons per quote, each auto-filled;
   the total panel count is the sum across all of them.

## Architecture

### Integration seam (why this is mostly additive)

`TechnicalData` already has `override_paneles` (zod: min 2, max 5000, nullable;
default `null`) and `cotizacion()` already honors it
(`src/lib/calculator/index.ts:141`: `input.overridePaneles ?? redondearAPar(...)`).
`buildInputFromStore()` already forwards it (`index.ts:110`).

Therefore the designer needs **no calculator/engine change for the numbers**: applying
a layout writes the placed-panel total into `override_paneles`, and sizing, cost,
generation, financials, carbon, and the MCP tools all follow automatically via the
existing live-recompute pattern.

### Component

- New `RoofDesigner` client component, rendered inside a fullscreen `Dialog`,
  launched by a new "Diseñar en el mapa" button in
  `src/components/quotation/step-technical.tsx`.
- Props (all derived from data already present when the Técnico step is reached):
  - `lat`, `lng` (from `ProjectData`)
  - `potenciaPanelW`, `tipoCubierta` (from `TechnicalData`)
  - `anchoM`, `altoM` (new `TechnicalData` fields)
  - `initialDesign: RoofDesign | null`
  - `onApply(design: RoofDesign): void` — parent writes `override_paneles` +
    `diseno_techo` into the technical form via `setValue`.
- Reuses `@react-google-maps/api` but with the **`drawing` + `geometry`** libraries
  added (see "Shared libraries array" risk).

### Designer UX

- **Toolbar**: Draw roof (polygon), Auto-fill panels, Rotate row, Delete panel,
  row-gap control (defaulted by `tipo_cubierta`), panel orientation toggle
  (vertical/horizontal).
- **Canvas**: hybrid satellite map; user clicks to draw each roof polygon; auto-fill
  packs a panel grid inside the polygon respecting panel dims + gap + orientation;
  individual panels are deletable, rows rotatable.
- **Sidebar (live)**: total área (m²), panels placed, kWp (`panels × potenciaPanelW`),
  and the consumption-suggested count as a reference (the bidirectional cue).
- **Footer**: Cancelar / "Aplicar a la cotización (N paneles)".
- Supports **multiple roof faces** — draw another polygon; totals sum across all.

## Data model

`src/lib/types.ts`, `src/lib/schemas.ts`, `src/lib/defaults.ts`.

New `TechnicalData` fields:

```ts
ancho_m: number          // panel width in meters, default 1.13
alto_m: number           // panel height in meters, default 2.38 (typical ~615 W panel)
diseno_techo: RoofDesign | null   // saved design; null when never drawn
```

New types:

```ts
interface RoofArea {
  id: string
  vertices: { lat: number; lng: number }[]   // polygon corners (lat/lng — projection-independent)
  area_m2: number                            // google.maps.geometry.spherical.computeArea
  panels: { lat: number; lng: number }[]     // placed panel centers (lat/lng)
  rotation_deg: number                       // row orientation for this face
  row_gap_m: number                          // defaulted from tipo_cubierta, editable
}

interface RoofDesign {
  areas: RoofArea[]
  total_panels: number
  total_area_m2: number
  orientacion: 'vertical' | 'horizontal'     // panel portrait/landscape, default 'vertical'
  snapshot_data_url: string | null           // rendered JPEG for web + PDF
  updated_at: string                         // ISO string
}
```

Rationale for storing vertices and panel centers as **lat/lng**: they re-render
correctly at any zoom and survive map re-centering; pixel coordinates would not.

Rationale for storing the whole design on **`technical`** (not `advanced`): the
designer is launched from the Técnico step and writes `override_paneles` (also on
`technical`), so a single slice owns the entire write — no cross-step plumbing.

### zod schema notes

- `ancho_m`, `alto_m`: positive numbers with sane bounds (e.g. `0.3`–`3` m).
- `diseno_techo`: nullable nested object schema mirroring the types above; `panels`
  and `vertices` are arrays of `{ lat, lng }`. `snapshot_data_url` is a nullable
  string. Keep validation permissive enough that an empty/partial design never blocks
  `handleSubmit` (the historical silent-submit-failure trap).

## Persistence

Follow the established Zustand-persist deep-merge discipline (AGENTS.md "Zustand
persist gotcha"):

1. Add `ancho_m`, `alto_m`, `diseno_techo: null` to `initialTechnicalData` in
   `src/lib/defaults.ts`.
2. `loadProposal` deep-merge and `step-technical.tsx` form `defaultValues` deep-merge
   already cover `technical` — verify the new nested `diseno_techo` is covered.
3. `fromPayload()` in `src/lib/share.ts` backfills `initialTechnicalData`, so old `/s/`
   links keep working.
4. The snapshot is bulky base64 (like `advanced.imagenes`). Compress/cap it
   (~150–200 KB, JPEG, reuse the `src/lib/images.ts` approach) and accept the Upstash
   share-size tradeoff (documented limit ~6–10 photos already).

## Snapshot rendering (the one real technical risk)

AGENTS.md records that in this `@react-pdf` build, **SVG and canvas-PNG-via-`<Image>`
render blank**, but `<Image>` with a real raster PNG/JPEG works (the monthly generation
chart proves it).

Approach — build the snapshot on an **offscreen canvas** at "Aplicar" time:

1. Compute the bounding box of all roof areas; pick a Google **Static Maps** satellite
   image (center + zoom to fit, `scale=2`). Reuse the URL-builder family from
   `src/lib/pdf/get-map-url.ts`.
2. Load that image with `crossOrigin = 'anonymous'` (Static Maps allows this — no
   canvas taint).
3. Project each polygon vertex and panel rectangle from lat/lng to the static image's
   pixel space using Web Mercator math at the chosen center/zoom.
4. Draw polygons (outline) and panels (filled rects) over the satellite image.
5. `canvas.toDataURL('image/jpeg', ~0.7)` → `snapshot_data_url`.

This single JPEG is reused verbatim in the web section and the PDF — no live-map
screenshot, no CORS taint, no canvas/SVG inside `@react-pdf`.

## Where the design shows

- **Web**: new `src/components/virtual/roof-design-section.tsx` in the virtual
  quotation orchestrator — the snapshot image + stats (área total, paneles, kWp,
  per-roof breakdown). Place near `system-design-section.tsx`. Guarded so proposals
  without a design render nothing.
- **PDF**: new "Diseño del Techo" page in `src/lib/pdf/proposal-pdf.tsx` — snapshot via
  `<Image>` + a small table (área total, paneles, kWp, per-roof). Wrapped in a
  defensive guard (`r`/`technical.diseno_techo?.snapshot_data_url && ...`).
- **MCP**: unchanged — agents have no geometry input; `quote_solar_system` /
  `create_quotation_link` continue to size from consumption (or an explicit override).

## Pure-function modules (testable without a map)

Extract the math into pure functions so they can be unit-tested with the
golden-master discipline (no Google Maps, no canvas in tests):

- `src/lib/roof/geometry.ts`
  - `polygonAreaM2(vertices)` — spherical area (mirror of `computeArea`, or wrap it).
  - `latLngToPixel(latLng, center, zoom, tileSize)` / `pixelToLatLng(...)` — Web
    Mercator projection round-trip.
- `src/lib/roof/packing.ts`
  - `packPanels({ polygon, anchoM, altoM, rowGapM, orientacion })` → panel centers.
    Deterministic, depends only on inputs.
  - `defaultRowGap(tipoCubierta)` → number (losa spaced, metálica/teja flush).

The `RoofDesigner` component and `snapshot` renderer consume these; they hold the
Google Maps / canvas side effects and stay out of unit tests.

## Testing

New `src/lib/roof/__tests__/`:

- `polygonAreaM2` of a known rectangle (lat/lng box) ≈ expected m² (tolerance).
- `packPanels`: a rectangle of known size with given panel dims + gap + orientation
  yields the expected deterministic count and non-overlapping centers.
- `defaultRowGap`: losa > metálica == teja (flush ≈ 0).
- Mercator `latLngToPixel`/`pixelToLatLng` round-trip within tolerance.

CI (`.github/workflows/ci.yml`) already runs typecheck + lint + test + build; these
tests join that gate. The existing calculator golden suite must remain green
(the engine is untouched, so snapshots should not move).

## Risks / assumptions

- **Shared `libraries` array**: `useJsApiLoader` must use one stable array across the
  app or Maps logs reload warnings. Hoist a shared
  `MAPS_LIBRARIES = ['places','maps','drawing','geometry']` constant and point both
  `src/components/interactive-map.tsx` and `RoofDesigner` at it.
- **Static Maps sizing**: very large commercial roofs may lose sharpness at the zoom
  that fits the bbox; mitigated with `scale=2`. Acceptable for a sales proposal.
- **localStorage / Upstash size**: the snapshot adds to the inline payload; capped via
  JPEG compression. Same tradeoff already accepted for `imagenes`.
- **Panel orientation default**: `vertical` (portrait); user-toggleable.
- **Tilt is visual-only**: losa panels are drawn flat with spaced rows; we do not model
  true 3D tilt geometry (Tier D, out of scope). Row gap approximates the real density.

## Out of scope (Tier D and beyond)

- Azimuth / true tilt 3D modeling, inter-row shading calculations, per-string
  electrical grouping, obstruction/setback drawing, terrain/roof-pitch inference.
  These can be layered later; the data model leaves room (`rotation_deg`, per-area
  fields) without committing to them now.

## Common-workflow checklist (from AGENTS.md "Adding a new field")

1. `types.ts` — `ancho_m`, `alto_m`, `diseno_techo`, `RoofArea`, `RoofDesign`. ✅ planned
2. `schemas.ts` — zod for the new fields. ✅ planned
3. `defaults.ts` — `initialTechnicalData` gets the new fields. ✅ planned
4. `step-technical.tsx` — `ancho_m`/`alto_m` inputs + "Diseñar en el mapa" button. ✅ planned
5. `buildInputFromStore` — no change needed (`override_paneles` already forwarded). ✅
6. `cotizacion` — no change needed (already honors `override_paneles`). ✅
7. Web `roof-design-section.tsx` + PDF page. ✅ planned
8. Verify deep-merge for old persisted + shared state. ✅ planned

## Verification before "done"

- `npm run typecheck` clean, `npm run lint` zero errors, `npm test` green (incl. new
  roof tests + untouched golden suite), `npm run build` passes.
- Manual: draw single + multiple roofs, apply, confirm `override_paneles` and metrics
  update; reload page (old localStorage backfill); open an old `/s/` link; download PDF
  and confirm the "Diseño del Techo" page renders the snapshot.
