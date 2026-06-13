/**
 * Tests for display-layer derived financial math (src/lib/calculator/derived.ts).
 *
 * These formulas feed the pricing table, the PPA section and the PDF.
 * Values are hand-computed so a change in any formula fails loudly.
 */
import { describe, it, expect } from 'vitest'
import { ivaBreakdown, ppaMetrics } from '@/lib/calculator/derived'
import type { CalculationResults } from '@/lib/types'

function makeResults(
  costoTotalCop: number,
  bateria?: { habilitada: boolean; costo_cop: number },
): CalculationResults {
  const partial: Partial<CalculationResults> = {
    costo_total_cop: costoTotalCop,
    bateria: bateria
      ? {
          habilitada: bateria.habilitada,
          capacidad_nominal_kwh: 10,
          capacidad_util_kwh: 9,
          profundidad_descarga: 0.9,
          eficiencia: 0.95,
          horas_autonomia: 4,
          costo_cop: bateria.costo_cop,
        }
      : null,
  }
  return partial as CalculationResults
}

describe('ivaBreakdown', () => {
  it('splits IVA and O&M without a battery (50M COP)', () => {
    const b = ivaBreakdown(makeResults(50_000_000))

    // 50_000_000 / 1.07
    expect(b.costoSinIVA).toBeCloseTo(46_728_971.962616824, 6)
    expect(b.valorIVA).toBeCloseTo(3_271_028.037383176, 6)
    expect(b.total).toBe(50_000_000)
    expect(b.omAnual).toBe(1_000_000) // 50M * 0.02
    expect(b.costoBateria).toBe(0)
    expect(b.bateriaSinIVA).toBe(0)
    // No battery: FV sin IVA equals total sin IVA
    expect(b.costoFvSinIVA).toBe(b.costoSinIVA)
  })

  it('separates battery cost when enabled (50M total, 10.7M battery)', () => {
    const b = ivaBreakdown(makeResults(50_000_000, { habilitada: true, costo_cop: 10_700_000 }))

    expect(b.costoSinIVA).toBeCloseTo(46_728_971.962616824, 6)
    expect(b.valorIVA).toBeCloseTo(3_271_028.037383176, 6)
    expect(b.omAnual).toBe(1_000_000)
    expect(b.costoBateria).toBe(10_700_000)
    expect(b.bateriaSinIVA).toBeCloseTo(10_000_000, 6) // 10_700_000 / 1.07
    expect(b.costoFvSinIVA).toBeCloseTo(36_728_971.962616824, 6)
    // The split must add back up to the pre-IVA total
    expect(b.costoFvSinIVA + b.bateriaSinIVA).toBeCloseTo(b.costoSinIVA, 6)
  })

  it('ignores a disabled battery', () => {
    const b = ivaBreakdown(makeResults(50_000_000, { habilitada: false, costo_cop: 10_700_000 }))

    expect(b.costoBateria).toBe(0)
    expect(b.bateriaSinIVA).toBe(0)
    expect(b.costoFvSinIVA).toBe(b.costoSinIVA)
  })
})

describe('ppaMetrics', () => {
  it('computes per-option metrics (tarifa 850, generación 12.000 kWh)', () => {
    const [a, b] = ppaMetrics(850, 12_000, [
      { precio_kwh: 600, duracion_anios: 12 },
      { precio_kwh: 550, duracion_anios: 15 },
    ])

    // Option 600 COP/kWh, 12 years
    expect(a.precio_kwh).toBe(600)
    expect(a.duracion_anios).toBe(12)
    expect(a.ahorroPorKwh).toBe(250) // 850 - 600
    expect(a.porcentajeAhorro).toBe(29) // round(250/850 * 100) = round(29.41)
    expect(a.ahorroAnual).toBe(3_000_000) // round(12_000 * 250)
    expect(a.ahorroTotal).toBe(36_000_000) // 3M * 12
    expect(a.pagoMiracAnual).toBe(7_200_000) // round(12_000 * 600)
    expect(a.pagoMiracMensual).toBe(600_000) // round(7.2M / 12)

    // Option 550 COP/kWh, 15 years
    expect(b.precio_kwh).toBe(550)
    expect(b.duracion_anios).toBe(15)
    expect(b.ahorroPorKwh).toBe(300) // 850 - 550
    expect(b.porcentajeAhorro).toBe(35) // round(300/850 * 100) = round(35.29)
    expect(b.ahorroAnual).toBe(3_600_000) // round(12_000 * 300)
    expect(b.ahorroTotal).toBe(54_000_000) // 3.6M * 15
    expect(b.pagoMiracAnual).toBe(6_600_000) // round(12_000 * 550)
    expect(b.pagoMiracMensual).toBe(550_000) // round(6.6M / 12)
  })

  it('clamps savings at zero when the PPA price exceeds the tariff', () => {
    const [m] = ppaMetrics(850, 12_000, [{ precio_kwh: 900, duracion_anios: 10 }])

    expect(m.ahorroPorKwh).toBe(0) // max(0, 850 - 900)
    expect(m.porcentajeAhorro).toBe(0)
    expect(m.ahorroAnual).toBe(0)
    expect(m.ahorroTotal).toBe(0)
    expect(m.pagoMiracAnual).toBe(10_800_000) // round(12_000 * 900)
    expect(m.pagoMiracMensual).toBe(900_000)
  })

  it('guards the percentage against a zero tariff', () => {
    const [m] = ppaMetrics(0, 12_000, [{ precio_kwh: 600, duracion_anios: 12 }])

    expect(m.ahorroPorKwh).toBe(0)
    expect(m.porcentajeAhorro).toBe(0) // no division by zero
    expect(m.pagoMiracAnual).toBe(7_200_000)
  })
})
