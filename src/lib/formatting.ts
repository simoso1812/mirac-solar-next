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
