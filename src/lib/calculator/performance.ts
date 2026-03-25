/**
 * Performance ratio and clipping — ported from calculator_service.py
 */
import { DEFAULT_PARAMS } from '@/lib/constants'

/**
 * Calculate Performance Ratio (PR) based on climate and roof type
 */
export function calcularPerformanceRatio(
  clima: string,
  cubierta: string,
  prBase?: number
): number {
  let pr = prBase ?? DEFAULT_PARAMS.performance_ratio_base

  // Climate adjustment
  const climaUpper = clima.trim().toUpperCase()
  if (climaUpper === 'NUBE' || climaUpper === 'NUBLADO' || climaUpper === 'FRIO') {
    pr -= 0.05
  } else if (climaUpper === 'SOL' || climaUpper === 'CALIDO') {
    pr -= 0.02
  }

  // Roof type adjustment
  const cubiertaUpper = cubierta.trim().toUpperCase()
  if (cubiertaUpper === 'TEJA') {
    pr -= 0.01
  }

  return Math.round(pr * 1000) / 1000
}

/**
 * Estimate annual energy loss percentage due to clipping
 * based on DC/AC ratio (empirical approximation)
 */
export function calcularFactorClipping(dcAcRatio: number): number {
  if (dcAcRatio <= 1.05) return 0.0
  if (dcAcRatio <= 1.15) return 0.005
  if (dcAcRatio <= 1.25) return 0.015
  if (dcAcRatio <= 1.35) return 0.03
  return 0.05
}
