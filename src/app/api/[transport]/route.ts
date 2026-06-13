/**
 * Mirac Solar MCP server (remote, Streamable HTTP).
 *
 * Exposes the solar calculator as MCP tools so agents in Claude Code, Codex,
 * and Claude.ai/cowork can run real quotations. Served at /api/mcp.
 *
 * Auth: when MCP_AUTH_TOKEN is set, requests must present the secret either
 * as a `?key=<MCP_AUTH_TOKEN>` query param (works with the Claude Cowork
 * connector UI, which only accepts a URL) OR as an `Authorization: Bearer
 * <MCP_AUTH_TOKEN>` header (Claude Code / Codex can send headers). Otherwise
 * the request gets a 404 so the secret URL stays unguessable. When the env
 * var is unset (e.g. local dev), the server is open.
 */
import { createHash, timingSafeEqual } from 'crypto'
import { createMcpHandler } from 'mcp-handler'
import {
  quoteInputShape,
  runQuote,
  priceInputShape,
  runEstimatePrice,
} from '@/lib/mcp/quote'
import { linkInputShape, runCreateQuotationLink } from '@/lib/mcp/create-link'

export const runtime = 'nodejs'
export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'quote_solar_system',
      {
        title: 'Cotizar sistema solar',
        description:
          'Genera una cotizacion solar completa para un cliente en Colombia usando la calculadora de Mirac. ' +
          'Recibe el consumo mensual y la ciudad como minimo; devuelve tamano del sistema (kWp, paneles, inversores), ' +
          'generacion anual, inversion total, ahorro anual/mensual, payback, TIR, VPN, ROI y CO2 evitado. ' +
          'Soporta baterias, financiamiento (tasa EA, metodo frances) y beneficios tributarios (Ley 1715).',
        inputSchema: quoteInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        const { summary, structured } = runQuote(args)
        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      'estimate_price',
      {
        title: 'Estimar precio por tamano',
        description:
          'Estimacion rapida del CAPEX de un sistema solar a partir del tamano en kWp, usando la curva de costos empirica. ' +
          'Util cuando ya se conoce el tamano y solo se quiere un precio aproximado (sin ajuste por cubierta ni baterias).',
        inputSchema: priceInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        const { summary, structured } = runEstimatePrice(args)
        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      'create_quotation_link',
      {
        title: 'Crear link de cotizacion virtual',
        description:
          'Genera una propuesta solar y devuelve un LINK publico a la cotizacion virtual (pagina /s/<id>) que el cliente puede abrir, ver, descargar en PDF y firmar. ' +
          'Recibe el nombre del cliente y los mismos parametros que quote_solar_system. ' +
          'La propuesta se guarda 90 dias. Usa esta herramienta cuando el usuario pida un link, una propuesta para enviar al cliente, o una cotizacion compartible.',
        inputSchema: linkInputShape,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async (args) => {
        const { summary, structured } = await runCreateQuotationLink(args)
        return {
          content: [{ type: 'text', text: summary }],
          structuredContent: structured,
        }
      },
    )
  },
  {},
  { basePath: '/api', maxDuration: 60 },
)

// Constant-time string compare. Hashing both sides first equalizes lengths,
// so no length information leaks and timingSafeEqual never throws.
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest()
  const hashB = createHash('sha256').update(b).digest()
  return timingSafeEqual(hashA, hashB)
}

// Optional shared-secret auth in front of the MCP handler.
function authorized(req: Request): boolean {
  const secret = process.env.MCP_AUTH_TOKEN
  if (!secret) return true // open when no secret configured (local dev)
  // Accept the secret as ?key= (for the Cowork connector, URL-only) or as a
  // Bearer header (for Claude Code / Codex, which can send headers).
  // Note: the ?key= form ends up in proxy/server logs; documented tradeoff
  // for the Cowork connector, which only accepts a URL.
  const key = new URL(req.url).searchParams.get('key')
  if (key !== null && safeEqual(key, secret)) return true
  return safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) {
    // 404 (not 401) so the secret URL stays unguessable / hidden.
    return new Response('Not found', { status: 404 })
  }
  return handler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
