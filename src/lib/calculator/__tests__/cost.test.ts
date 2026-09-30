/**
 * Pins the linear cost model (Simon 2026-09-30):
 * precio = (10.67M + 2.69M × kWp) × 1.05. Any recalibration must show up as
 * an explicit diff in this file, never as a silent change. Also covers
 * inverter recommendation and carbon metrics.
 */
import { describe, it, expect } from 'vitest'
import { estimatePrice } from '../cost'
import { recomendarInversor } from '../inverter'
import { calculateEmissionsAvoided } from '../carbon'

describe('estimatePrice linear model + 5%', () => {
  it('pins values', () => {
    expect(estimatePrice(10)).toBe(39_448_500) // 37.57M × 1.05
    expect(estimatePrice(5)).toBe(25_326_000)
    expect(estimatePrice(50)).toBe(152_428_500)
  })

  it('is monotonically increasing', () => {
    let prev = estimatePrice(1)
    for (let k = 1.5; k <= 100; k += 0.5) {
      const p = estimatePrice(k)
      expect(p).toBeGreaterThan(prev)
      prev = p
    }
  })

  it('throws for kwp <= 0', () => {
    expect(() => estimatePrice(0)).toThrow()
    expect(() => estimatePrice(-5)).toThrow()
  })
})

describe('recomendarInversor', () => {
  // Margin rules from calcularMargenInversor: <20 kWp -> 20%, <50 -> 25%,
  // <100 -> 30%, >=100 -> 35%. Assertions stay loose on purpose.
  const cases: Array<{ kwp: number; margen: number }> = [
    { kwp: 5, margen: 0.2 },
    { kwp: 12, margen: 0.2 },
    { kwp: 60, margen: 0.3 },
    { kwp: 120, margen: 0.35 },
  ]

  for (const { kwp, margen } of cases) {
    it(`returns a sane combo for ${kwp} kWp`, () => {
      const result = recomendarInversor(kwp)
      expect(result.totalPower).toBeGreaterThan(0)
      // maxPower = floor(sizeKwp), so AC power never exceeds the DC size
      expect(result.totalPower).toBeLessThanOrEqual(kwp)
      expect(result.totalPower).toBeGreaterThanOrEqual(kwp * (1 - margen))
      // Combo is consistent with the reported total power
      const comboTotal = Object.entries(result.combo).reduce(
        (sum, [kw, count]) => sum + Number(kw) * count,
        0,
      )
      expect(comboTotal).toBe(result.totalPower)
      expect(result.label.length).toBeGreaterThan(0)
    })
  }
})

describe('calculateEmissionsAvoided', () => {
  it('returns positive tons for positive generation', () => {
    const m = calculateEmissionsAvoided(10_000)
    expect(m.annual_co2_avoided_tons).toBeGreaterThan(0)
    expect(m.lifetime_co2_avoided_tons).toBeGreaterThan(0)
    expect(m.lifetime_co2_avoided_tons).toBeGreaterThan(m.annual_co2_avoided_tons)
  })

  it('scales linearly with generation', () => {
    const base = calculateEmissionsAvoided(10_000)
    const double = calculateEmissionsAvoided(20_000)
    expect(double.annual_co2_avoided_kg).toBeCloseTo(base.annual_co2_avoided_kg * 2, 6)
    expect(double.lifetime_co2_avoided_kg).toBeCloseTo(base.lifetime_co2_avoided_kg * 2, 6)
  })

  it('returns zeroed metrics for non-positive generation', () => {
    const m = calculateEmissionsAvoided(0)
    expect(m.annual_co2_avoided_tons).toBe(0)
    expect(m.lifetime_co2_avoided_tons).toBe(0)
  })
})
