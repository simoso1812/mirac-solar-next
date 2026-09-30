/**
 * Project cost estimation — single linear correlation on price
 * (Simon 2026-09-30): Precio ≈ 10.67M + 2.69M × kWp, and the quoted price
 * is that correlation plus a 5% margin.
 */
import { DEFAULT_PARAMS } from '@/lib/constants'

export type PriceSegment = 'small' | 'medium' | 'large'

export interface PriceEstimate {
  price: number
  pricePerKwp: number
  segment: PriceSegment
  segmentLabel: string
}

const PRICE_INTERCEPT = 10_670_000
const PRICE_SLOPE_PER_KWP = 2_690_000
const PRICE_MARKUP = 1.05

/**
 * Estimate total project price in COP for a given system size.
 */
export function estimatePrice(kwp: number): number {
  if (kwp <= 0) throw new Error('kWp debe ser mayor a 0')
  return Math.ceil((PRICE_INTERCEPT + PRICE_SLOPE_PER_KWP * kwp) * PRICE_MARKUP)
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

  if (kwp < 10) {
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
