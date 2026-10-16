/**
 * MCP tools: read and rewrite an existing shared quotation (`share:<id>`),
 * so agents can inspect or tweak a quote without orphaning the link already
 * sent to the client.
 */
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { quoteInputShape, buildStores, resolveHsp, summarize, type QuoteArgs } from './quote'
import { assertStorable, assertUniqueLabels, buildSharedVersion, optionInputSchema } from './create-link'
import { toPayload, fromPayload, type SharePayload } from '@/lib/share'
import { ofertaValidezHasta } from '@/lib/formatting'

const MAX_OPTIONS = 20

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
  cliente_direccion: z.string().max(200).optional().describe('Nueva direccion (omitir para conservar).'),
  cliente_email: z.string().max(254).optional().describe('Nuevo email (omitir para conservar).'),
  cliente_telefono: z.string().max(40).optional().describe('Nuevo telefono (omitir para conservar).'),
  cliente_cedula: z.string().max(40).optional().describe('Nueva cedula o NIT (omitir para conservar).'),
  opcion_index: z
    .coerce.number()
    .int()
    .min(0)
    .max(MAX_OPTIONS - 1)
    .optional()
    .describe('Solo links con varias opciones (pestanas): indice 0-based de la opcion a regenerar (ver get_quotation). Los datos del cliente se actualizan en todas las opciones.'),
  ...quoteInputShape,
}
export const updateQuotationInputSchema = z.object(updateQuotationInputShape)
export type UpdateQuotationArgs = z.infer<typeof updateQuotationInputSchema>

export const addOptionInputShape = {
  share_id: z
    .string()
    .regex(SHARE_ID_REGEX)
    .describe('ID del link existente (segmento final de /s/<id>). El link no cambia.'),
  ...optionInputSchema.shape,
}
export const addOptionInputSchema = z.object(addOptionInputShape)
export type AddOptionArgs = z.infer<typeof addOptionInputSchema>

type Version = { label: string; payload: SharePayload }

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
    const opciones = versions.map((v, i) => {
      const p = fromPayload(v.payload, args.share_id)
      const { summary, structured } = summarize({
        client: p.client,
        project: p.project,
        technical: p.technical,
        advanced: p.advanced,
      })
      const firma = p.docuseal?.status ?? 'sin_firma'
      return {
        text: `### Opcion ${i} (opcion_index=${i}): ${v.label ?? 'Propuesta'}${p.docuseal ? ` — firma: ${firma}` : ''}\n\n${summary}`,
        data: { indice: i, label: v.label ?? 'Propuesta', firma_estado: firma, ...structured },
      }
    })
    const first = fromPayload(versions[0].payload, args.share_id)
    return {
      summary: `## Propuesta compartida (${versions.length} opciones) — ${first.client.nombre}\n\n${opciones.map((o) => o.text).join('\n\n')}`,
      structured: {
        share_id: args.share_id,
        cliente_nombre: first.client.nombre,
        versiones: versions.length,
        opciones: opciones.map((o) => o.data),
      },
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

/** Regenerate one stored payload from quote args, keeping (or overriding) client identity. */
async function regenerate(current: ReturnType<typeof fromPayload>, args: UpdateQuotationArgs) {
  const quoteArgs = args as unknown as QuoteArgs
  const loc = await resolveHsp(quoteArgs)
  const stores = buildStores(quoteArgs, {
    cliente_nombre: args.cliente_nombre ?? current.client.nombre,
    cliente_direccion: args.cliente_direccion ?? current.client.direccion,
    cliente_email: args.cliente_email ?? current.client.email,
    cliente_telefono: args.cliente_telefono ?? current.client.telefono,
    cliente_cedula: args.cliente_cedula ?? current.client.nit_cc,
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
  // buildStores re-stamps fecha to today. Keep the original emission date when it
  // expires later (a link sent with 30 days must not drop to 15 on an update).
  const vencePrevio = ofertaValidezHasta(current.project.fecha)
  const venceNuevo = ofertaValidezHasta(stores.project.fecha)
  if (vencePrevio && venceNuevo && vencePrevio.getTime() > venceNuevo.getTime()) {
    stores.project = { ...stores.project, fecha: current.project.fecha }
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
  return { payload, summary, structured, clientName: stores.client.nombre }
}

function hasClientPatch(args: UpdateQuotationArgs) {
  return [args.cliente_nombre, args.cliente_direccion, args.cliente_email, args.cliente_telefono, args.cliente_cedula]
    .some((v) => v !== undefined)
}

/** Copy the client block (short keys) of `source` onto `target`. */
function withClientOf(target: SharePayload, source: SharePayload): SharePayload {
  return { ...target, c: { ...source.c } }
}

async function save(redis: Redis, key: string, data: unknown) {
  // keepTtl + xx: the link keeps its remaining expiry and cannot be resurrected.
  const result = await redis.set(key, data, { keepTtl: true, xx: true })
  if (result === null) throw new Error('La propuesta expiro durante la actualizacion.')
}

export async function runUpdateQuotation(args: UpdateQuotationArgs) {
  const redis = getRedis()
  const key = `share:${args.share_id}`
  const existing = await redis.get(key)
  if (!existing) throw new Error(`No existe una propuesta con id ${args.share_id} (puede haber expirado).`)

  if (isMulti(existing)) {
    const versions = existing.versions as Version[]
    const i = args.opcion_index
    if (i === undefined) {
      throw new Error(`Este link tiene ${versions.length} opciones; envia opcion_index (0 a ${versions.length - 1}). Usa get_quotation para verlas.`)
    }
    if (i >= versions.length) throw new Error(`opcion_index ${i} no existe (el link tiene ${versions.length} opciones).`)
    const current = fromPayload(versions[i].payload, args.share_id)
    if (current.docuseal?.status === 'completed') {
      throw new Error('Esta opcion ya fue firmada; no se puede modificar.')
    }
    const { payload, summary, structured, clientName } = await regenerate(current, args)
    const next: Version[] = versions.map((v, j) => {
      if (j === i) return { label: v.label, payload }
      // Client identity is shared across tabs: propagate any client change.
      return hasClientPatch(args) ? { label: v.label, payload: withClientOf(v.payload, payload) } : v
    })
    const data = { versions: next }
    assertStorable(data)
    await save(redis, key, data)
    return {
      summary: [
        `## Opcion ${i} (${versions[i].label}) actualizada — ${clientName}`,
        '',
        `El link /s/${args.share_id} ahora muestra estos numeros en esa pestana (los parametros no enviados vuelven a sus valores por defecto):`,
        '',
        summary,
      ].join('\n'),
      structured: { share_id: args.share_id, opcion_index: i, label: versions[i].label, ...structured },
    }
  }

  if (args.opcion_index !== undefined && args.opcion_index !== 0) {
    throw new Error('Este link tiene una sola opcion; omite opcion_index o usa add_option_to_quotation para agregar pestanas.')
  }
  const current = fromPayload(existing as SharePayload, args.share_id)
  if (current.docuseal?.status === 'completed') {
    throw new Error('Esta propuesta ya fue firmada; no se puede modificar. Crea un link nuevo con create_quotation_link.')
  }
  const { payload, summary, structured, clientName } = await regenerate(current, args)
  assertStorable(payload)
  await save(redis, key, payload)

  return {
    summary: [
      `## Propuesta actualizada — ${clientName}`,
      '',
      `El link /s/${args.share_id} ahora muestra estos numeros (los parametros no enviados vuelven a sus valores por defecto):`,
      '',
      summary,
    ].join('\n'),
    structured: { share_id: args.share_id, ...structured },
  }
}

export async function runAddOptionToQuotation(args: AddOptionArgs) {
  const redis = getRedis()
  const key = `share:${args.share_id}`
  const existing = await redis.get(key)
  if (!existing) throw new Error(`No existe una propuesta con id ${args.share_id} (puede haber expirado).`)

  // A single-proposal link becomes tab "Opcion 1" of a multi-option link.
  const versions: Version[] = isMulti(existing)
    ? (existing.versions as Version[])
    : [{ label: 'Opcion 1', payload: existing as SharePayload }]
  if (versions.length >= MAX_OPTIONS) throw new Error(`El link ya tiene el maximo de ${MAX_OPTIONS} opciones.`)
  if (versions.some((v) => v.payload.d && (v.payload.d as { status?: string }).status === 'completed')) {
    throw new Error('Esta propuesta ya fue firmada; no se le pueden agregar opciones. Crea un link nuevo.')
  }
  assertUniqueLabels([...versions.map((v) => v.label), args.label])

  // New tab reuses the link's client identity.
  const client = fromPayload(versions[0].payload, args.share_id).client
  const { label, ...rest } = args
  const quote: Partial<AddOptionArgs> = { ...rest }
  delete quote.share_id
  const built = await buildSharedVersion(quote as unknown as QuoteArgs, {
    cliente_nombre: client.nombre,
    cliente_direccion: client.direccion,
    cliente_email: client.email,
    cliente_telefono: client.telefono,
    cliente_cedula: client.nit_cc,
  }, args.share_id)
  const data = { versions: [...versions, { label, payload: built.payload }] }
  assertStorable(data)
  await save(redis, key, data)
  const indice = data.versions.length - 1

  return {
    summary: [
      `## Opcion agregada: ${label} (opcion_index=${indice})`,
      '',
      `El link /s/${args.share_id} ahora tiene ${data.versions.length} pestanas.`,
      '',
      built.summary,
    ].join('\n'),
    structured: { share_id: args.share_id, opcion_index: indice, label, opciones: data.versions.length, ...built.structured },
  }
}
