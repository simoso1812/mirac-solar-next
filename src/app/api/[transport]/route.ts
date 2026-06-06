/**
 * Mirac Solar MCP server (remote, Streamable HTTP).
 *
 * Exposes the solar calculator as MCP tools so agents in Claude Code, Codex,
 * and Claude.ai/cowork can run real quotations. Served at /api/mcp.
 *
 * Auth: when MCP_AUTH_TOKEN is set, requests must send
 *   Authorization: Bearer <MCP_AUTH_TOKEN>
 * When unset (e.g. local dev), the server is open.
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
  const token = process.env.MCP_AUTH_TOKEN
  if (!token) return true // open when no token configured (local dev)
  const header = req.headers.get('authorization') ?? ''
  return header === `Bearer ${token}`
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }
  return handler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
