/**
 * EV Charger cost calculation
 * Takes a final price (IVA included) and back-calculates the breakdown.
 */

export interface ChargerCostBreakdown {
  subtotalAntesIva: number
  iva: number
  diseno: number
  materiales: number
  costoTotal: number
}

/**
 * Calculate charger cost breakdown from a total price (IVA included).
 * Subtotal = total / 1.19, IVA = total - subtotal
 */
export function cotizacionCargadoresCostos(precioTotal: number): ChargerCostBreakdown {
  const subtotalAntesIva = precioTotal / 1.19
  const iva = precioTotal - subtotalAntesIva
  const diseno = 0.35 * subtotalAntesIva
  const materiales = 0.65 * subtotalAntesIva

  return {
    subtotalAntesIva: Math.ceil(subtotalAntesIva),
    iva: Math.ceil(iva),
    diseno: Math.ceil(diseno),
    materiales: Math.ceil(materiales),
    costoTotal: Math.ceil(precioTotal),
  }
}

export interface MaterialItem {
  nombre: string
  cantidad: number
  unidad: string
}

/**
 * Calculate approximate materials list based on cable distance
 */
export function calcularMaterialesCargador(distanciaMetros: number): MaterialItem[] {
  const d = distanciaMetros
  return [
    { nombre: 'TUBERIA EMT 3/4 Pulg', cantidad: Math.round(d / 3) + 1, unidad: 'UNIDADES' },
    { nombre: 'UNION EMT 3/4 Pulg', cantidad: Math.round(d / 3) + Math.round(d / 6), unidad: 'UNIDADES' },
    { nombre: 'CURVA EMT 3/4 Pulg', cantidad: Math.round(d / 6), unidad: 'UNIDADES' },
    { nombre: 'ENTRADA CAJA EMT 3/4 Pulg', cantidad: 2, unidad: 'UNIDADES' },
    { nombre: 'CABLE 8 AWG NEGRO', cantidad: Math.round(d + 3) * 2, unidad: 'METROS' },
    { nombre: 'CABLE 8 AWG VERDE', cantidad: Math.round(d + 3), unidad: 'METROS' },
    { nombre: 'CAJA DEXSON 18X14', cantidad: 1, unidad: 'UNIDAD' },
  ]
}
