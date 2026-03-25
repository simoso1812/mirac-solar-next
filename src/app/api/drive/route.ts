import { NextRequest, NextResponse } from 'next/server'
import { gestionarCreacionDrive } from '@/lib/integrations/drive'

export async function POST(request: NextRequest) {
  try {
    const parentFolderId = process.env.PARENT_FOLDER_ID
    if (!parentFolderId) {
      return NextResponse.json(
        { success: false, error: 'PARENT_FOLDER_ID not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { clientName, locationLabel, pdfBase64, pdfName } = body

    if (!clientName || !pdfBase64 || !pdfName) {
      return NextResponse.json(
        { success: false, error: 'clientName, pdfBase64, and pdfName are required' },
        { status: 400 }
      )
    }

    const pdfBytes = Buffer.from(pdfBase64, 'base64')

    const result = await gestionarCreacionDrive(
      parentFolderId,
      clientName,
      locationLabel ?? '',
      pdfBytes,
      pdfName
    )

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Server error: ${error}` },
      { status: 500 }
    )
  }
}
