/**
 * Zod gate for share payloads. Shared by POST /api/share and the MCP link
 * tools so both write paths validate the same shape.
 */
import { z } from 'zod'
import { roofDesignSchema } from '@/lib/schemas'

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
