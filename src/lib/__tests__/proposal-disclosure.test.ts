import { describe, expect, it } from 'vitest'
import {
  margenBruto,
  MARGEN_MINIMO,
  paybackSimpleAnios,
  precioParaMargen,
  textoBeneficios,
  textoModoConexion,
} from '@/lib/proposal-disclosure'

describe('paybackSimpleAnios', () => {
  it('divides investment by year-1 savings', () => {
    expect(paybackSimpleAnios(37_000_000, 8_621_383)).toBeCloseTo(4.29, 2)
  })

  it('returns null when savings are not positive', () => {
    expect(paybackSimpleAnios(10_000_000, 0)).toBeNull()
    expect(paybackSimpleAnios(10_000_000, -1)).toBeNull()
  })
})

describe('textoModoConexion', () => {
  it('names net billing and the surplus price', () => {
    expect(textoModoConexion('net_billing', 300)).toBe(
      'Excedentes a 300 COP/kWh (net billing).',
    )
  })

  it('names 1:1 net metering', () => {
    expect(textoModoConexion('net_metering', 300)).toBe(
      'Excedentes al mismo precio de la tarifa (net metering 1:1).',
    )
  })

  it('names self-consumption', () => {
    expect(textoModoConexion('autoconsumo', 300)).toBe(
      'Sin crédito por excedentes (autoconsumo).',
    )
  })
})

describe('textoBeneficios', () => {
  it('returns null when both shields are off', () => {
    expect(textoBeneficios(false, false)).toBeNull()
  })

  it('explains the engine payback when either shield is on', () => {
    const text = textoBeneficios(true, false)
    expect(text).toContain('Ley 1715')
    expect(text).toContain('payback simple')
  })
})

describe('margenBruto', () => {
  it('returns null until all four costs are filled', () => {
    expect(margenBruto(40_000_000, [10_000_000, null, 3_000_000, 8_000_000])).toBeNull()
  })

  it('computes (price - cost) / price', () => {
    const r = margenBruto(40_000_000, [8_000_000, 6_000_000, 3_000_000, 5_000_000])
    expect(r?.costo).toBe(22_000_000)
    expect(r?.margen).toBeCloseTo(0.45, 2)
    expect(r!.margen < MARGEN_MINIMO).toBe(true)
  })

  it('returns null for a zero or NaN price', () => {
    expect(margenBruto(0, [1, 1, 1, 1])).toBeNull()
    expect(margenBruto(NaN, [1, 1, 1, 1])).toBeNull()
  })

  it('returns null when a part is negative', () => {
    expect(margenBruto(40_000_000, [8_000_000, -1, 3_000_000, 5_000_000])).toBeNull()
  })
})

describe('precioParaMargen', () => {
  const IVA = 0.07

  it('takes the curve total before IVA', () => {
    const p = precioParaMargen({ totalCurvaCop: 42_800_000, precioManualCop: null, costoBateriaCop: 0, medidorCop: 0 }, IVA)
    expect(p).toBeCloseTo(40_000_000, 0)
  })

  it('subtracts battery and meter from the curve total', () => {
    const p = precioParaMargen({ totalCurvaCop: 50_000_000, precioManualCop: null, costoBateriaCop: 5_900_000, medidorCop: 1_300_000 }, IVA)
    expect(p).toBeCloseTo(42_800_000 / 1.07, 0)
  })

  it('uses a positive manual price instead of the curve total', () => {
    const p = precioParaMargen({ totalCurvaCop: 50_000_000, precioManualCop: 32_100_000, costoBateriaCop: 0, medidorCop: 0 }, IVA)
    expect(p).toBeCloseTo(30_000_000, 0)
  })

  it('subtracts battery and meter from the manual price', () => {
    const p = precioParaMargen({ totalCurvaCop: 50_000_000, precioManualCop: 39_400_000, costoBateriaCop: 6_000_000, medidorCop: 1_300_000 }, IVA)
    expect(p).toBeCloseTo(30_000_000, 0)
  })
})
