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
import { quoteInputShape, buildStores, summarize, type QuoteArgs, type ClientArgs } from './quote'
import { toPayload } from '@/lib/share'
import type { QuotationData } from '@/lib/types'

const SHARE_EXPIRY_SECONDS = 60 * 60 * 24 * 90 // 90 days — matches /api/share

/** Input shape: all quoting fields plus optional client identity. */
export const linkInputShape = {
  cliente_nombre: z
    .string()
    .min(1)
    .describe('Nombre del cliente para la propuesta. Requerido.'),
  cliente_direccion: z
    .string()
    .default('')
    .describe('Direccion del cliente o del proyecto (opcional).'),
  cliente_email: z
    .string()
    .default('')
    .describe('Email del cliente (opcional; puede completarse luego al firmar).'),
  cliente_telefono: z
    .string()
    .default('')
    .describe('Telefono del cliente (opcional).'),
  cliente_cedula: z
    .string()
    .default('')
    .describe('Cedula o NIT del cliente (opcional).'),
  ...quoteInputShape,
}

export const linkInputSchema = z.object(linkInputShape)
export type LinkArgs = z.infer<typeof linkInputSchema>

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Upstash Redis no esta configurado (UPSTASH_REDIS_REST_URL/TOKEN).')
  return new Redis({ url, token })
}

/** Resolve the public origin used to build the /s/ link. */
function publicBaseUrl(): string {
  if (process.env.MCP_PUBLIC_BASE_URL) return process.env.MCP_PUBLIC_BASE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return 'http://localhost:3000'
}

export async function runCreateQuotationLink(args: LinkArgs) {
  const quoteArgs = args as unknown as QuoteArgs
  const clientArgs: ClientArgs = {
    cliente_nombre: args.cliente_nombre,
    cliente_direccion: args.cliente_direccion,
    cliente_email: args.cliente_email,
    cliente_telefono: args.cliente_telefono,
    cliente_cedula: args.cliente_cedula,
  }

  const stores = buildStores(quoteArgs, clientArgs)
  const { summary, structured } = summarize(stores)

  const proposal: QuotationData = {
    id: 'mcp',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: 'sent',
    client: stores.client,
    project: stores.project,
    technical: stores.technical,
    advanced: stores.advanced,
    results: null,
    docuseal: undefined,
    drive_folder_link: null,
    drive_project_name: null,
  }

  const id = nanoid(8)
  await getRedis().set(`share:${id}`, toPayload(proposal), { ex: SHARE_EXPIRY_SECONDS })
  const url = `${publicBaseUrl()}/s/${id}`

  const text = [
    `## Propuesta para ${args.cliente_nombre}`,
    '',
    `**Link de la cotizacion virtual:** ${url}`,
    `(valido 90 dias · el cliente puede ver, descargar PDF y firmar)`,
    '',
    summary,
  ].join('\n')

  return {
    summary: text,
    structured: { url, share_id: id, ...structured },
  }
}
