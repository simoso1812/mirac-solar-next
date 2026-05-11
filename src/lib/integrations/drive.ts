/**
 * Google Drive integration — ported from drive_service.py
 *
 * Uses OAuth2 refresh token auth (same as the Streamlit app).
 * Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, PARENT_FOLDER_ID
 */

import { google, type drive_v3 } from 'googleapis'
import { ESTRUCTURA_CARPETAS } from '@/lib/constants'
import { Readable } from 'stream'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getDriveService(): drive_v3.Drive {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)')
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
  oauth2.setCredentials({ refresh_token: refreshToken })

  return google.drive({ version: 'v3', auth: oauth2 })
}

// ---------------------------------------------------------------------------
// Consecutive project number — FVyyNNN
// ---------------------------------------------------------------------------

export async function obtenerSiguienteConsecutivo(
  drive: drive_v3.Drive,
  parentFolderId: string
): Promise<number> {
  const yearShort = new Date().getFullYear().toString().slice(-2)
  const pattern = new RegExp(`FV${yearShort}(\\d{3})`)

  try {
    const res = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      pageSize: 1000,
      fields: 'files(name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    let maxNum = 0
    for (const file of res.data.files ?? []) {
      const match = pattern.exec(file.name ?? '')
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    }
    return maxNum + 1
  } catch (e) {
    console.error('Error fetching consecutive number:', e)
    return 1
  }
}

// ---------------------------------------------------------------------------
// Subfolder creation (recursive)
// ---------------------------------------------------------------------------

async function crearSubcarpetas(
  drive: drive_v3.Drive,
  parentId: string,
  estructura: Record<string, unknown>
): Promise<void> {
  for (const [name, sub] of Object.entries(estructura)) {
    const folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
      supportsAllDrives: true,
    })

    const folderId = folder.data.id
    const subObj = sub as Record<string, unknown>
    if (folderId && subObj && Object.keys(subObj).length > 0) {
      await crearSubcarpetas(drive, folderId, subObj)
    }
  }
}

// ---------------------------------------------------------------------------
// File upload helpers
// ---------------------------------------------------------------------------

export async function uploadBytesToDriveFolder(
  folderId: string,
  fileName: string,
  content: Buffer,
  mimeType: string,
): Promise<string | null> {
  const drive = getDriveService()
  return subirArchivo(drive, folderId, fileName, content, mimeType)
}

async function subirArchivo(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  content: Buffer,
  mimeType: string
): Promise<string | null> {
  try {
    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(content),
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    return file.data.webViewLink ?? null
  } catch (e) {
    console.error(`Error uploading ${fileName}:`, e)
    return null
  }
}

async function buscarSubcarpeta(
  drive: drive_v3.Drive,
  parentId: string,
  folderName: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${folderName}'`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return res.data.files?.[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// Prepare folder + get access token (for client-side PDF upload)
// ---------------------------------------------------------------------------

export interface DrivePrepareResult {
  success: boolean
  folderLink: string | null
  uploadFolderId: string | null
  accessToken: string | null
  projectName: string
  error?: string
}

export async function prepararCarpetaDrive(
  parentFolderId: string,
  clientName: string,
  locationLabel: string,
): Promise<DrivePrepareResult> {
  try {
    const drive = getDriveService()

    // Get fresh access token for client-side upload
    const oauth2 = drive.context._options.auth as import('google-auth-library').OAuth2Client
    const { token } = await oauth2.getAccessToken()
    if (!token) throw new Error('Failed to obtain access token')

    // 1. Get next consecutive number
    const consecutivo = await obtenerSiguienteConsecutivo(drive, parentFolderId)
    const yearShort = new Date().getFullYear().toString().slice(-2)
    const projectName = `FV${yearShort}${consecutivo.toString().padStart(3, '0')} - ${clientName}${locationLabel ? ` - ${locationLabel}` : ''}`

    // 2. Create main project folder
    const folder = await drive.files.create({
      requestBody: {
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    const folderId = folder.data.id
    if (!folderId) throw new Error('Failed to create project folder')

    // 3. Create subfolder structure
    await crearSubcarpetas(drive, folderId, ESTRUCTURA_CARPETAS)

    // 4. Find the upload target folder
    const propuestaFolderId = await buscarSubcarpeta(drive, folderId, '01_Propuesta_y_Contratacion')

    return {
      success: true,
      folderLink: folder.data.webViewLink ?? null,
      uploadFolderId: propuestaFolderId,
      accessToken: token,
      projectName,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Drive prepare error:', msg)
    return {
      success: false,
      folderLink: null,
      uploadFolderId: null,
      accessToken: null,
      projectName: '',
      error: msg,
    }
  }
}

// ---------------------------------------------------------------------------
// Main function — create project folder + structure + upload PDF
// ---------------------------------------------------------------------------

export interface DriveCreateResult {
  success: boolean
  folderLink: string | null
  pdfLink: string | null
  projectName: string
  error?: string
}

export async function gestionarCreacionDrive(
  parentFolderId: string,
  clientName: string,
  locationLabel: string,
  pdfBytes: Buffer,
  pdfName: string
): Promise<DriveCreateResult> {
  try {
    const drive = getDriveService()

    // 1. Get next consecutive number
    const consecutivo = await obtenerSiguienteConsecutivo(drive, parentFolderId)
    const yearShort = new Date().getFullYear().toString().slice(-2)
    const projectName = `FV${yearShort}${consecutivo.toString().padStart(3, '0')} - ${clientName}${locationLabel ? ` - ${locationLabel}` : ''}`

    // 2. Create main project folder
    const folder = await drive.files.create({
      requestBody: {
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })

    const folderId = folder.data.id
    if (!folderId) throw new Error('Failed to create project folder')

    // 3. Create subfolder structure
    await crearSubcarpetas(drive, folderId, ESTRUCTURA_CARPETAS)

    // 4. Upload PDF to 01_Propuesta_y_Contratacion
    let pdfLink: string | null = null
    const propuestaFolderId = await buscarSubcarpeta(drive, folderId, '01_Propuesta_y_Contratacion')
    if (propuestaFolderId) {
      pdfLink = await subirArchivo(drive, propuestaFolderId, pdfName, pdfBytes, 'application/pdf')
    }

    return {
      success: true,
      folderLink: folder.data.webViewLink ?? null,
      pdfLink,
      projectName,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Drive integration error:', msg)
    return {
      success: false,
      folderLink: null,
      pdfLink: null,
      projectName: '',
      error: msg,
    }
  }
}

// ---------------------------------------------------------------------------
// Upload CSV to 08_Administrativo_y_Financiero
// ---------------------------------------------------------------------------

export async function subirCSVaDrive(
  parentFolderId: string,
  projectFolderName: string,
  csvName: string,
  csvContent: string
): Promise<string | null> {
  try {
    const drive = getDriveService()

    // Find the project folder
    const res = await drive.files.list({
      q: `'${parentFolderId}' in parents and name='${projectFolderName}'`,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    const projectId = res.data.files?.[0]?.id
    if (!projectId) return null

    // Find admin subfolder
    const adminId = await buscarSubcarpeta(drive, projectId, '08_Administrativo_y_Financiero')
    if (!adminId) return null

    return await subirArchivo(drive, adminId, csvName, Buffer.from(csvContent, 'utf-8'), 'text/csv')
  } catch (e) {
    console.error('Error uploading CSV:', e)
    return null
  }
}
