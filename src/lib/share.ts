/**
 * Compress/decompress proposal data for shareable URLs
 */
import type { QuotationData } from '@/lib/types'

/**
 * Base64url encode a Uint8Array
 */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Base64url decode to Uint8Array
 */
function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Compress proposal data for URL sharing.
 * Strips flujo_caja (recalculable) to minimize size.
 */
export async function compressProposal(proposal: QuotationData): Promise<string> {
  // Clone and strip heavy recalculable data
  const stripped = structuredClone(proposal)
  if (stripped.results) {
    stripped.results.flujo_caja = []
  }
  // Remove drive sync info (not relevant for shared view)
  stripped.drive_folder_link = null
  stripped.drive_project_name = null

  const json = JSON.stringify(stripped)
  const encoder = new TextEncoder()
  const input = encoder.encode(json)

  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(input.buffer as ArrayBuffer)
  writer.close()

  const reader = cs.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const compressed = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    compressed.set(chunk, offset)
    offset += chunk.length
  }

  return base64urlEncode(compressed)
}

/**
 * Decompress proposal data from URL parameter.
 * Returns the QuotationData (results.flujo_caja will be empty — caller should recalculate).
 */
export async function decompressProposal(encoded: string): Promise<QuotationData> {
  const compressed = base64urlDecode(encoded)

  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(compressed.buffer as ArrayBuffer)
  writer.close()

  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const decompressed = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    decompressed.set(chunk, offset)
    offset += chunk.length
  }

  const decoder = new TextDecoder()
  const json = decoder.decode(decompressed)
  return JSON.parse(json) as QuotationData
}

/**
 * Generate a full shareable URL for a proposal
 */
export async function generateShareUrl(proposal: QuotationData): Promise<string> {
  const encoded = await compressProposal(proposal)
  return `${window.location.origin}/propuestas/shared?d=${encoded}`
}
