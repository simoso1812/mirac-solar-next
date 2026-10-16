import { describe, expect, it } from 'vitest'
import { cogsSugerido, type PrecioInversor, type PrecioModulo } from '@/lib/equipment-prices'

const modulos: PrecioModulo[] = [
  { producto: 'Modulo A', wp: 720, proveedor: 'P1', precioCop: 388_800, cotizado: '2026-09-20' },
  { producto: 'Modulo B', wp: 625, proveedor: 'P2', precioCop: 357_500, cotizado: '2026-09-20' },
]
const inversores: PrecioInversor[] = [
  { producto: 'Red 10K', kw: 10, tipo: 'on_grid', proveedor: 'P1', precioCop: 4_000_000, cotizado: '2026-09-20' },
  { producto: 'Red 12K', kw: 12, tipo: 'on_grid', proveedor: 'P2', precioCop: 3_800_000, cotizado: '2026-09-20' },
  { producto: 'Red 5K', kw: 5, tipo: 'on_grid', proveedor: 'P1', precioCop: 1_500_000, cotizado: '2026-09-20' },
  { producto: 'Hibrido 10K', kw: 10, tipo: 'hibrido', proveedor: 'P3', precioCop: 7_000_000, cotizado: '2026-08-01' },
]
const HOY = new Date('2026-10-14')

describe('cogsSugerido', () => {
  it('uses the cheapest COP/Wp module and a whole number of panels', () => {
    const r = cogsSugerido(10, false, HOY, modulos, inversores)
    expect(r?.modulo.producto).toBe('Modulo A')
    expect(r?.modulosCop).toBe(14 * 388_800)
  })

  it('picks the cheapest single on-grid inverter at least as large as the array', () => {
    const r = cogsSugerido(9.5, false, HOY, modulos, inversores)
    expect(r?.inversor?.producto).toBe('Red 12K')
    expect(r?.inversorCop).toBe(3_800_000)
  })

  it('uses a hybrid inverter when the quote has a battery', () => {
    const r = cogsSugerido(9.5, true, HOY, modulos, inversores)
    expect(r?.inversor?.tipo).toBe('hibrido')
    expect(r?.inversorCop).toBe(7_000_000)
  })

  it('leaves the inverter blank when no single unit covers the array, but still suggests modules', () => {
    const r = cogsSugerido(30, false, HOY, modulos, inversores)
    expect(r?.inversor).toBeNull()
    expect(r?.inversorCop).toBeNull()
    expect(r?.modulosCop).toBe(Math.ceil(30_000 / 720) * 388_800)
  })

  it('leaves the inverter blank when there are no rows of the needed type', () => {
    const r = cogsSugerido(10, true, HOY, modulos, inversores.filter((i) => i.tipo === 'on_grid'))
    expect(r?.inversor).toBeNull()
    expect(r?.modulosCop).toBe(14 * 388_800)
  })

  it('flags a quote older than 60 days as an old reference', () => {
    expect(cogsSugerido(9.5, true, HOY, modulos, inversores)?.referenciaVieja).toBe(true)
    expect(cogsSugerido(9.5, false, HOY, modulos, inversores)?.referenciaVieja).toBe(false)
  })

  it('returns null without a positive size or without modules', () => {
    expect(cogsSugerido(0, false, HOY, modulos, inversores)).toBeNull()
    expect(cogsSugerido(10, false, HOY, [], inversores)).toBeNull()
  })
})
