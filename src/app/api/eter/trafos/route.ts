import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { listTrafos, trafosQuerySchema, EterServiceError } from '@/lib/eter'

/**
 * GET /api/eter/trafos?municipio=&semaforo=&minKva=
 * Lista de transformadores EPM con su semáforo CREG 030.
 * El servicio de EPM no soporta paginación: la respuesta se trunca en ~2000
 * registros (`truncated: true`); acotar con los filtros.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const parsed = trafosQuerySchema.safeParse({
    municipio: q.get('municipio') ?? undefined,
    semaforo: q.get('semaforo')?.toUpperCase() ?? undefined,
    minKva: q.get('minKva') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
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
    const { trafos, truncated } = await listTrafos(parsed.data)
    return NextResponse.json({ count: trafos.length, truncated, trafos })
  } catch (error) {
    const message = error instanceof EterServiceError ? error.message : 'Error consultando el servicio de EPM'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
