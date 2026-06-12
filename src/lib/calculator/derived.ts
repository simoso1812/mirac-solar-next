/**
 * Display-layer financial math derived from CalculationResults.
 *
 * Single source of truth for formulas that the presentation layer
 * (virtual quotation sections and the PDF) derives from engine output.
 * Each formula must exist exactly once — consumers destructure these
 * helpers instead of re-implementing the math inline.
 */
import { PROMEDIOS_COSTO } from '@/lib/constants'
import type { CalculationResults, PpaOption } from '@/lib/types'

export interface IvaBreakdown {
  /** Total project cost net of IVA */
  costoSinIVA: number
  /** IVA portion of the total */
  valorIVA: number
  /** Total project cost (IVA included) — mirrors r.costo_total_cop */
  total: number
  /** Annual O&M estimate */
  omAnual: number
  /** Battery cost (IVA included); 0 when no battery is enabled */
  costoBateria: number
  /** Battery cost net of IVA */
  bateriaSinIVA: number
  /** PV system cost net of IVA (total sin IVA minus battery sin IVA) */
  costoFvSinIVA: number
}

/** IVA / O&M / battery cost breakdown shown in the pricing table and the PDF. */
export function ivaBreakdown(r: CalculationResults): IvaBreakdown {
  const costoSinIVA = r.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
  const valorIVA = r.costo_total_cop - costoSinIVA
  // 2% of CAPEX — keep in sync with DEFAULT_PARAMS.porcentaje_om_anual in constants.ts
  const omAnual = r.costo_total_cop * 0.02
  const costoBateria = r.bateria?.habilitada ? r.bateria.costo_cop : 0
  const bateriaSinIVA = costoBateria / (1 + PROMEDIOS_COSTO.iva_rate)
  const costoFvSinIVA = costoSinIVA - bateriaSinIVA
  return {
    costoSinIVA,
    valorIVA,
    total: r.costo_total_cop,
    omAnual,
    costoBateria,
    bateriaSinIVA,
    costoFvSinIVA,
  }
}

export interface PpaOptionMetrics {
  precio_kwh: number
  duracion_anios: number
  /** Savings per kWh vs the utility tariff (never negative) */
  ahorroPorKwh: number
  /** Savings vs the utility tariff, rounded percentage (0-100) */
  porcentajeAhorro: number
  /** Annual savings in COP */
  ahorroAnual: number
  /** Total savings over the contract duration in COP */
  ahorroTotal: number
  /** Annual payment to Mirac in COP */
  pagoMiracAnual: number
  /** Monthly payment to Mirac in COP */
  pagoMiracMensual: number
}

/**
 * Per-option PPA metrics derived from the utility tariff (costoKwh) and
 * annual generation. Used by the virtual PPA section and the PDF PPA page.
 */
export function ppaMetrics(
  costoKwh: number,
  generacionAnualKwh: number,
  opciones: PpaOption[],
): PpaOptionMetrics[] {
  return opciones.map((opt) => {
    const ahorroPorKwh = Math.max(0, costoKwh - opt.precio_kwh)
    const porcentajeAhorro = costoKwh > 0 ? Math.round((ahorroPorKwh / costoKwh) * 100) : 0
    const ahorroAnual = Math.round(generacionAnualKwh * ahorroPorKwh)
    const ahorroTotal = ahorroAnual * opt.duracion_anios
    const pagoMiracAnual = Math.round(generacionAnualKwh * opt.precio_kwh)
    const pagoMiracMensual = Math.round(pagoMiracAnual / 12)
    return {
      precio_kwh: opt.precio_kwh,
      duracion_anios: opt.duracion_anios,
      ahorroPorKwh,
      porcentajeAhorro,
      ahorroAnual,
      ahorroTotal,
      pagoMiracAnual,
      pagoMiracMensual,
    }
  })
}
