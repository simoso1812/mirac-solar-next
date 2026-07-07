import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { fetchPVGIS, getHSPEstimado } from '@/lib/pvgis'

/**
 * Fetch monthly HSP (Peak Sun Hours) data from the EU PVGIS API.
 * Thin wrapper over src/lib/pvgis.ts: rate limit + coordinate rounding.
 */
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat')
  const lon = request.nextUrl.searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon parameters required' }, { status: 400 })
  }

  // ~111m resolution: identical HSP for practical purposes, and rounding makes
  // the Next fetch cache (revalidate 86400) actually hit for nearby requests.
  const latNum = Math.round(parseFloat(lat) * 1000) / 1000
  const lonNum = Math.round(parseFloat(lon) * 1000) / 1000

  if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (redisUrl && redisToken) {
    const redis = new Redis({ url: redisUrl, token: redisToken })
    if (!(await rateLimit(redis, `rl:pvgis:${getClientIp(request)}`, 30, 60))) {
      return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 })
    }
  }

  try {
    const hsp = await fetchPVGIS(latNum, lonNum)
    if (hsp) {
      return NextResponse.json({ hsp, source: 'pvgis' })
    }
    // PVGIS unavailable: fall back to climate-based estimation
    return NextResponse.json({ hsp: getHSPEstimado(latNum, lonNum), source: 'estimated' })
  } catch {
    // Fallback to climate-based estimation
    const hsp = getHSPEstimado(latNum, lonNum)
    return NextResponse.json({ hsp, source: 'estimated' })
  }
}
