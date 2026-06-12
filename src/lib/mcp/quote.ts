/**
 * MCP quoting tools — friendly, agent-facing wrappers around the Mirac
 * solar calculator. Exposes a small input surface and builds the same
 * store shapes (technical/project/advanced) the web app uses, so results
 * computed here match what the shared `/s/[id]` page recomputes live.
 */
import { z } from 'zod'
import { cotizacion, buildInputFromStore } from '@/lib/calculator'
import { estimatePrice, estimatePricePerKwp } from '@/lib/calculator/cost'
import { formatCOP } from '@/lib/formatting'
import {
  deepMerge,
  initialAdvancedData,
  initialClientData,
  initialProjectData,
  initialTechnicalData,
} from '@/lib/defaults'
import type { ClientData, ProjectData, TechnicalData, AdvancedData } from '@/lib/types'

// Cities present in HSP_MENSUAL_POR_CIUDAD (others fall back to MEDELLIN).
const CIUDADES = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA', 'BUCARAMANGA', 'CARTAGENA', 'PEREIRA'] as const

/** Input shape (ZodRawShape) for the quoting tools. */
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

export const quoteInputSchema = z.object(quoteInputShape)
export type QuoteArgs = z.infer<typeof quoteInputSchema>

/** Optional client fields, used when creating a shareable proposal. */
export interface ClientArgs {
  cliente_nombre?: string
  cliente_direccion?: string
  cliente_email?: string
  cliente_telefono?: string
  cliente_cedula?: string
}

export interface QuotationStores {
  client: ClientData
  project: ProjectData
  technical: TechnicalData
  advanced: AdvancedData
}

/**
 * Map friendly args to the web app's store shapes. Going through these
 * (and then buildInputFromStore) keeps the calculator result identical to
 * what the shared `/s/[id]` page recomputes from the stored payload.
 */
export function buildStores(a: QuoteArgs, c: ClientArgs = {}): QuotationStores {
  const technical = deepMerge(initialTechnicalData, {
    consumo_mensual_kwh: a.consumo_mensual_kwh,
    potencia_panel_w: a.potencia_panel_w,
    factor_seguridad: a.factor_seguridad,
    tipo_cubierta: a.cubierta,
    clima: a.clima,
  }) as TechnicalData

  const project = deepMerge(initialProjectData, {
    ciudad: a.ciudad,
    fecha: new Date().toISOString().split('T')[0],
  }) as ProjectData

  const advanced = deepMerge(initialAdvancedData, {
    costo_kwh: a.costo_kwh,
    modo_conexion: a.modo_conexion,
    precio_excedentes: a.precio_excedentes,
    bateria: {
      habilitada: a.incluir_baterias,
      capacidad_kwh: a.bateria_capacidad_kwh,
      horas_autonomia: a.bateria_horas_autonomia,
    },
    financiamiento: {
      habilitado: a.financiamiento_porcentaje > 0,
      tasa_interes: a.financiamiento_tasa_ea,
      plazo_meses: Math.round(a.financiamiento_plazo_anios * 12),
      porcentaje_financiado: a.financiamiento_porcentaje / 100,
    },
    beneficios_tributarios: a.beneficio_deduccion_renta || a.beneficio_depreciacion_acelerada,
    incluir_deduccion_renta: a.beneficio_deduccion_renta,
    incluir_depreciacion_acelerada: a.beneficio_depreciacion_acelerada,
  }) as AdvancedData

  const client = deepMerge(initialClientData, {
    nombre: c.cliente_nombre ?? '',
    direccion: c.cliente_direccion ?? '',
    email: c.cliente_email ?? '',
    telefono: c.cliente_telefono ?? '',
    nit_cc: c.cliente_cedula ?? '',
  }) as ClientData

  return { client, project, technical, advanced }
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const yrs = (n: number) => `${n.toFixed(1)} años`

/** Build the Spanish markdown summary + structured data from a result. */
export function summarize(stores: QuotationStores) {
  const r = cotizacion(buildInputFromStore(stores.technical, stores.project, stores.advanced))

  const summary = [
    `**Sistema:** ${r.kwp.toFixed(2)} kWp · ${r.numero_paneles} paneles de ${r.potencia_panel_w}W`,
    `**Inversores:** ${r.inversores.map((i) => `${i.cantidad}x ${i.potencia_kw}kW`).join(' + ') || 'n/d'}`,
    `**Generacion anual:** ${Math.round(r.generacion_anual_kwh).toLocaleString('es-CO')} kWh (PR ${pct(r.performance_ratio)})`,
    r.bateria?.habilitada
      ? `**Bateria:** ${r.bateria.capacidad_nominal_kwh.toFixed(1)} kWh nominal · ${r.bateria.horas_autonomia.toFixed(1)}h autonomia`
      : '**Bateria:** no incluida',
    `**Inversion total:** ${formatCOP(r.costo_total_cop)} (${formatCOP(r.costo_por_kwp_cop)}/kWp)`,
    `**Ahorro anual:** ${formatCOP(r.ahorro_anual_cop)} · **mensual:** ${formatCOP(r.ahorro_mensual_cop)}`,
    // r.tir and r.roi_porcentaje are already x100 (percentages) — print directly.
    `**Payback:** ${yrs(r.payback_anios)} · **TIR:** ${r.tir.toFixed(1)}% · **VPN:** ${formatCOP(r.vpn)} · **ROI:** ${r.roi_porcentaje.toFixed(1)}%`,
    r.financiamiento
      ? `**Financiamiento:** cuota ${formatCOP(r.financiamiento.cuota_mensual_cop)}/mes · ${r.financiamiento.num_pagos} meses · anticipo ${formatCOP(r.financiamiento.desembolso_inicial_cop)} · tasa ${(r.financiamiento.tasa_ea * 100).toFixed(1)}% EA`
      : null,
    `**CO2 evitado (vida util):** ${Math.round(r.carbon.lifetime_co2_avoided_tons ?? 0)} t`,
  ].filter(Boolean).join('\n')

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
    financiamiento_cuota_mensual_cop: r.financiamiento?.cuota_mensual_cop ?? 0,
    financiamiento_num_pagos: r.financiamiento?.num_pagos ?? 0,
    financiamiento_anticipo_cop: r.financiamiento?.desembolso_inicial_cop ?? 0,
  }

  return { summary, structured }
}

/** Run a full quote and return both a markdown summary and structured data. */
export function runQuote(args: QuoteArgs) {
  const stores = buildStores(args)
  const { summary, structured } = summarize(stores)
  return {
    summary: `## Cotizacion solar — ${args.ciudad}\n\n${summary}`,
    structured,
  }
}

/** Input shape for the `estimate_price` tool. */
export const priceInputShape = {
  kwp: z
    .number()
    .positive()
    .describe('Tamano del sistema en kWp. Devuelve el precio estimado (sin ajuste por cubierta).'),
}
export const priceInputSchema = z.object(priceInputShape)
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
