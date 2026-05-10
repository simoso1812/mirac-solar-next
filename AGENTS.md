<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Mirac Solar — Agent Context

Next.js 16 / React 19 rewrite of the original Streamlit Python calculator (Mirac Energy, Colombia). Used to quote residential and commercial solar PV systems and generate client-facing proposals (virtual web view + PDF + Google Drive sync + contract .docx).

Solo dev: Simon (simon@mirac.energy). Market: Colombia. Currency: COP.

## Stack

- Next.js 16.2 (App Router, Turbopack), React 19.2
- TypeScript strict, Tailwind v4, shadcn/ui (Radix + CVA), base-ui/react
- Forms: react-hook-form + zod v4 (`@hookform/resolvers`)
- State: Zustand v5 with `persist` middleware (localStorage)
- PDF: `@react-pdf/renderer` (units in pt — A4 is 595.28 × 841.89pt; helper `mm()` converts mm→pt)
- Charts: Recharts (web), server-rendered PNG for PDF (`src/lib/pdf/render-chart.ts`)
- Maps: `@react-google-maps/api` + Static Maps for PDF
- Storage: Upstash Redis (`@upstash/redis`) for shared/published proposals
- Drive integration: `googleapis` + browser-direct REST upload (bypasses Vercel 4.5 MB body limit)
- Contracts: `docxtemplater` + `pizzip`
- AI: `@anthropic-ai/sdk` for bill scanning
- Deployment: Vercel

## Directory map

```
src/
├── app/
│   ├── page.tsx                       # landing
│   ├── cotizacion/page.tsx            # 5-step wizard host
│   ├── propuestas/
│   │   ├── page.tsx                   # list saved proposals
│   │   ├── [id]/page.tsx              # detail / edit
│   │   ├── [id]/virtual/layout.tsx    # virtual quotation route
│   │   └── shared/page.tsx
│   ├── s/[id]/page.tsx                # public shared proposal (Upstash-backed)
│   ├── clientes/page.tsx
│   ├── cargadores/page.tsx            # EV charger calculator
│   └── actions/
│       ├── drive.ts                   # server action: prepare Drive folders + access token
│       └── scan-bill.ts               # server action: Anthropic-powered utility bill OCR
├── components/
│   ├── quotation/                     # wizard steps (client, project, technical, advanced, review)
│   ├── virtual/                       # virtual web quotation sections + dialogs
│   │   ├── virtual-quotation.tsx      # orchestrator; recomputes results live via cotizacion()
│   │   ├── executive-summary.tsx
│   │   ├── system-design-section.tsx
│   │   ├── battery-section.tsx
│   │   ├── pricing-table.tsx
│   │   ├── bill-simulation-section.tsx
│   │   ├── financial-section.tsx      # sliders mutate `overrides` → live re-cotizacion
│   │   ├── cost-comparison-section.tsx
│   │   ├── project-details-section.tsx
│   │   ├── call-to-action.tsx
│   │   ├── esign-dialog.tsx
│   │   ├── share-dialog.tsx
│   │   └── version-selector.tsx
│   ├── bill-scanner/                  # Anthropic-powered utility bill OCR UI
│   ├── layout/                        # header, sidebar, main shell
│   ├── ui/                            # shadcn primitives
│   ├── interactive-map.tsx
│   ├── price-estimator.tsx
│   ├── pdf-download-button.tsx        # generates client-side PDF via @react-pdf
│   └── drive-sync-button.tsx          # PDF + contract → Drive folder structure
├── lib/
│   ├── calculator/                    # PORT OF Python streamlit calculator
│   │   ├── index.ts                   # cotizacion() entrypoint, buildInputFromStore()
│   │   ├── cost.ts                    # cost coefficients (small <20kW poly, large ≥20kW poly3)
│   │   ├── cashflow.ts                # year-by-year cash flow + NPV/TIR/payback
│   │   ├── financial.ts               # tax benefits (Ley 1715), depreciation, deducción
│   │   ├── inverter.ts                # auto-pick inverter from INVERTER_DATABASE
│   │   ├── performance.ts             # PR adjustments by clima/cubierta
│   │   └── carbon.ts                  # CO2 metrics + equivalents
│   ├── pdf/
│   │   ├── proposal-pdf.tsx           # @react-pdf/renderer document
│   │   ├── get-map-url.ts             # Google Static Maps URL builder
│   │   └── render-chart.ts            # canvas-based chart PNG for PDF
│   ├── contract/generator.ts          # docx contract generation
│   ├── chargers.ts + chargers-pdf.ts  # EV charger calculator
│   ├── share.ts                       # Upstash share-link helpers
│   ├── defaults.ts                    # initial form/store defaults + deepMerge backfill helper
│   ├── schemas.ts                     # zod schemas for all wizard steps
│   ├── types.ts                       # ClientData, ProjectData, TechnicalData, AdvancedData, CalculationResults, QuotationData, SignatureData
│   ├── constants.ts                   # HSP, PROMEDIOS_COSTO (iva 7%), inverter DB, defaults
│   ├── formatting.ts                  # formatCOP, number helpers
│   └── utils.ts                       # cn() (clsx + tw-merge)
├── stores/
│   ├── quotation-store.ts             # wizard state (persisted) + loadProposal()
│   └── proposals-store.ts             # list of saved proposals (persisted)
└── hooks/
    ├── use-hydration.ts
    ├── use-media-query.ts
    └── use-bill-scanner.ts
```

## Domain rules (Colombia-specific — do NOT change without checking with Simon)

- **IVA**: 7% (changed from 5%). Source: `PROMEDIOS_COSTO.iva_rate = 0.07` in `src/lib/constants.ts`. Solar PV under Ley 1715 has a reduced rate.
- **Tax benefits** (Ley 1715): two independent toggles
  - Store fields: `incluir_deduccion_renta` and `incluir_depreciacion_acelerada`
  - Calculator input fields: `incluirDeduccionRenta` and `incluirDepreciacionAcelerada`
  - Both are gated by master `beneficios_tributarios` / `incluirBeneficiosTributarios`
  - The advanced form must set `beneficios_tributarios` true when either child toggle is on, and false when both are off.
- **Connection modes**:
  - `net_metering` — 1:1 valuation of surplus energy
  - `net_billing` — surplus at reduced `precio_excedentes` (default 300 COP/kWh)
  - `autoconsumo` — no surplus credit
- **Cost curves** (empirical, per-kWp gets cheaper with size):
  - <20 kW: `cost = 11917544 × kWp^(-0.484721)`
  - ≥20 kW: polynomial in kWp (see `DEFAULT_PARAMS.costo_grande_coef_*`)
- **Inverter selection**: auto-pick from `INVERTER_DATABASE` unless `override_inversores` is set; sizing uses `factor_seguridad`.

## Calculator pattern (CRITICAL)

The Python calculator was ported to `src/lib/calculator/`. Single entrypoint: `cotizacion(input: CotizacionInput): CalculationResults`. Build inputs from store with `buildInputFromStore(technical, project, advanced)`.

**Key idiom — live recomputation**: do NOT trust `proposal.results` blindly. The virtual quotation, PDF download, and Drive sync all re-run `cotizacion(buildInputFromStore(...))` against the current `advanced/technical/project` data. This is how we handle schema migrations without re-saving stored proposals.

```ts
const liveResults = cotizacion(
  buildInputFromStore(proposal.technical, proposal.project, proposal.advanced)
)
```

Always do this before passing results to `<ProposalPdf>`, the contract generator, or sharing.

## Battery sizing (recent area of change)

User-entered `bateria.capacidad_kwh` is **authoritative** when > 0:
- Nominal = entered value, útil = nominal × DoD, autonomy derived from útil ÷ consumo_horario.
- When 0, falls back to auto-sizing from `consumo_mensual_kwh × horas_autonomia ÷ DoD`.

Autonomy is in **hours** (was days — migrated). Schema: `horas_autonomia: z.number().min(1).max(168)`.

All battery display sites have defensive guards (`typeof horas === 'number'`) so old proposals saved before the rename don't crash.

## Zustand persist gotcha (already fixed — keep in mind for future schema additions)

When you add new fields to `AdvancedData` (or other persisted shapes):

1. Users with old `localStorage` state miss the new fields → `z.number()` rejects undefined → `handleSubmit` silently fails (button does nothing).
2. Defaults and `deepMerge` live in `src/lib/defaults.ts`; the quotation store imports them for persist `merge`.
3. `loadProposal` also deep-merges with initial defaults (so editing an old proposal works).
4. `step-advanced.tsx` form defaults are also deep-merged with `initialAdvancedData` as a third layer of defense.
5. Shared Redis payloads are also backfilled in `src/lib/share.ts` via `fromPayload()` before live recomputation.
6. The advanced form **surfaces** `formState.errors` so future Zod failures are visible instead of silent.

**Rule**: when adding a new required field to a persisted shape, verify the deep-merge covers it (especially nested objects like `bateria.*` and `financiamiento.*`).

## Common workflows

### Adding a new field to the quote
1. Add to `src/lib/types.ts` (AdvancedData or TechnicalData)
2. Add to zod schema in `src/lib/schemas.ts`
3. Add default value to `initialAdvancedData` / `initialTechnicalData` in `src/lib/defaults.ts`
4. Add form input in the relevant `src/components/quotation/step-*.tsx`
5. Read it in `buildInputFromStore` (`src/lib/calculator/index.ts`)
6. Use it in `cotizacion` math
7. Display in `src/components/virtual/*` and `src/lib/pdf/proposal-pdf.tsx`
8. **Verify deep-merge handles old persisted and shared state** (refresh page; submit "Revisar y Generar"; load `/s/[id]` shares)

### Modifying the PDF
- Single source: `src/lib/pdf/proposal-pdf.tsx`
- Uses `mm()` helper to keep coordinates matching the original FPDF Python layout
- BRAND_RED + brand styles defined inline
- Always wrap optional pages with defensive guards (e.g., `r.bateria?.habilitada && (() => { ... })()`)
- Charts: pre-render PNG via `renderGenerationChart` and pass as `chartImageUrl`
- Maps: `getStaticMapUrlForPdf(lat, lon)` returns a Google Static Maps URL

### Sharing a proposal
- `src/lib/share.ts` writes to Upstash Redis with a short id
- `/api/share` creates the Upstash Redis client lazily inside request handlers; do not instantiate Redis at module scope, or `next build` logs missing-env warnings.
- `fromPayload()` must deep-merge `initialClientData`, `initialProjectData`, `initialTechnicalData`, and `initialAdvancedData` before returning a `QuotationData`, so old public links keep working after schema changes.
- Public route: `src/app/s/[id]/page.tsx`
- E-signature path: `<CallToAction>` → `<ESignDialog>` → `signature` saved to proposal

### Drive sync
- `prepareDriveUpload(clientName, addressLabel)` server action returns `{ uploadFolderId, accessToken, folderLink, projectName }`
- PDF and contract `.docx` are uploaded **direct from browser to googleapis** (bypasses Vercel 4.5 MB limit)
- Folder structure: `ESTRUCTURA_CARPETAS` in constants.ts

## Constraints / preferences

- **No emojis** in source files or commit messages (unless explicitly asked).
- **Spanish** in all user-facing copy (UI labels, PDF, error messages). Code stays English.
- **No backwards-compat shims** — when renaming, change everything in one pass and rely on the live-recompute pattern.
- **Avoid premature abstraction** — three similar React sections beats a generic over-parameterized one.
- **`npx tsc --noEmit`** must be clean before considering a change done.
- **`npm run lint`** must have zero errors before considering a change done. Current known warnings: React Hook Form `watch()` can trigger a React Compiler compatibility warning, and `@react-pdf/renderer` `<Image>` may trigger web alt-text warnings.

## Next 16 / React 19 gotchas

- `next.config.ts` sets `turbopack.root` to this app directory. Keep it, because a parent `/Users/simonosorio/package-lock.json` caused Next to infer the wrong workspace root.
- Do not call `setState` synchronously inside `useEffect` only to mark hydration. Use `useHydrated()` (`useSyncExternalStore`) instead.
- Do not initialize media-query state with effect-time `setState`; use `useMediaQuery()` (`useSyncExternalStore`).
- Do not read `ref.current` during render. Callback refs should be stable functions (for example `useCallback`) passed directly to `ref`.
- For App Router dynamic params in client pages, this codebase currently unwraps `params: Promise<{ id: string }>` with React `use(params)`.

## Commands

```bash
npm run dev      # next dev (Turbopack)
npm run build    # next build
npm run start    # next start
npm run lint     # eslint
npx tsc --noEmit # typecheck (always run before declaring done)
```

## Env vars (`.env.local`)

- `GOOGLE_*` — service account / OAuth for Drive + Static Maps
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — shared proposals
- `ANTHROPIC_API_KEY` — bill scanner

## Recent context (chronological)

1. IVA changed 5% → 7%.
2. Battery information added to dashboard (`virtual/battery-section.tsx`) and PDF (dedicated battery page).
3. Hardcoded battery sizing constants (`diasAutonomia`, `costoKwhBateria`) exposed as user fields.
4. User-entered `capacidad_kwh` made authoritative when > 0.
5. Autonomy migrated from days → hours throughout (schema, types, store, form, math, displays, PDF).
6. PDF download + Drive sync now re-run `cotizacion(buildInputFromStore(...))` so PDFs reflect live calculator changes without re-saving proposals.
7. Bug: "Revisar y generar" was silently failing on accounts with stale localStorage. Fixed by (a) `deepMerge` in Zustand persist `merge`, (b) `loadProposal` deep-merges defaults, (c) form `defaultValues` deep-merges initialAdvancedData, (d) form now surfaces `formState.errors` so silent failures stop happening.
8. React 19 lint errors fixed: hydration guards now use `useHydrated()`, media queries use `useSyncExternalStore`, e-sign canvas no longer reads refs during render, and stale `proposal.results!` usage was removed from the virtual quotation financial path.
9. Next 16 build warnings fixed: `turbopack.root` pins the project root and `/api/share` lazy-loads Upstash Redis so missing env vars are not logged during static build.
10. Tax benefits are now truly independent persisted fields (`incluir_deduccion_renta`, `incluir_depreciacion_acelerada`) under master `beneficios_tributarios`; `buildInputFromStore()` maps them to calculator booleans and old saved/shared proposals are backfilled from `src/lib/defaults.ts`.
