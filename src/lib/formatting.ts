/**
 * Formatting utilities for Colombian currency and numbers
 */

/** Round up to nearest 100 */
function ceilTo100(value: number): number {
  return Math.ceil(value / 100) * 100
}

/** Format COP currency with ceil-to-100 rounding */
export function formatCOP(value: number, round = true): string {
  const v = round ? ceilTo100(value) : value
  return `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`
}

/** Format COP without the "COP" suffix */
export function formatCOPShort(value: number, round = true): string {
  const v = round ? ceilTo100(value) : value
  return `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

/** Format large COP amounts in millions */
export function formatCOPMillones(value: number): string {
  const millones = value / 1_000_000
  if (millones >= 1) {
    return `$${millones.toFixed(1)}M COP`
  }
  return formatCOP(value)
}

/** Format kWh values */
export function formatKWh(value: number, decimals = 0): string {
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: decimals })} kWh`
}

/** Format kWp values */
export function formatKWp(value: number, decimals = 2): string {
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: decimals })} kWp`
}

/** Format percentage */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/** Format carbon numbers with appropriate units */
export function formatCarbon(value: number, unit: 'kg' | 'ton' = 'kg', decimals = 1): string {
  if (unit === 'kg' && value >= 1000) {
    return `${(value / 1000).toFixed(decimals)} ton`
  }
  if (unit === 'ton' && value < 1) {
    return `${(value * 1000).toFixed(0)} kg`
  }
  return `${value.toFixed(decimals)} ${unit}`
}

/** Format number with thousand separators */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('es-CO', { maximumFractionDigits: decimals })
}

/** Days an offer stays valid after its emission date */
export const OFERTA_VALIDEZ_DIAS = 30

/** Offer expiry date: fecha de emisión + 30 días. Null when the date is invalid. */
export function ofertaValidezHasta(fechaIso: string): Date | null {
  // project.fecha is a date-only string (YYYY-MM-DD); parse it as a local
  // calendar date — new Date('YYYY-MM-DD') is UTC midnight and shifts a day
  // back in Colombia (UTC-5).
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaIso)
  const fecha = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(fechaIso)
  if (isNaN(fecha.getTime())) return null
  fecha.setDate(fecha.getDate() + OFERTA_VALIDEZ_DIAS)
  return fecha
}

/** Long-form Spanish date, e.g. "5 de agosto de 2026" */
export function formatFechaLarga(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}
