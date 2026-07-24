import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { getTrafo, trafoParamsSchema, EterServiceError } from '@/lib/eter'

/**
 * GET /api/eter/trafo/[nro]?kwp=
 * Capacidad, semáforo CREG 030 y veredicto Mirac de un transformador EPM.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nro: string }> },
) {
  const { nro } = await params
  const parsed = trafoParamsSchema.safeParse({
    nro,
    kwp: request.nextUrl.searchParams.get('kwp') ?? undefined,
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
    const result = await getTrafo(parsed.data.nro, parsed.data.kwp)
    if (!result) {
      return NextResponse.json({ error: `Transformador ${parsed.data.nro} no encontrado en EPM` }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof EterServiceError ? error.message : 'Error consultando el servicio de EPM'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
