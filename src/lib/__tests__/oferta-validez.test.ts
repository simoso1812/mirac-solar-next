import { describe, it, expect } from 'vitest'
import { OFERTA_VALIDEZ_DIAS, ofertaValidezDias, ofertaValidezHasta } from '../formatting'

describe('oferta validez', () => {
  it('new proposals are valid for 15 days', () => {
    expect(OFERTA_VALIDEZ_DIAS).toBe(15)
    expect(ofertaValidezDias('2026-10-17')).toBe(15)
    expect(ofertaValidezHasta('2026-10-17')).toEqual(new Date(2026, 10, 1))
  })

  it('proposals emitted before the cutover keep the 30 days they were sent with', () => {
    expect(ofertaValidezDias('2026-10-16')).toBe(30)
    expect(ofertaValidezHasta('2026-10-16')).toEqual(new Date(2026, 10, 15))
  })

  it('invalid dates have no expiry', () => {
    expect(ofertaValidezHasta('not-a-date')).toBeNull()
    expect(ofertaValidezDias('not-a-date')).toBe(15)
  })
})
