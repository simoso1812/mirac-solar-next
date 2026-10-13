import { describe, expect, it } from 'vitest'
import {
  paybackSimpleAnios,
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
