'use server'

import { gestionarCreacionDrive, type DriveCreateResult } from '@/lib/integrations/drive'

export async function uploadToDrive(formData: FormData): Promise<DriveCreateResult> {
  try {
    const parentFolderId = process.env.PARENT_FOLDER_ID
    if (!parentFolderId) {
      return { success: false, folderLink: null, pdfLink: null, projectName: '', error: 'PARENT_FOLDER_ID not configured' }
    }

    // Check all required Google credentials
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { success: false, folderLink: null, pdfLink: null, projectName: '', error: 'Google Drive credentials not configured in environment variables' }
    }

    const clientName = formData.get('clientName') as string | null
    const locationLabel = (formData.get('locationLabel') as string) ?? ''
    const pdfName = formData.get('pdfName') as string | null
    const pdfFile = formData.get('pdf') as File | null

    if (!clientName || !pdfFile || !pdfName) {
      return { success: false, folderLink: null, pdfLink: null, projectName: '', error: 'clientName, pdf, and pdfName are required' }
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdfBytes = Buffer.from(arrayBuffer)

    const result = await gestionarCreacionDrive(
      parentFolderId,
      clientName,
      locationLabel,
      pdfBytes,
      pdfName,
    )

    // Return a plain serializable object
    return {
      success: result.success,
      folderLink: result.folderLink ?? null,
      pdfLink: result.pdfLink ?? null,
      projectName: result.projectName ?? '',
      error: result.error,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, folderLink: null, pdfLink: null, projectName: '', error: message }
  }
}
