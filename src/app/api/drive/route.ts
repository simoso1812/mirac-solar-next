import { NextRequest, NextResponse } from 'next/server'
import { gestionarCreacionDrive } from '@/lib/integrations/drive'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const parentFolderId = process.env.PARENT_FOLDER_ID
    if (!parentFolderId) {
      return NextResponse.json(
        { success: false, error: 'PARENT_FOLDER_ID not configured' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const clientName = formData.get('clientName') as string | null
    const locationLabel = (formData.get('locationLabel') as string) ?? ''
    const pdfName = formData.get('pdfName') as string | null
    const pdfFile = formData.get('pdf') as File | null

    if (!clientName || !pdfFile || !pdfName) {
      return NextResponse.json(
        { success: false, error: 'clientName, pdf, and pdfName are required' },
        { status: 400 }
      )
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfBytes = Buffer.from(arrayBuffer)

    const result = await gestionarCreacionDrive(
      parentFolderId,
      clientName,
      locationLabel,
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
