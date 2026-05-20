import type { ClientData, ProjectData, TechnicalData, AdvancedData } from '@/lib/types'

export const initialClientData: ClientData = {
  nombre: '',
  nit_cc: '',
  email: '',
  telefono: '',
  direccion: '',
}

export const initialProjectData: ProjectData = {
  ciudad: 'MEDELLIN',
  ubicacion_label: '',
  fecha: new Date().toISOString().split('T')[0],
  plantilla: 'standard',
  lat: null,
  lon: null,
  hsp_mensual_pvgis: null,
  map_url: null,
}

export const initialTechnicalData: TechnicalData = {
  consumo_mensual_kwh: 0,
  potencia_panel_w: 615,
  factor_seguridad: 1.1,
  tipo_cubierta: 'metalica',
  clima: 'templado',
  override_paneles: null,
  marca_panel: '',
  modelo_panel: '',
}

export const initialAdvancedData: AdvancedData = {
  marca_inversor: 'Automatico',
  marca_inversor_custom: '',
  modelo_inversor: '',
  override_inversores: null,
  medidor_inteligente: false,
  medidor_bidireccional: false,
  modo_conexion: 'net_metering',
  financiamiento: {
    habilitado: false,
    tasa_interes: 0.12,
    plazo_meses: 60,
    porcentaje_financiado: 0.7,
  },
  bateria: {
    habilitada: false,
    capacidad_kwh: 5,
    profundidad_descarga: 0.9,
    eficiencia: 0.95,
    horas_autonomia: 48,
    costo_kwh_bateria: 400000,
  },
  ppa: {
    habilitada: false,
    precio_kwh: 600,
    duracion_anios: 20,
  },
  beneficios_tributarios: true,
  incluir_deduccion_renta: true,
  incluir_depreciacion_acelerada: true,
  precio_manual: null,
  notas: '',
  costo_kwh: 850,
  indexacion_energia: 0.05,
  tasa_descuento: 0.10,
  horizonte_anios: 25,
  precio_excedentes: 300,
  tasa_degradacion: 0.001,
  porcentaje_mantenimiento: 0.05,
  performance_ratio_base: 0.75,
  demora_6_meses: false,
}

export function deepMerge<T>(base: T, partial: unknown): T {
  if (partial === null || partial === undefined) return base
  if (typeof base !== 'object' || base === null) return (partial as T) ?? base
  if (Array.isArray(base)) return (partial as T) ?? base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  const src = (partial as Record<string, unknown>) ?? {}
  for (const key of Object.keys(out)) {
    if (key in src) {
      out[key] = deepMerge(out[key], src[key])
    }
  }
  return out as T
}
