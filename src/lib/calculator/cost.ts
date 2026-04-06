/**
 * Project cost estimation — 3-segment model calibrated to 2025–2026
 * Colombian solar market (Mirac Energy dataset, n=80 projects).
 *
 * Segments:
 *   Small  (<10 kWp): Power law on COP/kWp + offset
 *   Medium (10–50 kWp): Linear on Price
 *   Large  (>50 kWp): Linear on Price
 */
import { DEFAULT_PARAMS } from '@/lib/constants'

export type PriceSegment = 'small' | 'medium' | 'large'

export interface PriceEstimate {
  price: number
  pricePerKwp: number
  segment: PriceSegment
  segmentLabel: string
  r2: number
}

/**
 * Estimate total project price in COP for a given system size.
 */
export function estimatePrice(kwp: number): number {
  if (kwp <= 0) throw new Error('kWp debe ser mayor a 0')

  if (kwp < 10) {
    // Segment 1 — Small: power law on COP/kWp
    const copPerKwp = 15_021_515.41 * Math.pow(kwp, -0.9522841) + 1_852_798.36
    return Math.ceil(copPerKwp * kwp)
  } else if (kwp <= 50) {
    // Segment 2 — Medium: linear on price
    return Math.ceil(2_841_579.58 * kwp + 7_854_609.55)
  } else {
    // Segment 3 — Large: linear on price
    return Math.ceil(2_458_941.57 * kwp + 36_121_590.48)
  }
}

/**
 * Estimate COP per kWp for a given system size.
 */
export function estimatePricePerKwp(kwp: number): number {
  return Math.ceil(estimatePrice(kwp) / kwp)
}

/**
 * Full estimate with segment info and R² confidence.
 */
export function getFullEstimate(kwp: number): PriceEstimate {
  const price = estimatePrice(kwp)
  const pricePerKwp = Math.ceil(price / kwp)

  let segment: PriceSegment
  let segmentLabel: string
  let r2: number

  if (kwp < 10) {
    segment = 'small'
    segmentLabel = 'Pequeño'
    r2 = 0.74
  } else if (kwp <= 50) {
    segment = 'medium'
    segmentLabel = 'Mediano'
    r2 = 0.71
  } else {
    segment = 'large'
    segmentLabel = 'Grande'
    r2 = 0.87
  }

  return { price, pricePerKwp, segment, segmentLabel, r2 }
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
