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
}

export type ConnectionMode = 'net_metering' | 'net_billing' | 'autoconsumo'

export interface AdvancedData {
  marca_inversor: string
  medidor_inteligente: boolean
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
  }
  beneficios_tributarios: boolean
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
  // Google Drive sync
  drive_folder_link: string | null
  drive_project_name: string | null
}
