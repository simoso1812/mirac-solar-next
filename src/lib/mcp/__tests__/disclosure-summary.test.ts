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
