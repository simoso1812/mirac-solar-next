/**
 * Cash flow table formatting — thin layer over the shared year simulation
 * (engine.ts). This file no longer contains its own savings loop; it only
 * adds year 0, cumulative totals and partial TIR/VPN columns.
 */
import { irr as calcIrr, npv as calcNpv } from './financial'
import type { YearSim } from './engine'

export interface CashFlowRow {
  year: number
  inversion_inicial_cop: number
  generacion_anual_kwh: number
  consumo_anual_kwh: number
  excedentes_vendidos_kwh: number
  cobertura_consumo_pct: number
  costo_energia_indexado_cop_kwh: number
  ahorro_anual_cop: number
  ingresos_excedentes_cop: number
  mantenimiento_cop: number
  cuotas_credito_cop: number
  beneficio_tributario_total_cop: number
  flujo_neto_anual_cop: number
  flujo_acumulado_cop: number
  vpn_parcial_cop: number
  tir_parcial_pct: number
  degradacion_aplicada_pct: number
}

export interface CashFlowFormatParams {
  desembolsoInicial: number
  discountRate: number
  costkWh: number
  indexRate: number
  tasaDegradacion: number
}

export function generarFlujoCajaDetallado(
  years: YearSim[],
  params: CashFlowFormatParams
): CashFlowRow[] {
  const { desembolsoInicial, discountRate, costkWh, indexRate, tasaDegradacion } = params

  const rows: CashFlowRow[] = []
  const flujosAcumulados: number[] = []

  // Year 0: Initial investment
  rows.push({
    year: 0,
    inversion_inicial_cop: desembolsoInicial,
    generacion_anual_kwh: 0,
    consumo_anual_kwh: 0,
    excedentes_vendidos_kwh: 0,
    cobertura_consumo_pct: 0,
    costo_energia_indexado_cop_kwh: 0,
    ahorro_anual_cop: 0,
    ingresos_excedentes_cop: 0,
    mantenimiento_cop: 0,
    cuotas_credito_cop: 0,
    beneficio_tributario_total_cop: 0,
    flujo_neto_anual_cop: -desembolsoInicial,
    flujo_acumulado_cop: -desembolsoInicial,
    vpn_parcial_cop: -desembolsoInicial,
    tir_parcial_pct: 0,
    degradacion_aplicada_pct: 0,
  })

  flujosAcumulados.push(-desembolsoInicial)

  for (const y of years) {
    const flujoAcumulado = flujosAcumulados.reduce((a, b) => a + b, 0) + y.flujoNeto
    flujosAcumulados.push(y.flujoNeto)

    let tirParcial = 0
    let vpnParcial = flujoAcumulado
    if (flujosAcumulados.length > 1) {
      try {
        const tirCalc = calcIrr(flujosAcumulados)
        tirParcial = isNaN(tirCalc) ? 0 : tirCalc * 100
        vpnParcial = calcNpv(discountRate, flujosAcumulados)
      } catch {
        tirParcial = 0
        vpnParcial = flujoAcumulado
      }
    }

    rows.push({
      year: y.year,
      inversion_inicial_cop: 0,
      generacion_anual_kwh: y.generacionAnualKwh,
      consumo_anual_kwh: y.consumoAnualKwh,
      excedentes_vendidos_kwh: y.excedentesKwh,
      cobertura_consumo_pct: y.coberturaConsumoPct,
      costo_energia_indexado_cop_kwh: costkWh * Math.pow(1 + indexRate, y.year - 1),
      ahorro_anual_cop: y.ahorroIndexado,
      ingresos_excedentes_cop: y.ingresosExcedentesIndexados,
      mantenimiento_cop: y.mantenimiento,
      cuotas_credito_cop: y.cuotasCredito,
      beneficio_tributario_total_cop: y.beneficioTributario,
      flujo_neto_anual_cop: y.flujoNeto,
      flujo_acumulado_cop: flujoAcumulado,
      vpn_parcial_cop: vpnParcial,
      tir_parcial_pct: tirParcial,
      degradacion_aplicada_pct: tasaDegradacion * 100,
    })
  }

  return rows
}
