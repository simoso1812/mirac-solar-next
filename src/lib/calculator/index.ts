/**
 * Main calculation orchestrator — ported from cotizacion()
 */
import { HSP_MENSUAL_POR_CIUDAD, DEFAULT_PARAMS, PROMEDIOS_COSTO, DIAS_POR_MES, INVERTER_DATABASE } from '@/lib/constants'
import { estimatePrice } from './cost'
import { recomendarInversor, redondearAPar } from './inverter'
import { calcularPerformanceRatio, calcularFactorClipping } from './performance'
import { pmt, npv, irr } from './financial'
import { calculateEmissionsAvoided } from './carbon'
import { generarFlujoCajaDetallado } from './cashflow'
import type { CalculationResults, TechnicalData, AdvancedData, ProjectData } from '@/lib/types'

export type ConnectionMode = 'net_metering' | 'net_billing' | 'autoconsumo'

export interface CotizacionInput {
  consumoMensualKwh: number
  potenciaPanelW: number
  factorSeguridad: number
  ciudad: string
  cubierta: string
  clima: string
  costoKwh: number // COP/kWh tariff
  indexRate: number // annual indexation (e.g. 0.06)
  discountRate: number // discount rate for NPV (e.g. 0.10)
  percFinanciamiento: number // 0-100
  tasaInteresCredito: number // annual (e.g. 0.12)
  plazoCreditoAnios: number
  incluirBaterias: boolean
  costoKwhBateria: number
  capacidadBateriaKwh: number // user-entered nominal capacity; if > 0, overrides auto-sizing
  profundidadDescarga: number
  eficienciaBateria: number
  horasAutonomia: number
  horizonteTiempo: number
  incluirBeneficiosTributarios: boolean
  incluirDeduccionRenta: boolean
  incluirDepreciacionAcelerada: boolean
  precioManual: number | null
  demora6Meses: boolean
  hspMensualPVGIS: number[] | null // Real PVGIS data (overrides city HSP)
  modoConexion: ConnectionMode
  precioExcedentes: number // COP/kWh surplus price
  tasaDegradacion: number // annual degradation (e.g. 0.001)
  porcentajeMantenimiento: number // maintenance % of savings (e.g. 0.05)
  performanceRatioBase: number // base PR (e.g. 0.75)
  marcaInversor: string // inverter brand
  marcaInversorCustom: string // custom brand name when marcaInversor === 'Otro'
  modeloInversor: string // custom model name (applies when marcaInversor === 'Otro')
  marcaPanel: string // free-text panel brand
  modeloPanel: string // free-text panel model
  overridePaneles: number | null // manual panel count override
  overrideInversores: { potencia_kw: number; cantidad: number }[] | null // manual inverter config
  medidorBidireccional: boolean // adds 1.3M COP to project cost
}

/**
 * Build CotizacionInput from store data with sensible defaults
 */
export function buildInputFromStore(
  technical: TechnicalData,
  project: ProjectData,
  advanced: AdvancedData
): CotizacionInput {
  const climaMap: Record<string, string> = {
    templado: 'TEMPLADO',
    calido: 'SOL',
    frio: 'NUBE',
  }
  return {
    consumoMensualKwh: technical.consumo_mensual_kwh,
    potenciaPanelW: technical.potencia_panel_w,
    factorSeguridad: technical.factor_seguridad,
    ciudad: project.ciudad,
    cubierta: technical.tipo_cubierta.toUpperCase(),
    clima: climaMap[technical.clima] ?? 'TEMPLADO',
    costoKwh: advanced.costo_kwh ?? 850,
    indexRate: advanced.indexacion_energia ?? 0.06,
    discountRate: advanced.tasa_descuento ?? 0.10,
    percFinanciamiento: advanced.financiamiento.habilitado
      ? advanced.financiamiento.porcentaje_financiado * 100
      : 0,
    tasaInteresCredito: advanced.financiamiento.tasa_interes,
    plazoCreditoAnios: Math.round(advanced.financiamiento.plazo_meses / 12),
    incluirBaterias: advanced.bateria.habilitada,
    costoKwhBateria: advanced.bateria.costo_kwh_bateria ?? 400000,
    capacidadBateriaKwh: advanced.bateria.capacidad_kwh ?? 0,
    profundidadDescarga: advanced.bateria.profundidad_descarga,
    eficienciaBateria: advanced.bateria.eficiencia,
    horasAutonomia: advanced.bateria.horas_autonomia ?? 48,
    horizonteTiempo: advanced.horizonte_anios ?? 25,
    incluirBeneficiosTributarios: advanced.beneficios_tributarios && (
      advanced.incluir_deduccion_renta || advanced.incluir_depreciacion_acelerada
    ),
    incluirDeduccionRenta: advanced.beneficios_tributarios && advanced.incluir_deduccion_renta,
    incluirDepreciacionAcelerada: advanced.beneficios_tributarios && advanced.incluir_depreciacion_acelerada,
    precioManual: advanced.precio_manual,
    demora6Meses: advanced.demora_6_meses ?? false,
    hspMensualPVGIS: project.hsp_mensual_pvgis,
    modoConexion: advanced.modo_conexion ?? 'net_metering',
    precioExcedentes: advanced.precio_excedentes ?? 300,
    tasaDegradacion: advanced.tasa_degradacion ?? 0.001,
    porcentajeMantenimiento: advanced.porcentaje_mantenimiento ?? 0.05,
    performanceRatioBase: advanced.performance_ratio_base ?? 0.75,
    marcaInversor: advanced.marca_inversor ?? 'Automatico',
    marcaInversorCustom: advanced.marca_inversor_custom ?? '',
    modeloInversor: advanced.modelo_inversor ?? '',
    marcaPanel: technical.marca_panel ?? '',
    modeloPanel: technical.modelo_panel ?? '',
    overridePaneles: technical.override_paneles,
    overrideInversores: advanced.override_inversores,
    medidorBidireccional: advanced.medidor_bidireccional ?? false,
  }
}

/**
 * Main cotizacion calculation — orchestrates all modules
 */
export function cotizacion(input: CotizacionInput): CalculationResults {
  const {
    consumoMensualKwh, potenciaPanelW, factorSeguridad, ciudad, cubierta,
    clima, costoKwh, indexRate, discountRate, percFinanciamiento,
    tasaInteresCredito, plazoCreditoAnios, incluirBaterias, costoKwhBateria,
    capacidadBateriaKwh, profundidadDescarga, eficienciaBateria, horasAutonomia, horizonteTiempo,
    incluirBeneficiosTributarios, incluirDeduccionRenta,
    incluirDepreciacionAcelerada, precioManual, demora6Meses,
    hspMensualPVGIS, modoConexion, marcaInversor,
    marcaInversorCustom, modeloInversor, marcaPanel, modeloPanel,
  } = input

  // Use PVGIS data if available, otherwise fall back to city-based HSP
  const hspMensual = (hspMensualPVGIS && hspMensualPVGIS.length === 12)
    ? hspMensualPVGIS
    : (HSP_MENSUAL_POR_CIUDAD[ciudad.toUpperCase()] ?? HSP_MENSUAL_POR_CIUDAD['MEDELLIN'])

  // System sizing
  const hspPromedio = hspMensual.reduce((a, b) => a + b, 0) / 12
  const eficienciaEstimacion = DEFAULT_PARAMS.eficiencia_sistema_estimacion
  const kwpRaw = (consumoMensualKwh / (hspPromedio * 30 * eficienciaEstimacion)) * factorSeguridad
  const potenciaPanelKw = potenciaPanelW / 1000
  const numeroPaneles = input.overridePaneles ?? redondearAPar(Math.ceil(kwpRaw / potenciaPanelKw))
  const sizeKwp = numeroPaneles * potenciaPanelKw

  // Performance ratio & clipping
  const pr = calcularPerformanceRatio(clima, cubierta, input.performanceRatioBase)
  const inverterResult = input.overrideInversores && input.overrideInversores.length > 0
    ? {
        label: input.overrideInversores.map((i) => `${i.cantidad}x${i.potencia_kw}kW`).join(' + '),
        totalPower: input.overrideInversores.reduce((s, i) => s + i.potencia_kw * i.cantidad, 0),
        combo: Object.fromEntries(input.overrideInversores.map((i) => [i.potencia_kw, i.cantidad])),
      }
    : recomendarInversor(sizeKwp)
  const potenciaAcInversor = inverterResult.totalPower
  const dcAcRatio = potenciaAcInversor > 0 ? sizeKwp / potenciaAcInversor : 1.0
  const factorClipping = calcularFactorClipping(dcAcRatio)

  // Monthly generation (base, year 0)
  const monthlyGenerationInit = hspMensual.map(
    (hsp, i) => sizeKwp * hsp * DIAS_POR_MES[i] * pr * (1 - factorClipping)
  )
  const generacionAnualKwh = monthlyGenerationInit.reduce((a, b) => a + b, 0)

  // Cost (3-segment model: small/medium/large)
  let costoFV = estimatePrice(sizeKwp)
  if (cubierta.trim().toUpperCase() === 'TEJA') {
    costoFV = Math.ceil(costoFV * DEFAULT_PARAMS.ajuste_cubierta_teja)
  }

  // Battery sizing
  // If user entered a capacity (capacidadBateriaKwh > 0) → that's the nominal source of truth.
  // Otherwise auto-size from hourly consumption × autonomy hours ÷ DoD.
  let costoBateria = 0
  let capacidadNominalBateria = 0
  let capacidadUtilBateria = 0
  if (incluirBaterias) {
    const dod = profundidadDescarga > 0 ? profundidadDescarga : 0.8
    if (capacidadBateriaKwh > 0) {
      capacidadNominalBateria = capacidadBateriaKwh
      capacidadUtilBateria = capacidadNominalBateria * dod
    } else {
      const consumoHorario = consumoMensualKwh / 30 / 24
      capacidadUtilBateria = consumoHorario * horasAutonomia
      capacidadNominalBateria = capacidadUtilBateria / dod
    }
    costoBateria = capacidadNominalBateria * costoKwhBateria
  }

  let valorProyectoTotal = Math.ceil(costoFV + costoBateria)
  if (input.medidorBidireccional) {
    valorProyectoTotal += 1_300_000
  }
  if (precioManual !== null && precioManual > 0) {
    valorProyectoTotal = precioManual
  }

  // Financing
  const montoAFinanciar = Math.ceil(valorProyectoTotal * (percFinanciamiento / 100))
  // tasa_interes is Tasa Efectiva Anual (EA, Colombian convention).
  // Convert to equivalent monthly rate geometrically: (1+EA)^(1/12) - 1.
  const tasaMensualCredito = Math.pow(1 + tasaInteresCredito, 1 / 12) - 1
  const numPagosCredito = plazoCreditoAnios * 12
  let cuotaMensualCredito = 0
  if (montoAFinanciar > 0 && plazoCreditoAnios > 0 && tasaInteresCredito > 0) {
    cuotaMensualCredito = Math.ceil(Math.abs(pmt(tasaMensualCredito, numPagosCredito, -montoAFinanciar)))
  }
  const desembolsoInicial = valorProyectoTotal - montoAFinanciar

  // Single source of truth for every financing figure a client sees
  // (web card, PDF page, MCP summary all read this block).
  const financiamientoResults = cuotaMensualCredito > 0
    ? {
        porcentaje_financiado: percFinanciamiento,
        monto_financiado_cop: montoAFinanciar,
        desembolso_inicial_cop: desembolsoInicial,
        tasa_ea: tasaInteresCredito,
        tasa_mensual: tasaMensualCredito,
        num_pagos: numPagosCredito,
        cuota_mensual_cop: cuotaMensualCredito,
        total_pagado_cop: cuotaMensualCredito * numPagosCredito,
        total_intereses_cop: cuotaMensualCredito * numPagosCredito - montoAFinanciar,
      }
    : null

  // Cash flow for IRR/NPV — connection mode determines surplus pricing
  let precioExcedentes: number
  if (modoConexion === 'net_metering') {
    precioExcedentes = costoKwh // surplus valued at same purchase price
  } else if (modoConexion === 'net_billing') {
    precioExcedentes = input.precioExcedentes ?? DEFAULT_PARAMS.precio_excedentes
  } else {
    precioExcedentes = 0 // autoconsumo — no compensation
  }
  const tasaDegradacion = input.tasaDegradacion ?? DEFAULT_PARAMS.tasa_degradacion_anual
  const porcentajeMantenimiento = input.porcentajeMantenimiento ?? DEFAULT_PARAMS.porcentaje_mantenimiento

  const cashflowFree: number[] = []
  let ahorroAnualAnio1 = 0

  for (let i = 0; i < horizonteTiempo; i++) {
    const currentMonthly = monthlyGenerationInit.map(
      (gen) => gen * Math.pow(1 - tasaDegradacion, i)
    )

    const generacionAnual = currentMonthly.reduce((a, b) => a + b, 0)
    const consumoAnual = consumoMensualKwh * 12

    let ahorroAnualTotal = 0
    if (incluirBaterias) {
      // A battery shifts surplus generation to cover night-time load, so the
      // system can self-consume nearly all it generates — but savings can
      // never exceed actual generation. Cap at min(generación, consumo);
      // any true surplus is sold at the export price.
      const autoConsumo = Math.min(generacionAnual, consumoAnual)
      const excedentes = Math.max(0, generacionAnual - consumoAnual)
      ahorroAnualTotal = autoConsumo * costoKwh + excedentes * precioExcedentes
    } else {
      for (const genMes of currentMonthly) {
        if (genMes >= consumoMensualKwh) {
          ahorroAnualTotal += consumoMensualKwh * costoKwh + (genMes - consumoMensualKwh) * precioExcedentes
        } else {
          ahorroAnualTotal += genMes * costoKwh
        }
      }
    }

    let ahorroIndexado = ahorroAnualTotal * Math.pow(1 + indexRate, i)
    if (i === 0) ahorroAnualAnio1 = ahorroAnualTotal

    if (demora6Meses && i === 0) ahorroIndexado *= 0.5

    const mantenimiento = porcentajeMantenimiento * ahorroIndexado
    const cuotasAnuales = i < plazoCreditoAnios ? cuotaMensualCredito * 12 : 0
    let flujo = ahorroIndexado - mantenimiento - cuotasAnuales

    // Tax benefits
    if (incluirBeneficiosTributarios) {
      if (incluirDeduccionRenta && i === 1) {
        flujo += valorProyectoTotal * Math.pow(1 + indexRate, i) * 0.175
      }
      if (incluirDepreciacionAcelerada && i < 3) {
        flujo += valorProyectoTotal * 0.33
      }
    }

    cashflowFree.push(flujo)
  }

  cashflowFree.unshift(-desembolsoInicial)

  const vpn = npv(discountRate, cashflowFree)
  let tir = irr(cashflowFree)
  if (isNaN(tir)) tir = 0

  // Payback
  let payback = horizonteTiempo
  let cumulative = 0
  for (let i = 0; i < cashflowFree.length; i++) {
    cumulative += cashflowFree[i]
    if (cumulative >= 0) {
      if (i > 0) {
        const prev = cumulative - cashflowFree[i]
        const denom = cashflowFree[i]
        payback = denom !== 0 ? (i - 1) + Math.abs(prev) / denom : i
      } else {
        payback = 0
      }
      break
    }
  }

  // ROI
  const totalReturns = cashflowFree.slice(1).reduce((a, b) => a + b, 0)
  const roi = desembolsoInicial > 0 ? totalReturns / desembolsoInicial : 0

  // Cost breakdown
  const desgloseCostos = {
    equipos: Math.ceil(valorProyectoTotal * PROMEDIOS_COSTO.equipos / 100),
    materiales: Math.ceil(valorProyectoTotal * PROMEDIOS_COSTO.materiales / 100),
    iva: Math.ceil(valorProyectoTotal - valorProyectoTotal / (1 + PROMEDIOS_COSTO.iva_rate)),
    margen: Math.ceil(valorProyectoTotal * PROMEDIOS_COSTO.margen / 100),
  }

  // Carbon
  const carbon = calculateEmissionsAvoided(generacionAnualKwh, ciudad, horizonteTiempo)

  // Cash flow detail
  const flujoCaja = generarFlujoCajaDetallado({
    load: consumoMensualKwh,
    sizeKwp,
    costkWh: costoKwh,
    indexRate,
    discountRate,
    monthlyGeneration: monthlyGenerationInit,
    cubierta,
    clima,
    horizonte: horizonteTiempo,
    percFinanciamiento,
    tasaInteresCredito,
    plazoCreditoAnios,
    desembolsoInicial,
    cuotaMensualCredito,
    valorProyectoTotal,
    incluirBaterias,
    incluirBeneficiosTributarios,
    incluirDeduccionRenta,
    incluirDepreciacionAcelerada,
    precioExcedentes,
    tasaDegradacion,
    porcentajeMantenimiento,
  })

  return {
    kwp: sizeKwp,
    numero_paneles: numeroPaneles,
    potencia_panel_w: potenciaPanelW,
    potencia_total_kw: sizeKwp,
    marca_panel: marcaPanel,
    modelo_panel: modeloPanel,
    generacion_mensual_kwh: monthlyGenerationInit,
    generacion_anual_kwh: generacionAnualKwh,
    performance_ratio: pr,
    costo_total_cop: valorProyectoTotal,
    costo_por_kwp_cop: Math.ceil(valorProyectoTotal / sizeKwp),
    desglose_costos: desgloseCostos,
    ahorro_mensual_cop: Math.ceil(ahorroAnualAnio1 / 12),
    ahorro_anual_cop: Math.ceil(ahorroAnualAnio1),
    roi_porcentaje: roi * 100,
    payback_anios: payback,
    tir: tir * 100,
    vpn,
    financiamiento: financiamientoResults,
    inversores: Object.entries(inverterResult.combo).map(([kw, count]) => {
      const kwNum = Number(kw)
      // Custom brand: use the free-text brand/model supplied by the user
      if (marcaInversor === 'Otro') {
        return {
          marca: marcaInversorCustom || 'Personalizado',
          modelo: modeloInversor || `${kwNum}kW`,
          potencia_kw: kwNum,
          cantidad: count,
          potencia_total_kw: kwNum * count,
        }
      }
      // Resolve brand and model name from database
      const brand = marcaInversor && marcaInversor !== 'Automatico'
        ? marcaInversor : 'Huawei'
      const brandDb = INVERTER_DATABASE[brand]
      const model = brandDb?.models.find((m) => m.potencia_kw === kwNum)
      return {
        marca: brand,
        modelo: model?.modelo ?? `${kwNum}KTL`,
        potencia_kw: kwNum,
        cantidad: count,
        potencia_total_kw: kwNum * count,
      }
    }),
    bateria: incluirBaterias
      ? (() => {
          const consumoHorario = consumoMensualKwh / 30 / 24
          // When capacity was user-entered, derive real autonomy from útil ÷ hourly consumption.
          // Otherwise use the user-entered autonomy (which drove the auto-sizing).
          const horasReales = capacidadBateriaKwh > 0 && consumoHorario > 0
            ? capacidadUtilBateria / consumoHorario
            : horasAutonomia
          return {
            habilitada: true,
            capacidad_nominal_kwh: capacidadNominalBateria,
            capacidad_util_kwh: capacidadUtilBateria,
            profundidad_descarga: profundidadDescarga,
            eficiencia: eficienciaBateria,
            horas_autonomia: horasReales,
            costo_cop: Math.ceil(costoBateria),
          }
        })()
      : null,
    carbon,
    flujo_caja: flujoCaja.map((row) => ({
      mes: 0,
      anio: row.year,
      generacion_kwh: row.generacion_anual_kwh,
      ahorro_cop: row.ahorro_anual_cop,
      excedentes_cop: row.ingresos_excedentes_cop,
      mantenimiento_cop: row.mantenimiento_cop,
      cuota_financiamiento_cop: row.cuotas_credito_cop,
      flujo_neto_cop: row.flujo_neto_anual_cop,
      flujo_acumulado_cop: row.flujo_acumulado_cop,
    })),
  }
}

export { estimatePrice, estimatePricePerKwp, getFullEstimate, calcularCostoPorKwp } from './cost'
export { recomendarInversor } from './inverter'
export { calcularPerformanceRatio, calcularFactorClipping } from './performance'
export { pmt, npv, irr } from './financial'
export { calculateEmissionsAvoided } from './carbon'
export { generarFlujoCajaDetallado } from './cashflow'
