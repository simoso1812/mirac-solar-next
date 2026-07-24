/**
 * ETER/EPM — operaciones de alto nivel compartidas por las rutas API
 * (/api/eter/*) y los tools MCP (epm_*).
 *
 * Caché: el cliente usa el fetch cache de Next (revalidate 6 h), suficiente
 * para no golpear a EPM en consultas repetidas desde Vercel.
 */
import { queryTrafoByNumero, queryTrafosByMunicipio, queryTrafosNear } from './client'
import { parseTrafo, distanceM } from './parse'
import { evaluarViabilidad } from './veredicto'
import type { TrafoCapacidad, Veredicto } from './schemas'

export { EterServiceError } from './client'
export { evaluarViabilidad } from './veredicto'
export type { TrafoCapacidad, Veredicto, SemaforoColor } from './schemas'
export { trafoParamsSchema, trafosQuerySchema, capacidadQuerySchema } from './schemas'

export interface TrafoConVeredicto {
  trafo: TrafoCapacidad
  veredicto: Veredicto
  distanciaM?: number
}

/** Un trafo por número EPM, con veredicto (null si no existe). */
export async function getTrafo(nro: number, kwp?: number): Promise<TrafoConVeredicto | null> {
  const feature = await queryTrafoByNumero(nro)
  if (!feature) return null
  const trafo = parseTrafo(feature)
  return { trafo, veredicto: evaluarViabilidad(trafo, kwp) }
}

/** Lista por municipio/semáforo/kVA. El servicio EPM trunca en ~2000. */
export async function listTrafos(opts: {
  municipio?: string
  semaforo?: 'VERDE' | 'AMARILLO' | 'ROJO'
  minKva?: number
}): Promise<{ trafos: TrafoCapacidad[]; truncated: boolean }> {
  const { features, truncated } = await queryTrafosByMunicipio(opts)
  return { trafos: features.map(parseTrafo), truncated }
}

/** Trafos en un radio (m) alrededor de un punto, ordenados por distancia. */
export async function trafosCercanos(
  lat: number,
  lon: number,
  radioM: number,
  kwp?: number,
): Promise<TrafoConVeredicto[]> {
  const features = await queryTrafosNear(lat, lon, radioM)
  return features
    .map((f) => {
      const trafo = parseTrafo(f)
      return {
        trafo,
        veredicto: evaluarViabilidad(trafo, kwp),
        distanciaM: trafo.ubicacion
          ? Math.round(distanceM(lat, lon, trafo.ubicacion.lat, trafo.ubicacion.lon))
          : undefined,
      }
    })
    .sort((a, b) => (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity))
}
