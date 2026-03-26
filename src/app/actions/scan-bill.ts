'use server'

import Anthropic from '@anthropic-ai/sdk'
import {
  BILL_EXTRACTION_SYSTEM_PROMPT,
  BILL_EXTRACTION_USER_PROMPT,
  BILL_TEXT_EXTRACTION_SYSTEM_PROMPT,
  buildBillTextExtractionUserPrompt,
} from '@/lib/bill-scanner/prompts'
import { normalizeExtractedData } from '@/lib/bill-scanner/validator'
import type { ExtractedBillData, BillScanResult } from '@/lib/bill-scanner/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MIN_USEFUL_CHARS = 200
const MARKITDOWN_TIMEOUT = 45_000

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const VISION_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const BILL_KEYWORDS = ['kwh', 'consumo', 'factura', 'tarifa', 'cop', 'energía', 'energia', 'medidor', 'periodo']

// ---------------------------------------------------------------------------
// MarkItDown conversion via Render microservice
// ---------------------------------------------------------------------------

interface MarkItDownResult {
  markdown: string
  char_count: number
  has_tables: boolean
  source_type: string
}

async function convertWithMarkItDown(file: File): Promise<MarkItDownResult | null> {
  const serviceUrl = process.env.MARKITDOWN_SERVICE_URL
  const apiKey = process.env.MARKITDOWN_API_KEY
  if (!serviceUrl) return null

  try {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${serviceUrl}/convert`, {
      method: 'POST',
      headers: apiKey ? { 'X-API-Key': apiKey } : {},
      body: formData,
      signal: AbortSignal.timeout(MARKITDOWN_TIMEOUT),
    })

    if (!res.ok) return null
    return await res.json() as MarkItDownResult
  } catch {
    return null
  }
}

function hasRelevantBillContent(markdown: string): boolean {
  const lower = markdown.toLowerCase()
  return BILL_KEYWORDS.some((kw) => lower.includes(kw))
}

// ---------------------------------------------------------------------------
// Claude extraction helpers
// ---------------------------------------------------------------------------

function parseClaudeResponse(text: string): ExtractedBillData {
  let jsonText = text.trim()
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }
  return JSON.parse(jsonText) as ExtractedBillData
}

async function extractWithClaudeText(
  client: Anthropic,
  markdown: string,
): Promise<ExtractedBillData> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: BILL_TEXT_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildBillTextExtractionUserPrompt(markdown),
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }
  return parseClaudeResponse(textBlock.text)
}

async function extractWithClaudeVision(
  client: Anthropic,
  base64Data: string,
  fileType: string,
): Promise<ExtractedBillData> {
  const isPdf = fileType === 'application/pdf'
  const imageContent: Anthropic.Messages.ContentBlockParam = isPdf
    ? {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf', data: base64Data },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: fileType as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64Data,
        },
      }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: BILL_EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [imageContent, { type: 'text', text: BILL_EXTRACTION_USER_PROMPT }],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }
  return parseClaudeResponse(textBlock.text)
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function scanBillAction(formData: FormData): Promise<BillScanResult> {
  const startTime = Date.now()

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        success: false, data: null,
        error: 'ANTHROPIC_API_KEY no configurada',
        processing_time_ms: Date.now() - startTime,
      }
    }

    const file = formData.get('file') as File | null

    if (!file) {
      return {
        success: false, data: null,
        error: 'No se proporcionó un archivo',
        processing_time_ms: Date.now() - startTime,
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false, data: null,
        error: `Tipo de archivo no soportado: ${file.type}. Use JPG, PNG, WebP, PDF, Word o Excel.`,
        processing_time_ms: Date.now() - startTime,
      }
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false, data: null,
        error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.`,
        processing_time_ms: Date.now() - startTime,
      }
    }

    const client = new Anthropic({ apiKey })
    const canUseVision = VISION_TYPES.includes(file.type)

    let extractedData: ExtractedBillData
    let extractionMethod: 'text' | 'vision'

    const mkResult = await convertWithMarkItDown(file)
    const hasUsefulText = mkResult && mkResult.char_count >= MIN_USEFUL_CHARS && hasRelevantBillContent(mkResult.markdown)

    if (hasUsefulText) {
      try {
        extractedData = await extractWithClaudeText(client, mkResult.markdown)
        extractionMethod = 'text'
      } catch {
        if (canUseVision) {
          const buffer = Buffer.from(await file.arrayBuffer())
          extractedData = await extractWithClaudeVision(client, buffer.toString('base64'), file.type)
          extractionMethod = 'vision'
        } else {
          return {
            success: false, data: null,
            error: 'Error al extraer datos del texto. Intente con PDF o imagen.',
            processing_time_ms: Date.now() - startTime,
          }
        }
      }
    } else if (canUseVision) {
      const buffer = Buffer.from(await file.arrayBuffer())
      extractedData = await extractWithClaudeVision(client, buffer.toString('base64'), file.type)
      extractionMethod = 'vision'
    } else {
      return {
        success: false, data: null,
        error: 'No se pudo extraer texto del archivo Word/Excel. Intenta con PDF o imagen.',
        processing_time_ms: Date.now() - startTime,
      }
    }

    const normalizedData = normalizeExtractedData(extractedData)

    return {
      success: true,
      data: normalizedData,
      processing_time_ms: Date.now() - startTime,
      extraction_method: extractionMethod,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return {
      success: false, data: null,
      error: `Error procesando la factura: ${message}`,
      processing_time_ms: Date.now() - startTime,
    }
  }
}
