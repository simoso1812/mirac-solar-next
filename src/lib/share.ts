/**
 * Compress/decompress proposal data for shareable URLs.
 * Only stores input data (client, project, technical, advanced) —
 * results are recalculated on the receiving end.
 */
import type { QuotationData } from '@/lib/types'

function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Minimal payload — just the inputs needed to recalculate everything */
interface SharePayload {
  c: { n: string; d: string; e: string; t: string; a: string } // client
  p: { ci: string; f: string; la: number | null; lo: number | null; h: number[] | null } // project
  t: { co: number; pw: number; fs: number; tc: string; cl: string; op: number | null } // technical
  a: Record<string, unknown> // advanced (kept as-is, it's small)
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

function fromPayload(payload: SharePayload): Omit<QuotationData, 'results'> & { results: null } {
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

async function compress(data: unknown): Promise<string> {
  const json = JSON.stringify(data)
  const input = new TextEncoder().encode(json)

  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(input.buffer as ArrayBuffer)
  writer.close()

  const reader = cs.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const compressed = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    compressed.set(chunk, offset)
    offset += chunk.length
  }

  return base64urlEncode(compressed)
}

async function decompress(encoded: string): Promise<unknown> {
  const compressed = base64urlDecode(encoded)

  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(compressed.buffer as ArrayBuffer)
  writer.close()

  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const decompressed = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    decompressed.set(chunk, offset)
    offset += chunk.length
  }

  return JSON.parse(new TextDecoder().decode(decompressed))
}

/**
 * Compress proposal inputs for URL sharing.
 * Strips results (recalculable) and uses short keys to minimize URL length.
 */
export async function compressProposal(proposal: QuotationData): Promise<string> {
  const payload = toPayload(proposal)
  return compress(payload)
}

/**
 * Decompress proposal data from URL parameter.
 * Returns QuotationData with results=null — caller should recalculate.
 */
export async function decompressProposal(encoded: string): Promise<QuotationData> {
  const payload = await decompress(encoded) as SharePayload
  return fromPayload(payload) as QuotationData
}

/**
 * Generate a full shareable URL for a proposal
 */
export async function generateShareUrl(proposal: QuotationData): Promise<string> {
  const encoded = await compressProposal(proposal)
  return `${window.location.origin}/propuestas/shared?d=${encoded}`
}
