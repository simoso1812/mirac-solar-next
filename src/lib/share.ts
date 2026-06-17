/**
 * Share proposals via short URLs backed by Upstash Redis.
 * Supports single proposals and multi-version comparisons.
 * Only stores input data — results are recalculated on load.
 */
import type { QuotationData, RoofDesign } from '@/lib/types'
import {
  deepMerge,
  initialAdvancedData,
  initialClientData,
  initialProjectData,
  initialTechnicalData,
} from '@/lib/defaults'

/** Minimal payload — just the inputs needed to recalculate */
export interface SharePayload {
  c: { n: string; d: string; e: string; t: string; a: string }
  p: { ci: string; f: string; la: number | null; lo: number | null; h: number[] | null }
  t: { co: number; pw: number; fs: number; tc: string; cl: string; op: number | null; mp?: string; mo?: string; an?: number; al?: number; dt?: RoofDesign | null }
  a: Record<string, unknown>
  d?: Record<string, unknown>
}

/** Multi-version wrapper */
export interface SharedVersion {
  label: string
  proposal: QuotationData
}

interface StoredVersionEntry {
  label: string
  payload: SharePayload
}

/** What we store in Redis — either single or multi */
type StoredData =
  | SharePayload                            // single (legacy)
  | { versions: StoredVersionEntry[] }      // multi

/**
 * Replace a non-finite number (NaN / ±Infinity) with a fallback.
 *
 * Why this matters for sharing: `JSON.stringify` serializes NaN/Infinity to
 * `null`. The /api/share zod gate types these fields as `z.number()` (and
 * `.optional()`, which accepts undefined but NOT null), so a single non-finite
 * value anywhere in the payload makes the POST 400 ("Formato de propuesta
 * inválido"). The most reachable source is `ancho_m`/`alto_m`: react-hook-form
 * `valueAsNumber` yields NaN for an emptied field. We sanitize at this
 * serialization boundary so the wire payload is always finite — this also
 * covers the MCP create_quotation_link path, which reuses toPayload().
 */
const finiteOr = (v: number | null | undefined, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/** Drop non-finite numbers anywhere in a roof design so it survives JSON + the gate. */
function sanitizeRoofDesign(d: RoofDesign | null): RoofDesign | null {
  if (!d) return d
  const n = (v: number) => (Number.isFinite(v) ? v : 0)
  return {
    ...d,
    total_panels: n(d.total_panels),
    total_area_m2: n(d.total_area_m2),
    areas: d.areas.map((a) => ({
      ...a,
      area_m2: n(a.area_m2),
      rotation_deg: n(a.rotation_deg),
      row_gap_m: n(a.row_gap_m),
      vertices: a.vertices.map((v) => ({ lat: n(v.lat), lng: n(v.lng) })),
      panels: a.panels.map((p) => ({ lat: n(p.lat), lng: n(p.lng) })),
    })),
  }
}

export function toPayload(proposal: QuotationData): SharePayload {
  const { client: c, project: p, technical: t, advanced: a } = proposal
  // `h` must be 12 finite numbers or null — a NaN element serializes to null and
  // the gate rejects it, so collapse a malformed array back to null (fromPayload
  // backfills it on read).
  const hsp =
    Array.isArray(p.hsp_mensual_pvgis) &&
    p.hsp_mensual_pvgis.length === 12 &&
    p.hsp_mensual_pvgis.every((v) => Number.isFinite(v))
      ? p.hsp_mensual_pvgis
      : null
  return {
    c: { n: c.nombre, d: c.direccion, e: c.email, t: c.telefono, a: c.nit_cc },
    p: { ci: p.ciudad, f: p.fecha, la: p.lat, lo: p.lon, h: hsp },
    t: { co: finiteOr(t.consumo_mensual_kwh, 0), pw: finiteOr(t.potencia_panel_w, 615), fs: finiteOr(t.factor_seguridad, 1.1), tc: t.tipo_cubierta, cl: t.clima, op: t.override_paneles, mp: t.marca_panel, mo: t.modelo_panel, an: finiteOr(t.ancho_m, 1.13), al: finiteOr(t.alto_m, 2.38), dt: sanitizeRoofDesign(t.diseno_techo) },
    a: a as unknown as Record<string, unknown>,
    d: proposal.docuseal as unknown as Record<string, unknown> | undefined,
  }
}

export function fromPayload(payload: SharePayload): QuotationData {
  const client = deepMerge(initialClientData, {
    nombre: payload.c.n,
    direccion: payload.c.d,
    email: payload.c.e,
    telefono: payload.c.t,
    nit_cc: payload.c.a,
  })
  const project = deepMerge(initialProjectData, {
    ciudad: payload.p.ci,
    fecha: payload.p.f,
    ubicacion_label: '',
    plantilla: 'default',
    lat: payload.p.la,
    lon: payload.p.lo,
    hsp_mensual_pvgis: payload.p.h,
    map_url: null,
  })
  const technical = deepMerge(initialTechnicalData, {
    consumo_mensual_kwh: payload.t.co,
    potencia_panel_w: payload.t.pw,
    factor_seguridad: payload.t.fs,
    tipo_cubierta: payload.t.tc,
    clima: payload.t.cl,
    override_paneles: payload.t.op,
    marca_panel: payload.t.mp ?? '',
    modelo_panel: payload.t.mo ?? '',
    ancho_m: payload.t.an ?? 1.13,
    alto_m: payload.t.al ?? 2.38,
    diseno_techo: (payload.t.dt as RoofDesign | null) ?? null,
  })
  const advanced = deepMerge(initialAdvancedData, payload.a)

  return {
    id: 'shared',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'sent',
    client,
    project,
    technical,
    advanced,
    results: null,
    docuseal: payload.d as unknown as QuotationData['docuseal'],
    drive_folder_link: null,
    drive_project_name: null,
  }
}

function isMultiVersion(data: StoredData): data is { versions: StoredVersionEntry[] } {
  return 'versions' in data && Array.isArray(data.versions)
}

// ---------------------------------------------------------------------------
// Single proposal sharing (backwards compatible)
// ---------------------------------------------------------------------------

export async function generateShareUrl(proposal: QuotationData): Promise<string> {
  const payload = toPayload(proposal)

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  })

  if (!res.ok) throw new Error('Error al guardar la propuesta')

  const { id } = await res.json()
  return `${window.location.origin}/s/${id}`
}

export async function updateSharedClient(
  id: string,
  clientPatch: { email?: string; telefono?: string; nit_cc?: string },
): Promise<void> {
  const res = await fetch('/api/share', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, clientPatch }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'No se pudo actualizar los datos del cliente')
  }
}

export async function fetchSharedProposal(id: string): Promise<QuotationData> {
  const res = await fetch(`/api/share?id=${id}`)
  if (!res.ok) throw new Error('Propuesta no encontrada o expirada')

  const { data } = await res.json()
  return fromPayload(data as SharePayload)
}

// ---------------------------------------------------------------------------
// Multi-version sharing
// ---------------------------------------------------------------------------

export async function generateMultiShareUrl(
  proposals: { label: string; proposal: QuotationData }[]
): Promise<string> {
  const versions: StoredVersionEntry[] = proposals.map((v) => ({
    label: v.label,
    payload: toPayload(v.proposal),
  }))

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { versions } }),
  })

  if (!res.ok) throw new Error('Error al guardar las propuestas')

  const { id } = await res.json()
  return `${window.location.origin}/s/${id}`
}

/**
 * Fetch shared data — returns either a single proposal or multiple versions.
 */
export async function fetchSharedData(id: string): Promise<SharedVersion[]> {
  const res = await fetch(`/api/share?id=${id}`)
  if (!res.ok) throw new Error('Propuesta no encontrada o expirada')

  const { data } = await res.json() as { data: StoredData }

  if (isMultiVersion(data)) {
    return data.versions.map((v) => ({
      label: v.label,
      proposal: fromPayload(v.payload),
    }))
  }

  // Legacy single proposal
  return [{
    label: 'Propuesta',
    proposal: fromPayload(data),
  }]
}
