/**
 * HTTP Basic Auth gate for the internal app (consumed by `src/proxy.ts`).
 *
 * The public surface is the client's link (/s/<id>) and everything it needs:
 * the share API reads and the client-side patches, DocuSeal signing, the
 * DocuSeal webhook, the MCP endpoint (has its own MCP_AUTH_TOKEN), and static
 * files. This module is the single list of public routes.
 */

// Path and everything under it.
const PREFIJOS_PUBLICOS = [
  '/s',
  '/propuestas/shared',
  '/_next',
  '/assets',
  '/virtual',
]

// Exact paths, any method.
const RUTAS_PUBLICAS = new Set([
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/api/docuseal/submission',
  '/api/docuseal/webhook',
  // Served by src/app/api/[transport]/route.ts (mcp-handler, basePath /api).
  '/api/mcp',
  '/api/sse',
  '/api/message',
])

// /s/<id> reads the payload (GET) and saves client data and the DocuSeal
// state (PATCH). POST (create link) and DELETE (revoke) stay gated.
const METODOS_PUBLICOS_SHARE = new Set(['GET', 'HEAD', 'PATCH'])

function bajo(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function esRutaPublica(pathname: string, method: string): boolean {
  if (pathname === '/api/share') return METODOS_PUBLICOS_SHARE.has(method.toUpperCase())
  if (RUTAS_PUBLICAS.has(pathname)) return true
  return PREFIJOS_PUBLICOS.some((base) => bajo(pathname, base))
}

const encoder = new TextEncoder()

// Runtime-agnostic (no node:crypto). The loop always runs over the expected
// password, so timing does not depend on how much of the attempt matches.
function igualesTiempoConstante(intento: string, esperado: string): boolean {
  const a = encoder.encode(intento)
  const b = encoder.encode(esperado)
  let diff = a.length ^ b.length
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i] ?? 0) ^ b[i]
  }
  return diff === 0
}

function decodificarBase64Utf8(valor: string): string {
  const binario = atob(valor)
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

/** Basic Auth with any username; only the password is checked. */
export function credencialesValidas(authorizationHeader: string | null, password: string): boolean {
  if (!authorizationHeader || !password) return false
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})\s*$/i.exec(authorizationHeader)
  if (!match) return false
  let decodificado: string
  try {
    decodificado = decodificarBase64Utf8(match[1])
  } catch {
    return false
  }
  const separador = decodificado.indexOf(':')
  if (separador < 0) return false
  return igualesTiempoConstante(decodificado.slice(separador + 1), password)
}

export type DecisionAcceso = 'pasar' | 'no_autorizado' | 'sin_configurar'

export function decidirAcceso(p: {
  pathname: string
  method: string
  authorization: string | null
  password: string | undefined
  produccion: boolean
}): DecisionAcceso {
  if (esRutaPublica(p.pathname, p.method)) return 'pasar'
  // Fail closed in production when the password is missing; dev stays open.
  if (!p.password) return p.produccion ? 'sin_configurar' : 'pasar'
  return credencialesValidas(p.authorization, p.password) ? 'pasar' : 'no_autorizado'
}
