/**
 * Cost calculation — ported from calcular_costo_por_kwp()
 */
import { DEFAULT_PARAMS } from '@/lib/constants'

interface CostParams {
  costo_pequeno_coef_a?: number
  costo_pequeno_coef_b?: number
  costo_grande_coef_a?: number
  costo_grande_coef_b?: number
  costo_grande_coef_c?: number
  costo_grande_coef_d?: number
  ajuste_cubierta_teja?: number
}

function getParam<K extends keyof typeof DEFAULT_PARAMS>(
  key: K,
  custom?: Partial<CostParams>
): number {
  if (custom && key in custom) return (custom as Record<string, number>)[key]
  return DEFAULT_PARAMS[key] as number
}

/**
 * Calculate cost per kWp based on system size
 * - <20 kW: power law (a * size^b) based on 42 data points
 * - >=20 kW: cubic polynomial (ax³+bx²+cx+d) based on 38 projects
 */
export function calcularCostoPorKwp(sizeKwp: number, customParams?: CostParams): number {
  if (sizeKwp < 20) {
    const a = getParam('costo_pequeno_coef_a', customParams)
    const b = getParam('costo_pequeno_coef_b', customParams)
    return a * Math.pow(sizeKwp, b)
  } else {
    const a = getParam('costo_grande_coef_a', customParams)
    const b = getParam('costo_grande_coef_b', customParams)
    const c = getParam('costo_grande_coef_c', customParams)
    const d = getParam('costo_grande_coef_d', customParams)
    return a * Math.pow(sizeKwp, 3) + b * Math.pow(sizeKwp, 2) + c * sizeKwp + d
  }
}

/**
 * Calculate total project cost with optional roof adjustment
 */
export function calcularCostoProyecto(
  sizeKwp: number,
  cubierta: string,
  customParams?: CostParams
): { costoPorKwp: number; costoTotal: number } {
  const costoPorKwp = calcularCostoPorKwp(sizeKwp, customParams)
  let costoTotal = costoPorKwp * sizeKwp
  const ajusteTeja = getParam('ajuste_cubierta_teja', customParams)

  if (cubierta.trim().toUpperCase() === 'TEJA') {
    costoTotal *= ajusteTeja
  }

  return { costoPorKwp, costoTotal: Math.ceil(costoTotal) }
}
