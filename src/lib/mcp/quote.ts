/**
 * MCP quoting tools — friendly, agent-facing wrappers around the Mirac
 * solar calculator. Exposes a small input surface and fills the ~35
 * remaining CotizacionInput fields from the same defaults the web app uses.
 */
import { z } from 'zod'
import { cotizacion, type CotizacionInput, type ConnectionMode } from '@/lib/calculator'
import { estimatePrice, estimatePricePerKwp } from '@/lib/calculator/cost'
import { formatCOP } from '@/lib/formatting'

// Cities present in HSP_MENSUAL_POR_CIUDAD (others fall back to MEDELLIN).
const CIUDADES = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA', 'BUCARAMANGA', 'CARTAGENA', 'PEREIRA'] as const

// Calculator expects upper-case clima codes; this maps the friendly enum.
const CLIMA_MAP: Record<string, string> = { templado: 'TEMPLADO', calido: 'SOL', frio: 'NUBE' }

/** Input shape (ZodRawShape) for the `quote_solar_system` tool. */
export const quoteInputShape = {
  consumo_mensual_kwh: z
    .number()
    .positive()
    .describe('Consumo promedio mensual del cliente en kWh (de la factura de energia). Requerido.'),
  ciudad: z
    .enum(CIUDADES)
    .default('MEDELLIN')
    .describe('Ciudad del proyecto. Determina la radiacion solar (HSP). Default MEDELLIN.'),
  costo_kwh: z
    .number()
    .positive()
    .default(850)
    .describe('Tarifa actual de energia en COP por kWh. Default 850.'),
  clima: z
    .enum(['templado', 'calido', 'frio'])
    .default('templado')
    .describe('Clima predominante del sitio. Ajusta el performance ratio. Default templado.'),
  cubierta: z
    .enum(['metalica', 'teja', 'losa'])
    .default('metalica')
    .describe('Tipo de cubierta. teja aplica un sobrecosto de instalacion. Default metalica.'),
  modo_conexion: z
    .enum(['net_metering', 'net_billing', 'autoconsumo'])
    .default('net_metering')
    .describe('net_metering: excedentes 1:1. net_billing: excedentes a precio reducido. autoconsumo: sin credito por excedentes.'),
  precio_excedentes: z
    .number()
    .nonnegative()
    .default(300)
    .describe('Precio de excedentes en COP/kWh (solo aplica en net_billing). Default 300.'),
  incluir_baterias: z
    .boolean()
    .default(false)
    .describe('Si el sistema incluye almacenamiento en baterias.'),
  bateria_capacidad_kwh: z
    .number()
    .nonnegative()
    .default(0)
    .describe('Capacidad nominal de bateria en kWh. Si > 0 es autoritativo; si 0 se auto-dimensiona.'),
  bateria_horas_autonomia: z
    .number()
    .positive()
    .max(168)
    .default(48)
    .describe('Horas de autonomia deseadas cuando se auto-dimensiona la bateria. Default 48.'),
  financiamiento_porcentaje: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .describe('Porcentaje del CAPEX financiado con credito (0 = pago de contado). Default 0.'),
  financiamiento_tasa_ea: z
    .number()
    .min(0)
    .default(0.15)
    .describe('Tasa Efectiva Anual (EA) del credito, ej 0.15 = 15% EA. Default 0.15.'),
  financiamiento_plazo_anios: z
    .number()
    .positive()
    .default(5)
    .describe('Plazo del credito en anios. Default 5.'),
  beneficio_deduccion_renta: z
    .boolean()
    .default(false)
    .describe('Aplicar deduccion de renta (Ley 1715).'),
  beneficio_depreciacion_acelerada: z
    .boolean()
    .default(false)
    .describe('Aplicar depreciacion acelerada (Ley 1715).'),
  factor_seguridad: z
    .number()
    .positive()
    .default(1.1)
    .describe('Factor de sobredimensionamiento del sistema. Default 1.1.'),
  potencia_panel_w: z
    .number()
    .positive()
    .default(615)
    .describe('Potencia de cada panel en W. Default 615.'),
}

const quoteInputSchema = z.object(quoteInputShape)
export type QuoteArgs = z.infer<typeof quoteInputSchema>

/** Map the friendly args to a full CotizacionInput, defaulting the rest. */
function toCotizacionInput(a: QuoteArgs): CotizacionInput {
  return {
    consumoMensualKwh: a.consumo_mensual_kwh,
    potenciaPanelW: a.potencia_panel_w,
    factorSeguridad: a.factor_seguridad,
    ciudad: a.ciudad,
    cubierta: a.cubierta.toUpperCase(),
    clima: CLIMA_MAP[a.clima] ?? 'TEMPLADO',
    costoKwh: a.costo_kwh,
    indexRate: 0.06,
    discountRate: 0.1,
    percFinanciamiento: a.financiamiento_porcentaje,
    tasaInteresCredito: a.financiamiento_tasa_ea,
    plazoCreditoAnios: a.financiamiento_plazo_anios,
    incluirBaterias: a.incluir_baterias,
    costoKwhBateria: 400000,
    capacidadBateriaKwh: a.bateria_capacidad_kwh,
    profundidadDescarga: 0.9,
    eficienciaBateria: 0.95,
    horasAutonomia: a.bateria_horas_autonomia,
    horizonteTiempo: 25,
    incluirBeneficiosTributarios: a.beneficio_deduccion_renta || a.beneficio_depreciacion_acelerada,
    incluirDeduccionRenta: a.beneficio_deduccion_renta,
    incluirDepreciacionAcelerada: a.beneficio_depreciacion_acelerada,
    precioManual: null,
    demora6Meses: false,
    hspMensualPVGIS: null,
    modoConexion: a.modo_conexion as ConnectionMode,
    precioExcedentes: a.precio_excedentes,
    tasaDegradacion: 0.001,
    porcentajeMantenimiento: 0.05,
    performanceRatioBase: 0.75,
    marcaInversor: 'Automatico',
    marcaInversorCustom: '',
    modeloInversor: '',
    marcaPanel: '',
    modeloPanel: '',
    overridePaneles: null,
    overrideInversores: null,
    medidorBidireccional: false,
  }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const yrs = (n: number) => `${n.toFixed(1)} años`

/** Run a full quote and return both a markdown summary and structured data. */
export function runQuote(args: QuoteArgs) {
  const input = toCotizacionInput(args)
  const r = cotizacion(input)

  const summary = [
    `## Cotizacion solar — ${args.ciudad}`,
    '',
    `**Sistema:** ${r.kwp.toFixed(2)} kWp · ${r.numero_paneles} paneles de ${r.potencia_panel_w}W`,
    `**Inversores:** ${r.inversores.map((i) => `${i.cantidad}x ${i.potencia_kw}kW`).join(' + ') || 'n/d'}`,
    `**Generacion anual:** ${Math.round(r.generacion_anual_kwh).toLocaleString('es-CO')} kWh (PR ${pct(r.performance_ratio)})`,
    r.bateria?.habilitada
      ? `**Bateria:** ${r.bateria.capacidad_nominal_kwh.toFixed(1)} kWh nominal · ${r.bateria.horas_autonomia}h autonomia`
      : '**Bateria:** no incluida',
    '',
    `**Inversion total:** ${formatCOP(r.costo_total_cop)} (${formatCOP(r.costo_por_kwp_cop)}/kWp)`,
    `**Ahorro anual:** ${formatCOP(r.ahorro_anual_cop)} · **mensual:** ${formatCOP(r.ahorro_mensual_cop)}`,
    // Note: r.tir and r.roi_porcentaje are already percentages (calculator
    // multiplies by 100), so print directly — do NOT scale again.
    `**Payback:** ${yrs(r.payback_anios)} · **TIR:** ${r.tir.toFixed(1)}% · **VPN:** ${formatCOP(r.vpn)} · **ROI:** ${r.roi_porcentaje.toFixed(1)}%`,
    `**CO2 evitado (vida util):** ${Math.round(r.carbon.lifetime_co2_avoided_tons ?? 0)} t`,
  ].join('\n')

  const structured = {
    kwp: r.kwp,
    numero_paneles: r.numero_paneles,
    generacion_anual_kwh: Math.round(r.generacion_anual_kwh),
    inversion_total_cop: Math.round(r.costo_total_cop),
    costo_por_kwp_cop: Math.round(r.costo_por_kwp_cop),
    ahorro_anual_cop: Math.round(r.ahorro_anual_cop),
    ahorro_mensual_cop: Math.round(r.ahorro_mensual_cop),
    payback_anios: Number(r.payback_anios.toFixed(2)),
    tir_porcentaje: Number(r.tir.toFixed(2)),
    vpn_cop: Math.round(r.vpn),
    roi_porcentaje: Number(r.roi_porcentaje.toFixed(2)),
    bateria_incluida: !!r.bateria?.habilitada,
    bateria_capacidad_kwh: r.bateria?.capacidad_nominal_kwh ?? 0,
  }

  return { summary, structured }
}

/** Input shape for the `estimate_price` tool. */
export const priceInputShape = {
  kwp: z
    .number()
    .positive()
    .describe('Tamano del sistema en kWp. Devuelve el precio estimado (sin ajuste por cubierta).'),
}
const priceInputSchema = z.object(priceInputShape)
export type PriceArgs = z.infer<typeof priceInputSchema>

/** Quick CAPEX estimate from system size, using the empirical cost curve. */
export function runEstimatePrice(args: PriceArgs) {
  const total = estimatePrice(args.kwp)
  const perKwp = estimatePricePerKwp(args.kwp)
  const summary =
    `Sistema de ${args.kwp.toFixed(2)} kWp · precio estimado **${formatCOP(total)}** ` +
    `(${formatCOP(perKwp)}/kWp). Estimacion base, sin ajuste por tipo de cubierta ni baterias.`
  return {
    summary,
    structured: {
      kwp: args.kwp,
      precio_total_cop: Math.round(total),
      precio_por_kwp_cop: Math.round(perKwp),
    },
  }
}
