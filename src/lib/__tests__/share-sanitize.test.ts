import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { toPayload, fromPayload } from '@/lib/share'
import { roofDesignSchema } from '@/lib/schemas'
import {
  initialAdvancedData,
  initialClientData,
  initialProjectData,
  initialTechnicalData,
} from '@/lib/defaults'
import type { QuotationData, RoofDesign } from '@/lib/types'

// Exact mirror of singlePayloadSchema in src/app/api/share/route.ts — the gate
// the share POST runs the payload through. If toPayload output passes this for
// proposals carrying non-finite numbers, /api/share no longer 400s.
const singlePayloadSchema = z.object({
  c: z.object({ n: z.string().max(500), d: z.string().max(500), e: z.string().max(500), t: z.string().max(500), a: z.string().max(500) }),
  p: z.object({ ci: z.string().max(100), f: z.string().max(100), la: z.number().nullish(), lo: z.number().nullish(), h: z.array(z.number()).length(12).nullish() }),
  t: z.object({
    co: z.number(), pw: z.number(), fs: z.number(), tc: z.string().max(100), cl: z.string().max(100),
    op: z.number().nullish(), mp: z.string().max(100).optional(), mo: z.string().max(100).optional(),
    an: z.number().min(0.3).max(3).optional(), al: z.number().min(0.3).max(3).optional(),
    dt: roofDesignSchema.nullable().optional(),
  }),
  a: z.record(z.string(), z.unknown()),
  d: z.record(z.string(), z.unknown()).nullish(),
})

function proposalWith(t: Partial<QuotationData['technical']>, p: Partial<QuotationData['project']> = {}): QuotationData {
  return {
    id: 'x', created_at: 'x', updated_at: 'x', status: 'sent',
    client: { ...initialClientData, nombre: 'Juan', direccion: 'Calle 1' },
    project: { ...initialProjectData, ...p },
    technical: { ...initialTechnicalData, consumo_mensual_kwh: 800, ...t },
    advanced: { ...initialAdvancedData },
    results: null,
    docuseal: undefined as unknown as QuotationData['docuseal'],
    drive_folder_link: null, drive_project_name: null,
  }
}

// The bug: NaN serializes to JSON null, and the gate's z.number()/.optional()
// reject null. After serialization these must round-trip and still validate.
const overWire = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

describe('toPayload sanitizes non-finite numbers so the share gate accepts it', () => {
  it('NaN ancho_m / alto_m -> finite defaults, gate passes', () => {
    const payload = overWire(toPayload(proposalWith({ ancho_m: NaN, alto_m: NaN })))
    expect(payload.t.an).toBe(1.13)
    expect(payload.t.al).toBe(2.38)
    expect(singlePayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('Infinity in core technical numbers -> finite, gate passes', () => {
    const payload = overWire(toPayload(proposalWith({ consumo_mensual_kwh: Infinity, potencia_panel_w: NaN, factor_seguridad: NaN })))
    expect(Number.isFinite(payload.t.co)).toBe(true)
    expect(Number.isFinite(payload.t.pw)).toBe(true)
    expect(Number.isFinite(payload.t.fs)).toBe(true)
    expect(singlePayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('NaN inside a roof design geometry -> sanitized, gate passes', () => {
    const roof: RoofDesign = {
      areas: [{ id: 'a1', vertices: [{ lat: 6.2, lng: -75.5 }, { lat: NaN, lng: -75.5 }, { lat: 6.21, lng: -75.49 }], area_m2: NaN, panels: [{ lat: NaN, lng: -75.49 }], rotation_deg: NaN, row_gap_m: 0.7 }],
      total_panels: 274, total_area_m2: NaN, orientacion: 'vertical', snapshot_data_url: 'data:image/jpeg;base64,AAAA', updated_at: 'x',
    }
    const payload = overWire(toPayload(proposalWith({ diseno_techo: roof })))
    expect(singlePayloadSchema.safeParse(payload).success).toBe(true)
  })

  it('malformed hsp (wrong length / NaN element) collapses to null, gate passes', () => {
    const p1 = overWire(toPayload(proposalWith({}, { hsp_mensual_pvgis: [1, 2, 3] })))
    expect(p1.p.h).toBeNull()
    expect(singlePayloadSchema.safeParse(p1).success).toBe(true)
    const p2 = overWire(toPayload(proposalWith({}, { hsp_mensual_pvgis: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, NaN] })))
    expect(p2.p.h).toBeNull()
    expect(singlePayloadSchema.safeParse(p2).success).toBe(true)
  })

  it('a healthy proposal still round-trips with finite values untouched', () => {
    const payload = overWire(toPayload(proposalWith({ ancho_m: 1.0, alto_m: 2.0 }, { hsp_mensual_pvgis: Array(12).fill(4.5) })))
    expect(payload.t.an).toBe(1.0)
    expect(payload.t.al).toBe(2.0)
    expect(payload.p.h).toHaveLength(12)
    expect(singlePayloadSchema.safeParse(payload).success).toBe(true)
  })
})

describe('fromPayload id + status derivation (signing loop, roadmap #10/#13)', () => {
  it('derives a real s:<shareId> id and share_id', () => {
    const payload = toPayload(proposalWith({}))
    const restored = fromPayload(payload, 'abc123XY')
    expect(restored.id).toBe('s:abc123XY')
    expect(restored.share_id).toBe('abc123XY')
    expect(restored.status).toBe('sent')
  })

  it('falls back to the legacy constant without a share id', () => {
    const restored = fromPayload(toPayload(proposalWith({})))
    expect(restored.id).toBe('shared')
    expect(restored.share_id).toBeNull()
  })

  it('marks the proposal accepted when the stored docuseal state is completed', () => {
    const proposal = proposalWith({})
    proposal.docuseal = {
      submission_id: 1,
      submitter_id: 2,
      submitter_slug: 'slug',
      embed_src: 'https://docuseal.com/s/slug',
      status: 'completed',
      document_url: null,
      audit_log_url: null,
      completed_at: new Date().toISOString(),
      declined_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const restored = fromPayload(toPayload(proposal), 'zz11ZZ22')
    expect(restored.status).toBe('accepted')
    expect(restored.docuseal?.status).toBe('completed')
  })
})
