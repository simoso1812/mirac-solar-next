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
import { createMcpHandler } from 'mcp-handler'
import {
  quoteInputShape,
  runQuote,
  priceInputShape,
  runEstimatePrice,
} from '@/lib/mcp/quote'

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
  },
  {},
  { basePath: '/api', maxDuration: 60 },
)

// Optional shared-secret auth in front of the MCP handler.
function authorized(req: Request): boolean {
  const secret = process.env.MCP_AUTH_TOKEN
  if (!secret) return true // open when no secret configured (local dev)
  // Accept the secret as ?key= (for the Cowork connector, URL-only) or as a
  // Bearer header (for Claude Code / Codex, which can send headers).
  if (new URL(req.url).searchParams.get('key') === secret) return true
  return (req.headers.get('authorization') ?? '') === `Bearer ${secret}`
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) {
    // 404 (not 401) so the secret URL stays unguessable / hidden.
    return new Response('Not found', { status: 404 })
  }
  return handler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
