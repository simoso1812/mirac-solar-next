import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { shareDataSchema } from '@/lib/share-schema'
import { getDocusealSubmission, toDocusealSignatureData } from '@/lib/docuseal'

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

// DocuSeal state is never trusted from the client: the pair below is only a
// claim, verified against the DocuSeal API before anything is stored.
const docusealPatchSchema = z.object({
  submission_id: z.number().int().positive(),
  submitter_slug: z.string().min(6).max(120),
  // Multi-option links: the tab the client signed. Omitted by old clients,
  // in which case every version is stamped (legacy behavior).
  version_index: z.number().int().min(0).max(19).optional(),
})

const patchBodySchema = z
  .object({
    id: z.string().regex(SHARE_ID_REGEX),
    clientPatch: clientPatchSchema.optional(),
    docusealPatch: docusealPatchSchema.optional(),
  })
  .refine((b) => b.clientPatch !== undefined || b.docusealPatch !== undefined, {
    message: 'Se requiere al menos un patch',
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
    const { id, clientPatch, docusealPatch } = parsed.data

    const redis = getRedis()
    if (!(await rateLimit(redis, `rl:share:patch:${getClientIp(request)}`, 30, 60))) {
      return rateLimited()
    }

    const data = await redis.get(`share:${id}`) as Record<string, unknown> | null
    if (!data) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }

    // Verify the docuseal claim against the DocuSeal API and rebuild the
    // stored state server-side. Slug mismatch gets the same 404 as a missing
    // share so submission ids can't be probed.
    let verifiedDocuseal: Record<string, unknown> | null = null
    if (docusealPatch) {
      let submission
      try {
        submission = await getDocusealSubmission(docusealPatch.submission_id)
      } catch {
        return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
      }
      const slug = submission.submitters?.[0]?.slug
      if (!slug || slug !== docusealPatch.submitter_slug) {
        return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
      }
      verifiedDocuseal = toDocusealSignatureData(submission) as unknown as Record<string, unknown>
    }

    const patch: ClientShortKeys = {}
    if (clientPatch?.email !== undefined) patch.e = clientPatch.email
    if (clientPatch?.telefono !== undefined) patch.t = clientPatch.telefono
    if (clientPatch?.nit_cc !== undefined) patch.a = clientPatch.nit_cc

    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value)

    const applyPatch = (c: unknown): ClientShortKeys => ({
      ...(isRecord(c) ? c : {}),
      ...patch,
    })

    const applyToPayload = (payload: Record<string, unknown>) => {
      if (clientPatch) payload.c = applyPatch(payload.c)
      if (verifiedDocuseal) payload.d = verifiedDocuseal
    }

    if (Array.isArray((data as { versions?: unknown }).versions)) {
      const versions = (data as { versions: unknown[] }).versions
      const signedIndex = docusealPatch?.version_index
      if (signedIndex !== undefined && signedIndex >= versions.length) {
        return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
      }
      versions.forEach((v, i) => {
        if (!isRecord(v)) return
        const payload = (v as { payload?: unknown }).payload
        if (!isRecord(payload)) return
        if (clientPatch) payload.c = applyPatch(payload.c)
        // Only the signed option carries the signature.
        if (verifiedDocuseal && (signedIndex === undefined || signedIndex === i)) {
          payload.d = verifiedDocuseal
        }
      })
    } else {
      applyToPayload(data)
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

const STATS_EXPIRY_SECONDS = EXPIRY_SECONDS // stats live as long as a fresh link

/** GET — retrieve proposal data by ID, or view stats for a list of IDs */
export async function GET(request: NextRequest) {
  const statsParam = request.nextUrl.searchParams.get('stats')

  // ?stats=<id1>,<id2>,... — view counters for the dashboard. Never increments.
  if (statsParam) {
    const ids = statsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60)
    if (ids.length === 0 || !ids.every((i) => SHARE_ID_REGEX.test(i))) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
    }
    try {
      const redis = getRedis()
      if (!(await rateLimit(redis, `rl:share:stats:${getClientIp(request)}`, 60, 60))) {
        return rateLimited()
      }
      const viewKeys = ids.map((i) => `share_views:${i}`)
      const lastKeys = ids.map((i) => `share_last_view:${i}`)
      const values = await redis.mget<(number | string | null)[]>(...viewKeys, ...lastKeys)
      const stats: Record<string, { views: number; last_viewed: string | null }> = {}
      ids.forEach((shareId, i) => {
        stats[shareId] = {
          views: Number(values[i] ?? 0),
          last_viewed: (values[ids.length + i] as string | null) ?? null,
        }
      })
      return NextResponse.json({ stats })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

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

    // View tracking — best effort, never blocks the response. Owner-side
    // fetches (status sync from /propuestas) pass no_track=1 so Simon's own
    // opens don't count as client views.
    if (request.nextUrl.searchParams.get('no_track') === '1') {
      return NextResponse.json({ data })
    }
    try {
      await redis
        .multi()
        .incr(`share_views:${id}`)
        .expire(`share_views:${id}`, STATS_EXPIRY_SECONDS)
        .set(`share_last_view:${id}`, new Date().toISOString(), { ex: STATS_EXPIRY_SECONDS })
        .exec()
    } catch {
      // stats are non-critical
    }

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE — revoke a share link. Possession of the (unguessable) id is the
 * capability, same trust model as GET/PATCH in this single-operator tool.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !SHARE_ID_REGEX.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  try {
    const redis = getRedis()
    if (!(await rateLimit(redis, `rl:share:delete:${getClientIp(request)}`, 30, 60))) {
      return rateLimited()
    }
    const removed = await redis.del(`share:${id}`, `share_views:${id}`, `share_last_view:${id}`)
    if (removed === 0) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
