/**
 * Boundary tests for the 3-segment cost model, inverter recommendation and
 * carbon metrics. The estimatePrice values are pinned deliberately: the raw
 * segments meet with a jump (~9.2M COP at 50 kWp), so estimatePrice blends
 * linearly between the adjacent segment predictions inside the 9-11 and
 * 45-55 kWp bands (decision: Simon, 2026-07-06). Any recalibration of the
 * coefficients or the bands must show up as an explicit diff in this file,
 * never as a silent change.
 */
import { describe, it, expect } from 'vitest'
import { estimatePrice } from '../cost'
import { recomendarInversor } from '../inverter'
import { calculateEmissionsAvoided } from '../carbon'

describe('estimatePrice segments and blend bands', () => {
  it('pins pure-segment values outside the blend bands (unchanged by blending)', () => {
    expect(estimatePrice(5)).toBe(25_484_548) // small
    expect(estimatePrice(20)).toBe(64_686_202) // medium
    expect(estimatePrice(80)).toBe(232_836_917) // large
  })

  it('pins blended values inside the 9-11 kWp band', () => {
    expect(estimatePrice(9)).toBe(33_357_115) // band start = pure small
    expect(estimatePrice(10)).toBe(35_782_199) // 50/50 small-medium mix
    expect(estimatePrice(11)).toBe(39_111_985) // band end = pure medium
  })

  it('pins blended values inside the 45-55 kWp band', () => {
    expect(estimatePrice(45)).toBe(135_725_691) // band start = pure medium
    expect(estimatePrice(50)).toBe(154_501_129) // 50/50 medium-large mix
    expect(estimatePrice(55)).toBe(171_363_377) // band end = pure large
  })

  it('is continuous: no COP jump for a marginal kWp change near the boundaries', () => {
    // The pre-blend model jumped ~9.2M COP between 50 and 50.01 kWp. Assert
    // small steps everywhere around both former discontinuities.
    for (const [lo, hi] of [[8.5, 11.5], [44.5, 55.5]]) {
      for (let k = lo; k < hi; k += 0.01) {
        expect(Math.abs(estimatePrice(k + 0.01) - estimatePrice(k))).toBeLessThan(100_000)
      }
    }
  })

  it('is monotonically increasing across the blend bands', () => {
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
