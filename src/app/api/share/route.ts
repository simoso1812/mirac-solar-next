import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

const EXPIRY_SECONDS = 60 * 60 * 24 * 90 // 90 days
// Legit payloads carry inline base64 images and can reach ~4MB; cap just above that.
const MAX_BODY_BYTES = 4_500_000
const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{4,30}$/

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Upstash Redis no está configurado')
  }
  return new Redis({ url, token })
}

// Validation mirrors SharePayload in src/lib/share.ts. It is a gate only:
// after it passes we store the ORIGINAL parsed JSON, never zod's output,
// so unknown future keys are not stripped.
const singlePayloadSchema = z.object({
  c: z.object({
    n: z.string().max(500),
    d: z.string().max(500),
    e: z.string().max(500),
    t: z.string().max(500),
    a: z.string().max(500),
  }),
  p: z.object({
    ci: z.string().max(100),
    f: z.string().max(100),
    la: z.number().nullish(),
    lo: z.number().nullish(),
    h: z.array(z.number()).length(12).nullish(),
  }),
  t: z.object({
    co: z.number(),
    pw: z.number(),
    fs: z.number(),
    tc: z.string().max(100),
    cl: z.string().max(100),
    op: z.number().nullish(),
    mp: z.string().max(100).optional(),
    mo: z.string().max(100).optional(),
  }),
  a: z.record(z.string(), z.unknown()),
  d: z.record(z.string(), z.unknown()).nullish(),
})

const multiPayloadSchema = z.object({
  versions: z
    .array(
      z.object({
        label: z.string().max(120),
        payload: singlePayloadSchema,
      }),
    )
    .min(1)
    .max(20),
})

const shareDataSchema = z.union([multiPayloadSchema, singlePayloadSchema])

const rateLimited = () =>
  NextResponse.json({ error: 'Demasiadas solicitudes, intenta más tarde' }, { status: 429 })

/** POST — store proposal data, return short ID */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload demasiado grande' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const data = body && typeof body === 'object'
      ? (body as { data?: unknown }).data
      : undefined
    if (!data) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 })
    }

    const redis = getRedis()
    if (!(await rateLimit(redis, `rl:share:post:${getClientIp(request)}`, 10, 60))) {
      return rateLimited()
    }

    if (!shareDataSchema.safeParse(data).success) {
      return NextResponse.json({ error: 'Formato de propuesta inválido' }, { status: 400 })
    }

    const id = nanoid(8)
    // Store the original parsed JSON (not zod output) so future keys survive.
    await redis.set(`share:${id}`, data, { ex: EXPIRY_SECONDS })

    return NextResponse.json({ id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface ClientShortKeys {
  n?: string
  d?: string
  e?: string
  t?: string
  a?: string
}

const clientPatchSchema = z
  .object({
    email: z.email().max(254).optional(),
    telefono: z.string().max(40).optional(),
    nit_cc: z.string().max(40).optional(),
  })
  .refine(
    (p) => p.email !== undefined || p.telefono !== undefined || p.nit_cc !== undefined,
    { message: 'Se requiere al menos un campo' },
  )

const patchBodySchema = z.object({
  id: z.string().regex(SHARE_ID_REGEX),
  clientPatch: clientPatchSchema,
})

/** PATCH — update client info on an existing shared proposal */
export async function PATCH(request: NextRequest) {
  try {
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const parsed = patchBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }
    const { id, clientPatch } = parsed.data

    const redis = getRedis()
    if (!(await rateLimit(redis, `rl:share:patch:${getClientIp(request)}`, 30, 60))) {
      return rateLimited()
    }

    const data = await redis.get(`share:${id}`) as Record<string, unknown> | null
    if (!data) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }

    const patch: ClientShortKeys = {}
    if (clientPatch.email !== undefined) patch.e = clientPatch.email
    if (clientPatch.telefono !== undefined) patch.t = clientPatch.telefono
    if (clientPatch.nit_cc !== undefined) patch.a = clientPatch.nit_cc

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value)

    const applyPatch = (c: unknown): ClientShortKeys => ({
      ...(isRecord(c) ? c : {}),
      ...patch,
    })

    if (Array.isArray((data as { versions?: unknown }).versions)) {
      const versions = (data as { versions: unknown[] }).versions
      for (const v of versions) {
        if (!isRecord(v)) continue
        const payload = (v as { payload?: unknown }).payload
        if (!isRecord(payload)) continue
        payload.c = applyPatch(payload.c)
      }
    } else {
      const single = data as { c?: unknown }
      single.c = applyPatch(single.c)
    }

    // keepTtl preserves the remaining expiry instead of resetting it to 90 days;
    // xx avoids resurrecting a key (without TTL) that expired mid-request.
    const result = await redis.set(`share:${id}`, data, { keepTtl: true, xx: true })
    if (result === null) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
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
  if (!SHARE_ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    const redis = getRedis()
    if (!(await rateLimit(redis, `rl:share:get:${getClientIp(request)}`, 120, 60))) {
      return rateLimited()
    }

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
