/**
 * MCP tool: create a shareable virtual quotation link.
 *
 * Builds the same store shapes the web app uses, stores them in Upstash
 * (same `share:<id>` format as POST /api/share), and returns the public
 * `/s/<id>` URL. The `/s` page recomputes results live from this payload.
 */
import { z } from 'zod'
import { Redis } from '@upstash/redis'
import { nanoid } from 'nanoid'
import { quoteInputShape, buildStores, resolveHsp, summarize, type QuoteArgs, type ClientArgs } from './quote'
import { toPayload, type SharePayload } from '@/lib/share'
import { shareDataSchema } from '@/lib/share-schema'
import type { QuotationData } from '@/lib/types'

const SHARE_EXPIRY_SECONDS = 60 * 60 * 24 * 90 // 90 days — matches /api/share
const MAX_SHARE_BYTES = 4_500_000 // same cap POST /api/share enforces

/** Input shape: all quoting fields plus optional client identity. */
export const clientInputShape = {
  cliente_nombre: z
    .string()
    .min(1)
    .max(120)
    .describe('Nombre del cliente para la propuesta. Requerido.'),
  cliente_direccion: z
    .string()
    .max(200)
    .default('')
    .describe('Direccion del cliente o del proyecto (opcional).'),
  cliente_email: z
    .string()
    .max(254)
    .default('')
    .describe('Email del cliente (opcional; puede completarse luego al firmar).'),
  cliente_telefono: z
    .string()
    .max(40)
    .default('')
    .describe('Telefono del cliente (opcional).'),
  cliente_cedula: z
    .string()
    .max(40)
    .default('')
    .describe('Cedula o NIT del cliente (opcional).'),
}

export const linkInputShape = {
  ...clientInputShape,
  ...quoteInputShape,
}

export const linkInputSchema = z.object(linkInputShape)
export type LinkArgs = z.infer<typeof linkInputSchema>

/** One tab of a multi-option proposal: a label plus a full, independent quote. */
export const optionInputSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(120)
    .describe('Nombre de la pestana (ej "Opcion A — 10 kWp", "Con bateria"). Unico dentro del link.'),
  ...quoteInputShape,
})
export type OptionArgs = z.infer<typeof optionInputSchema>

export const multiLinkInputShape = {
  ...clientInputShape,
  opciones: z
    .array(optionInputSchema)
    .min(2)
    .max(20)
    .describe(
      'Opciones de sistema FV que se muestran como pestanas en la misma propuesta (2 a 20). ' +
        'Cada opcion es una cotizacion completa e independiente: repite en cada una los parametros comunes (consumo, ubicacion, tarifa). ' +
        'Los labels deben ser unicos.',
    ),
}
export const multiLinkInputSchema = z.object(multiLinkInputShape)
export type MultiLinkArgs = z.infer<typeof multiLinkInputSchema>

export function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis no esta configurado (UPSTASH_REDIS_REST_URL/TOKEN).')
  return new Redis({ url, token })
}

/** Resolve the public origin used to build the /s/ link. */
export function publicBaseUrl(): string {
  if (process.env.MCP_PUBLIC_BASE_URL) return process.env.MCP_PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}

export function clientArgsOf(args: z.infer<z.ZodObject<typeof clientInputShape>>): ClientArgs {
  return {
    cliente_nombre: args.cliente_nombre,
    cliente_direccion: args.cliente_direccion,
    cliente_email: args.cliente_email,
    cliente_telefono: args.cliente_telefono,
    cliente_cedula: args.cliente_cedula,
  }
}

/**
 * Quote one system and serialize it as a share payload. `shareId` is minted
 * by the caller so every option of a link carries the same `s:<id>` (the id
 * the /s page derives and DocuSeal uses as external_id).
 */
export async function buildSharedVersion(quoteArgs: QuoteArgs, clientArgs: ClientArgs, shareId: string) {
  const loc = await resolveHsp(quoteArgs)
  const stores = buildStores(quoteArgs, clientArgs, loc)
  const { summary, structured } = summarize(stores, { hsp: loc })
  const now = new Date().toISOString()
  const proposal: QuotationData = {
    id: `s:${shareId}`,
    created_at: now,
    updated_at: now,
    status: 'sent',
    client: stores.client,
    project: stores.project,
    technical: stores.technical,
    advanced: stores.advanced,
    results: null,
    docuseal: undefined,
    share_id: shareId,
    drive_folder_link: null,
    drive_project_name: null,
  }
  return { payload: toPayload(proposal), summary, structured }
}

/** Run the same gate POST /api/share applies before anything reaches Redis. */
export function assertStorable(data: SharePayload | { versions: { label: string; payload: SharePayload }[] }) {
  const json = JSON.stringify(data)
  if (Buffer.byteLength(json, 'utf8') > MAX_SHARE_BYTES) {
    throw new Error('La propuesta es demasiado grande para compartir (maximo ~4.5MB).')
  }
  if (!shareDataSchema.safeParse(JSON.parse(json)).success) {
    throw new Error('La propuesta generada no paso la validacion del formato compartido.')
  }
}

export function assertUniqueLabels(labels: string[]) {
  const seen = new Set<string>()
  for (const l of labels) {
    const key = l.trim().toLowerCase()
    if (seen.has(key)) throw new Error(`Label de opcion repetido: "${l}". Cada pestana necesita un nombre unico.`)
    seen.add(key)
  }
}

export async function runCreateQuotationLink(args: LinkArgs) {
  const id = nanoid(8)
  const { payload, summary, structured } = await buildSharedVersion(
    args as unknown as QuoteArgs,
    clientArgsOf(args),
    id,
  )
  assertStorable(payload)
  await getRedis().set(`share:${id}`, payload, { ex: SHARE_EXPIRY_SECONDS })
  const url = `${publicBaseUrl()}/s/${id}`

  const text = [
    `## Propuesta para ${args.cliente_nombre}`,
    '',
    `**Link de la cotizacion virtual:** ${url}`,
    `(valido 90 dias · el cliente puede ver la propuesta digital y firmar)`,
    '',
    summary,
  ].join('\n')

  return {
    summary: text,
    structured: { url, share_id: id, ...structured },
  }
}

export async function runCreateMultiQuotationLink(args: MultiLinkArgs) {
  assertUniqueLabels(args.opciones.map((o) => o.label))
  const id = nanoid(8)
  const clientArgs = clientArgsOf(args)
  // Sequential on purpose: each option may hit PVGIS; keeps us polite and
  // within maxDuration for typical 2-4 option links.
  const built = []
  for (const { label, ...quote } of args.opciones) {
    built.push({ label, ...(await buildSharedVersion(quote as unknown as QuoteArgs, clientArgs, id)) })
  }
  const data = { versions: built.map((b) => ({ label: b.label, payload: b.payload })) }
  assertStorable(data)
  await getRedis().set(`share:${id}`, data, { ex: SHARE_EXPIRY_SECONDS })
  const url = `${publicBaseUrl()}/s/${id}`

  const text = [
    `## Propuesta para ${args.cliente_nombre} — ${built.length} opciones`,
    '',
    `**Link de la cotizacion virtual:** ${url}`,
    `(valido 90 dias · las opciones aparecen como pestanas arriba de la propuesta; el cliente firma la que elija)`,
    '',
    ...built.map((b, i) => `### Opcion ${i + 1}: ${b.label}\n\n${b.summary}`),
  ].join('\n')

  return {
    summary: text,
    structured: {
      url,
      share_id: id,
      opciones: built.map((b, i) => ({ indice: i, label: b.label, ...b.structured })),
    },
  }
}
