/**
 * PVGIS monthly HSP (Peak Sun Hours) fetch + climate-based fallback.
 *
 * Extracted from /api/pvgis so the MCP tools can resolve radiation for
 * arbitrary lat/lon server-side. The route stays a thin wrapper (rate limit
 * + coordinate rounding); both callers share this exact logic so a shared
 * link created via MCP recomputes with the same HSP the agent quoted.
 */

const DIAS_POR_MES = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const PVGIS_TILT_DEG = 10
export const PVGIS_ASPECT_DEG = 0

export interface RadiationFetch {
  hsp: number[]
  source: 'pvgis_poa' | 'estimada'
}

export function pvgisUrl(lat: number, lon: number): string {
  const url = new URL('https://re.jrc.ec.europa.eu/api/v5_3/MRcalc')
  url.searchParams.set('lat', lat.toString())
  url.searchParams.set('lon', lon.toString())
  // MRcalc returns no irradiation values unless an output option is chosen;
  // selectrad=1 is the one that emits H(i)_m for `angle`.
  url.searchParams.set('selectrad', '1')
  url.searchParams.set('angle', PVGIS_TILT_DEG.toString())
  url.searchParams.set('aspect', PVGIS_ASPECT_DEG.toString())
  url.searchParams.set('outputformat', 'json')
  url.searchParams.set('browser', '0')
  return url.toString()
}

async function attemptPVGIS(url: string, lat: number, lon: number): Promise<RadiationFetch | null> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MiracSolarCalculator/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const data = await res.json()
  return processPVGISData(data, lat, lon)
}

export async function fetchPVGIS(lat: number, lon: number): Promise<RadiationFetch | null> {
  const urlStr = pvgisUrl(lat, lon)

  // One retry after a short delay; kept as two explicit attempts.
  try {
    const first = await attemptPVGIS(urlStr, lat, lon)
    if (first) return first
  } catch {
    // fall through to the retry
  }

  await new Promise((r) => setTimeout(r, 1000))

  try {
    const second = await attemptPVGIS(urlStr, lat, lon)
    if (second) return second
  } catch {
    // fall through
  }

  // Both attempts failed: let the caller fall back and label the source
  // as 'estimada' instead of claiming PVGIS data.
  return null
}

/**
 * Parse an MRcalc response into 12 daily HSP values (kWh/m²/día).
 * MRcalc returns one row per month per year; each calendar month is the mean
 * of its inclined-plane H(i)_m rows. Only a year where all 12 months came
 * from H(i)_m is labeled 'pvgis_poa'; any gap is backfilled with the climate
 * estimate and the whole result is labeled 'estimada'.
 */
export function processPVGISData(
  data: Record<string, unknown>,
  lat: number,
  lon: number,
): RadiationFetch | null {
  const outputs = (data.outputs ?? {}) as Record<string, unknown>
  const monthlyData = outputs.monthly
  if (!Array.isArray(monthlyData) || !monthlyData.length) return null

  const sums = Array<number>(12).fill(0)
  const counts = Array<number>(12).fill(0)

  for (const month of monthlyData as Record<string, unknown>[]) {
    if (!month) continue
    const monthIndex = ((month.month as number) ?? 1) - 1
    if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex >= 12) continue

    const hi = month['H(i)_m']
    if (typeof hi === 'number' && Number.isFinite(hi) && hi > 0) {
      sums[monthIndex] += hi
      counts[monthIndex] += 1
    }
  }

  let allPoa = true
  const hsp: number[] = []
  for (let i = 0; i < 12; i++) {
    let daily: number
    if (counts[i] > 0) {
      daily = sums[i] / counts[i] / DIAS_POR_MES[i]
      if (daily > 8) allPoa = false
    } else {
      allPoa = false
      const region = getClimateData(lat)
      const seasonal = getSeasonalFactor(lat, i)
      const altitude = getAltitudeFactor(lat, lon)
      daily = (region.baseHsp + region.variation * seasonal) * altitude
    }
    hsp.push(Math.round(daily * 100) / 100)
  }

  return { hsp, source: allPoa ? 'pvgis_poa' : 'estimada' }
}

export function getHSPEstimado(lat: number, lon: number): number[] {
  const hsp: number[] = []
  const region = getClimateData(lat)
  const altitude = getAltitudeFactor(lat, lon)

  for (let i = 0; i < 12; i++) {
    const seasonal = getSeasonalFactor(lat, i)
    let val = (region.baseHsp + region.variation * seasonal) * altitude
    val = Math.max(1.5, Math.min(7.5, val))
    hsp.push(Math.round(val * 100) / 100)
  }

  return hsp
}

function getClimateData(lat: number) {
  const absLat = Math.abs(lat)
  if (absLat < 10) return { baseHsp: 5.2, variation: 0.8 }
  if (absLat < 30) return { baseHsp: 4.8, variation: 1.2 }
  if (absLat < 40) return { baseHsp: 4.2, variation: 1.8 }
  if (absLat < 60) return { baseHsp: 3.5, variation: 2.2 }
  return { baseHsp: 2.8, variation: 2.5 }
}

function getSeasonalFactor(lat: number, monthIndex: number): number {
  const angle = (2 * Math.PI * monthIndex) / 12
  return lat >= 0
    ? Math.sin(angle - Math.PI / 2)
    : Math.sin(angle + Math.PI / 2)
}

function getAltitudeFactor(lat: number, lon: number): number {
  // Colombia-specific altitude estimation
  if (lat >= 4 && lat <= 12 && lon >= -80 && lon <= -70) {
    if (lat < 6) return 1.0    // Costa Caribe
    if (lat < 8) return 0.95   // Región Andina baja
    return 0.90                 // Región Andina alta
  }
  return 1.0
}
