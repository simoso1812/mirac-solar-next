/**
 * Tools MCP de capacidad de red EPM (visor ETER / semáforo CREG 030).
 * Wrappers agent-friendly sobre src/lib/eter — responden la pregunta de
 * negocio "¿el trafo aguanta esta conexión FV y de qué potencia?".
 */
import { z } from 'zod'
import { getTrafo, trafosCercanos, type TrafoConVeredicto } from '@/lib/eter'

export const capacidadTrafoInputShape = {
  nro_transformador: z.coerce
    .number()
    .int()
    .positive()
    .describe('Número del transformador EPM (visible en el visor ETER o en la factura/acta de conexión).'),
  kwp_propuesto: z.coerce
    .number()
    .positive()
    .max(5000)
    .optional()
    .describe('Tamaño FV propuesto en kWp, para evaluar viabilidad contra el cupo del trafo. Opcional.'),
}

export const trafosCercanosInputShape = {
  lat: z.coerce.number().min(-4.5).max(13.5).describe('Latitud del proyecto (Colombia).'),
  lon: z.coerce.number().min(-82).max(-66).describe('Longitud del proyecto (Colombia).'),
  radio_m: z.coerce
    .number()
    .int()
    .min(10)
    .max(2000)
    .default(300)
    .describe('Radio de búsqueda en metros alrededor del punto. Default 300.'),
  kwp_propuesto: z.coerce
    .number()
    .positive()
    .max(5000)
    .optional()
    .describe('Tamaño FV propuesto en kWp para evaluar viabilidad en cada trafo. Opcional.'),
}

function resumenTrafo({ trafo, veredicto, distanciaM }: TrafoConVeredicto): string {
  const partes = [
    `Trafo ${trafo.nroTransformador ?? '?'} (${trafo.municipio ?? 'municipio ?'}): ${trafo.capacidadNominalKva ?? '?'} kVA`,
    `semáforo potencia ${trafo.semaforo.potencia}`,
    `cargabilidad ${trafo.cargabilidadPct !== null ? trafo.cargabilidadPct.toFixed(0) + '%' : 'n/d'}`,
    `cupo AGPE ocupado ${trafo.ocupacionCupoPct !== null ? trafo.ocupacionCupoPct.toFixed(0) + '%' : 'n/d'}`,
    `cupo estimado ${veredicto.kvaDisponiblesEstimados !== null ? veredicto.kvaDisponiblesEstimados.toFixed(1) + ' kVA' : 'n/d'}`,
    `veredicto: ${veredicto.viable.toUpperCase()}`,
  ]
  if (distanciaM !== undefined) partes.unshift(`a ${distanciaM} m`)
  return partes.join(' · ')
}

export async function runCapacidadTrafo(args: {
  nro_transformador: number
  kwp_propuesto?: number
}): Promise<{ summary: string; structured: Record<string, unknown> }> {
  const result = await getTrafo(args.nro_transformador, args.kwp_propuesto)
  if (!result) {
    throw new Error(`Transformador ${args.nro_transformador} no encontrado en el servicio de EPM.`)
  }
  const summary = [
    resumenTrafo(result),
    `Subestación ${result.trafo.subestacion ?? 'n/d'}, circuito ${result.trafo.circuito ?? 'n/d'}, ${result.trafo.tensionKv ?? '?'} kV.`,
    ...result.veredicto.notas,
  ].join('\n')
  return { summary, structured: { ...result } }
}

export async function runTrafosCercanos(args: {
  lat: number
  lon: number
  radio_m: number
  kwp_propuesto?: number
}): Promise<{ summary: string; structured: Record<string, unknown> }> {
  const resultados = await trafosCercanos(args.lat, args.lon, args.radio_m, args.kwp_propuesto)
  if (resultados.length === 0) {
    return {
      summary: `Sin transformadores EPM en ${args.radio_m} m alrededor de (${args.lat}, ${args.lon}). Amplía el radio o verifica que el punto esté en zona de cobertura EPM.`,
      structured: { count: 0, resultados: [] },
    }
  }
  const top = resultados.slice(0, 10)
  const summary = [
    `${resultados.length} trafos EPM en ${args.radio_m} m (mostrando ${top.length} más cercanos):`,
    ...top.map(resumenTrafo),
  ].join('\n')
  return { summary, structured: { count: resultados.length, radioM: args.radio_m, resultados: top } }
}
