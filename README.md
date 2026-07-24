# Mirac Solar

Internal quoting tool for [Mirac Energy](https://mirac.energy) (Colombia). Sizes residential and commercial solar PV systems, computes financials (TIR/VPN/payback under Ley 1715), and produces client-facing deliverables: a virtual web proposal, a branded PDF, a DocuSeal-signed contract, and Google Drive filing.

Next.js 16 / React 19 rewrite of the original Streamlit Python calculator. Spanish UI, COP currency.

> Agent/contributor context (domain rules, calculator invariants, workflows) lives in [AGENTS.md](AGENTS.md). Read it before changing anything in `src/lib/calculator/`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in what you need (see table below)
npm run dev                  # http://localhost:3000
```

The calculator, wizard, and proposal views work without any env vars. Integrations (maps, Drive, sharing, e-signature, bill scanner) each need their own credentials.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm test` | Vitest suite (golden-master tests for the financial engine) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

CI (`.github/workflows/ci.yml`) runs typecheck + lint + test + build on every PR and push to `main`. The golden-master snapshots in `src/lib/calculator/__tests__/` lock the numbers clients see — a snapshot diff is never routine.

## What's where

```
src/lib/calculator/   financial engine (pure functions; engine.ts is the single savings loop)
src/components/       wizard steps, virtual proposal sections, PDF button, Drive sync
src/lib/pdf/          @react-pdf proposal document
src/app/api/          share links, DocuSeal submission + webhook, PVGIS, ETER/EPM grid capacity, remote MCP server
src/lib/eter/         EPM ETER client (CREG 030 transformer traffic-light: capacity + FV feasibility)
src/stores/           Zustand persisted stores (wizard state + proposals book)
skills/               Claude Cowork skill for the MCP quoting connector
```

Key architectural rule: stored `results` are never trusted — every consumer (web proposal, PDF, Drive sync, share page, MCP tools) re-runs `cotizacion(buildInputFromStore(...))` live.

### ETER / EPM grid capacity (`src/lib/eter/`)

Queries the public ArcGIS service behind EPM's ETER viewer (CREG 030 transformer traffic-light) to answer "does this transformer have autogeneración hosting capacity?". Exposed as REST (`GET /api/eter/trafo/[nro]`, `/api/eter/trafos?municipio=&semaforo=&minKva=`, `/api/eter/capacidad?lat=&lon=&radio=&kwp=`) and as MCP tools (`epm_capacidad_trafo`, `epm_trafos_cercanos`).

Service gotchas (verified 2026-07-23): field names must be fully qualified (`SIGMAENERGIA.MOV_VETRANSFO_PT.*` / `CREG030.C30_CALCULO_SEMAFORO.*`); no pagination (`resultRecordCount` → 400) with an implicit 2000-record cap; `MUNICIPIO` values carry accents (accent-insensitive matching uses `LIKE` with `_` wildcards since `TRANSLATE` is unsupported); `CARGABILIDAD` is sometimes a fraction. Semantics (confirmed against the viewer's DisponibilidadRed widget): `VALOR_POTENCIA`/`VALOR_ENERGIA` are the official occupation **percentages** over nominal capacity (thresholds VERDE ≤30%, AMARILLO 30–40%, NARANJA 40–50%, ROJO >50%); `SUMATORIA_POTENCIA` is the committed kW (`VALOR = SUMATORIA / CAPACIDAD × 100`). Headroom heuristic: `cupo ≈ 0.5·CAPACIDAD_NOMINAL − SUMATORIA_POTENCIA`; the semaphore color is the authoritative datum. The viewer popup's % additionally includes the user-simulated system (POST `/ETER/api/querybd/GetSolicitudTransitoria`, CSRF-protected). Best-effort public service — the official source is the viewer at https://maps.epm.com.co/ETER/Visor/Visor.

## Environment variables

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Interactive map + Static Maps in the PDF (restrict by referrer) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` / `PARENT_FOLDER_ID` | Google Drive folder creation + uploads |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `/s/<id>` share links, webhook Drive mapping, rate limiting |
| `ANTHROPIC_API_KEY` | Utility-bill scanner |
| `MARKITDOWN_SERVICE_URL` / `MARKITDOWN_API_KEY` | Optional text-extraction path for the bill scanner |
| `DOCUSEAL_API_KEY` / `DOCUSEAL_API_URL` | Contract e-signing |
| `DOCUSEAL_WEBHOOK_SECRET` | Optional HMAC validation of the signed-contract webhook |
| `MCP_AUTH_TOKEN` | Optional shared secret for the remote MCP server at `/api/mcp` |
| `MCP_PUBLIC_BASE_URL` | Optional origin for MCP-generated share links |

See `.env.example` for per-variable notes.

## Deployment

Deployed on Vercel. Set the env vars above in the Vercel project; the DocuSeal webhook must be registered in the DocuSeal dashboard (`Settings → Webhooks → form.completed → https://<app>/api/docuseal/webhook`).
