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
│   ├── actions/
│   │   ├── drive.ts                   # server actions: prepare Drive folders + access token, register/upload signed contract mapping
│   │   └── scan-bill.ts               # server action: Anthropic-powered utility bill OCR
│   └── api/
│       ├── share/route.ts             # GET/POST/PATCH share payload (Upstash)
│       └── docuseal/
│           ├── submission/route.ts    # create / refresh DocuSeal submission
│           └── webhook/route.ts       # form.completed → fetch signed PDF + upload to Drive
├── components/
│   ├── quotation/                     # wizard steps (client, project, technical, advanced, review)
│   ├── virtual/                       # virtual web quotation sections + dialogs
│   │   ├── virtual-quotation.tsx      # orchestrator; recomputes results live via cotizacion()
│   │   ├── executive-summary.tsx
│   │   ├── system-design-section.tsx
│   │   ├── battery-section.tsx
│   │   ├── pricing-table.tsx
│   │   ├── bill-simulation-section.tsx
│   │   ├── financial-section.tsx      # sliders mutate `overrides`; shows financing (deuda) metrics card when enabled
│   │   ├── cost-comparison-section.tsx
│   │   ├── ppa-section.tsx            # PPA "Opción Cero Inversión" — bar chart + per-option cards
│   │   ├── image-gallery-section.tsx  # attached project images grid
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
│   ├── share.ts                       # Upstash share-link helpers (POST + PATCH client)
│   ├── proposal-drive-map.ts          # Upstash mapping: proposalId → Drive upload folder (used by webhook)
│   ├── docuseal.ts                    # DocuSeal API client (submissions, signatures)
│   ├── integrations/drive.ts          # googleapis Drive client (server-side upload helper)
│   ├── defaults.ts                    # initial form/store defaults + deepMerge backfill helper
│   ├── images.ts                      # client-side image compression (resize → JPEG base64)
│   ├── schemas.ts                     # zod schemas for all wizard steps
│   ├── types.ts                       # ClientData, ProjectData, TechnicalData, AdvancedData, CalculationResults, QuotationData, SignatureData, PpaOption, ProposalImage
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

## Savings model (energy offset — CRITICAL, recently fixed)

Annual savings (`ahorro_anual_cop`) and the cash flow are **capped by what the system actually generates** — never by total consumption. The savings loop lives in **two places** that must stay in sync: `src/lib/calculator/index.ts` (the `cashflowFree` loop feeding TIR/VPN/ROI/payback/`ahorro_anual_cop`) and `src/lib/calculator/cashflow.ts` (the detailed year-by-year table).

- **No battery**: month-by-month. If `genMes ≥ consumoMes`, save the full month bill plus surplus sold at `precioExcedentes`; otherwise save only `genMes × costoKwh`.
- **With battery**: a battery shifts daytime surplus to night, so the system self-consumes nearly all it generates — but savings still cannot exceed generation. `autoConsumo = min(generaciónAnual, consumoAnual)`, savings `= autoConsumo × costoKwh + max(0, generación − consumo) × precioExcedentes`.

**Past bug (do not reintroduce)**: the battery branch used to set `ahorroAnualTotal = consumoAnual × costoKwh` and `cobertura = 100%`, assuming a battery covers the whole bill. That produced absurd metrics (e.g. TIR 310%, ROI 19277%, payback 0.3 años) whenever the array only covered part of the load. A battery stores energy, it cannot create it.

## Financing (deuda tradicional — método francés)

`advanced.financiamiento` is `{ habilitado, tasa_interes, plazo_meses, porcentaje_financiado }`.

- **`tasa_interes` is Tasa Efectiva Anual (EA)** — Colombian bank convention, NOT nominal APR. Convert to the monthly rate **geometrically**: `tasaMensual = (1 + EA)^(1/12) − 1` (e.g. 15% EA → 1.1715%/mes). Do **not** divide by 12. Set in `src/lib/calculator/index.ts`.
- Amortization is **método francés** (fixed monthly cuota) via `pmt(tasaMensual, plazoMeses, -montoFinanciado)`.
- `desembolsoInicial = valorProyectoTotal × (1 − porcentaje_financiado)` is the **anticipo** (down payment) and the year-0 equity outlay; IRR/ROI are computed on this levered equity, not the full CAPEX.
- `financial-section.tsx` renders a financing card (gated on `habilitado`) with: % CAPEX financiado, Tasa EA, Tasa mensual equiv., plazo, anticipo (money + %), monto financiado, cuota mensual, total cuotas, total intereses. The form labels the input "Tasa EA — Efectiva Anual".

## PPA — "Opción Cero Inversión"

`advanced.ppa` is `{ habilitada: boolean, opciones: PpaOption[] }` where `PpaOption` is `{ precio_kwh, duracion_anios }`. Multiple options are presented side by side (e.g. 600 COP/kWh for 12 yrs, 550 for 15).

- Not part of the calculator — PPA metrics are derived in the display layer from `costoKwh` (utility tariff) and `results.generacion_anual_kwh`. Per option: `ahorroPorKwh = costoKwh − precio_kwh`, `ahorroAnual = generacion_anual × ahorroPorKwh`, `ahorroTotal = ahorroAnual × duracion_anios`, `pagoMiracAnual = generacion_anual × precio_kwh`, monthly = annual ÷ 12.
- Virtual: `ppa-section.tsx` — bar chart (one gray utility bar + one yellow bar per option, each with a red `-X%` badge) + one detail card per option.
- PDF: page in `proposal-pdf.tsx` — same bar chart (dynamic widths) + a comparison table, one row per option.
- The form (`step-advanced.tsx`) manages the `opciones` array with add/remove rows; minimum one option.

## Image attachments

`advanced.imagenes` is `ProposalImage[]` (`{ id, data, caption }`). `data` is a compressed JPEG base64 data URL stored **inline** in the proposal.

- Compression: `src/lib/images.ts` `compressImage()` resizes to max 1280px and re-encodes JPEG q0.7 (~150-300KB each). `dataUrlByteSize()` estimates payload size.
- Form: "Imágenes del Proyecto" section in `step-advanced.tsx` — multi-file upload, thumbnail grid with caption inputs, soft warning if total > 4MB.
- Virtual: `image-gallery-section.tsx`. PDF: "Imágenes del Proyecto" page(s), 4 per page (2×2), paginated.
- Inline storage means images travel with the proposal everywhere (localStorage, `/s/` share links, PDF). Tradeoff: localStorage ~5MB and Upstash share-size limits cap practical count at ~6-10 photos.

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
- Maps: `getStaticMapUrlForPdf(lat, lon)` returns a Google Static Maps URL
- **Drawing shapes/bars in the PDF**: `@react-pdf` SVG (`<Svg>/<Rect>`) and canvas-PNG-via-`<Image>` both rendered blank/unreliably in this build. The working pattern is native `<View>` rectangles with **a `<Text> </Text>` child inside each** — the text child forces the renderer to commit the layout. The PPA bar chart uses this. The monthly generation chart still uses a canvas PNG (`renderGenerationChart` → `chartImageUrl`) and that one works — but prefer View+Text bars for new shape work.

### Sharing a proposal
- `src/lib/share.ts` writes to Upstash Redis with a short id
- `/api/share` creates the Upstash Redis client lazily inside request handlers; do not instantiate Redis at module scope, or `next build` logs missing-env warnings.
- `fromPayload()` must deep-merge `initialClientData`, `initialProjectData`, `initialTechnicalData`, and `initialAdvancedData` before returning a `QuotationData`, so old public links keep working after schema changes.
- Public route: `src/app/s/[id]/page.tsx`
- `PATCH /api/share` updates `c` (client short-keys) on the stored payload — used by the pre-sign data form so clients can fill missing email/cédula/teléfono from the shared link, and the change persists across reloads.
- E-signature paths: `<CallToAction>` → either `<ESignDialog>` (legacy canvas signature, stored on `proposal.signature`) or `<DocusealSignDialog>` (DocuSeal embed). DocuSeal is the primary flow.

### Pre-sign client data flow
- `<DocusealSignDialog>` checks `hasMissingClientData(client)` (email or nit_cc blank) before creating the DocuSeal submission.
- If missing, it switches to a `stage: 'collect-data'` form (email + cédula + teléfono) inside the same dialog, then calls the optional `onClientUpdate` prop to persist:
  - On shared page (`/s/[id]`): `updateSharedClient(id, patch)` → PATCH `/api/share`.
  - On local page (`/propuestas/[id]/virtual`): `updateProposal(id, { client })` in Zustand.
- Then creates the DocuSeal submission with the merged client data, and switches to `stage: 'embed'`.
- The wizard's `step-client` schema already allows blank email/nit_cc/teléfono — quotes can be created without them.

### Drive sync
- `prepareDriveUpload(clientName, addressLabel)` server action returns `{ uploadFolderId, accessToken, folderLink, projectName }`.
- Proposal PDF is uploaded **direct from browser to googleapis** (bypasses Vercel 4.5 MB limit).
- Drive sync **no longer generates the unsigned contract DOCX** — that file is delivered only via DocuSeal (signed PDF lands in Drive via the webhook).
- After the proposal PDF upload, `registerProposalDriveMapping(proposalId, uploadFolderId, fileBaseName)` writes a record to Upstash so the DocuSeal webhook can find the destination folder later.
- If the proposal is already signed when sync runs (`docuseal.status === 'completed'`), `uploadSignedContractToDrive()` fetches the signed PDF from DocuSeal and uploads it in the same flow.
- Folder structure: `ESTRUCTURA_CARPETAS` in constants.ts. Signed contracts land in `01_Propuesta_y_Contratacion/` as `Contrato_Firmado_<cliente>_<fecha>.pdf`.

### DocuSeal signed-contract webhook
- Endpoint: `POST /api/docuseal/webhook` (configure in DocuSeal dashboard → Settings → Webhooks → event `form.completed`).
- Optional HMAC verification via `DOCUSEAL_WEBHOOK_SECRET` env var — when set, requests without a matching `X-Docuseal-Signature` (hex HMAC-SHA256 of the body) are rejected.
- Flow on `form.completed`: look up `getProposalDriveMapping(external_id)` from Upstash → fetch the signed PDF via `getDocusealSubmission(submission_id).documents[0].url` → `uploadBytesToDriveFolder()` server-side.
- If no mapping exists (signed before Drive sync), the webhook is a no-op; the next Drive sync picks up the signed PDF via the live re-fetch path.
- Owner notifications go via DocuSeal's built-in "notify me on completion" setting — there's no custom email path.

### Static signatures in the contract template
- `public/assets/contrato_plantilla.docx` carries Samuel's representante legal signature as an embedded PNG (added directly in Word, no code path).
- Only the client signs via DocuSeal — Samuel's signature is pre-filled on every contract.
- If you re-version the template, keep the client `{{signature}}` placeholder intact for DocuSeal.

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
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — shared proposals and proposal→Drive mapping
- `ANTHROPIC_API_KEY` — bill scanner
- `DOCUSEAL_API_KEY`, `DOCUSEAL_API_URL` — DocuSeal Cloud
- `DOCUSEAL_WEBHOOK_SECRET` — optional. When set, `/api/docuseal/webhook` validates the `X-Docuseal-Signature` header.

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
11. Contract template was replaced with a generic version based on the Augusto Posada DOCX. It now uses placeholders for client/project/value/date data and includes a DocuSeal signature tag in the client signature line.
12. DocuSeal Cloud integration is implemented and verified with the API key in `.env.local`. Current flow: `/api/docuseal/submission` generates the live contract DOCX from `public/assets/contrato_plantilla.docx`, sends it to DocuSeal, and returns signer metadata; the virtual quotation embeds the DocuSeal signer form and stores `docuseal` state on proposals.
13. Verified locally: `npx tsc --noEmit` passes, `npm run build` passes, and a read-only DocuSeal API call succeeded with the configured key.
14. Drive sync stopped generating the unsigned contract DOCX — only the proposal PDF is uploaded. Removed `generarContratoDocx` call from `drive-sync-button.tsx`.
15. DocuSeal webhook auto-uploads the signed contract to Drive. New files: `src/app/api/docuseal/webhook/route.ts`, `src/lib/proposal-drive-map.ts`. New server actions: `registerProposalDriveMapping`, `uploadSignedContractToDrive`. New exported helper: `uploadBytesToDriveFolder` in `src/lib/integrations/drive.ts`. Optional HMAC validation via `DOCUSEAL_WEBHOOK_SECRET`.
16. Samuel's representante legal signature is now an embedded PNG in `public/assets/contrato_plantilla.docx`. Every generated contract carries his signature; only the client signs via DocuSeal.
17. For notifications, the user prefers DocuSeal's built-in owner notification (Settings → Email & Notifications) over a custom Resend integration — the Resend code was added then removed in the same session.
18. Pre-sign data collection on the shared link: clients filling the proposal via WhatsApp typically have nombre + dirección only. The `<DocusealSignDialog>` now shows a `Confirma tus datos` form (email + cédula required, teléfono optional) before creating the DocuSeal submission whenever those fields are blank. The form persists via `PATCH /api/share` (shared link) or Zustand `updateProposal` (local), and `onClientUpdate` is threaded through `VirtualQuotation → CallToAction → DocusealSignDialog`.
19. Notion CRM integration was already removed in commit `07817cf` (history shows no remaining references in `src/`, `package.json`, or env files).
20. PPA "Opción Cero Inversión" added — `advanced.ppa` with a list of `opciones` ({ precio_kwh, duracion_anios }). Bar chart + per-option cards in the virtual quotation; bar chart + comparison table in the PDF. Started as a single PPA, then generalized to multiple options.
21. PDF shape-rendering: SVG and canvas-PNG approaches both rendered blank in this `@react-pdf` build. Settled on native `<View>` bars with `<Text> </Text>` children. Unused `render-ppa-chart.ts` and the `ppaChartImageUrl` prop were removed.
22. Image attachments added — `advanced.imagenes` (`ProposalImage[]`), compressed inline via `src/lib/images.ts`. Upload UI in `step-advanced.tsx`, gallery in `image-gallery-section.tsx`, paginated image pages in the PDF.
23. Financing metrics card added to `financial-section.tsx` (shown when `financiamiento.habilitado`): % CAPEX financiado, anticipo (money + %), monto financiado, cuota mensual, total cuotas, total intereses, plazo.
24. Financing rate is **Tasa EA** (Colombian convention), converted to monthly geometrically `(1+EA)^(1/12)−1` — was wrongly divided by 12. Verified against Simon's Excel (76.8M @ 15% EA, 60 mo → cuota $1.789.308). Amortization is método francés. Form label changed to "Tasa EA — Efectiva Anual". Card surfaces the equivalent monthly rate.
25. Battery savings bug fixed (see "Savings model"): savings were capped at full consumption when a battery was on, inflating TIR/ROI/payback. Now capped at actual generation in both `index.ts` and `cashflow.ts`. Battery proposals quoted before this fix should be regenerated.
26. React Doctor health pass (`npx react-doctor@latest`): score raised 72 → 91. Key structural changes:
    - **Pages are now server wrappers.** Every `app/**/page.tsx` is a server component that exports `metadata` and renders the moved client component from a sibling `page-client.tsx` (`'use client'`). Dynamic routes pass `params: Promise<{ id: string }>` straight through to the client view. Edit page UI/logic in `page-client.tsx`, not `page.tsx`.
    - **shadcn variant CVAs were split out** of their component files (Fast Refresh / `only-export-components`): `buttonVariants` → `ui/button-variants.ts`, `badgeVariants` → `ui/badge-variants.ts`, `tabsListVariants` → `ui/tabs-variants.ts`, `navigationMenuTriggerStyle` → `ui/navigation-menu-variants.ts`. Import variants from those files.
    - Bill-scanner constants moved out of the `'use server'` file to `src/lib/bill-scanner/constants.ts` (module-scope state in `'use server'` files is an error).
    - Tailwind `w-N h-N` redundant pairs were rewritten to `size-N` across the app.
    - JSX copy: em dashes replaced with `·`/`:`/parentheticals and `...` with `…` (design rules — Spanish copy unchanged in meaning).
    - `share-dialog`/`s/[id]` no longer adjust state in effects (init in handlers / consolidated fetch state); `docuseal-sign-dialog` dropped its prop-sync effects and reads signing-result handlers via a `handlersRef` so the embed effect never tears down the form.
    - `useState`→`useRef` for non-render values (esign canvas `isDrawing`/`hasDrawn`, interactive-map `map`).
    - **Known remaining React Doctor findings (intentional / deferred):** `server-auth-actions` on the 4 server actions (no auth system in this internal tool — a product decision, not a lint fix), plus a few false-positive-ish warnings (`no-tiny-text` on intentional PDF fine print, `prefer-dynamic-import` on `proposal-pdf.tsx` which *is* the `@react-pdf` document, `label-has-associated-control` on the shadcn `Label` primitive, `no-event-handler` on the react-day-picker focus effect). Do not "fix" these by faking auth or degrading the PDF.
