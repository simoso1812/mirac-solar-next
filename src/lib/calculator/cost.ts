/**
 * Project cost estimation (Simon 2026-09-30):
 *   <= 20 kWp: linear correlation + 5% margin — (10.67M + 2.69M × kWp) × 1.05
 *   > 20 kWp:  previous calibrated model — linear 2.84M × kWp + 7.85M up to
 *              50 kWp, linear 2.46M × kWp + 36.12M above.
 * Blend bands (18-22 and 45-55 kWp) interpolate linearly between adjacent
 * models so quotes stay continuous (raw jump is ~3M at 20, ~9.2M at 50).
 */
import { DEFAULT_PARAMS } from '@/lib/constants'

export type PriceSegment = 'small' | 'medium' | 'large'

export interface PriceEstimate {
  price: number
  pricePerKwp: number
  segment: PriceSegment
  segmentLabel: string
}

function priceSmall(kwp: number): number {
  return (10_670_000 + 2_690_000 * kwp) * 1.05
}
function priceMedium(kwp: number): number {
  return 2_841_579.58 * kwp + 7_854_609.55
}
function priceLarge(kwp: number): number {
  return 2_458_941.57 * kwp + 36_121_590.48
}

const BLEND_SMALL_MEDIUM: [number, number] = [18, 22]
const BLEND_MEDIUM_LARGE: [number, number] = [45, 55]

function blend(kwp: number, [lo, hi]: [number, number], fLo: (k: number) => number, fHi: (k: number) => number): number {
  const w = (kwp - lo) / (hi - lo)
  return (1 - w) * fLo(kwp) + w * fHi(kwp)
}

/**
 * Estimate total project price in COP for a given system size.
 */
export function estimatePrice(kwp: number): number {
  if (kwp <= 0) throw new Error('kWp debe ser mayor a 0')

  if (kwp < BLEND_SMALL_MEDIUM[0]) return Math.ceil(priceSmall(kwp))
  if (kwp <= BLEND_SMALL_MEDIUM[1]) return Math.ceil(blend(kwp, BLEND_SMALL_MEDIUM, priceSmall, priceMedium))
  if (kwp < BLEND_MEDIUM_LARGE[0]) return Math.ceil(priceMedium(kwp))
  if (kwp <= BLEND_MEDIUM_LARGE[1]) return Math.ceil(blend(kwp, BLEND_MEDIUM_LARGE, priceMedium, priceLarge))
  return Math.ceil(priceLarge(kwp))
}

/**
 * Estimate COP per kWp for a given system size.
 */
export function estimatePricePerKwp(kwp: number): number {
  return Math.ceil(estimatePrice(kwp) / kwp)
}

/**
 * Full estimate with a size-segment label (display only).
 */
export function getFullEstimate(kwp: number): PriceEstimate {
  const price = estimatePrice(kwp)
  const pricePerKwp = Math.ceil(price / kwp)

  let segment: PriceSegment
  let segmentLabel: string

  if (kwp <= 20) {
    segment = 'small'
    segmentLabel = 'Pequeño'
  } else if (kwp <= 50) {
    segment = 'medium'
    segmentLabel = 'Mediano'
  } else {
    segment = 'large'
    segmentLabel = 'Grande'
  }

  return { price, pricePerKwp, segment, segmentLabel }
}

// ---------------------------------------------------------------------------
// Legacy wrapper used by the calculator engine
// ---------------------------------------------------------------------------

/**
 * @deprecated Use estimatePrice() or estimatePricePerKwp() directly.
 * Kept for backwards compat with calcularCostoProyecto.
 */
export function calcularCostoPorKwp(sizeKwp: number): number {
  if (sizeKwp <= 0) return 0
  return estimatePricePerKwp(sizeKwp)
}

/**
 * Calculate total project cost with optional roof adjustment.
 */
export function calcularCostoProyecto(
  sizeKwp: number,
  cubierta: string,
): { costoPorKwp: number; costoTotal: number } {
  const price = estimatePrice(sizeKwp)
  let costoTotal = price

  if (cubierta.trim().toUpperCase() === 'TEJA') {
    costoTotal = Math.ceil(costoTotal * DEFAULT_PARAMS.ajuste_cubierta_teja)
  }

  return { costoPorKwp: Math.ceil(costoTotal / sizeKwp), costoTotal }
}
