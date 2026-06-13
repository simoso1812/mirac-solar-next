'use server'

import {
  prepararCarpetaDrive,
  createResumableUploadSession,
  uploadBytesToDriveFolder,
  type DrivePrepareResult,
} from '@/lib/integrations/drive'
import { setProposalDriveMapping } from '@/lib/proposal-drive-map'
import { getDocusealSubmission } from '@/lib/docuseal'

export async function prepareDriveUpload(
  clientName: string,
  locationLabel: string,
): Promise<DrivePrepareResult> {
  try {
    const parentFolderId = process.env.PARENT_FOLDER_ID
    if (!parentFolderId) {
      return { success: false, folderLink: null, uploadFolderId: null, projectName: '', error: 'PARENT_FOLDER_ID not configured' }
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { success: false, folderLink: null, uploadFolderId: null, projectName: '', error: 'Google Drive credentials not configured' }
    }

    const result = await prepararCarpetaDrive(parentFolderId, clientName, locationLabel)

    return {
      success: result.success,
      folderLink: result.folderLink ?? null,
      uploadFolderId: result.uploadFolderId ?? null,
      projectName: result.projectName ?? '',
      error: result.error,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, folderLink: null, uploadFolderId: null, projectName: '', error: message }
  }
}

/**
 * Create a Google Drive resumable upload session server-side. The returned
 * session URI lets the browser PUT the file bytes directly to Google without
 * ever seeing the OAuth access token.
 */
export async function createDriveUploadSession(
  folderId: string,
  fileName: string,
  mimeType: string,
  browserOrigin?: string,
): Promise<{ success: boolean; uploadUrl: string | null; error?: string }> {
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
      return { success: false, uploadUrl: null, error: 'Google Drive credentials not configured' }
    }

    const uploadUrl = await createResumableUploadSession(folderId, fileName, mimeType, browserOrigin)
    if (!uploadUrl) {
      return { success: false, uploadUrl: null, error: 'No se pudo crear la sesión de subida a Drive' }
    }

    return { success: true, uploadUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, uploadUrl: null, error: message }
  }
}

/**
 * Register the mapping that the DocuSeal webhook uses to find the
 * destination folder when the signed contract comes back.
 */
export async function registerProposalDriveMapping(
  proposalId: string,
  uploadFolderId: string,
  fileBaseName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await setProposalDriveMapping(proposalId, { uploadFolderId, fileBaseName })
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Fetch a signed contract PDF from DocuSeal and upload it to the given
 * Drive folder. Used when a proposal is synced AFTER it was already signed.
 */
export async function uploadSignedContractToDrive(
  submissionId: number,
  uploadFolderId: string,
  fileBaseName: string,
): Promise<{ success: boolean; link: string | null; error?: string }> {
  try {
    const submission = await getDocusealSubmission(submissionId)
    const docUrl = submission.documents?.[0]?.url
    if (!docUrl) {
      return { success: false, link: null, error: 'DocuSeal no devolvió el contrato firmado' }
    }

    const pdfRes = await fetch(docUrl)
    if (!pdfRes.ok) {
      return { success: false, link: null, error: `No se pudo descargar el contrato firmado (${pdfRes.status})` }
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

    const link = await uploadBytesToDriveFolder(
      uploadFolderId,
      `${fileBaseName}.pdf`,
      pdfBuffer,
      'application/pdf',
    )

    return { success: true, link }
  } catch (error) {
    return { success: false, link: null, error: error instanceof Error ? error.message : String(error) }
  }
}
