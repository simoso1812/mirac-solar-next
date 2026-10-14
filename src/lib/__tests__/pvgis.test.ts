import { describe, expect, it } from 'vitest'
import { processPVGISData, pvgisUrl } from '@/lib/pvgis'

const DIAS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function poaPayload(daily: number[]): Record<string, unknown> {
  return {
    outputs: {
      monthly: daily.map((hsp, i) => ({ month: i + 1, 'H(i)_m': hsp * DIAS[i] })),
    },
  }
}

describe('pvgisUrl', () => {
  it('asks for a 10 degree plane and does not request horizontal irradiance', () => {
    const url = pvgisUrl(6.252, -75.014)
    expect(url).toContain('angle=10')
    expect(url).toContain('aspect=0')
    expect(url).not.toContain('horirrad')
  })

  it('requests the selected-inclination output, without which MRcalc returns no H(i)_m', () => {
    expect(pvgisUrl(6.252, -75.014)).toContain('selectrad=1')
  })
})

describe('processPVGISData', () => {
  it('reads inclined-plane H(i)_m and labels a complete year pvgis_poa', () => {
    const parsed = processPVGISData(poaPayload(Array(12).fill(5.38)), 6.252, -75.014)
    expect(parsed?.source).toBe('pvgis_poa')
    expect(parsed!.hsp.every((v) => Math.abs(v - 5.38) < 0.02)).toBe(true)
  })

  it('does not call horizontal H(h)_m a POA result', () => {
    const data = {
      outputs: {
        monthly: DIAS.map((d, i) => ({ month: i + 1, 'H(h)_m': 4.38 * d })),
      },
    }
    const parsed = processPVGISData(data, 6.252, -75.014)
    expect(parsed?.source).toBe('estimada')
  })

  it('labels a year with a missing month as estimada', () => {
    const daily = Array(12).fill(5.38)
    const payload = poaPayload(daily)
    const monthly = (payload.outputs as { monthly: Record<string, unknown>[] }).monthly
    delete monthly[3]['H(i)_m']
    const parsed = processPVGISData(payload, 6.252, -75.014)
    expect(parsed?.source).toBe('estimada')
    expect(parsed?.hsp).toHaveLength(12)
  })

  it('averages the per-year rows MRcalc returns into 12 monthly values', () => {
    const rows = [2005, 2006].flatMap((year, y) =>
      DIAS.map((d, i) => ({ year, month: i + 1, 'H(i)_m': (y === 0 ? 5 : 6) * d })),
    )
    const parsed = processPVGISData({ outputs: { monthly: rows } }, 6.252, -75.014)
    expect(parsed?.source).toBe('pvgis_poa')
    expect(parsed?.hsp).toHaveLength(12)
    expect(parsed!.hsp.every((v) => v === 5.5)).toBe(true)
  })
})
