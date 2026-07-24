/**
 * ETER/EPM — tipos y validación de entrada para la consulta de capacidad
 * de transformadores del visor CREG 030 de EPM.
 */
import { z } from 'zod'

export type SemaforoColor = 'VERDE' | 'AMARILLO' | 'ROJO' | 'DESCONOCIDO'

export interface TrafoCapacidad {
  nroTransformador: number | null
  capacidadNominalKva: number | null
  cargabilidadPct: number | null
  semaforo: {
    potencia: SemaforoColor
    energia: SemaforoColor
    mixto: string | null
  }
  /** Potencia solicitada/instalada agregada reportada por EPM (VALOR_POTENCIA). */
  potenciaSolicitadaKw: number | null
  energiaSolicitada: number | null
  /** Suma ponderada ya comprometida contra el límite CREG 030 (SUMATORIA_*). */
  comprometido: { potenciaKw: number | null; energia: number | null }
  /**
   * Cupo restante estimado bajo la regla CREG 030 (autogeneración agregada
   * ≤ 50% de la capacidad nominal): 0.5·kVA_nominal − SUMATORIA_POTENCIA.
   * Heurístico — el dato autoritativo es el color del semáforo.
   */
  cupoEstimadoKva: number | null
  municipio: string | null
  subestacion: string | null
  circuito: string | null
  tensionKv: string | null
  fases: string | null
  propietario: string | null
  tipoPropietario: string | null
  ubicacion?: { lat: number; lon: number }
}

export interface Veredicto {
  viable: 'si' | 'condicionado' | 'no' | 'indeterminado'
  kvaDisponiblesEstimados: number | null
  notas: string[]
}

export const trafoParamsSchema = z.object({
  nro: z.coerce.number().int().positive(),
  kwp: z.coerce.number().positive().max(5000).optional(),
})

export const trafosQuerySchema = z.object({
  municipio: z.string().min(2).max(60).optional(),
  semaforo: z.enum(['VERDE', 'AMARILLO', 'ROJO']).optional(),
  minKva: z.coerce.number().positive().optional(),
})

export const capacidadQuerySchema = z.object({
  lat: z.coerce.number().min(-4.5).max(13.5),
  lon: z.coerce.number().min(-82).max(-66),
  radio: z.coerce.number().int().min(10).max(2000).default(300),
  kwp: z.coerce.number().positive().max(5000).optional(),
})
