/**
 * Mapea los atributos crudos del servicio ArcGIS de EPM al tipo limpio
 * TrafoCapacidad.
 *
 * Semántica CREG 030 observada en datos reales (2026-07-23):
 * - COLOR_POTENCIA/COLOR_ENERGIA: 'VERDE' | 'AMARILLO' | 'ROJO';
 *   COLOR_MIXTO los concatena ("VERDE-VERDE").
 * - VALOR_POTENCIA: potencia solicitada/instalada agregada (kW bruto).
 * - SUMATORIA_POTENCIA: suma ponderada que EPM compara contra el límite
 *   CREG 030 del 50% de la capacidad nominal — en todos los trafos ROJOS
 *   muestreados, SUMATORIA_POTENCIA ≥ 0.5·CAPACIDAD_NOMINAL.
 */
import { F_TRAFO, F_SEMAFORO, type ArcgisFeature } from './client'
import type { SemaforoColor, TrafoCapacidad } from './schemas'

function num(attrs: Record<string, unknown>, field: string): number | null {
  const v = attrs[field]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function str(attrs: Record<string, unknown>, field: string): string | null {
  const v = attrs[field]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function color(raw: string | null): SemaforoColor {
  if (raw === 'VERDE' || raw === 'AMARILLO' || raw === 'ROJO') return raw
  return 'DESCONOCIDO'
}

export function parseTrafo(feature: ArcgisFeature): TrafoCapacidad {
  const a = feature.attributes
  const capacidadNominalKva = num(a, `${F_TRAFO}.CAPACIDAD_NOMINAL`)
  const comprometidoPotencia = num(a, `${F_SEMAFORO}.SUMATORIA_POTENCIA`)

  // Cupo bajo la regla CREG 030 (≤50% de la capacidad nominal). Heurístico:
  // el color del semáforo es el dato autoritativo de EPM.
  const cupoEstimadoKva =
    capacidadNominalKva !== null
      ? Math.max(0, 0.5 * capacidadNominalKva - (comprometidoPotencia ?? 0))
      : null

  // % del cupo CREG 030 ya comprometido (>100% en trafos rojos).
  const ocupacionCupoPct =
    capacidadNominalKva !== null && capacidadNominalKva > 0
      ? Math.round(((comprometidoPotencia ?? 0) / (0.5 * capacidadNominalKva)) * 1000) / 10
      : null

  // CARGABILIDAD llega a veces como fracción (0.18 = 18%) y a veces como
  // porcentaje; normalizar a porcentaje (valores ≤ 1.5 se asumen fracción).
  const cargabilidadRaw = num(a, `${F_TRAFO}.CARGABILIDAD`)
  const cargabilidadPct =
    cargabilidadRaw !== null && cargabilidadRaw <= 1.5 ? cargabilidadRaw * 100 : cargabilidadRaw

  return {
    nroTransformador: num(a, `${F_TRAFO}.NRO_TRANSFORMADOR`),
    capacidadNominalKva,
    cargabilidadPct,
    semaforo: {
      potencia: color(str(a, `${F_SEMAFORO}.COLOR_POTENCIA`)),
      energia: color(str(a, `${F_SEMAFORO}.COLOR_ENERGIA`)),
      mixto: str(a, `${F_SEMAFORO}.COLOR_MIXTO`),
    },
    potenciaSolicitadaKw: num(a, `${F_SEMAFORO}.VALOR_POTENCIA`),
    energiaSolicitada: num(a, `${F_SEMAFORO}.VALOR_ENERGIA`),
    comprometido: {
      potenciaKw: comprometidoPotencia,
      energia: num(a, `${F_SEMAFORO}.SUMATORIA_ENERGIA`),
    },
    cupoEstimadoKva,
    ocupacionCupoPct,
    municipio: str(a, `${F_TRAFO}.MUNICIPIO`),
    subestacion: str(a, `${F_TRAFO}.SUBESTACION_CONN`),
    circuito: str(a, `${F_TRAFO}.CIRCUITO_CONN`),
    tensionKv: str(a, `${F_TRAFO}.TENSION_CONN`),
    fases: str(a, `${F_TRAFO}.FASES_CONN`),
    propietario: str(a, `${F_TRAFO}.PROPIETARIO`),
    tipoPropietario: str(a, `${F_TRAFO}.TIPO_PROPIETARIO`),
    ubicacion:
      feature.geometry && Number.isFinite(feature.geometry.x)
        ? { lat: feature.geometry.y, lon: feature.geometry.x }
        : undefined,
  }
}

/** Distancia haversine en metros (para ordenar trafos cercanos). */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
