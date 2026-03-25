/**
 * EV Charger cost calculation — ported from chargers.py
 */

export interface ChargerCostBreakdown {
  costoBase: number
  aiu: number
  subtotalAntesIva: number
  iva: number
  diseno: number
  materiales: number
  costoTotal: number
}

/**
 * Calculate charger installation costs based on cable distance
 * Formula: base = (63640 * distance + 857195) * 1.1
 * Then: +20% AIU, +19% IVA
 */
export function cotizacionCargadoresCostos(
  distanciaMetros: number,
  precioManual?: number | null
): ChargerCostBreakdown {
  let costoBase: number
  let subtotalAntesIva: number
  let iva: number
  let costoTotal: number

  if (precioManual && precioManual > 0) {
    // Reverse calculation from total
    costoTotal = precioManual
    subtotalAntesIva = costoTotal / 1.19
    iva = subtotalAntesIva * 0.19
    costoBase = subtotalAntesIva / 1.20
  } else {
    // Normal calculation from distance
    costoBase = (63640 * distanciaMetros + 857195) * 1.1
    const primaAiu = costoBase * 0.20
    subtotalAntesIva = costoBase + primaAiu
    iva = subtotalAntesIva * 0.19
    costoTotal = subtotalAntesIva + iva
  }

  const diseno = 0.35 * subtotalAntesIva
  const materiales = 0.65 * subtotalAntesIva
  const aiu = subtotalAntesIva - costoBase

  return {
    costoBase: Math.ceil(costoBase),
    aiu: Math.ceil(aiu),
    subtotalAntesIva: Math.ceil(subtotalAntesIva),
    iva: Math.ceil(iva),
    diseno: Math.ceil(diseno),
    materiales: Math.ceil(materiales),
    costoTotal: Math.ceil(costoTotal),
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
