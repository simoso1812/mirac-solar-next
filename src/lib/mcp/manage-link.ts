/**
 * MCP tools: read and rewrite an existing shared quotation (`share:<id>`),
 * so agents can inspect or tweak a quote without orphaning the link already
 * sent to the client.
 */
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { quoteInputShape, buildStores, resolveHsp, summarize, type QuoteArgs } from './quote'
import { toPayload, fromPayload, type SharePayload } from '@/lib/share'

const SHARE_ID_REGEX = /^[A-Za-z0-9_-]{4,30}$/

export const getQuotationInputShape = {
  share_id: z
    .string()
    .regex(SHARE_ID_REGEX)
    .describe('ID del link compartido (el segmento final de la URL /s/<id>).'),
}
export const getQuotationInputSchema = z.object(getQuotationInputShape)
export type GetQuotationArgs = z.infer<typeof getQuotationInputSchema>

export const updateQuotationInputShape = {
  share_id: z
    .string()
    .regex(SHARE_ID_REGEX)
    .describe('ID del link compartido a actualizar (segmento final de /s/<id>). El link no cambia.'),
  cliente_nombre: z
    .string()
    .max(120)
    .optional()
    .describe('Nuevo nombre del cliente (omitir para conservar el actual).'),
  ...quoteInputShape,
}
export const updateQuotationInputSchema = z.object(updateQuotationInputShape)
export type UpdateQuotationArgs = z.infer<typeof updateQuotationInputSchema>

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis no esta configurado (UPSTASH_REDIS_REST_URL/TOKEN).')
  return new Redis({ url, token })
}

function isMulti(data: unknown): data is { versions: unknown[] } {
  return typeof data === 'object' && data !== null && Array.isArray((data as { versions?: unknown }).versions)
}

export async function runGetQuotation(args: GetQuotationArgs) {
  const data = await getRedis().get(`share:${args.share_id}`)
  if (!data) throw new Error(`No existe una propuesta con id ${args.share_id} (puede haber expirado).`)

  if (isMulti(data)) {
    const versions = data.versions as { label?: string; payload: SharePayload }[]
    const parts = versions.map((v, i) => {
      const p = fromPayload(v.payload, args.share_id)
      const { summary } = summarize({
        client: p.client,
        project: p.project,
        technical: p.technical,
        advanced: p.advanced,
      })
      return `### Version ${i + 1}: ${v.label ?? 'Propuesta'}\n\n${summary}`
    })
    const first = fromPayload(versions[0].payload, args.share_id)
    return {
      summary: `## Propuesta compartida (${versions.length} versiones) — ${first.client.nombre}\n\n${parts.join('\n\n')}`,
      structured: { share_id: args.share_id, versiones: versions.length },
    }
  }

  const proposal = fromPayload(data as SharePayload, args.share_id)
  const { summary, structured } = summarize({
    client: proposal.client,
    project: proposal.project,
    technical: proposal.technical,
    advanced: proposal.advanced,
  })
  return {
    summary: [
      `## Propuesta compartida — ${proposal.client.nombre || 'sin nombre'}`,
      proposal.docuseal ? `**Estado de firma:** ${proposal.docuseal.status}` : null,
      '',
      summary,
    ].filter((l) => l !== null).join('\n'),
    structured: {
      share_id: args.share_id,
      cliente_nombre: proposal.client.nombre,
      firma_estado: proposal.docuseal?.status ?? 'sin_firma',
      ...structured,
    },
  }
}

export async function runUpdateQuotation(args: UpdateQuotationArgs) {
  const redis = getRedis()
  const key = `share:${args.share_id}`
  const existing = await redis.get(key)
  if (!existing) throw new Error(`No existe una propuesta con id ${args.share_id} (puede haber expirado).`)
  if (isMulti(existing)) {
    throw new Error('Este link tiene multiples versiones; actualizalo desde la app web.')
  }

  const current = fromPayload(existing as SharePayload, args.share_id)
  if (current.docuseal?.status === 'completed') {
    throw new Error('Esta propuesta ya fue firmada; no se puede modificar. Crea un link nuevo con create_quotation_link.')
  }

  // Full regeneration semantics: unspecified quote args return to their
  // defaults (same as quote_solar_system). Client identity and signing state
  // are preserved from the stored payload unless overridden.
  const loc = await resolveHsp(args as unknown as QuoteArgs)
  const stores = buildStores(args as unknown as QuoteArgs, {
    cliente_nombre: args.cliente_nombre ?? current.client.nombre,
    cliente_direccion: current.client.direccion,
    cliente_email: current.client.email,
    cliente_telefono: current.client.telefono,
    cliente_cedula: current.client.nit_cc,
  }, loc)
  // When the update did not send its own location/HSP, preserve the stored
  // location + PVGIS data BEFORE summarizing, so the numbers the agent quotes
  // are the same ones /s/<id> recomputes from the stored payload.
  if (loc.fuente === 'ciudad') {
    stores.project = {
      ...stores.project,
      lat: current.project.lat,
      lon: current.project.lon,
      hsp_mensual_pvgis: current.project.hsp_mensual_pvgis,
    }
  }
  const { summary, structured } = summarize(stores, loc.fuente === 'ciudad' ? {} : { hsp: loc })

  const payload = toPayload({
    ...current,
    client: stores.client,
    project: stores.project,
    technical: stores.technical,
    advanced: stores.advanced,
    updated_at: new Date().toISOString(),
  })
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 4_500_000) {
    throw new Error('La propuesta es demasiado grande para compartir (maximo ~4.5MB).')
  }

  // keepTtl + xx: the link keeps its remaining expiry and cannot be resurrected.
  const result = await redis.set(key, payload, { keepTtl: true, xx: true })
  if (result === null) throw new Error('La propuesta expiro durante la actualizacion.')

  return {
    summary: [
      `## Propuesta actualizada — ${stores.client.nombre}`,
      '',
      `El link /s/${args.share_id} ahora muestra estos numeros (los parametros no enviados vuelven a sus valores por defecto):`,
      '',
      summary,
    ].join('\n'),
    structured: { share_id: args.share_id, ...structured },
  }
}
