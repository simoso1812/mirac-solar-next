/**
 * Cliente del servicio ArcGIS público de EPM detrás del visor ETER
 * (https://maps.epm.com.co/ETER/Visor/Visor) — semáforo CREG 030 de
 * capacidad de conexión de autogeneración por transformador.
 *
 * Único módulo del repo que habla con EPM. Gotchas del servicio (verificados
 * 2026-07-23): no soporta paginación (resultRecordCount → 400), los nombres
 * de campo deben ir totalmente calificados (SIGMAENERGIA.MOV_VETRANSFO_PT.* /
 * CREG030.C30_CALCULO_SEMAFORO.*), MUNICIPIO viene con tildes (MEDELLÍN),
 * y el tope implícito de respuesta es maxRecordCount=2000.
 *
 * Servicio público sin contrato de API: tratar como best-effort; el dato
 * oficial sigue siendo el visor.
 */

const LAYER_URL =
  'https://maps.epm.com.co/arcgis/rest/services/CREG030/Semaforo_Transformador/MapServer/0/query'

// Prefijos de los dos orígenes de la capa unida.
export const F_TRAFO = 'SIGMAENERGIA.MOV_VETRANSFO_PT'
export const F_SEMAFORO = 'CREG030.C30_CALCULO_SEMAFORO'

/** Campos que pedimos siempre (parse.ts depende de esta lista). */
export const OUT_FIELDS = [
  `${F_TRAFO}.NRO_TRANSFORMADOR`,
  `${F_TRAFO}.CAPACIDAD_NOMINAL`,
  `${F_TRAFO}.CARGABILIDAD`,
  `${F_TRAFO}.MUNICIPIO`,
  `${F_TRAFO}.SUBESTACION_CONN`,
  `${F_TRAFO}.CIRCUITO_CONN`,
  `${F_TRAFO}.TENSION_CONN`,
  `${F_TRAFO}.FASES_CONN`,
  `${F_TRAFO}.PROPIETARIO`,
  `${F_TRAFO}.TIPO_PROPIETARIO`,
  `${F_SEMAFORO}.COLOR_POTENCIA`,
  `${F_SEMAFORO}.COLOR_ENERGIA`,
  `${F_SEMAFORO}.COLOR_MIXTO`,
  `${F_SEMAFORO}.VALOR_POTENCIA`,
  `${F_SEMAFORO}.VALOR_ENERGIA`,
  `${F_SEMAFORO}.SUMATORIA_POTENCIA`,
  `${F_SEMAFORO}.SUMATORIA_ENERGIA`,
].join(',')

export interface ArcgisFeature {
  attributes: Record<string, unknown>
  geometry?: { x: number; y: number }
}

interface ArcgisQueryResponse {
  features?: ArcgisFeature[]
  error?: { code: number; message: string }
  exceededTransferLimit?: boolean
}

export class EterServiceError extends Error {}

async function arcgisQuery(params: Record<string, string>): Promise<ArcgisQueryResponse> {
  const search = new URLSearchParams({
    f: 'json',
    outFields: OUT_FIELDS,
    returnGeometry: 'true',
    outSR: '4326',
    ...params,
  })
  const doFetch = () =>
    fetch(`${LAYER_URL}?${search}`, {
      headers: {
        // Hoy el servicio responde sin estos headers, pero el WAF de EPM ha
        // bloqueado otros clientes; imitar al visor es barato y robusto.
        Referer: 'https://maps.epm.com.co/ETER/Visor/Visor',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15_000),
      // El semáforo se recalcula con baja frecuencia; cache del fetch de Next.
      next: { revalidate: 21_600 },
    })

  let res: Response
  try {
    res = await doFetch()
  } catch {
    // Un único retry ante fallo de red/timeout.
    res = await doFetch()
  }
  if (!res.ok) {
    throw new EterServiceError(`Servicio EPM respondió HTTP ${res.status}`)
  }
  const json = (await res.json()) as ArcgisQueryResponse
  if (json.error) {
    throw new EterServiceError(`Error ArcGIS ${json.error.code}: ${json.error.message}`)
  }
  return json
}

/** Busca un transformador por su número EPM. */
export async function queryTrafoByNumero(nro: number): Promise<ArcgisFeature | null> {
  const json = await arcgisQuery({
    where: `${F_TRAFO}.NRO_TRANSFORMADOR = ${Math.trunc(nro)}`,
  })
  return json.features?.[0] ?? null
}

/** Trafos por municipio (con o sin tilde) y filtros opcionales. */
export async function queryTrafosByMunicipio(opts: {
  municipio?: string
  semaforo?: 'VERDE' | 'AMARILLO' | 'ROJO'
  minKva?: number
}): Promise<{ features: ArcgisFeature[]; truncated: boolean }> {
  const clauses: string[] = []
  if (opts.municipio) {
    // MUNICIPIO viene con tildes (MEDELLÍN, ITAGÜÍ) y el servicio no soporta
    // TRANSLATE (verificado: error 400). Comparación acento-insensible vía
    // LIKE: cada vocal/N del nombre normalizado se vuelve comodín '_'
    // (M_D_LL_N matchea MEDELLÍN; sin colisiones en la práctica).
    const m = opts.municipio
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/'/g, "''")
      .replace(/[AEIOUN]/g, '_')
    clauses.push(`UPPER(${F_TRAFO}.MUNICIPIO) LIKE '${m}'`)
  }
  if (opts.semaforo) {
    clauses.push(`${F_SEMAFORO}.COLOR_POTENCIA = '${opts.semaforo}'`)
  }
  if (opts.minKva) {
    clauses.push(`${F_TRAFO}.CAPACIDAD_NOMINAL >= ${opts.minKva}`)
  }
  const json = await arcgisQuery({
    where: clauses.length ? clauses.join(' AND ') : '1=1',
    returnGeometry: 'false',
  })
  const features = json.features ?? []
  return { features, truncated: json.exceededTransferLimit === true || features.length >= 2000 }
}

/** Trafos dentro de un radio (m) alrededor de un punto WGS84. */
export async function queryTrafosNear(
  lat: number,
  lon: number,
  radioM: number,
): Promise<ArcgisFeature[]> {
  const json = await arcgisQuery({
    where: '1=1',
    geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(radioM),
    units: 'esriSRUnit_Meter',
  })
  return json.features ?? []
}
