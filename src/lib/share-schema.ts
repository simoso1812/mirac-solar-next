/**
 * Zod gate for share payloads. Shared by POST /api/share and the MCP link
 * tools so both write paths validate the same shape.
 */
import { z } from 'zod'
import { roofDesignSchema } from '@/lib/schemas'
import { COGS_KEYS } from '@/lib/defaults'

// Validation mirrors SharePayload in src/lib/share.ts. It is a gate only:
// after it passes we store the ORIGINAL parsed JSON, never zod's output,
// so unknown future keys are not stripped.
export const singlePayloadSchema = z.object({
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
    an: z.number().min(0.3).max(3).optional(),
    al: z.number().min(0.3).max(3).optional(),
    dt: roofDesignSchema.nullable().optional(),
  }),
  a: z.record(z.string(), z.unknown()),
  d: z.record(z.string(), z.unknown()).nullish(),
})

export const multiPayloadSchema = z.object({
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

export const shareDataSchema = z.union([multiPayloadSchema, singlePayloadSchema])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function advancedSinCostos(payload: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(payload.a)) return payload
  const a = { ...payload.a }
  for (const key of COGS_KEYS) delete a[key]
  return { ...payload, a }
}

/**
 * Drop internal COGS from a stored share payload (single or multi-version).
 * toPayload already strips them; this guards payloads built by other callers.
 * Returns a copy; anything that is not a payload object is returned as is.
 */
export function quitarCostosInternos<T>(data: T): T {
  if (!isRecord(data)) return data
  if (Array.isArray(data.versions)) {
    return {
      ...data,
      versions: data.versions.map((v: unknown) =>
        isRecord(v) && isRecord(v.payload) ? { ...v, payload: advancedSinCostos(v.payload) } : v,
      ),
    } as T
  }
  return advancedSinCostos(data) as T
}
