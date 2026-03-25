import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { BILL_EXTRACTION_SYSTEM_PROMPT, BILL_EXTRACTION_USER_PROMPT } from '@/lib/bill-scanner/prompts'
import { normalizeExtractedData } from '@/lib/bill-scanner/validator'
import type { ExtractedBillData, BillScanResult } from '@/lib/bill-scanner/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function POST(request: NextRequest): Promise<NextResponse<BillScanResult>> {
  const startTime = Date.now()

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'ANTHROPIC_API_KEY no configurada',
        processing_time_ms: Date.now() - startTime,
      }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No se proporcionó un archivo',
        processing_time_ms: Date.now() - startTime,
      }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        success: false,
        data: null,
        error: `Tipo de archivo no soportado: ${file.type}. Use JPG, PNG, WebP o PDF.`,
        processing_time_ms: Date.now() - startTime,
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        data: null,
        error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 10MB.`,
        processing_time_ms: Date.now() - startTime,
      }, { status: 400 })
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Data = buffer.toString('base64')

    // Determine media type for Claude
    const isPdf = file.type === 'application/pdf'
    const mediaType = isPdf ? 'application/pdf' : file.type as 'image/jpeg' | 'image/png' | 'image/webp'

    // Build content for Claude Vision
    const imageContent: Anthropic.Messages.ContentBlockParam = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf',
            data: base64Data,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64Data,
          },
        }

    // Call Claude Vision API
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: BILL_EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            imageContent,
            { type: 'text', text: BILL_EXTRACTION_USER_PROMPT },
          ],
        },
      ],
    })

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No se obtuvo respuesta del modelo de IA',
        processing_time_ms: Date.now() - startTime,
      }, { status: 500 })
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = textBlock.text.trim()
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    let extractedData: ExtractedBillData
    try {
      extractedData = JSON.parse(jsonText) as ExtractedBillData
    } catch {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'Error al parsear la respuesta del modelo. Intente con una imagen más clara.',
        processing_time_ms: Date.now() - startTime,
      }, { status: 500 })
    }

    // Normalize and validate
    const normalizedData = normalizeExtractedData(extractedData)

    return NextResponse.json({
      success: true,
      data: normalizedData,
      processing_time_ms: Date.now() - startTime,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({
      success: false,
      data: null,
      error: `Error procesando la factura: ${message}`,
      processing_time_ms: Date.now() - startTime,
    }, { status: 500 })
  }
}
