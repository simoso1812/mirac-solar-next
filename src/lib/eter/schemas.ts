/**
 * ETER/EPM — tipos y validación de entrada para la consulta de capacidad
 * de transformadores del visor CREG 030 de EPM.
 */
import { z } from 'zod'

export type SemaforoColor = 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO' | 'DESCONOCIDO'

export interface TrafoCapacidad {
  nroTransformador: number | null
  capacidadNominalKva: number | null
  cargabilidadPct: number | null
  semaforo: {
    potencia: SemaforoColor
    energia: SemaforoColor
    mixto: string | null
  }
  /**
   * % de ocupación OFICIAL EPM sobre la capacidad nominal (VALOR_POTENCIA /
   * VALOR_ENERGIA son porcentajes, no kW — es el número que muestra el popup
   * "Disponibilidad según potencia/energía" del visor, antes de sumar lo
   * simulado). Umbrales EPM: VERDE ≤30 · AMARILLO 30–40 · NARANJA 40–50 ·
   * ROJO >50.
   */
  ocupacionPotenciaPct: number | null
  ocupacionEnergiaPct: number | null
  /** Potencia/energía agregada ya comprometida en kW (SUMATORIA_*). */
  comprometido: { potenciaKw: number | null; energia: number | null }
  /**
   * Cupo restante estimado hasta el umbral ROJO (50% de la capacidad
   * nominal): 0.5·kVA_nominal − SUMATORIA_POTENCIA. Heurístico — el dato
   * autoritativo es el color del semáforo.
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

export interface Simulacion {
  potenciaPropuestaKw: number
  /** Ocupación de potencia actual del trafo (sin la propuesta), % EPM. */
  ocupacionActualPotenciaPct: number | null
  /** Ocupación que reportaría el visor al simular la propuesta ("Disponibilidad según potencia"). */
  ocupacionResultantePotenciaPct: number | null
  colorResultante: SemaforoColor
  /** true si la ocupación resultante ≤ 50% (límite CREG 030). */
  dentroDelLimite: boolean
}

export interface Veredicto {
  viable: 'si' | 'condicionado' | 'no' | 'indeterminado'
  kvaDisponiblesEstimados: number | null
  notas: string[]
  /** Simulación de la conexión propuesta (solo cuando se envía kwp). */
  simulacion: Simulacion | null
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
