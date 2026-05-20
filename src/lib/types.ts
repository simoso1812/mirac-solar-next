/**
 * TypeScript interfaces for Mirac Solar Calculator
 */

export interface ClientData {
  nombre: string
  nit_cc: string
  email: string
  telefono: string
  direccion: string
}

export interface ProjectData {
  ciudad: string
  ubicacion_label: string
  fecha: string
  plantilla: string
  lat: number | null
  lon: number | null
  hsp_mensual_pvgis: number[] | null
  map_url: string | null
}

export interface TechnicalData {
  consumo_mensual_kwh: number
  potencia_panel_w: number
  factor_seguridad: number
  tipo_cubierta: 'metalica' | 'teja' | 'losa'
  clima: 'templado' | 'calido' | 'frio'
  override_paneles: number | null
  marca_panel: string
  modelo_panel: string
}

export type ConnectionMode = 'net_metering' | 'net_billing' | 'autoconsumo'

export interface InverterOverride {
  potencia_kw: number
  cantidad: number
}

export interface PpaOption {
  precio_kwh: number // COP/kWh — Mirac sells solar generation at this price
  duracion_anios: number // contract duration in years
}

export interface ProposalImage {
  id: string
  data: string // compressed JPEG as base64 data URL
  caption: string
}

export interface AdvancedData {
  marca_inversor: string
  marca_inversor_custom: string
  modelo_inversor: string
  override_inversores: InverterOverride[] | null
  medidor_inteligente: boolean
  medidor_bidireccional: boolean
  modo_conexion: ConnectionMode
  financiamiento: {
    habilitado: boolean
    tasa_interes: number
    plazo_meses: number
    porcentaje_financiado: number
  }
  bateria: {
    habilitada: boolean
    capacidad_kwh: number
    profundidad_descarga: number
    eficiencia: number
    horas_autonomia: number
    costo_kwh_bateria: number
  }
  ppa: {
    habilitada: boolean
    opciones: PpaOption[] // one or more PPA offers to present side by side
  }
  imagenes: ProposalImage[] // attached project images (compressed, shown in web + PDF)
  beneficios_tributarios: boolean
  incluir_deduccion_renta: boolean
  incluir_depreciacion_acelerada: boolean
  precio_manual: number | null
  notas: string
  // Advanced financial parameters
  costo_kwh: number // COP/kWh energy tariff
  indexacion_energia: number // annual indexation rate (decimal, e.g. 0.06)
  tasa_descuento: number // discount rate for NPV (decimal, e.g. 0.10)
  horizonte_anios: number // analysis horizon in years
  precio_excedentes: number // COP/kWh surplus price (for net billing)
  tasa_degradacion: number // annual panel degradation (decimal, e.g. 0.001)
  porcentaje_mantenimiento: number // maintenance as % of savings (decimal, e.g. 0.05)
  performance_ratio_base: number // base PR (decimal, e.g. 0.75)
  demora_6_meses: boolean // 6-month connection delay
}

export interface InverterRecommendation {
  marca: string
  modelo: string
  potencia_kw: number
  cantidad: number
  potencia_total_kw: number
}

export interface CashFlowEntry {
  mes: number
  anio: number
  generacion_kwh: number
  ahorro_cop: number
  excedentes_cop: number
  mantenimiento_cop: number
  cuota_financiamiento_cop: number
  flujo_neto_cop: number
  flujo_acumulado_cop: number
}

export interface CarbonMetrics {
  annual_co2_avoided_kg: number
  annual_co2_avoided_tons: number
  lifetime_co2_avoided_kg: number
  lifetime_co2_avoided_tons: number
  trees_saved_per_year: number
  cars_off_road_per_year: number
  homes_powered_per_year: number
  flights_avoided_per_year: number
  annual_certification_value_cop: number
  lifetime_certification_value_cop: number
  emission_factor_used: number
  region: string
  system_lifetime_years: number
  plastic_bottles_avoided_per_year: number
  smartphone_charges_avoided_per_year: number
}

export interface CalculationResults {
  // System sizing
  kwp: number
  numero_paneles: number
  potencia_panel_w: number
  potencia_total_kw: number
  marca_panel: string
  modelo_panel: string

  // Generation
  generacion_mensual_kwh: number[]
  generacion_anual_kwh: number
  performance_ratio: number

  // Costs
  costo_total_cop: number
  costo_por_kwp_cop: number
  desglose_costos: {
    equipos: number
    materiales: number
    iva: number
    margen: number
  }

  // Financial
  ahorro_mensual_cop: number
  ahorro_anual_cop: number
  roi_porcentaje: number
  payback_anios: number
  tir: number
  vpn: number

  // Inverter
  inversores: InverterRecommendation[]

  // Battery (null when not enabled)
  bateria: {
    habilitada: boolean
    capacidad_nominal_kwh: number
    capacidad_util_kwh: number
    profundidad_descarga: number
    eficiencia: number
    horas_autonomia: number
    costo_cop: number
  } | null

  // Carbon
  carbon: CarbonMetrics

  // Cash flow
  flujo_caja: CashFlowEntry[]
}

export interface SignatureData {
  name: string
  email: string
  image: string // base64 data URL from canvas
  timestamp: string
}

export interface DocusealSignatureData {
  submission_id: number
  submitter_id: number
  submitter_slug: string
  embed_src: string
  status: 'pending' | 'completed' | 'declined' | 'expired'
  document_url: string | null
  audit_log_url: string | null
  completed_at: string | null
  declined_at: string | null
  created_at: string
  updated_at: string
}

export interface QuotationData {
  id: string
  created_at: string
  updated_at: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  client: ClientData
  project: ProjectData
  technical: TechnicalData
  advanced: AdvancedData
  results: CalculationResults | null
  signature?: SignatureData
  docuseal?: DocusealSignatureData
  // Google Drive sync
  drive_folder_link: string | null
  drive_project_name: string | null
}
