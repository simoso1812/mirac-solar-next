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
import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import {
  quoteInputShape,
  runQuote,
  priceInputShape,
  runEstimatePrice,
  listInvertersInputShape,
  runListInverters,
} from '@/lib/mcp/quote'
import { linkInputShape, runCreateQuotationLink } from '@/lib/mcp/create-link'
import {
  getQuotationInputShape,
  runGetQuotation,
  updateQuotationInputShape,
  runUpdateQuotation,
} from '@/lib/mcp/manage-link'

/**
 * Wrap a tool handler so failures come back as a Spanish isError result
 * instead of a raw JSON-RPC error the agent can't relay to the user.
 */
function tool<A>(fn: (args: A) => Promise<{ summary: string; structured: Record<string, unknown> }> | { summary: string; structured: Record<string, unknown> }) {
  return async (args: A) => {
    try {
      const { summary, structured } = await fn(args)
      return {
        content: [{ type: 'text' as const, text: summary }],
        structuredContent: structured,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      return {
        content: [{ type: 'text' as const, text: `Error al ejecutar la herramienta: ${message}` }],
        isError: true,
      }
    }
  }
}

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
          'Soporta baterias, financiamiento (tasa EA, metodo frances), beneficios tributarios (Ley 1715), ' +
          'precio manual del proyecto (precio_manual_cop, reemplaza la curva de costos) y seleccion de inversor ' +
          '(inversor_marca / inversor_potencia_kw; ver list_inverters; omitir para seleccion automatica). ' +
          'Ubicacion: usa ciudad para las 7 ciudades del enum, o lat/lon para cualquier municipio de Colombia ' +
          '(consulta radiacion real PVGIS), o hsp_personalizado para radiacion propia. ' +
          'PPA "Opcion Cero Inversion" (ppa_opciones): ofrecela como alternativa sin inversion para clientes comerciales ' +
          'con buen consumo — el cliente no compra el sistema, paga la energia generada a un precio menor que la tarifa; ' +
          'ejemplo tipico: [{precio_kwh: 600, duracion_anios: 12}]. Los totales PPA indexan la tarifa al Indice Mirac (4.25% anual) con precio PPA fijo.',
        inputSchema: quoteInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      tool(async (args) => runQuote(args)),
    )

    server.registerTool(
      'estimate_price',
      {
        title: 'Estimar precio por tamano',
        description:
          'Estimacion rapida del CAPEX de un sistema solar a partir del tamano en kWp, usando la curva de costos empirica. ' +
          'Acepta cubierta (teja aplica sobrecosto) y bateria_capacidad_kwh opcionales. ' +
          'Util cuando ya se conoce el tamano y solo se quiere un precio aproximado.',
        inputSchema: priceInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      tool(async (args) => runEstimatePrice(args)),
    )

    server.registerTool(
      'list_inverters',
      {
        title: 'Listar catalogo de inversores',
        description:
          'Devuelve el catalogo de inversores de Mirac (marca, tipo y modelos con su potencia en kW). ' +
          'Usalo antes de forzar un inversor en quote_solar_system / create_quotation_link: ' +
          'con inversor_marca + inversor_potencia_kw el modelo se resuelve de este catalogo. ' +
          'Acepta un filtro opcional por marca.',
        inputSchema: listInvertersInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      tool(async (args) => runListInverters(args)),
    )

    server.registerTool(
      'create_quotation_link',
      {
        title: 'Crear link de cotizacion virtual',
        description:
          'Genera una propuesta solar y devuelve un LINK publico a la cotizacion virtual (pagina /s/<id>) que el cliente puede abrir, ver, descargar en PDF y firmar. ' +
          'Recibe el nombre del cliente y los mismos parametros que quote_solar_system (incluye lat/lon o hsp_personalizado ' +
          'para la radiacion, precio manual y opciones PPA, que se muestran en la pagina compartida con su mapa). ' +
          'La propuesta se guarda 90 dias. Usa esta herramienta cuando el usuario pida un link, una propuesta para enviar al cliente, o una cotizacion compartible.',
        inputSchema: linkInputShape,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      tool(runCreateQuotationLink),
    )

    server.registerTool(
      'get_quotation',
      {
        title: 'Leer cotizacion compartida',
        description:
          'Lee una propuesta compartida existente por su share_id (el segmento final de la URL /s/<id>) y devuelve sus numeros actuales, ' +
          'incluyendo el estado de firma. Usa esta herramienta antes de update_quotation para ver que contiene el link.',
        inputSchema: getQuotationInputShape,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      tool(runGetQuotation),
    )

    server.registerTool(
      'update_quotation',
      {
        title: 'Actualizar cotizacion compartida',
        description:
          'Regenera una propuesta compartida existente SIN cambiar el link /s/<id> ya enviado al cliente. ' +
          'IMPORTANTE: los parametros no enviados vuelven a sus valores por defecto — envia el conjunto completo de parametros que quieres que tenga la propuesta ' +
          '(usa get_quotation primero para conocer el estado actual). El nombre y datos del cliente se conservan salvo que se envie cliente_nombre. ' +
          'Propuestas ya firmadas no se pueden modificar.',
        inputSchema: updateQuotationInputShape,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      tool(runUpdateQuotation),
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

// Per-IP rate limit in front of the tools (covers create_quotation_link's
// Upstash writes too). Skipped when Upstash is not configured (local dev).
async function withinRateLimit(req: Request): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return true
  const redis = new Redis({ url, token })
  return rateLimit(redis, `rl:mcp:${getClientIp(req)}`, 60, 60)
}

async function guarded(req: Request): Promise<Response> {
  if (!authorized(req)) {
    // 404 (not 401) so the secret URL stays unguessable / hidden.
    return new Response('Not found', { status: 404 })
  }
  if (!(await withinRateLimit(req))) {
    return new Response('Too many requests', { status: 429 })
  }
  return handler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
