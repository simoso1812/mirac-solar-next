'use server'

import { gestionarCreacionDrive } from '@/lib/integrations/drive'

export async function uploadToDrive(formData: FormData) {
  const parentFolderId = process.env.PARENT_FOLDER_ID
  if (!parentFolderId) {
    return { success: false, error: 'PARENT_FOLDER_ID not configured' } as const
  }

  const clientName = formData.get('clientName') as string | null
  const locationLabel = (formData.get('locationLabel') as string) ?? ''
  const pdfName = formData.get('pdfName') as string | null
  const pdfFile = formData.get('pdf') as File | null

  if (!clientName || !pdfFile || !pdfName) {
    return { success: false, error: 'clientName, pdf, and pdfName are required' } as const
  }

  const arrayBuffer = await pdfFile.arrayBuffer()
  const pdfBytes = Buffer.from(arrayBuffer)

  return gestionarCreacionDrive(
    parentFolderId,
    clientName,
    locationLabel,
    pdfBytes,
    pdfName,
  )
}
