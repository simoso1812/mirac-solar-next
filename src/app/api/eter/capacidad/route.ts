import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { trafosCercanos, capacidadQuerySchema, EterServiceError } from '@/lib/eter'

/**
 * GET /api/eter/capacidad?lat=&lon=&radio=&kwp=
 * Transformadores EPM cercanos a un punto, ordenados por distancia, con
 * semáforo CREG 030 y veredicto de viabilidad FV (si se envía kwp).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const parsed = capacidadQuerySchema.safeParse({
    lat: q.get('lat'),
    lon: q.get('lon'),
    radio: q.get('radio') ?? undefined,
    kwp: q.get('kwp') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos: lat y lon requeridos (Colombia)' }, { status: 400 })
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (redisUrl && redisToken) {
    const redis = new Redis({ url: redisUrl, token: redisToken })
    if (!(await rateLimit(redis, `rl:eter:${getClientIp(request)}`, 30, 60))) {
      return NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 })
    }
  }

  try {
    const { lat, lon, radio, kwp } = parsed.data
    const resultados = await trafosCercanos(lat, lon, radio, kwp)
    return NextResponse.json({ count: resultados.length, radioM: radio, resultados })
  } catch (error) {
    const message = error instanceof EterServiceError ? error.message : 'Error consultando el servicio de EPM'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
