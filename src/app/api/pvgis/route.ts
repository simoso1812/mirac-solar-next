import { NextRequest, NextResponse } from 'next/server'

const DIAS_POR_MES = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Fetch monthly HSP (Peak Sun Hours) data from the EU PVGIS API
 */
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lon = request.nextUrl.searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon parameters required' }, { status: 400 })
  }

  const latNum = parseFloat(lat)
  const lonNum = parseFloat(lon)

  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  try {
    const hsp = await fetchPVGIS(latNum, lonNum)
    return NextResponse.json({ hsp, source: hsp ? 'pvgis' : 'estimated' })
  } catch {
    // Fallback to climate-based estimation
    const hsp = getHSPEstimado(latNum, lonNum)
    return NextResponse.json({ hsp, source: 'estimated' })
  }
}

async function attemptPVGIS(url: string, lat: number, lon: number): Promise<number[] | null> {
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

async function fetchPVGIS(lat: number, lon: number): Promise<number[] | null> {
  const url = new URL('https://re.jrc.ec.europa.eu/api/MRcalc')
  url.searchParams.set('lat', lat.toString())
  url.searchParams.set('lon', lon.toString())
  url.searchParams.set('horirrad', '1')
  url.searchParams.set('outputformat', 'json')
  url.searchParams.set('components', '1')
  const urlStr = url.toString()

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
    // fall through to the city-based estimate
  }

  return getHSPEstimado(lat, lon)
}

function processPVGISData(data: Record<string, unknown>, lat: number, lon: number): number[] | null {
  const outputs = (data.outputs ?? {}) as Record<string, unknown>
  const monthlyData = (outputs.monthly ?? []) as Record<string, unknown>[]

  if (!monthlyData.length) return getHSPEstimado(lat, lon)

  const hspMensual: number[] = []

  for (const month of monthlyData) {
    let hspDiario: number | null = null
    const monthIndex = ((month.month as number) ?? 1) - 1

    if (monthIndex < 0 || monthIndex >= 12) continue

    // Try different PVGIS response keys
    if (month['H(h)_m'] != null) {
      hspDiario = (month['H(h)_m'] as number) / DIAS_POR_MES[monthIndex]
    } else if (month['H_d'] != null && month['H_b'] != null) {
      hspDiario = ((month['H_d'] as number) + (month['H_b'] as number)) / DIAS_POR_MES[monthIndex]
    } else if (month['G(i)'] != null) {
      hspDiario = (month['G(i)'] as number) / DIAS_POR_MES[monthIndex]
    }

    if (hspDiario == null || hspDiario <= 0 || hspDiario > 8) {
      const region = getClimateData(lat)
      const seasonal = getSeasonalFactor(lat, monthIndex)
      const altitude = getAltitudeFactor(lat, lon)
      hspDiario = (region.baseHsp + region.variation * seasonal) * altitude
    }

    hspMensual.push(Math.round(hspDiario * 100) / 100)
  }

  // Fill missing months
  while (hspMensual.length < 12) {
    const idx = hspMensual.length
    const region = getClimateData(lat)
    const seasonal = getSeasonalFactor(lat, idx)
    const altitude = getAltitudeFactor(lat, lon)
    hspMensual.push(Math.round((region.baseHsp + region.variation * seasonal) * altitude * 100) / 100)
  }

  return hspMensual
}

function getHSPEstimado(lat: number, lon: number): number[] {
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
