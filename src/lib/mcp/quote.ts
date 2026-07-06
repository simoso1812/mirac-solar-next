/**
 * MCP quoting tools — friendly, agent-facing wrappers around the Mirac
 * solar calculator. Exposes a small input surface and builds the same
 * store shapes (technical/project/advanced) the web app uses, so results
 * computed here match what the shared `/s/[id]` page recomputes live.
 */
import { z } from 'zod'
import { cotizacion, buildInputFromStore } from '@/lib/calculator'
import { ppaMetrics } from '@/lib/calculator/derived'
import { estimatePrice, estimatePricePerKwp } from '@/lib/calculator/cost'
import { formatCOP } from '@/lib/formatting'
import { INVERTER_DATABASE } from '@/lib/constants'
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

/**
 * MCP clients (Cowork) sometimes serialize booleans as "true"/"false" strings —
 * the exact bug class z.coerce.number() fixes for numbers. NOT z.coerce.boolean()
 * (which treats any non-empty string, including "false", as true).
 */
const boolInput = (defaultValue: boolean) =>
  z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().default(defaultValue),
  )

/** Input shape (ZodRawShape) for the quoting tools. */
export const quoteInputShape = {
  consumo_mensual_kwh: z
    .coerce.number()
    .positive()
    .max(1_000_000)
    .describe('Consumo promedio mensual del cliente en kWh (de la factura de energia). Requerido.'),
  ciudad: z
    .enum(CIUDADES)
    .default('MEDELLIN')
    .describe('Ciudad del proyecto. Determina la radiacion solar (HSP). Default MEDELLIN.'),
  costo_kwh: z
    .coerce.number()
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
    .coerce.number()
    .nonnegative()
    .default(300)
    .describe('Precio de excedentes en COP/kWh (solo aplica en net_billing). Default 300.'),
  incluir_baterias: boolInput(false)
    .describe('Si el sistema incluye almacenamiento en baterias. Se activa solo si bateria_capacidad_kwh > 0.'),
  bateria_capacidad_kwh: z
    .coerce.number()
    .nonnegative()
    .default(0)
    .describe('Capacidad nominal de bateria en kWh. Si > 0 es autoritativo; si 0 se auto-dimensiona.'),
  bateria_horas_autonomia: z
    .coerce.number()
    .positive()
    .max(168)
    .default(48)
    .describe('Horas de autonomia deseadas cuando se auto-dimensiona la bateria. Default 48.'),
  financiamiento_porcentaje: z
    .coerce.number()
    .min(0)
    .max(100)
    .default(0)
    .describe('Porcentaje del CAPEX financiado con credito (0 = pago de contado). Default 0.'),
  financiamiento_tasa_ea: z
    .coerce.number()
    .min(0)
    .max(1)
    .default(0.15)
    .describe('Tasa Efectiva Anual (EA) del credito como fraccion, ej 0.15 = 15% EA (maximo 1 = 100%). Default 0.15.'),
  financiamiento_plazo_anios: z
    .coerce.number()
    .positive()
    .max(30)
    .default(5)
    .describe('Plazo del credito en anios. Default 5.'),
  beneficio_deduccion_renta: boolInput(false)
    .describe('Aplicar deduccion de renta (Ley 1715).'),
  beneficio_depreciacion_acelerada: boolInput(false)
    .describe('Aplicar depreciacion acelerada (Ley 1715).'),
  demora_6_meses: boolInput(false)
    .describe('Si la instalacion demora ~6 meses, el primer anio de ahorro se reduce a la mitad.'),
  factor_seguridad: z
    .coerce.number()
    .positive()
    .default(1.1)
    .describe('Factor de sobredimensionamiento del sistema. Default 1.1.'),
  potencia_panel_w: z
    .coerce.number()
    .positive()
    .max(1000)
    .default(615)
    .describe('Potencia de cada panel en W. Default 615.'),
  panel_marca: z
    .string()
    .max(80)
    .optional()
    .describe('Marca del panel a mostrar en la propuesta (texto libre, ej "Jinko"). Omitir para no especificar.'),
  panel_modelo: z
    .string()
    .max(120)
    .optional()
    .describe('Modelo del panel a mostrar en la propuesta (texto libre). Omitir para no especificar.'),
  numero_paneles: z
    .coerce.number()
    .int()
    .positive()
    .max(10_000)
    .optional()
    .describe('Numero de paneles a forzar (override manual). Reemplaza el dimensionamiento por consumo. Omitir para dimensionar automaticamente.'),
  horizonte_anios: z
    .coerce.number()
    .int()
    .min(5)
    .max(40)
    .default(25)
    .describe('Horizonte de analisis financiero en anios. Default 25.'),
  tasa_descuento: z
    .coerce.number()
    .min(0)
    .max(1)
    .default(0.10)
    .describe('Tasa de descuento para el VPN como fraccion. Default 0.10.'),
  indexacion_energia: z
    .coerce.number()
    .min(0)
    .max(0.5)
    .default(0.06)
    .describe('Indexacion anual de la tarifa de energia como fraccion. Default 0.06.'),
  porcentaje_mantenimiento: z
    .coerce.number()
    .min(0)
    .max(0.5)
    .default(0.05)
    .describe('Mantenimiento anual como fraccion del ahorro. Default 0.05.'),
  bateria_profundidad_descarga: z
    .coerce.number()
    .min(0.1)
    .max(1)
    .default(0.9)
    .describe('Profundidad de descarga (DoD) de la bateria como fraccion. Default 0.9.'),
  bateria_costo_kwh: z
    .coerce.number()
    .positive()
    .max(10_000_000)
    .default(400_000)
    .describe('Costo de la bateria en COP por kWh nominal. Default 400000.'),
  precio_manual_cop: z
    .coerce.number()
    .positive()
    .max(1_000_000_000_000)
    .optional()
    .describe(
      'Precio manual del proyecto en COP (IVA incluido). Si se indica, reemplaza el precio de la curva de costos y todos los indicadores financieros (ahorro, TIR, VPN, payback, financiamiento) se calculan sobre este valor. Omitir para usar el precio automatico.',
    ),
  ppa_opciones: z
    .array(
      z.object({
        precio_kwh: z
          .coerce.number()
          .positive()
          .max(100_000)
          .describe('Precio del PPA en COP por kWh que paga el cliente a Mirac.'),
        duracion_anios: z
          .coerce.number()
          .positive()
          .max(30)
          .describe('Duracion del contrato PPA en anios.'),
      }),
    )
    .max(20)
    .default([])
    .describe(
      'Opciones de PPA "Opcion Cero Inversion" a presentar (ej [{precio_kwh: 600, duracion_anios: 12}]). El cliente no invierte: paga la energia generada a este precio. Vacio = sin PPA.',
    ),
  inversor_marca: z
    .string()
    .max(80)
    .optional()
    .describe(
      'Marca del inversor a mostrar en la propuesta (ej "Deye", "Huawei", "Growatt"). Si es una marca conocida, el modelo se resuelve automaticamente del catalogo; si no, se muestra tal cual. Omitir para seleccion automatica.',
    ),
  inversor_modelo: z
    .string()
    .max(120)
    .optional()
    .describe(
      'Modelo especifico del inversor (texto libre, ej "SUN-5K-SG04LP1" o "5kW hibrido"). Se muestra en la propuesta tal cual se escribe.',
    ),
  inversor_potencia_kw: z
    .coerce.number()
    .positive()
    .max(1000)
    .optional()
    .describe(
      'Potencia AC de cada inversor en kW a forzar (ej 5). Reemplaza la seleccion automatica por tamano del sistema. Omitir para que la calculadora elija.',
    ),
  inversor_cantidad: z
    .coerce.number()
    .int()
    .positive()
    .max(50)
    .default(1)
    .describe('Cantidad de inversores cuando se fuerza inversor_potencia_kw. Default 1.'),
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
 * Map the friendly inverter args to the store's four inverter fields.
 * - A known brand (in INVERTER_DATABASE, case-insensitive) with no explicit
 *   model resolves its model from the catalog (marca_inversor = brand).
 * - Any explicit model, or an unknown brand, routes through the 'Otro' custom
 *   path so the proposal shows exactly what was passed. A model given WITHOUT a
 *   brand also uses this path (previously it was silently dropped and the quote
 *   fell back to auto-select).
 * - A forced power (inversor_potencia_kw) becomes a single override row; else
 *   the calculator auto-picks by system size.
 */
function inverterFields(a: QuoteArgs): Partial<AdvancedData> {
  const marca = a.inversor_marca?.trim() || ''
  const modelo = a.inversor_modelo?.trim() || ''

  // Case-insensitive catalog match ("deye" -> "Deye"); '' if not a known brand.
  const brandKey =
    marca === '' || marca.toLowerCase() === 'automatico'
      ? ''
      : Object.keys(INVERTER_DATABASE).find(
          (k) => k !== 'Automatico' && k.toLowerCase() === marca.toLowerCase(),
        ) ?? ''

  // Custom path when an explicit model is given, or a brand not in the catalog.
  const useCustom = modelo !== '' || (marca !== '' && brandKey === '')

  const override =
    a.inversor_potencia_kw && a.inversor_potencia_kw > 0
      ? [{ potencia_kw: a.inversor_potencia_kw, cantidad: a.inversor_cantidad ?? 1 }]
      : null

  let marcaInversor: string
  if (useCustom) marcaInversor = 'Otro'
  else if (brandKey !== '') marcaInversor = brandKey
  else marcaInversor = 'Automatico'

  // The web/PDF render the custom inverter as `marca modelo`, and the engine
  // fills an EMPTY model slot with the auto-inferred power (`modelo || `${kw}kW``).
  // To show a brand-less model label verbatim (e.g. "Deye 5kW Hibrido") with no
  // trailing kW suffix and no "Personalizado" filler, split it across the two
  // slots on the first space. An explicit brand keeps marca/modelo as given.
  let customBrand = marca
  let customModel = modelo
  if (useCustom && marca === '' && modelo !== '') {
    const sp = modelo.indexOf(' ')
    if (sp > 0) {
      customBrand = modelo.slice(0, sp)
      customModel = modelo.slice(sp + 1).trim()
    } else {
      customBrand = modelo
      customModel = ''
    }
  }

  return {
    marca_inversor: marcaInversor,
    marca_inversor_custom: useCustom ? customBrand : '',
    modelo_inversor: useCustom ? customModel : '',
    override_inversores: override,
  }
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
    marca_panel: a.panel_marca?.trim() ?? '',
    modelo_panel: a.panel_modelo?.trim() ?? '',
    override_paneles: a.numero_paneles ?? null,
  }) as TechnicalData

  const project = deepMerge(initialProjectData, {
    ciudad: a.ciudad,
    fecha: new Date().toISOString().split('T')[0],
  }) as ProjectData

  const advanced = deepMerge(initialAdvancedData, {
    costo_kwh: a.costo_kwh,
    modo_conexion: a.modo_conexion,
    precio_excedentes: a.precio_excedentes,
    horizonte_anios: a.horizonte_anios,
    tasa_descuento: a.tasa_descuento,
    indexacion_energia: a.indexacion_energia,
    porcentaje_mantenimiento: a.porcentaje_mantenimiento,
    demora_6_meses: a.demora_6_meses,
    bateria: {
      // A capacity without the flag still means "quote a battery".
      habilitada: a.incluir_baterias || a.bateria_capacidad_kwh > 0,
      capacidad_kwh: a.bateria_capacidad_kwh,
      horas_autonomia: a.bateria_horas_autonomia,
      profundidad_descarga: a.bateria_profundidad_descarga,
      costo_kwh_bateria: a.bateria_costo_kwh,
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
    precio_manual: a.precio_manual_cop ?? null,
    ppa: {
      habilitada: (a.ppa_opciones?.length ?? 0) > 0,
      opciones: a.ppa_opciones ?? [],
    },
    ...inverterFields(a),
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

  const ppa = stores.advanced.ppa.habilitada
    ? ppaMetrics(stores.advanced.costo_kwh, r.generacion_anual_kwh, stores.advanced.ppa.opciones)
    : []

  const summary = [
    stores.advanced.precio_manual !== null && stores.advanced.precio_manual > 0
      ? `**Precio manual aplicado:** ${formatCOP(stores.advanced.precio_manual)} (reemplaza el precio de la curva de costos)`
      : null,
    `**Sistema:** ${r.kwp.toFixed(2)} kWp · ${r.numero_paneles} paneles de ${r.potencia_panel_w}W`,
    `**Inversores:** ${r.inversores.map((i) => `${i.cantidad}x ${i.marca} ${i.modelo} (${i.potencia_kw}kW)`).join(' + ') || 'n/d'}`,
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
    ...(ppa.length > 0
      ? [
          '',
          '**PPA — Opcion Cero Inversion** (el cliente no invierte, paga la energia generada):',
          ...ppa.map(
            (o) =>
              `- ${formatCOP(o.precio_kwh, false)}/kWh x ${o.duracion_anios} anios: ahorro ${o.porcentajeAhorro}% vs tarifa · ` +
              `ahorro anual ${formatCOP(o.ahorroAnual)} · ahorro total ${formatCOP(o.ahorroTotal)} · pago a Mirac ${formatCOP(o.pagoMiracMensual)}/mes`,
          ),
        ]
      : []),
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
    precio_manual_aplicado: stores.advanced.precio_manual !== null && stores.advanced.precio_manual > 0,
    ppa_opciones: ppa.map((o) => ({
      precio_kwh: o.precio_kwh,
      duracion_anios: o.duracion_anios,
      porcentaje_ahorro: o.porcentajeAhorro,
      ahorro_anual_cop: o.ahorroAnual,
      ahorro_total_cop: o.ahorroTotal,
      pago_mirac_mensual_cop: o.pagoMiracMensual,
    })),
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
    .coerce.number()
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
