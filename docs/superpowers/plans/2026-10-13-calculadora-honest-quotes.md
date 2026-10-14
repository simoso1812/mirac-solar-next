# Calculadora — honest quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a new solar quote say which connection mode, which payback, and which tax shield the client is looking at, without moving the price curve or any link already sent.

**Architecture:** Display copy and the simple-payback ratio live in one pure module, `src/lib/proposal-disclosure.ts`. The engine (`cotizacion`, `estimatePrice`, Ley 1715 cash, `INDICE_MIRAC`) stays the source of TIR, VPN, and engine payback. Radiation for a *new* coordinate fetch moves to plane-of-array PVGIS in `src/lib/pvgis.ts`; a stored 12-month vector is never rewritten. Internal COGS stays on the wizard and is stripped in `toPayload` so `/s/<id>` cannot carry it.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Zustand persist + `deepMerge` in `src/lib/defaults.ts`.

**Repo:** `/Users/simonosorio/Desktop/mirac-solar-next`. Work on a branch, not `main`, unless the human says otherwise.

**Status (2026-10-14):** Tasks 1–4 are done and on `main` (commit `df6e95d`). Tasks 5–7 are authorized. Start at Task 5.

## Global Constraints

- Spanish in every user-facing string. No emojis in source or commit messages.
- Do not edit `estimatePrice` / `priceSmall` / `priceMedium` / `priceLarge` in `src/lib/calculator/cost.ts`.
- Do not edit the Ley 1715 cash formulas in `src/lib/calculator/engine.ts`.
- Do not change `INDICE_MIRAC` (`0.0425`) or `PROMEDIOS_COSTO.iva_rate` (`0.07`) in `src/lib/constants.ts`.
- Do not apply battery `eficiencia` inside the savings loop.
- Do not rewrite `project.hsp_mensual_pvgis` on proposals or share payloads that already have 12 finite numbers.
- Do not add absolute `Pos` coordinates on `info_financiera.jpg` in `src/lib/pdf/proposal-pdf.tsx`. That page is a designed background.
- Tax toggles stay default-on (`beneficios_tributarios`, `incluir_deduccion_renta`, `incluir_depreciacion_acelerada` remain `true` in `initialAdvancedData`).
- New radiation uses tilt `10` degrees and aspect `0` (south). Do not call the live PVGIS API from tests.
- Module and inverter COP prices come only from the live equipment sheet (Task 7 Step 1), never from memory, the Obsidian vault, or an old quote. Panels and inverters carry no IVA: the sheet price is final, never add 19%. BOS and installation COGS start as `null` and the user types them.
- `npm test` snapshot updates are forbidden. Do not pass `-u` to Vitest.
- Commit a task only when the human has asked for commits in that session. Never push.
- **Execution scope:** Tasks 1–4 are done. Tasks 5, 6, 7 are authorized (human, 2026-10-14), in that order. Task 5 changes kWh on new coordinate quotes; that is expected. Stop inside Task 7 only if the equipment sheet cannot be read (Task 7 Step 1).

---

### Task 1: Disclosure helpers

**Status: done (`df6e95d`).**

**Files:**
- Create: `src/lib/proposal-disclosure.ts`
- Test: `src/lib/__tests__/proposal-disclosure.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `paybackSimpleAnios(inversionCop: number, ahorroAnualCop: number): number | null`
  - `textoModoConexion(modo: 'net_metering' | 'net_billing' | 'autoconsumo', precioExcedentes: number): string`
  - `textoBeneficios(incluirDeduccionRenta: boolean, incluirDepreciacionAcelerada: boolean): string | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  paybackSimpleAnios,
  textoBeneficios,
  textoModoConexion,
} from '@/lib/proposal-disclosure'

describe('paybackSimpleAnios', () => {
  it('divides investment by year-1 savings', () => {
    expect(paybackSimpleAnios(37_000_000, 8_621_383)).toBeCloseTo(4.29, 2)
  })

  it('returns null when savings are not positive', () => {
    expect(paybackSimpleAnios(10_000_000, 0)).toBeNull()
    expect(paybackSimpleAnios(10_000_000, -1)).toBeNull()
  })
})

describe('textoModoConexion', () => {
  it('names net billing and the surplus price', () => {
    expect(textoModoConexion('net_billing', 300)).toBe(
      'Excedentes a 300 COP/kWh (net billing).',
    )
  })

  it('names 1:1 net metering', () => {
    expect(textoModoConexion('net_metering', 300)).toBe(
      'Excedentes al mismo precio de la tarifa (net metering 1:1).',
    )
  })

  it('names self-consumption', () => {
    expect(textoModoConexion('autoconsumo', 300)).toBe(
      'Sin crédito por excedentes (autoconsumo).',
    )
  })
})

describe('textoBeneficios', () => {
  it('returns null when both shields are off', () => {
    expect(textoBeneficios(false, false)).toBeNull()
  })

  it('explains the engine payback when either shield is on', () => {
    const text = textoBeneficios(true, false)
    expect(text).toContain('Ley 1715')
    expect(text).toContain('payback simple')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/proposal-disclosure.test.ts`

Expected: FAIL, cannot find module `@/lib/proposal-disclosure`.

- [ ] **Step 3: Write the module**

```ts
export type ModoConexion = 'net_metering' | 'net_billing' | 'autoconsumo'

export function paybackSimpleAnios(inversionCop: number, ahorroAnualCop: number): number | null {
  if (!Number.isFinite(inversionCop) || inversionCop <= 0) return null
  if (!Number.isFinite(ahorroAnualCop) || ahorroAnualCop <= 0) return null
  return inversionCop / ahorroAnualCop
}

export function textoModoConexion(modo: ModoConexion, precioExcedentes: number): string {
  if (modo === 'net_billing') {
    const precio = Math.round(precioExcedentes).toLocaleString('es-CO')
    return `Excedentes a ${precio} COP/kWh (net billing).`
  }
  if (modo === 'autoconsumo') return 'Sin crédito por excedentes (autoconsumo).'
  return 'Excedentes al mismo precio de la tarifa (net metering 1:1).'
}

export function textoBeneficios(
  incluirDeduccionRenta: boolean,
  incluirDepreciacionAcelerada: boolean,
): string | null {
  if (!incluirDeduccionRenta && !incluirDepreciacionAcelerada) return null
  return 'La TIR y el payback del motor incluyen deducción de renta y/o depreciación acelerada (Ley 1715). El payback simple es inversión ÷ ahorro del año 1, sin ese escudo.'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/proposal-disclosure.test.ts`

Expected: PASS.

---

### Task 2: Show the two paybacks and the connection mode

**Status: done (`df6e95d`).**

**Files:**
- Modify: `src/components/virtual/executive-summary.tsx`
- Modify: `src/components/virtual/virtual-quotation.tsx` (the `<ExecutiveSummary` call near line 119)
- Modify: `src/components/virtual/financial-section.tsx` (the `financialMetrics` array near line 119)
- Modify: `src/lib/mcp/quote.ts` (`summarize`, the payback markdown line near line 473)
- Test: `src/lib/mcp/__tests__/disclosure-summary.test.ts`

**Interfaces:**
- Consumes: `paybackSimpleAnios`, `textoModoConexion`, `textoBeneficios` from Task 1
- Produces: the same strings on the virtual proposal and in the MCP markdown. Engine fields `r.payback_anios` and `r.tir` are still rendered unchanged.

- [ ] **Step 1: Write the failing MCP test**

`summarize` is exported from `src/lib/mcp/quote.ts`. Build stores with `deepMerge(initialAdvancedData, { modo_conexion: 'net_billing', precio_excedentes: 300, incluir_deduccion_renta: true, incluir_depreciacion_acelerada: true })`, `deepMerge(initialTechnicalData, { consumo_mensual_kwh: 500 })`, and `initialProjectData`. Call `summarize({ client: initialClientData, project, technical, advanced })`.

```ts
import { describe, expect, it } from 'vitest'
import { summarize } from '@/lib/mcp/quote'
import { deepMerge, initialAdvancedData, initialClientData, initialProjectData, initialTechnicalData } from '@/lib/defaults'

describe('summarize disclosure', () => {
  it('prints simple payback, net billing, and the Ley 1715 line', () => {
    const { summary } = summarize({
      client: initialClientData,
      project: initialProjectData,
      technical: deepMerge(initialTechnicalData, { consumo_mensual_kwh: 500 }),
      advanced: deepMerge(initialAdvancedData, {
        modo_conexion: 'net_billing',
        precio_excedentes: 300,
        incluir_deduccion_renta: true,
        incluir_depreciacion_acelerada: true,
      }),
    })
    expect(summary).toContain('Payback simple:')
    expect(summary).toContain('Excedentes a 300 COP/kWh (net billing).')
    expect(summary).toContain('Ley 1715')
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/mcp/__tests__/disclosure-summary.test.ts`

Expected: FAIL because those sentences are absent.

- [ ] **Step 3: Extend the MCP summary**

Inside `summarize`, after the existing payback/TIR line, push:

```ts
const simple = paybackSimpleAnios(r.costo_total_cop, r.ahorro_anual_cop)
const beneficio = textoBeneficios(
  stores.advanced.incluir_deduccion_renta && stores.advanced.beneficios_tributarios,
  stores.advanced.incluir_depreciacion_acelerada && stores.advanced.beneficios_tributarios,
)
```

Add these markdown lines immediately after the existing `**Payback:**` line:

```ts
`**Payback simple:** ${simple === null ? 'n/d' : `${simple.toFixed(1)} años`} (inversión ÷ ahorro del año 1)`,
textoModoConexion(stores.advanced.modo_conexion, stores.advanced.precio_excedentes),
beneficio,
```

Leave `**Payback:** ${yrs(r.payback_anios)}` in place. That number is the engine payback.

In the PPA intro string in the same function, append this sentence to the parenthetical, without changing any `ppaMetrics` math:

` Ilustración comercial: la tarifa evitada crece al 4,25% (Índice Mirac) y el precio PPA queda fijo. No incluye ICA, Ley 1715 ni deuda, y no es el modelo ACP.`

- [ ] **Step 4: Pass disclosure props into the executive summary**

`ExecutiveSummary` gains:

```ts
modoConexion: 'net_metering' | 'net_billing' | 'autoconsumo'
precioExcedentes: number
incluirDeduccionRenta: boolean
incluirDepreciacionAcelerada: boolean
```

`VirtualQuotation` passes `proposal.advanced.modo_conexion`, `proposal.advanced.precio_excedentes`, and the what-if flags `overrides.incluirDeduccionRenta` and `overrides.incluirDepreciacionAcelerada` (not the stored flags). Numbers still come from `whatIfResults`.

Under the six-card grid, render:

```tsx
<p className="mt-4 text-xs text-[#9CA3AF]">
  {textoModoConexion(modoConexion, precioExcedentes)}
  {' '}
  Payback simple: {simple === null ? 'n/d' : `${simple.toFixed(1)} años`}.
</p>
{nota && <p className="mt-1 text-xs text-[#9CA3AF]">{nota}</p>}
```

where `simple = paybackSimpleAnios(r.costo_total_cop, r.ahorro_anual_cop)` and `nota = textoBeneficios(...)`. Keep the card that prints `r.payback_anios` and `r.tir`.

- [ ] **Step 5: Add the simple-payback row in the financial section**

`FinancialSection` already has `overrides.incluirDeduccionRenta` and `overrides.incluirDepreciacionAcelerada`, and `r`. Insert this object into `financialMetrics` immediately after the existing Payback row:

```ts
{
  label: 'Payback simple',
  value: (() => {
    const simple = paybackSimpleAnios(r.costo_total_cop, r.ahorro_anual_cop)
    return simple === null ? 'n/d' : `${simple.toFixed(1)} años`
  })(),
},
```

Under the metric grid, if `textoBeneficios(overrides.incluirDeduccionRenta, overrides.incluirDepreciacionAcelerada)` is non-null, render that string as `text-xs text-[#9CA3AF]`.

- [ ] **Step 6: Run the new test and typecheck**

Run: `npx vitest run src/lib/mcp/__tests__/disclosure-summary.test.ts && npx tsc --noEmit`

Expected: PASS and a clean typecheck.

---

### Task 3: Default new quotes to net billing

**Status: done (`df6e95d`).**

**Files:**
- Modify: `src/lib/defaults.ts` (`modo_conexion`)
- Modify: `src/lib/calculator/__tests__/golden.test.ts` (the assertion at the `maps defaults without surprises` test, currently `expect(input.modoConexion).toBe('net_metering')`)

**Interfaces:**
- Consumes: `initialAdvancedData.modo_conexion`
- Produces: new empty quotes and MCP quotes that omit `modo_conexion` resolve to `net_billing`. A stored `modo_conexion: 'net_metering'` on an old proposal or share payload stays, because `deepMerge` keeps the stored value.

- [ ] **Step 1: Change the assertion first**

In `maps defaults without surprises`, replace the expected mode:

```ts
expect(input.modoConexion).toBe('net_billing')
```

- [ ] **Step 2: Run that test to verify it fails**

Run: `npx vitest run src/lib/calculator/__tests__/golden.test.ts -t "maps defaults without surprises"`

Expected: FAIL, received `net_metering`.

- [ ] **Step 3: Change the default**

In `initialAdvancedData`, set `modo_conexion: 'net_billing'`. Do not change `precio_excedentes` (it is already `300`).

- [ ] **Step 4: Run the full suite**

Run: `npm test`

Expected: PASS.

If any other test fails only because `deepMerge(initialAdvancedData, ...)` now inherits `net_billing`, add `modo_conexion: 'net_metering'` to that test's `deepMerge` so the test still measures what it was written to measure. Do not update snapshots. `baseInput()` in `golden.test.ts` already hardcodes `modoConexion: 'net_metering'` and must stay that way.

---

### Task 4: Docs and the PPA footnote

**Status: done (`df6e95d`).**

**Files:**
- Modify: `AGENTS.md` (the Cost model bullets under Domain rules)
- Modify: `src/components/virtual/ppa-section.tsx` (after the intro paragraph that starts `Con nuestro PPA Cero Inversión`)
- Modify: `src/lib/pdf/proposal-pdf.tsx` (the footer `Pos` whose text starts `Con el modelo PPA`, near line 694)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: one cost paragraph that matches `src/lib/calculator/cost.ts`, and one PPA footnote. No numeric change.

- [ ] **Step 1: Replace the cost section in AGENTS.md**

Delete every cost-model bullet and paragraph from `**Cost model** (empirical...` through the paragraph that begins `**Cost model (Simon 2026-10-08`. Leave the Índice Mirac bullet that follows. Replace the deleted block with:

```md
- **Cost model** — `estimatePrice()` in `src/lib/calculator/cost.ts` is the only curve. As of 2026-10-08: `<= 20 kWp` on-grid is `11_407_797 + 2_827_267 × kWp`; above that, the previous 10–50 and `> 50` linear segments remain, with blend bands 18–22 and 45–55. A battery adds `3_000_000 + kWh × costo/kWh` (default 800_000). Do not quote the retired power-law or the `× 1.05` formula. A teja roof still multiplies by `ajuste_cubierta_teja` inside `cotizacion`, not inside `estimatePrice`.
```

- [ ] **Step 2: Add the web footnote**

In `PpaSection`, immediately after the intro `<p>` (the one that starts `Con nuestro PPA Cero Inversión`), add:

```tsx
<p className="mb-8 max-w-3xl text-xs leading-relaxed text-[#9CA3AF]">
  Ilustración comercial. La tarifa evitada de esta tarjeta crece al 4,25% anual (Índice Mirac) y el precio del PPA queda fijo. No incluye ICA, beneficios de la Ley 1715 ni servicio de deuda, y no es el modelo de evaluación de ACP.
</p>
```

Do not change `ppaMetrics` or `INDICE_MIRAC`.

- [ ] **Step 3: Append the same fact to the internal PDF prose**

In the PPA footer string that already ends with `permanece fijo durante todo el contrato.`, append a space and:

`Esta proyección no es el modelo ACP: no incluye ICA, Ley 1715 ni deuda.`

Do not move the `Pos` `x` or `y`.

- [ ] **Step 4: Verify slice A**

Run: `npm test && npx tsc --noEmit`

Expected: PASS, clean typecheck.

Done in `df6e95d`. Continue with Task 5.

---

### Task 5: Plane-of-array PVGIS for new fetches

**Files:**
- Modify: `src/lib/pvgis.ts`
- Modify: `src/app/api/pvgis/route.ts`
- Modify: `src/lib/mcp/quote.ts` (`HspFuente`, `resolveHsp`)
- Test: `src/lib/__tests__/pvgis.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–4
- Produces:
  - `export const PVGIS_TILT_DEG = 10`
  - `export const PVGIS_ASPECT_DEG = 0`
  - `export function pvgisUrl(lat: number, lon: number): string`
  - `export interface RadiationFetch { hsp: number[]; source: 'pvgis_poa' | 'estimada' }`
  - `export function processPVGISData(data: Record<string, unknown>, lat: number, lon: number): RadiationFetch | null`
  - `export async function fetchPVGIS(lat: number, lon: number): Promise<RadiationFetch | null>`
  - `HspFuente = 'ciudad' | 'pvgis_poa' | 'estimada' | 'personalizada'`

A stored `hsp_mensual_pvgis` of length 12 is still preferred by `cotizacion` and is not refetched.

- [ ] **Step 1: Write the failing parser tests**

Use the same month lengths the file already uses: `[31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]`.

```ts
import { describe, expect, it } from 'vitest'
import { processPVGISData, pvgisUrl } from '@/lib/pvgis'

const DIAS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function poaPayload(daily: number[]): Record<string, unknown> {
  return {
    outputs: {
      monthly: daily.map((hsp, i) => ({ month: i + 1, 'H(i)_m': hsp * DIAS[i] })),
    },
  }
}

describe('pvgisUrl', () => {
  it('asks for a 10 degree plane and does not request horizontal irradiance', () => {
    const url = pvgisUrl(6.252, -75.014)
    expect(url).toContain('angle=10')
    expect(url).toContain('aspect=0')
    expect(url).not.toContain('horirrad')
  })
})

describe('processPVGISData', () => {
  it('reads inclined-plane H(i)_m and labels a complete year pvgis_poa', () => {
    const parsed = processPVGISData(poaPayload(Array(12).fill(5.38)), 6.252, -75.014)
    expect(parsed?.source).toBe('pvgis_poa')
    expect(parsed!.hsp.every((v) => Math.abs(v - 5.38) < 0.02)).toBe(true)
  })

  it('does not call horizontal H(h)_m a POA result', () => {
    const data = {
      outputs: {
        monthly: DIAS.map((d, i) => ({ month: i + 1, 'H(h)_m': 4.38 * d })),
      },
    }
    const parsed = processPVGISData(data, 6.252, -75.014)
    expect(parsed?.source).toBe('estimada')
  })

  it('labels a year with a missing month as estimada', () => {
    const daily = Array(12).fill(5.38)
    const payload = poaPayload(daily)
    const monthly = (payload.outputs as { monthly: Record<string, unknown>[] }).monthly
    delete monthly[3]['H(i)_m']
    const parsed = processPVGISData(payload, 6.252, -75.014)
    expect(parsed?.source).toBe('estimada')
    expect(parsed?.hsp).toHaveLength(12)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/pvgis.test.ts`

Expected: FAIL, `pvgisUrl` / `processPVGISData` are not exported.

- [ ] **Step 3: Implement the URL and the parser**

`pvgisUrl` builds `https://re.jrc.ec.europa.eu/api/v5_3/MRcalc` with `lat`, `lon`, `angle=10`, `aspect=0`, `outputformat=json`, `browser=0`. It does not set `horirrad`.

`processPVGISData` walks `outputs.monthly`. For each month index 0–11:

- If `H(i)_m` is a finite number greater than 0, daily HSP is `H(i)_m / DIAS_POR_MES[monthIndex]`, and that month is POA.
- Otherwise the month is not POA. Fill it with the existing climate estimate (`getClimateData` / `getSeasonalFactor` / `getAltitudeFactor`) so the array still has length 12.

If there is no monthly array, return `null`. If all 12 months were POA and each daily value is `> 0` and `<= 8`, return `{ hsp, source: 'pvgis_poa' }`. Otherwise return `{ hsp, source: 'estimada' }`. Round each value with `Math.round(v * 100) / 100`.

`fetchPVGIS` calls `pvgisUrl`, keeps the existing two-attempt timeout behavior, and returns the `RadiationFetch` from `processPVGISData`. On total failure it returns `null`.

- [ ] **Step 4: Thread the source through the API and MCP**

`GET /api/pvgis` returns `{ hsp, source: 'pvgis_poa' }` or `{ hsp, source: 'estimada' }`. Delete the old `source: 'pvgis'` and `source: 'estimated'` strings.

`HspFuente` replaces `'pvgis'` with `'pvgis_poa'`. `resolveHsp`, when `fetchPVGIS` returns a result, sets `fuente` to that result's `source` and `fallbackRadiacion` to `source !== 'pvgis_poa'`. When `fetchPVGIS` returns `null`, keep today's climate fallback and `fuente: 'estimada'`.

Search the repo for the string `'pvgis'` and update every source comparison. Do not change the engine branch that uses a stored 12-vector.

In `src/components/quotation/step-project.tsx`, map the API `source` before displaying it:

- `pvgis_poa` → `PVGIS, plano del arreglo, inclinación 10°.`
- `estimada` → `Estimación climática (PVGIS incompleto o no disponible).`

A failed `fetch` still leaves the city table in place. Set the visible source to the estimación sentence instead of leaving it blank.

- [ ] **Step 5: Document the fetch**

In `AGENTS.md`, under the calculator pattern, add:

```md
- **Radiation:** a new lat/lon fetch uses PVGIS `MRcalc` v5_3 on the inclined plane (`angle=10`, `aspect=0`) and may be labeled `pvgis_poa` only when all 12 months came from `H(i)_m`. Horizontal `H(h)_m`, a missing month, or a failed request is `estimada`. A proposal that already has 12 stored HSP values keeps those values.
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/__tests__/pvgis.test.ts && npm test && npx tsc --noEmit`

Expected: PASS. No snapshot diffs.

Continue with Task 6, then Task 7.

---

### Task 6: Wizard source label uses the new union

This task is the UI half of Task 5 if Step 4 above was split across a review. If Task 5 Step 4 already updated `step-project.tsx` and `HspFuente`, mark this task done and do not duplicate it.

**Files:**
- Modify: `src/components/quotation/step-project.tsx`

**Interfaces:**
- Consumes: `RadiationFetch['source']` from Task 5
- Produces: the two Spanish sentences in Task 5 Step 4

- [ ] **Step 1: Confirm the wizard never displays the raw token `pvgis`**

Search `step-project.tsx` for `pvgis`. The only user-visible radiation strings are the two sentences in Task 5 Step 4.

---

### Task 7: Internal COGS margin, stripped from the public link

**Files:**
- Modify: `src/lib/types.ts` (`AdvancedData`)
- Modify: `src/lib/defaults.ts` (`initialAdvancedData`)
- Modify: `src/lib/schemas.ts` (`advancedSchema`)
- Modify: `src/lib/share.ts` (`toPayload`, `fromPayload`)
- Modify: `src/components/quotation/step-advanced.tsx`
- Modify: `src/lib/proposal-disclosure.ts`
- Create: `src/lib/equipment-prices.ts` (dated snapshot of the live equipment sheet + `cogsSugerido`)
- Test: `src/lib/__tests__/equipment-prices.test.ts`
- Test: `src/lib/__tests__/proposal-disclosure.test.ts`
- Test: `src/lib/__tests__/share.test.ts` or `src/lib/__tests__/share-sanitize.test.ts` (whichever already imports `toPayload`)

**Interfaces:**
- Consumes: `AdvancedData`, `toPayload`, `calcResults.kwp` and `calcResults.costo_total_cop` inside `step-advanced.tsx`, `advanced.bateria.habilitada`, `PROMEDIOS_COSTO.iva_rate`
- Produces:
  - `AdvancedData` fields `cogs_modulos_cop`, `cogs_inversor_cop`, `cogs_bos_cop`, `cogs_instalacion_cop`, each `number | null`
  - `export const MARGEN_MINIMO = 0.5`
  - `export function margenBruto(precioCop: number, partes: Array<number | null>): { costo: number; margen: number } | null`
  - In `src/lib/equipment-prices.ts`:
    - `export interface PrecioModulo { producto: string; wp: number; proveedor: string; precioCop: number; cotizado: string }` (`cotizado` is `YYYY-MM-DD`)
    - `export interface PrecioInversor { producto: string; kw: number; tipo: 'on_grid' | 'hibrido'; proveedor: string; precioCop: number; cotizado: string }`
    - `export const PRECIOS_EQUIPOS_LEIDO: string` (date the sheet was read, `YYYY-MM-DD`)
    - `export const MODULOS: PrecioModulo[]`, `export const INVERSORES: PrecioInversor[]`
    - `export const DIAS_PRECIO_VIGENTE = 60`
    - `export interface CogsSugerido { modulosCop: number; inversorCop: number; modulo: PrecioModulo; inversor: PrecioInversor; cantidadInversores: number; referenciaVieja: boolean }`
    - `export function cogsSugerido(kwp: number, conBateria: boolean, hoy: Date, modulos?: PrecioModulo[], inversores?: PrecioInversor[]): CogsSugerido | null`

The selling price for margin is the price **before IVA**: `calcResults.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)`. `costo_total_cop` already includes the 7% IVA (`src/lib/calculator/index.ts`), so using it directly would overstate margin.

- [ ] **Step 1: Build the snapshot from the live sheet**

Read the Google Sheet `1f855ajzAGKBHHb_jGmyYN-8K1D2LeWuZGESOpiZyInU` with the Google Drive connector (`read_file_content` with that fileId). If the connector is not available or not signed in, ask the human for a CSV export of the sheet (File → Download → CSV). If neither is possible, stop and say so. Do not fill the snapshot from the Obsidian vault mirror, from an earlier quote, or from memory.

The sheet has three blocks (hybrid/SPE inverters, Huawei, modules) with columns `Producto | Voltaje | Proveedor | Precio Unitario | Fecha de Cotización | Notas`. Build `src/lib/equipment-prices.ts`:

- One entry per product + supplier, using the row with the most recent `Fecha de Cotización`. Skip rows with no price.
- Modules: `wp` from the product name or notes. Inverters: `kw` from the product name or notes.
- `tipo`: rows in the hybrid block are `'hibrido'`; Huawei string inverters are `'on_grid'`. If a row's type is not clear from its block and name, ask the human. Do not guess.
- `precioCop` is the sheet number as is. No IVA is added.
- `PRECIOS_EQUIPOS_LEIDO` is the date you read the sheet.
- Put this comment above the arrays: `// Snapshot of the live equipment sheet. Refresh by re-reading the sheet; do not edit prices by hand.`

Tell the human the read date in your final report, so the vault mirror note can be refreshed if the sheet changed.

- [ ] **Step 2: Write the failing `cogsSugerido` tests**

The fixture numbers are test data, not prices.

```ts
import { describe, expect, it } from 'vitest'
import { cogsSugerido, type PrecioInversor, type PrecioModulo } from '@/lib/equipment-prices'

const modulos: PrecioModulo[] = [
  { producto: 'Modulo A', wp: 720, proveedor: 'P1', precioCop: 388_800, cotizado: '2026-09-20' },
  { producto: 'Modulo B', wp: 625, proveedor: 'P2', precioCop: 357_500, cotizado: '2026-09-20' },
]
const inversores: PrecioInversor[] = [
  { producto: 'Red 10K', kw: 10, tipo: 'on_grid', proveedor: 'P1', precioCop: 4_000_000, cotizado: '2026-09-20' },
  { producto: 'Red 12K', kw: 12, tipo: 'on_grid', proveedor: 'P2', precioCop: 3_800_000, cotizado: '2026-09-20' },
  { producto: 'Red 5K', kw: 5, tipo: 'on_grid', proveedor: 'P1', precioCop: 1_500_000, cotizado: '2026-09-20' },
  { producto: 'Hibrido 10K', kw: 10, tipo: 'hibrido', proveedor: 'P3', precioCop: 7_000_000, cotizado: '2026-08-01' },
]
const HOY = new Date('2026-10-14')

describe('cogsSugerido', () => {
  it('uses the cheapest COP/Wp module and a whole number of panels', () => {
    const r = cogsSugerido(10, false, HOY, modulos, inversores)
    expect(r?.modulo.producto).toBe('Modulo A')
    expect(r?.modulosCop).toBe(14 * 388_800)
  })

  it('picks the cheapest single on-grid inverter at least as large as the array', () => {
    const r = cogsSugerido(9.5, false, HOY, modulos, inversores)
    expect(r?.inversor.producto).toBe('Red 12K')
    expect(r?.cantidadInversores).toBe(1)
    expect(r?.inversorCop).toBe(3_800_000)
  })

  it('uses a hybrid inverter when the quote has a battery', () => {
    const r = cogsSugerido(9.5, true, HOY, modulos, inversores)
    expect(r?.inversor.tipo).toBe('hibrido')
    expect(r?.inversorCop).toBe(7_000_000)
  })

  it('combines several units of the cheapest COP/W inverter when no single one is large enough', () => {
    const r = cogsSugerido(30, false, HOY, modulos, inversores)
    expect(r?.inversor.producto).toBe('Red 5K')
    expect(r?.cantidadInversores).toBe(6)
    expect(r?.inversorCop).toBe(9_000_000)
  })

  it('flags a quote older than 60 days as an old reference', () => {
    expect(cogsSugerido(9.5, true, HOY, modulos, inversores)?.referenciaVieja).toBe(true)
    expect(cogsSugerido(9.5, false, HOY, modulos, inversores)?.referenciaVieja).toBe(false)
  })

  it('returns null without a positive size or without rows of the needed type', () => {
    expect(cogsSugerido(0, false, HOY, modulos, inversores)).toBeNull()
    expect(cogsSugerido(10, true, HOY, modulos, inversores.filter((i) => i.tipo === 'on_grid'))).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/equipment-prices.test.ts`

Expected: FAIL, `cogsSugerido` is not exported.

- [ ] **Step 4: Implement `cogsSugerido`**

Append to `src/lib/equipment-prices.ts`, below the snapshot:

```ts
export const DIAS_PRECIO_VIGENTE = 60
const MS_DIA = 86_400_000

export interface CogsSugerido {
  modulosCop: number
  inversorCop: number
  modulo: PrecioModulo
  inversor: PrecioInversor
  cantidadInversores: number
  referenciaVieja: boolean
}

function masBarato<T>(xs: T[], costo: (x: T) => number): T | null {
  return xs.reduce<T | null>((best, x) => (best === null || costo(x) < costo(best) ? x : best), null)
}

export function cogsSugerido(
  kwp: number,
  conBateria: boolean,
  hoy: Date,
  modulos: PrecioModulo[] = MODULOS,
  inversores: PrecioInversor[] = INVERSORES,
): CogsSugerido | null {
  if (!Number.isFinite(kwp) || kwp <= 0) return null

  const modulo = masBarato(modulos, (m) => m.precioCop / m.wp)
  if (!modulo) return null
  const paneles = Math.ceil((kwp * 1000) / modulo.wp)

  const tipo = conBateria ? 'hibrido' : 'on_grid'
  const delTipo = inversores.filter((i) => i.tipo === tipo)
  const unico = masBarato(delTipo.filter((i) => i.kw >= kwp), (i) => i.precioCop)
  const inversor = unico ?? masBarato(delTipo, (i) => i.precioCop / i.kw)
  if (!inversor) return null
  const cantidadInversores = unico ? 1 : Math.ceil(kwp / inversor.kw)

  const viejo = (fecha: string) => hoy.getTime() - new Date(fecha).getTime() > DIAS_PRECIO_VIGENTE * MS_DIA

  return {
    modulosCop: paneles * modulo.precioCop,
    inversorCop: cantidadInversores * inversor.precioCop,
    modulo,
    inversor,
    cantidadInversores,
    referenciaVieja: viejo(modulo.cotizado) || viejo(inversor.cotizado),
  }
}
```

Run: `npx vitest run src/lib/__tests__/equipment-prices.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing margin tests**

```ts
import { describe, expect, it } from 'vitest'
import { margenBruto, MARGEN_MINIMO } from '@/lib/proposal-disclosure'

describe('margenBruto', () => {
  it('returns null until all four costs are filled', () => {
    expect(margenBruto(40_000_000, [10_000_000, null, 3_000_000, 8_000_000])).toBeNull()
  })

  it('computes (price - cost) / price', () => {
    const r = margenBruto(40_000_000, [8_000_000, 6_000_000, 3_000_000, 5_000_000])
    expect(r?.costo).toBe(22_000_000)
    expect(r?.margen).toBeCloseTo(0.45, 2)
    expect(r!.margen < MARGEN_MINIMO).toBe(true)
  })
})
```

And a share test: build a `QuotationData` whose `advanced` includes the four COGS numbers, call `toPayload`, and expect `JSON.stringify(payload.a)` not to contain `cogs_modulos_cop`, `cogs_inversor_cop`, `cogs_bos_cop`, or `cogs_instalacion_cop`.

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/proposal-disclosure.test.ts src/lib/__tests__/share.test.ts src/lib/__tests__/share-sanitize.test.ts`

Expected: FAIL on `margenBruto` and on the COGS keys still present. If the share test file you picked does not exist, add the assertion to the file that already imports `toPayload`.

- [ ] **Step 7: Implement margin and the strip**

```ts
export const MARGEN_MINIMO = 0.5

export function margenBruto(
  precioCop: number,
  partes: Array<number | null>,
): { costo: number; margen: number } | null {
  if (!Number.isFinite(precioCop) || precioCop <= 0) return null
  if (partes.length !== 4) return null
  if (partes.some((p) => p === null || !Number.isFinite(p) || p < 0)) return null
  const costo = (partes as number[]).reduce((s, n) => s + n, 0)
  return { costo, margen: (precioCop - costo) / precioCop }
}
```

Add the four fields to `AdvancedData`, to `advancedSchema` as `z.number().min(0).nullable()`, and to `initialAdvancedData` as `null`. `deepMerge` already fills missing keys from the defaults, so old `localStorage` quotes gain `null` rather than failing Zod.

In `toPayload`, omit the four keys from `a` before the return. In `fromPayload`, after `deepMerge`, set all four back to `null` so a payload that already contains them cannot rehydrate onto a public page.

- [ ] **Step 8: Wizard UI**

In `step-advanced.tsx`, add a section titled `Costo interno`. The description is `No sale en el link del cliente.` Four number inputs in COP: módulos, inversor, BOS, instalación. On submit, store `null` for a blank input and the finite number otherwise.

Pre-fill from the snapshot: compute `const sugerido = cogsSugerido(calcResults.kwp, advanced.bateria.habilitada, new Date())` (use the same advanced values the form already reads). When the form initializes and a stored value is `null`:

- `cogs_modulos_cop` starts at `sugerido.modulosCop`, with the caption `Sugerido: ${sugerido.modulo.producto} ${sugerido.modulo.wp} W, ${sugerido.modulo.proveedor}, cotizado ${sugerido.modulo.cotizado}.`
- `cogs_inversor_cop` starts at `sugerido.inversorCop`, with the caption `Sugerido: ${sugerido.cantidadInversores} × ${sugerido.inversor.producto}, ${sugerido.inversor.proveedor}, cotizado ${sugerido.inversor.cotizado}.`
- If `sugerido.referenciaVieja`, add one line under both captions: `Precio de referencia viejo: la cotización tiene más de 60 días.`
- BOS and instalación stay empty. They are not in the sheet.

A stored number is never replaced by the suggestion. The user can edit or clear any pre-filled value. If `sugerido` is `null`, all four start empty and no caption shows.

Compute margin with the pre-IVA price: `margenBruto(calcResults.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate), [modulos, inversor, bos, instalacion])` using the current input values.

When `margenBruto` returns a value and `margen < MARGEN_MINIMO`, show:

`Margen bruto XX,X%. Está por debajo del 50%.`

When it returns a value at or above `0.5`, show the percentage with no warning. When it returns `null`, show `Completa los cuatro costos para ver el margen.` Do not disable the submit button and do not block sharing.

Do not render these fields from `executive-summary.tsx`, `financial-section.tsx`, `ppa-section.tsx`, or `proposal-pdf.tsx`.

- [ ] **Step 9: Verify**

Run: `npm test && npx tsc --noEmit`

Expected: PASS, clean typecheck. Confirm with a search that `cogs_modulos_cop` and `equipment-prices` do not appear under `src/components/virtual/`, `src/lib/pdf/` or `src/lib/mcp/`.

---

## Done when

- A new quote defaults to net billing at 300 COP/kWh. An old quote with `modo_conexion: 'net_metering'` still says net metering.
- The virtual proposal and the MCP summary show engine payback and simple payback, and a Ley 1715 sentence only when a tax toggle is on.
- `estimatePrice`, the engine tax math, `INDICE_MIRAC`, and the IVA rate are unchanged. `npm test` has no snapshot diff.
- A complete `H(i)_m` year is `pvgis_poa`; horizontal or incomplete data is `estimada`; stored 12-vectors are untouched.
- The wizard pre-fills module and inverter cost from a dated snapshot of the live sheet, shows margin against the pre-IVA price, warns under 50%, and none of it reaches `toPayload`, the virtual proposal, the PDF, or the MCP.
