/**
 * Boundary tests for the 3-segment cost model, inverter recommendation and
 * carbon metrics. The estimatePrice values are pinned deliberately: the model
 * has a known discontinuity at the 50 kWp segment boundary (~9.2M COP jump),
 * so any recalibration of the coefficients must show up as an explicit diff
 * in this file, never as a silent change.
 */
import { describe, it, expect } from 'vitest'
import { estimatePrice } from '../cost'
import { recomendarInversor } from '../inverter'
import { calculateEmissionsAvoided } from '../carbon'

describe('estimatePrice segment boundaries', () => {
  it('pins the small-segment value just below 10 kWp', () => {
    expect(estimatePrice(9.99)).toBe(35_274_663)
  })

  it('pins the medium-segment value at 10 kWp', () => {
    expect(estimatePrice(10)).toBe(36_270_406)
  })

  it('pins the medium-segment value at 50 kWp', () => {
    expect(estimatePrice(50)).toBe(149_933_589)
  })

  it('pins the large-segment value just above 50 kWp (known ~9.2M discontinuity)', () => {
    expect(estimatePrice(50.01)).toBe(159_093_259)
    // Document the discontinuity: the large segment starts well above where
    // the medium segment ends. Recalibration decision pending (Simon).
    expect(estimatePrice(50.01) - estimatePrice(50)).toBeGreaterThan(9_000_000)
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
