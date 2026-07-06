# Upgrade Roadmap — 2026-07-06 multi-agent audit

Synthesis of a 5-agent parallel audit (security, calculator correctness, product/UX,
code quality, integrations). Baseline: all 55 tests pass, `tsc` clean, lint 0 errors,
no new high-severity npm advisories. The June 2026 hardening was verified intact
(share gate, DocuSeal slug gating, MCP constant-time auth, Drive token isolation,
deepMerge prototype-pollution safety).

Legend: effort S/M/L. Items marked **[Simon]** need domain sign-off before code.

---

## Phase 0 — Correctness bugs (fix before anything else; client-visible numbers)

1. **"Costo de No Hacer Nada" chart is wrong twice** — `cost-comparison-section.tsx`
   - Off-by-one: loop reads `flujo_caja[i-1]`, so year 1 shows the year-0 row and the
     whole con-solar curve lags a year.
   - Parallel math: hardcoded `costo_total × 0.02` maintenance, no surplus/tax/cuotas/
     demora — diverges from the engine (same drift class as past bugs X1/X2).
   - Fix: derive the con-solar line from `results.flujo_caja[i].flujo_acumulado_cop`;
     delete the local loop. Add a golden test pinning chart-vs-engine consistency. (S)
2. **0%-interest loan = free money** — `index.ts:203` guard `tasaInteresCredito > 0`
   skips the cuota entirely while still reducing the desembolso. `pmt()` already
   handles rate 0. Drop the guard; add test. (S)
3. **Payback "0 años" at 100% financing** — `index.ts:271-283`: `-0` year-0 flow makes
   cumulative ≥ 0 at i=0. Report the crossing after the flow first goes negative. (S)
4. **`estimatePrice` throw reachable from shared/imported payloads** — `index.ts:164`:
   `consumo=0`/`override_paneles=0` payloads crash `/s/[id]` and the PDF path. Clamp
   panels ≥ 2 or short-circuit inside `cotizacion()`. (S)
5. **[Simon] Cost-curve discontinuities** — `cost.ts`: +9.2M COP jump at 50 kWp,
   ~+1M at 10 kWp. Blend segments or re-anchor intercepts so curves meet; coefficients
   are dataset-calibrated so needs Simon. Add boundary tests either way. (S code, but
   pricing decision)
6. **Sub-3 kWp systems get no inverter** — `inverter.ts:40`: empty combo, silent
   dcAcRatio=1.0. Floor at the smallest (3 kW) inverter. (S)
7. **Duplicate `override_inversores` rows collapse** — `index.ts:150` keys by
   potencia_kw; merge quantities instead. (S)
8. **[Simon] Battery model ignores round-trip efficiency and capacity** — engine credits
   full `min(gen, consumo)` self-consumption regardless of battery size and never uses
   `eficienciaBateria`. Deliberate Tier-C simplification? Sign off or model it. (M)

## Phase 1 — Close the broken signing loop (highest business value)

The WhatsApp-link → client-signs → contract-in-Drive loop is broken end-to-end today:

9. **Persist DocuSeal state on the share payload** — signing on `/s/[id]` is in-memory
   only; reload forgets the submission and mints a duplicate contract. Extend
   `PATCH /api/share` with a `docusealPatch` (it's clientPatch-only) and call it from
   the shared page. (S)
10. **Real ids for shared/MCP proposals** — `fromPayload` uses constant `id: 'shared'`,
    `create-link.ts` uses `'mcp'`, so the webhook's `getProposalDriveMapping(external_id)`
    can never match and all shared proposals collide on one external id. Thread
    `s:<shareId>` through as the proposal/external id and key the Drive mapping on it. (M)
11. **Drive re-sync duplicates the whole project folder** — `drive-sync-button.tsx`
    always calls `prepareDriveUpload`, minting a new `FVyyNNN` consecutive + tree.
    Persist `uploadFolderId` on the proposal and reuse it; overwrite the PDF. (S)
12. **Webhook must fail loudly** — return 500 when the Drive upload fails (DocuSeal
    retries non-2xx); `subirArchivo`/`uploadSignedContractToDrive` must stop reporting
    `success: true, link: null`. Add 15s timeouts to DocuSeal fetches. (S)
13. **Auto-status** — ShareDialog sets `status: 'sent'` locally after link generation;
    signed status flows back to `/propuestas` (via the share payload from #9 + a
    status key the list reads). Kills the manual `<select>` ritual. (S)

## Phase 2 — Security hardening batch (small, do together)

14. **DocuSeal webhook fails closed** when `DOCUSEAL_WEBHOOK_SECRET` is unset in prod;
    confirm the env var is actually set in Vercel. **[Simon: check Vercel]** (S)
15. **Rate-limit the unthrottled surfaces** with the existing `rateLimit()`: MCP handler
    (per-IP), `/api/pvgis` (+ round lat/lon to 3 decimals for cache hits), `scan-bill`
    server action (Anthropic spend), `runCreateQuotationLink` (Upstash writes). (S)
16. **MCP input bounds** — `ppa_opciones.max(20)`, `.max()` on free-text strings,
    `financiamiento_tasa_ea.max(1)`, plazo `.max(30)`; size-check the serialized
    payload before `redis.set` in create-link. (S)
17. **Validate `docuseal.embed_src`** against the DocuSeal origin before feeding the
    embed (untrusted-storage → live embed). (S)
18. **Atomic rate-limit INCR/EXPIRE** (pipeline or SET NX EX) so a crash can't leave a
    TTL-less counter permanently limiting an IP. (S)

## Phase 3 — Sales-loop features (the "did they see it / who needs a nudge" gap)

19. **Store `share_id` + `shared_at` on the proposal** — today the link is shown once
    and lost. Prereq for everything below. (S)
20. **View tracking** — `INCR views:<id>` + `last_viewed:<id>` in `GET /api/share`;
    surface "Visto 3 veces · hace 2 días" on `/propuestas` cards. (S/M, high value)
21. **Follow-up nudges on the dashboard** — "enviada hace 8 días sin firma" list with
    one-click `wa.me/<telefono>`, pipeline value by status, sent→accepted conversion.
    All data already in the store. (S)
22. **Share-link management** — status/expiry on the detail page, "Regenerar enlace",
    DELETE revocation. (S)
23. **Optional first-view notification** (email/webhook, env-gated). (M)

## Phase 4 — Storage durability (biggest risk item)

24. **Prereqs in `proposals-store`**: rehydrate deep-merge backfill (it has none today,
    unlike quotation-store); stop persisting `results` (never trusted); record-per-
    proposal layout instead of one monolithic array with inline base64. (M)
25. **Upstash-primary with localStorage cache** (or minimum viable: automatic periodic
    export-JSON push to Upstash/Drive). Import/merge needs `updated_at` arbitration —
    current import is last-write-wins and clobbers newer edits. (M/L)

## Phase 5 — MCP parity

26. **Boolean coercion** — `incluir_baterias` etc. are plain `z.boolean()`; the exact
    string-encoding bug class just fixed for numbers. Use a `"true"/"false"` preprocess
    (NOT `z.coerce.boolean()`). Also: auto-enable battery when `bateria_capacidad_kwh > 0`. (S)
27. **Panel selection + `override_paneles`** inputs (mirrors the inverter work; share
    codec already round-trips `mp`/`mo`). (S)
28. **Arbitrary lat/lon with PVGIS HSP** — MCP is locked to 7 cities; also fixes
    MCP-created links showing no map. (M)
29. **`get_quotation` / `update_quotation`** — read/rewrite an existing `share:<id>` so
    agents can tweak a quote without orphaning the sent link. (M)
30. **Financial-model + battery-detail args** (horizonte, tasa_descuento, indexación,
    mantenimiento, demora, DoD, eficiencia, costo_kwh_bateria). (S)
31. **Spanish `isError` handling** — wrap tool handlers in try/catch. (S)

## Phase 6 — Product enhancements

32. **"Generar 3 opciones"** — clone with adjusted `override_paneles` (80/100/120%
    coverage or ±battery); the multi-version share + VersionSelector already exist. (M)
33. **Bill-simulation fidelity** — month-by-month before/after bars using
    `generacion_mensual_kwh`, modo_conexion-aware valuation. (S/M)
34. **`valida_hasta` field** — offer expiry in PDF/virtual/CTA. (S)
35. **Actionable `/clientes`** — click-to-WhatsApp/mailto, notes field, "Cotizar de
    nuevo" prefill. (S/M)
36. **Cargadores parity** — persist quotes, toasts, share/PDF/MCP later. (M)
37. **[Simon] PPA totals footnote or indexation** — only multi-year money figure in the
    app that isn't indexed (understates client savings ~1.5-2×). (S)

## Phase 7 — Cleanup + test debt

38. Dead code: 9 unused shadcn primitives (~1,500 lines), `date-fns` dep,
    `calendar.tsx`→`react-day-picker`, quotation-store re-export block,
    `medidor_inteligente` toggle (zero engine effect — wire or remove **[Simon]**). (S)
39. Test coverage: cost.ts boundaries, inverter.ts, performance.ts, carbon.ts,
    0%-rate financing, payback-at-zero-desembolso, NaN propagation, MCP `buildStores`
    mapping, roof packing last-row bound + concave polygon, chart-vs-engine consistency. (M)
40. Minor: roof packing last-row bound (`cy + h/2 <= maxY`), self-intersection guard in
    the designer, `derived.ts` hardcoded 0.02 → read constant, partially-estimated PVGIS
    months labeled `mixed`, bill-scanner concurrency cap + MarkItDown-down `console.warn`,
    años rounding mismatch (Math.round vs floor) between web and PDF financing cards.

---

## Suggested execution order

Phase 0 (items 1-4, 6-7) and Phase 1 are the "do now" set — wrong client-facing numbers
and a broken signing funnel. Phase 2 is one small PR. Phases 3-4 are the biggest
workflow upgrades; 3 is cheap, 4 is the risk eliminator. Each phase = one branch, with
typecheck + lint + `npm test` + build gates per project convention.

Decisions needed from Simon before code: #5 (cost-curve blending), #8 (battery
efficiency modeling), #14 (is `DOCUSEAL_WEBHOOK_SECRET` set in Vercel?), #37 (PPA
indexation), #38 (`medidor_inteligente` fate).
