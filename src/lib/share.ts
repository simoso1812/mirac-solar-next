/**
 * Share proposals via short URLs backed by Upstash Redis.
 * Only stores input data — results are recalculated on load.
 */
import type { QuotationData } from '@/lib/types'

/** Minimal payload — just the inputs needed to recalculate */
interface SharePayload {
  c: { n: string; d: string; e: string; t: string; a: string }
  p: { ci: string; f: string; la: number | null; lo: number | null; h: number[] | null }
  t: { co: number; pw: number; fs: number; tc: string; cl: string; op: number | null }
  a: Record<string, unknown>
}

function toPayload(proposal: QuotationData): SharePayload {
  const { client: c, project: p, technical: t, advanced: a } = proposal
  return {
    c: { n: c.nombre, d: c.direccion, e: c.email, t: c.telefono, a: c.nit_cc },
    p: { ci: p.ciudad, f: p.fecha, la: p.lat, lo: p.lon, h: p.hsp_mensual_pvgis },
    t: { co: t.consumo_mensual_kwh, pw: t.potencia_panel_w, fs: t.factor_seguridad, tc: t.tipo_cubierta, cl: t.clima, op: t.override_paneles },
    a: a as unknown as Record<string, unknown>,
  }
}

export function fromPayload(payload: SharePayload): QuotationData {
  return {
    id: 'shared',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'sent',
    client: {
      nombre: payload.c.n,
      direccion: payload.c.d,
      email: payload.c.e,
      telefono: payload.c.t,
      nit_cc: payload.c.a,
    },
    project: {
      ciudad: payload.p.ci,
      fecha: payload.p.f,
      ubicacion_label: '',
      plantilla: 'default',
      lat: payload.p.la,
      lon: payload.p.lo,
      hsp_mensual_pvgis: payload.p.h,
      map_url: null,
    },
    technical: {
      consumo_mensual_kwh: payload.t.co,
      potencia_panel_w: payload.t.pw,
      factor_seguridad: payload.t.fs,
      tipo_cubierta: payload.t.tc as 'metalica' | 'teja' | 'losa',
      clima: payload.t.cl as 'templado' | 'calido' | 'frio',
      override_paneles: payload.t.op,
    },
    advanced: payload.a as unknown as QuotationData['advanced'],
    results: null,
    drive_folder_link: null,
    drive_project_name: null,
  }
}

/**
 * Store proposal data server-side and return a short share URL.
 * URL format: /s/[8-char-id]
 */
export async function generateShareUrl(proposal: QuotationData): Promise<string> {
  const payload = toPayload(proposal)

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  })

  if (!res.ok) {
    throw new Error('Error al guardar la propuesta')
  }

  const { id } = await res.json()
  return `${window.location.origin}/s/${id}`
}

/**
 * Fetch proposal data from server by share ID.
 */
export async function fetchSharedProposal(id: string): Promise<QuotationData> {
  const res = await fetch(`/api/share?id=${id}`)

  if (!res.ok) {
    throw new Error('Propuesta no encontrada o expirada')
  }

  const { data } = await res.json()
  return fromPayload(data as SharePayload)
}
