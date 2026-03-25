'use server'

import { prepararCarpetaDrive, type DrivePrepareResult } from '@/lib/integrations/drive'

export async function prepareDriveUpload(
  clientName: string,
  locationLabel: string,
): Promise<DrivePrepareResult> {
  try {
    const parentFolderId = process.env.PARENT_FOLDER_ID
    if (!parentFolderId) {
      return { success: false, folderLink: null, uploadFolderId: null, accessToken: null, projectName: '', error: 'PARENT_FOLDER_ID not configured' }
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { success: false, folderLink: null, uploadFolderId: null, accessToken: null, projectName: '', error: 'Google Drive credentials not configured' }
    }

    const result = await prepararCarpetaDrive(parentFolderId, clientName, locationLabel)

    return {
      success: result.success,
      folderLink: result.folderLink ?? null,
      uploadFolderId: result.uploadFolderId ?? null,
      accessToken: result.accessToken ?? null,
      projectName: result.projectName ?? '',
      error: result.error,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, folderLink: null, uploadFolderId: null, accessToken: null, projectName: '', error: message }
  }
}
