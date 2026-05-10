import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'

const EXPIRY_SECONDS = 60 * 60 * 24 * 90 // 90 days

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Upstash Redis no está configurado')
  }
  return new Redis({ url, token })
}

/** POST — store proposal data, return short ID */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.data) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    const redis = getRedis()
    const id = nanoid(8)
    await redis.set(`share:${id}`, body.data, { ex: EXPIRY_SECONDS })

    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** GET — retrieve proposal data by ID */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'No ID provided' }, { status: 400 })
  }

  try {
    const redis = getRedis()
    const data = await redis.get(`share:${id}`)
    if (!data) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
