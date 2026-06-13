/**
 * Tests for the share codec (src/lib/share.ts toPayload/fromPayload).
 *
 * These functions are pure (no Redis/env): the network helpers that use
 * fetch live elsewhere in the module. We exercise only the encode/decode
 * round-trip so the new roof-designer technical fields (ancho_m, alto_m,
 * diseno_techo) survive a /s/ share link instead of being silently dropped.
 */
import { describe, it, expect } from 'vitest'
import { toPayload, fromPayload } from '@/lib/share'
import {
  initialAdvancedData,
  initialClientData,
  initialProjectData,
  initialTechnicalData,
} from '@/lib/defaults'
import type { QuotationData, RoofDesign } from '@/lib/types'

const roofDesign: RoofDesign = {
  areas: [
    {
      id: 'area-1',
      vertices: [
        { lat: 4.711, lng: -74.072 },
        { lat: 4.712, lng: -74.072 },
        { lat: 4.712, lng: -74.071 },
        { lat: 4.711, lng: -74.071 },
      ],
      area_m2: 120.5,
      panels: [
        { lat: 4.7113, lng: -74.0718 },
        { lat: 4.7115, lng: -74.0716 },
      ],
      rotation_deg: 30,
      row_gap_m: 0.4,
    },
  ],
  total_panels: 2,
  total_area_m2: 120.5,
  orientacion: 'vertical',
  snapshot_data_url: 'data:image/jpeg;base64,/9j/roof-snapshot',
  updated_at: '2026-06-13T00:00:00.000Z',
}

function makeProposal(): QuotationData {
  return {
    id: 'test',
    created_at: '2026-06-13T00:00:00.000Z',
    updated_at: '2026-06-13T00:00:00.000Z',
    status: 'sent',
    client: { ...initialClientData, nombre: 'Cliente Test', direccion: 'Calle 1' },
    project: { ...initialProjectData, ciudad: 'Bogotá', fecha: '2026-06-13' },
    technical: {
      ...initialTechnicalData,
      consumo_mensual_kwh: 500,
      ancho_m: 1.2,
      alto_m: 2.4,
      diseno_techo: roofDesign,
    },
    advanced: initialAdvancedData,
    results: null,
    drive_folder_link: null,
    drive_project_name: null,
  }
}

describe('share codec round-trip', () => {
  it('preserves the roof design and panel dimensions through toPayload/fromPayload', () => {
    const decoded = fromPayload(toPayload(makeProposal()))

    expect(decoded.technical.ancho_m).toBe(1.2)
    expect(decoded.technical.alto_m).toBe(2.4)
    expect(decoded.technical.diseno_techo).toEqual(roofDesign)
  })

  it('falls back to defaults for legacy payloads without the roof keys', () => {
    const payload = toPayload(makeProposal())
    delete payload.t.an
    delete payload.t.al
    delete payload.t.dt

    const decoded = fromPayload(payload)

    expect(decoded.technical.ancho_m).toBe(initialTechnicalData.ancho_m)
    expect(decoded.technical.alto_m).toBe(initialTechnicalData.alto_m)
    expect(decoded.technical.diseno_techo).toBeNull()
  })
})
