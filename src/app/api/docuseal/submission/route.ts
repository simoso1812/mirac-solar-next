import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { getDocusealSubmission, toDocusealSignatureData } from '@/lib/docuseal'
import { crearSubmissionContrato, errorParaFirma } from '@/lib/docuseal-contract'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { fromPayload, type SharePayload } from '@/lib/share'

// Public route (the client signs from /s/<id>): the body is only a reference,
// never proposal data. The contract is built from the stored share payload.
const MAX_BODY_BYTES = 2_000
const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{4,30}$/

const bodySchema = z.union([
  z.strictObject({
    submissionId: z.number().int().positive(),
    submitterSlug: z.string().max(120).optional(),
  }),
  z.strictObject({
    shareId: z.string().regex(SHARE_ID_REGEX),
    optionIndex: z.number().int().min(0).max(19).optional(),
  }),
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The stored payload for the requested option, or null if it doesn't exist. */
function elegirPayload(stored: unknown, optionIndex: number | undefined): SharePayload | null {
  if (!isRecord(stored)) return null
  if (Array.isArray(stored.versions)) {
    const versions = stored.versions
    // A multi-option link must say which option is being signed.
    if (optionIndex === undefined && versions.length > 1) return null
    const entry = versions[optionIndex ?? 0]
    return isRecord(entry) && isRecord(entry.payload) ? (entry.payload as unknown as SharePayload) : null
  }
  if (optionIndex !== undefined && optionIndex !== 0) return null
  return stored as unknown as SharePayload
}

export async function POST(request: NextRequest) {
  try {
    // Redis stays lazy (inside the handler) so `next build` never logs
    // missing-env warnings.
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
    const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null
    if (redis && !(await rateLimit(redis, `rl:docuseal:post:${getClientIp(request)}`, 10, 60))) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes, intenta más tarde' },
        { status: 429 },
      )
    }

    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    let rawBody: unknown
    try {
      rawBody = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const parsedBody = bodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }
    const body = parsedBody.data

    if ('submissionId' in body) {
      // Refreshing an existing submission requires its submitter slug as proof
      // of access. DocuSeal submission IDs are sequential, so every failure
      // mode answers 404 to avoid leaking whether an ID exists.
      if (!body.submitterSlug) {
        return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      }
      try {
        const submission = await getDocusealSubmission(body.submissionId)
        if (!submission.submitters?.some((s) => s.slug === body.submitterSlug)) {
          return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
        }
        return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
      } catch {
        return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      }
    }

    if (!redis) {
      return NextResponse.json({ error: 'Upstash Redis no está configurado' }, { status: 500 })
    }
    const payload = elegirPayload(await redis.get(`share:${body.shareId}`), body.optionIndex)
    if (!payload) {
      return NextResponse.json({ error: 'Propuesta no encontrada o expirada' }, { status: 404 })
    }

    // fromPayload sets id `s:<shareId>`, which becomes the DocuSeal external_id
    // (PATCH /api/share and the Drive webhook both key on it).
    const proposal = fromPayload(payload, body.shareId)
    const error = errorParaFirma(proposal)
    if (error) return NextResponse.json({ error }, { status: 400 })

    const submission = await crearSubmissionContrato(proposal)
    return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando firma en DocuSeal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
