/**
 * MCP tool: save a shared quotation to Google Drive, like the app's
 * "Guardar en Drive" button. Creates (or reuses) the FVyyNNN folder tree,
 * renders the proposal PDF server-side, uploads it to
 * 01_Propuesta_y_Contratacion and registers the DocuSeal mapping so the
 * signed contract lands in the same folder.
 */
import { z } from 'zod'
import { renderToBuffer } from '@react-pdf/renderer'
import { ProposalPdf } from '@/lib/pdf/proposal-pdf'
import { GenerationChartPdf } from '@/lib/pdf/generation-chart-pdf'
import { getStaticMapUrlForPdf } from '@/lib/pdf/get-map-url'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { fromPayload, type SharePayload } from '@/lib/share'
import { prepararCarpetaDrive, uploadBytesToDriveFolder } from '@/lib/integrations/drive'
import { getProposalDriveMapping, setProposalDriveMapping } from '@/lib/proposal-drive-map'
import { getQuotationInputShape } from './manage-link'
import { getRedis } from './create-link'

export const saveDriveInputShape = {
  ...getQuotationInputShape,
  ubicacion: z
    .string()
    .max(120)
    .default('')
    .describe('Etiqueta de ubicacion para el nombre de la carpeta (ej "Rionegro"). Opcional; solo se usa al crear la carpeta.'),
}
export const saveDriveInputSchema = z.object(saveDriveInputShape)
export type SaveDriveArgs = z.infer<typeof saveDriveInputSchema>

const mm = (v: number) => v * 2.8346

function versionsOf(data: unknown): { label: string; payload: SharePayload }[] {
  if (typeof data === 'object' && data !== null && Array.isArray((data as { versions?: unknown }).versions)) {
    return (data as { versions: { label?: string; payload: SharePayload }[] }).versions.map((v, i) => ({
      label: v.label ?? `Opcion ${i + 1}`,
      payload: v.payload,
    }))
  }
  return [{ label: '', payload: data as SharePayload }]
}

export async function runSaveToDrive(args: SaveDriveArgs) {
  const parentFolderId = process.env.PARENT_FOLDER_ID
  if (!parentFolderId) throw new Error('PARENT_FOLDER_ID no esta configurado.')
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('Las credenciales de Google Drive no estan configuradas.')
  }

  const data = await getRedis().get(`share:${args.share_id}`)
  if (!data) throw new Error(`No existe una propuesta con id ${args.share_id} (puede haber expirado).`)
  const versions = versionsOf(data)
  const first = fromPayload(versions[0].payload, args.share_id)

  const safeClient = first.client.nombre.replace(/\s+/g, '_')
  const signedContractBaseName = `Contrato_Firmado_${safeClient}_${first.project.fecha}`

  // Reuse the folder of a previous save — otherwise every call mints a new
  // FVyyNNN consecutive + folder tree.
  const mappingId = `s:${args.share_id}`
  const existing = await getProposalDriveMapping(mappingId)
  let uploadFolderId = existing?.uploadFolderId ?? null
  let folderLink = existing?.folderLink ?? null
  let projectName = existing?.projectName ?? ''
  if (!uploadFolderId) {
    const prep = await prepararCarpetaDrive(parentFolderId, first.client.nombre, args.ubicacion)
    if (!prep.success || !prep.uploadFolderId) throw new Error(prep.error ?? 'No se pudo crear la carpeta en Drive.')
    uploadFolderId = prep.uploadFolderId
    folderLink = prep.folderLink
    projectName = prep.projectName
  }

  const archivos: string[] = []
  for (const v of versions) {
    const p = fromPayload(v.payload, args.share_id)
    const results = cotizacion(buildInputFromStore(p.technical, p.project, p.advanced))
    const mapImageUrl =
      p.project.lat != null && p.project.lon != null ? getStaticMapUrlForPdf(p.project.lat, p.project.lon) : null
    const pdf = await renderToBuffer(
      <ProposalPdf
        client={p.client}
        project={p.project}
        technical={p.technical}
        advanced={p.advanced}
        results={results}
        mapImageUrl={mapImageUrl}
        chartElement={
          <GenerationChartPdf
            monthlyGeneration={results.generacion_mensual_kwh}
            load={p.technical.consumo_mensual_kwh}
            incluirBaterias={p.advanced.bateria.habilitada}
            width={mm(180)}
            height={mm(90)}
          />
        }
      />,
    )
    const sufijo = v.label ? `_${v.label.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')}` : ''
    const nombre = `Propuesta_${safeClient}_${p.project.fecha}${sufijo}.pdf`
    await uploadBytesToDriveFolder(uploadFolderId, nombre, Buffer.from(pdf), 'application/pdf')
    archivos.push(nombre)
  }

  await setProposalDriveMapping(mappingId, {
    uploadFolderId,
    fileBaseName: signedContractBaseName,
    folderLink,
    projectName,
  })

  const reutilizada = !!existing?.uploadFolderId
  return {
    summary: [
      `## Guardado en Drive — ${projectName || first.client.nombre}`,
      '',
      reutilizada ? 'Carpeta existente reutilizada.' : 'Carpeta nueva creada con la estructura estandar.',
      folderLink ? `Carpeta: ${folderLink}` : null,
      `PDF subidos a 01_Propuesta_y_Contratacion: ${archivos.join(', ')}`,
      'El contrato firmado por DocuSeal se guardara en la misma carpeta.',
    ]
      .filter(Boolean)
      .join('\n'),
    structured: {
      share_id: args.share_id,
      carpeta_link: folderLink,
      proyecto: projectName,
      carpeta_reutilizada: reutilizada,
      archivos,
    },
  }
}
