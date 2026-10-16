import { describe, expect, it } from 'vitest'
import { summarize } from '@/lib/mcp/quote'
import { deepMerge, initialAdvancedData, initialClientData, initialProjectData, initialTechnicalData } from '@/lib/defaults'

function fuenteFor(hsp: number[] | null) {
  const { structured } = summarize({
    client: initialClientData,
    project: deepMerge(initialProjectData, { hsp_mensual_pvgis: hsp }),
    technical: deepMerge(initialTechnicalData, { consumo_mensual_kwh: 500 }),
    advanced: initialAdvancedData,
  })
  return structured.supuestos.hsp_fuente
}

describe('summarize hsp_fuente without fetch metadata', () => {
  it('labels a stored 12-value vector estimada', () => {
    expect(fuenteFor(Array(12).fill(5))).toBe('estimada')
  })

  it('labels a vector the engine ignores as ciudad', () => {
    expect(fuenteFor(Array(228).fill(5))).toBe('ciudad')
  })
})
