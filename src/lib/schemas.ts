import { z } from 'zod'

export const clientSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  nit_cc: z.string(),
  email: z.string().refine((v) => v === '' || z.string().email().safeParse(v).success, {
    message: 'Email inválido',
  }),
  telefono: z.string(),
  direccion: z.string().min(5, 'Dirección requerida'),
})

export const projectSchema = z.object({
  ciudad: z.string().min(1, 'Ciudad requerida'),
  ubicacion_label: z.string().optional(),
  fecha: z.string().min(1, 'Fecha requerida'),
  plantilla: z.string(),
})

export const technicalSchema = z.object({
  consumo_mensual_kwh: z.number().min(50, 'Mínimo 50 kWh').max(500000, 'Máximo 500,000 kWh'),
  potencia_panel_w: z.number().min(300, 'Mínimo 300 W').max(1000, 'Máximo 1000 W'),
  factor_seguridad: z.number().min(1.0, 'Mínimo 1.0').max(1.5, 'Máximo 1.5'),
  tipo_cubierta: z.enum(['metalica', 'teja', 'losa']),
  clima: z.enum(['templado', 'calido', 'frio']),
  override_paneles: z.number().min(2, 'Mínimo 2 paneles').max(5000, 'Máximo 5000 paneles').nullable(),
  marca_panel: z.string(),
  modelo_panel: z.string(),
})

const inverterOverrideSchema = z.object({
  potencia_kw: z.number().min(1),
  cantidad: z.number().min(1).max(20),
})

export const advancedSchema = z.object({
  marca_inversor: z.string(),
  marca_inversor_custom: z.string(),
  modelo_inversor: z.string(),
  override_inversores: z.array(inverterOverrideSchema).nullable(),
  medidor_inteligente: z.boolean(),
  medidor_bidireccional: z.boolean(),
  modo_conexion: z.enum(['net_metering', 'net_billing', 'autoconsumo']),
  financiamiento: z.object({
    habilitado: z.boolean(),
    tasa_interes: z.number().min(0).max(1),
    plazo_meses: z.number().min(12).max(240),
    porcentaje_financiado: z.number().min(0).max(1),
  }),
  bateria: z.object({
    habilitada: z.boolean(),
    capacidad_kwh: z.number().min(0),
    profundidad_descarga: z.number().min(0).max(1),
    eficiencia: z.number().min(0).max(1),
    horas_autonomia: z.number().min(1).max(168),
    costo_kwh_bateria: z.number().min(100000).max(2000000),
  }),
  ppa: z.object({
    habilitada: z.boolean(),
    opciones: z.array(z.object({
      precio_kwh: z.number().min(1).max(10000),
      duracion_anios: z.number().min(1).max(40),
    })).min(1),
  }),
  beneficios_tributarios: z.boolean(),
  incluir_deduccion_renta: z.boolean(),
  incluir_depreciacion_acelerada: z.boolean(),
  precio_manual: z.number().nullable(),
  notas: z.string(),
  costo_kwh: z.number().min(1).max(5000),
  indexacion_energia: z.number().min(0).max(0.20),
  tasa_descuento: z.number().min(0).max(0.25),
  horizonte_anios: z.number().min(10).max(40),
  precio_excedentes: z.number().min(0).max(2000),
  tasa_degradacion: z.number().min(0.0001).max(0.01),
  porcentaje_mantenimiento: z.number().min(0).max(0.15),
  performance_ratio_base: z.number().min(0.5).max(0.95),
  demora_6_meses: z.boolean(),
})

export type ClientFormValues = z.infer<typeof clientSchema>
export type ProjectFormValues = z.infer<typeof projectSchema>
export type TechnicalFormValues = z.infer<typeof technicalSchema>
export type AdvancedFormValues = z.infer<typeof advancedSchema>
