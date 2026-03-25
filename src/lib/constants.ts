/**
 * Constants and configuration for Mirac Solar Calculator
 * Ported from Python config.py + config_parametros.py
 */

// Monthly HSP data (kWh/m²/day) per Colombian city
export const HSP_MENSUAL_POR_CIUDAD: Record<string, number[]> = {
  MEDELLIN:     [4.39, 4.49, 4.51, 4.31, 4.20, 4.35, 4.80, 4.71, 4.40, 4.15, 4.05, 4.19],
  BOGOTA:       [4.35, 4.48, 4.21, 3.89, 3.70, 3.81, 4.25, 4.30, 4.10, 3.95, 3.88, 4.15],
  CALI:         [4.80, 4.95, 4.85, 4.60, 4.50, 4.75, 5.10, 5.05, 4.80, 4.65, 4.55, 4.68],
  BARRANQUILLA: [5.10, 5.35, 5.80, 5.90, 5.75, 5.85, 5.95, 5.80, 5.45, 5.15, 4.90, 4.95],
  BUCARAMANGA:  [4.60, 4.75, 4.50, 4.30, 4.15, 4.25, 4.70, 4.80, 4.65, 4.40, 4.30, 4.45],
  CARTAGENA:    [5.30, 5.60, 6.10, 6.20, 6.00, 6.15, 6.25, 6.10, 5.70, 5.40, 5.10, 5.15],
  PEREIRA:      [4.55, 4.68, 4.60, 4.40, 4.30, 4.45, 4.90, 4.85, 4.55, 4.35, 4.25, 4.40],
}

// Annual average HSP per city
export const HSP_POR_CIUDAD: Record<string, number> = {
  MEDELLIN: 4.5,
  BOGOTA: 4.0,
  CALI: 4.8,
  BARRANQUILLA: 5.2,
  BUCARAMANGA: 4.3,
  CARTAGENA: 5.3,
  PEREIRA: 4.6,
}

// City display names for UI
export const CIUDADES = [
  { value: 'MEDELLIN', label: 'Medellín' },
  { value: 'BOGOTA', label: 'Bogotá' },
  { value: 'CALI', label: 'Cali' },
  { value: 'BARRANQUILLA', label: 'Barranquilla' },
  { value: 'BUCARAMANGA', label: 'Bucaramanga' },
  { value: 'CARTAGENA', label: 'Cartagena' },
  { value: 'PEREIRA', label: 'Pereira' },
] as const

// Cost distribution percentages
export const PROMEDIOS_COSTO = {
  equipos: 24.33,
  materiales: 16.67,
  iva: 6.28,
  margen: 16.38,
}

// Google Drive folder structure template
export const ESTRUCTURA_CARPETAS: Record<string, Record<string, Record<string, Record<string, Record<string, unknown>>>>> = {
  '00_Contacto_y_Venta': {},
  '01_Propuesta_y_Contratacion': {},
  '02_Ingenieria_y_Diseno': {
    Fichas_Tecnicas: {
      Paneles: {},
      Inversores: {},
      Estructura_Soporte: {},
      Tableros_y_Protecciones: {},
      Cableado: {},
    },
    Memorias_de_Calculo: {},
    Planos_y_Diagramas: {},
  },
  '03_Adquisiciones_y_Logistica': {},
  '04_Permisos_y_Legal': {},
  '05_Instalacion_y_Construccion': {
    Reportes_Fotograficos: {},
    Informes_Diarios_Avance: {},
  },
  '06_Puesta_en_Marcha_y_Entrega': {},
  '07_Operacion_y_Mantenimiento_OM': {},
  '08_Administrativo_y_Financiero': {},
  '09_Material_Grafico_y_Marketing': {},
}

// Configurable default parameters
export const DEFAULT_PARAMS = {
  // Surplus energy
  precio_excedentes: 300.0, // COP/kWh

  // Degradation
  tasa_degradacion_anual: 0.001, // 0.1% per year

  // Maintenance
  porcentaje_mantenimiento: 0.05, // 5% of annual savings

  // Efficiency
  performance_ratio_base: 0.75, // 75%
  eficiencia_sistema_estimacion: 0.85, // 85% for initial sizing

  // Cost coefficients — small systems (<20 kW): cost = a * size^b
  costo_pequeno_coef_a: 11917544,
  costo_pequeno_coef_b: -0.484721,

  // Cost coefficients — large systems (>=20 kW): cost = ax³ + bx² + cx + d
  costo_grande_coef_a: -0.265979,
  costo_grande_coef_b: 103.58,
  costo_grande_coef_c: -14285.52,
  costo_grande_coef_d: 3286846.42,

  // Roof type adjustment
  ajuste_cubierta_teja: 1.03, // +3% for tile roof

  // Battery parameters
  profundidad_descarga_default: 0.9, // 90% DoD
  eficiencia_bateria_default: 0.95, // 95% efficiency

  // Carbon
  precio_certificado_carbono_cop: 95000, // COP per ton CO2
  precio_certificado_carbono_usd: 25.50, // USD per ton CO2

  // O&M
  porcentaje_om_anual: 0.02, // 2% of CAPEX
} as const

// Validation limits
export const PARAM_LIMITS = {
  precio_excedentes: { min: 0, max: 2000, step: 10 },
  tasa_degradacion_anual: { min: 0.0001, max: 0.01, step: 0.0001 },
  porcentaje_mantenimiento: { min: 0, max: 0.15, step: 0.01 },
  performance_ratio_base: { min: 0.5, max: 0.95, step: 0.01 },
} as const

// Parameter descriptions for UI
export const PARAM_DESCRIPTIONS: Record<string, string> = {
  precio_excedentes: 'Precio de venta de energía excedente a la red (COP/kWh). En Colombia típicamente entre 200-400 COP/kWh.',
  tasa_degradacion_anual: 'Pérdida de eficiencia anual de los paneles. Típicamente 0.1%-0.5% por año según fabricante.',
  porcentaje_mantenimiento: 'Porcentaje del ahorro anual destinado a mantenimiento. Típicamente 3-7%.',
  performance_ratio_base: 'Eficiencia base del sistema considerando pérdidas. Típicamente 70-80%.',
}

// Emission factors for Colombia
export const EMISSION_FACTORS = {
  colombia_grid: {
    national_average: 0.245, // kg CO2/kWh
    by_region: {
      BOGOTA: 0.220,
      MEDELLIN: 0.250,
      CALI: 0.240,
      BARRANQUILLA: 0.260,
      CARTAGENA: 0.255,
      BUCARAMANGA: 0.235,
      PEREIRA: 0.245,
    } as Record<string, number>,
  },
  colombia_hydro: 0.012,
  colombia_thermal: 0.485,
  certification_rates: {
    carbon_credit_cop_per_ton: 95000,
    usd_per_ton: 25.50,
  },
  equivalency_factors: {
    tree_co2_absorption_kg_per_year: 22,
    car_emissions_kg_per_year: 4200,
    home_electricity_kwh_per_year: 3500,
    flight_emissions_kg_per_km: 0.25,
    plastic_bottle_co2_kg: 0.06,
    smartphone_charge_co2_kg: 0.0083,
  },
} as const

// Inverter database — complete catalog from old calculator
export interface InverterModel {
  modelo: string
  potencia_kw: number
}

export interface InverterBrand {
  label: string
  flag: string
  type: string
  models: InverterModel[]
}

export const INVERTER_DATABASE: Record<string, InverterBrand> = {
  Automatico: {
    label: 'Automático',
    flag: '',
    type: 'Auto',
    models: [], // auto-select based on system size
  },
  Huawei: {
    label: 'Huawei',
    flag: '🇨🇳',
    type: 'Premium',
    models: [
      { modelo: 'SUN2000-3KTL', potencia_kw: 3 },
      { modelo: 'SUN2000-5KTL', potencia_kw: 5 },
      { modelo: 'SUN2000-6KTL', potencia_kw: 6 },
      { modelo: 'SUN2000-8KTL', potencia_kw: 8 },
      { modelo: 'SUN2000-10KTL', potencia_kw: 10 },
      { modelo: 'SUN2000-20KTL', potencia_kw: 20 },
      { modelo: 'SUN2000-30KTL', potencia_kw: 30 },
      { modelo: 'SUN2000-40KTL', potencia_kw: 40 },
      { modelo: 'SUN2000-50KTL', potencia_kw: 50 },
      { modelo: 'SUN2000-100KTL', potencia_kw: 100 },
    ],
  },
  Deye: {
    label: 'Deye',
    flag: '🇨🇳',
    type: 'Híbrido',
    models: [
      { modelo: 'SUN-3K-SG04LP1', potencia_kw: 3 },
      { modelo: 'SUN-5K-SG04LP1', potencia_kw: 5 },
      { modelo: 'SUN-6K-SG04LP1', potencia_kw: 6 },
      { modelo: 'SUN-8K-SG04LP1', potencia_kw: 8 },
      { modelo: 'SUN-10K-SG04LP1', potencia_kw: 10 },
      { modelo: 'SUN-12K-SG04LP3', potencia_kw: 12 },
      { modelo: 'SUN-15K-SG04LP3', potencia_kw: 15 },
      { modelo: 'SUN-20K-SG04LP3', potencia_kw: 20 },
      { modelo: 'SUN-25K-SG04LP3', potencia_kw: 25 },
      { modelo: 'SUN-30K-SG04LP3', potencia_kw: 30 },
      { modelo: 'SUN-50K-SG01HP3', potencia_kw: 50 },
    ],
  },
  Growatt: {
    label: 'Growatt',
    flag: '🇨🇳',
    type: 'Económico',
    models: [
      { modelo: 'MIN 3000TL-X', potencia_kw: 3 },
      { modelo: 'MIN 5000TL-X', potencia_kw: 5 },
      { modelo: 'MIN 6000TL-X', potencia_kw: 6 },
      { modelo: 'MOD 8000TL3-X', potencia_kw: 8 },
      { modelo: 'MOD 10000TL3-X', potencia_kw: 10 },
      { modelo: 'MOD 20000TL3-X', potencia_kw: 20 },
      { modelo: 'MOD 30000TL3-X', potencia_kw: 30 },
      { modelo: 'MAX 50KTL3', potencia_kw: 50 },
      { modelo: 'MAX 100KTL3', potencia_kw: 100 },
    ],
  },
  Solis: {
    label: 'Solis',
    flag: '🇨🇳',
    type: 'Económico',
    models: [
      { modelo: 'S5-GR1P3K', potencia_kw: 3 },
      { modelo: 'S5-GR1P5K', potencia_kw: 5 },
      { modelo: 'S5-GR1P6K', potencia_kw: 6 },
      { modelo: 'S5-GR3P8K', potencia_kw: 8 },
      { modelo: 'S5-GR3P10K', potencia_kw: 10 },
      { modelo: 'S5-GC20K', potencia_kw: 20 },
      { modelo: 'S5-GC30K', potencia_kw: 30 },
      { modelo: 'S5-GC50K', potencia_kw: 50 },
      { modelo: 'S5-GC100K', potencia_kw: 100 },
    ],
  },
  Hoymiles: {
    label: 'Hoymiles',
    flag: '🇨🇳',
    type: 'Microinversor',
    models: [
      { modelo: 'HMS-2000-4T', potencia_kw: 2 },
    ],
  },
} as const

// Days per month
export const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Month names in Spanish
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
