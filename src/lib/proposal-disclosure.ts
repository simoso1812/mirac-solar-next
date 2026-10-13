export type ModoConexion = 'net_metering' | 'net_billing' | 'autoconsumo'

export function paybackSimpleAnios(inversionCop: number, ahorroAnualCop: number): number | null {
  if (!Number.isFinite(inversionCop) || inversionCop <= 0) return null
  if (!Number.isFinite(ahorroAnualCop) || ahorroAnualCop <= 0) return null
  return inversionCop / ahorroAnualCop
}

export function textoModoConexion(modo: ModoConexion, precioExcedentes: number): string {
  if (modo === 'net_billing') {
    const precio = Math.round(precioExcedentes).toLocaleString('es-CO')
    return `Excedentes a ${precio} COP/kWh (net billing).`
  }
  if (modo === 'autoconsumo') return 'Sin crédito por excedentes (autoconsumo).'
  return 'Excedentes al mismo precio de la tarifa (net metering 1:1).'
}

export function textoBeneficios(
  incluirDeduccionRenta: boolean,
  incluirDepreciacionAcelerada: boolean,
): string | null {
  if (!incluirDeduccionRenta && !incluirDepreciacionAcelerada) return null
  return 'La TIR y el payback del motor incluyen deducción de renta y/o depreciación acelerada (Ley 1715). El payback simple es inversión ÷ ahorro del año 1, sin ese escudo.'
}
