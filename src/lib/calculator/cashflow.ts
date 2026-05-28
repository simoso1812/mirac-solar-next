/**
 * Cash flow generation — ported from generar_csv_flujo_caja_detallado()
 */
import { DEFAULT_PARAMS } from '@/lib/constants'
import { irr as calcIrr, npv as calcNpv } from './financial'

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

export interface CashFlowParams {
  load: number // monthly consumption kWh
  sizeKwp: number
  costkWh: number
  indexRate: number // annual indexation rate (e.g. 0.06)
  discountRate: number
  monthlyGeneration: number[] // 12 months base generation
  cubierta: string
  clima: string
  horizonte: number
  percFinanciamiento: number // 0-100
  tasaInteresCredito: number
  plazoCreditoAnios: number
  desembolsoInicial: number
  cuotaMensualCredito: number
  valorProyectoTotal: number
  incluirBaterias: boolean
  incluirBeneficiosTributarios: boolean
  incluirDeduccionRenta: boolean
  incluirDepreciacionAcelerada: boolean
  precioExcedentes?: number
  tasaDegradacion?: number
  porcentajeMantenimiento?: number
}

export function generarFlujoCajaDetallado(params: CashFlowParams): CashFlowRow[] {
  const {
    load, costkWh, indexRate, discountRate, monthlyGeneration,
    horizonte, plazoCreditoAnios, desembolsoInicial, cuotaMensualCredito,
    valorProyectoTotal, incluirBaterias, incluirBeneficiosTributarios,
    incluirDeduccionRenta, incluirDepreciacionAcelerada,
  } = params

  const precioExcedentes = params.precioExcedentes ?? DEFAULT_PARAMS.precio_excedentes
  const tasaDegradacion = params.tasaDegradacion ?? DEFAULT_PARAMS.tasa_degradacion_anual
  const porcentajeMantenimiento = params.porcentajeMantenimiento ?? DEFAULT_PARAMS.porcentaje_mantenimiento

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

  // Years 1-N
  for (let i = 0; i < horizonte; i++) {
    const currentMonthly = monthlyGeneration.map(
      (gen) => gen * Math.pow(1 - tasaDegradacion, i)
    )
    const generacionAnual = currentMonthly.reduce((a, b) => a + b, 0)
    const consumoAnual = load * 12

    let excedentesTotales = 0
    let ahorroAnualTotal = 0
    let ingresosExcedentes = 0
    let coberturaConsumo = 0

    if (incluirBaterias) {
      // A battery enables near-full self-consumption of what the system
      // generates (it shifts daytime surplus to night), but it can never
      // create energy — savings are capped by actual annual generation.
      const autoConsumo = Math.min(generacionAnual, consumoAnual)
      ahorroAnualTotal = autoConsumo * costkWh
      const excedentes = Math.max(0, generacionAnual - consumoAnual)
      excedentesTotales = excedentes
      ingresosExcedentes = excedentes * precioExcedentes
      coberturaConsumo = consumoAnual > 0
        ? Math.min(100, (generacionAnual / consumoAnual) * 100)
        : 0
    } else {
      for (const genMes of currentMonthly) {
        const consumoMes = load
        if (genMes >= consumoMes) {
          ahorroAnualTotal += consumoMes * costkWh
          const excMes = genMes - consumoMes
          excedentesTotales += excMes
          ingresosExcedentes += excMes * precioExcedentes
        } else {
          ahorroAnualTotal += genMes * costkWh
        }
      }
      coberturaConsumo = consumoAnual > 0
        ? Math.min(100, (generacionAnual / consumoAnual) * 100)
        : 0
    }

    const costoEnergiaIndexado = costkWh * Math.pow(1 + indexRate, i)
    const ahorroIndexado = ahorroAnualTotal * Math.pow(1 + indexRate, i)
    const ingresosExcedentesIndexados = ingresosExcedentes * Math.pow(1 + indexRate, i)
    const mantenimiento = porcentajeMantenimiento * ahorroIndexado
    const cuotasAnuales = i < plazoCreditoAnios ? cuotaMensualCredito * 12 : 0

    // Tax benefits
    let beneficioTributario = 0
    if (incluirBeneficiosTributarios) {
      if (incluirDeduccionRenta && i === 1) {
        const capexIndexado = valorProyectoTotal * Math.pow(1 + indexRate, i)
        beneficioTributario += capexIndexado * 0.175
      }
      if (incluirDepreciacionAcelerada && i < 3) {
        beneficioTributario += valorProyectoTotal * 0.33
      }
    }

    const flujoAnual = ahorroIndexado - mantenimiento - cuotasAnuales + beneficioTributario
    const flujoAcumulado = flujosAcumulados.reduce((a, b) => a + b, 0) + flujoAnual
    flujosAcumulados.push(flujoAnual)

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
      year: i + 1,
      inversion_inicial_cop: 0,
      generacion_anual_kwh: generacionAnual,
      consumo_anual_kwh: consumoAnual,
      excedentes_vendidos_kwh: excedentesTotales,
      cobertura_consumo_pct: coberturaConsumo,
      costo_energia_indexado_cop_kwh: costoEnergiaIndexado,
      ahorro_anual_cop: ahorroIndexado,
      ingresos_excedentes_cop: ingresosExcedentesIndexados,
      mantenimiento_cop: mantenimiento,
      cuotas_credito_cop: cuotasAnuales,
      beneficio_tributario_total_cop: beneficioTributario,
      flujo_neto_anual_cop: flujoAnual,
      flujo_acumulado_cop: flujoAcumulado,
      vpn_parcial_cop: vpnParcial,
      tir_parcial_pct: tirParcial,
      degradacion_aplicada_pct: tasaDegradacion * 100,
    })
  }

  return rows
}
