'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { ProposalPdf } from '@/lib/pdf/proposal-pdf'
import { getStaticMapUrlForPdf } from '@/lib/pdf/get-map-url'
import { renderGenerationChart } from '@/lib/pdf/render-chart'
import { useProposalsStore } from '@/stores/proposals-store'
import { Button } from '@/components/ui/button'
import { HardDrive, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { prepareDriveUpload } from '@/app/actions/drive'
import type { QuotationData } from '@/lib/types'

interface DriveSyncButtonProps {
  proposal: QuotationData
  className?: string
}

/**
 * Upload a file directly to Google Drive using their REST API.
 * This bypasses Vercel's 4.5MB body limit since the upload goes
 * straight from the browser to Google's servers.
 */
async function uploadPdfToDrive(
  blob: Blob,
  fileName: string,
  folderId: string,
  accessToken: string,
): Promise<string | null> {
  const metadata = {
    name: fileName,
    parents: [folderId],
  }

  const form = new FormData()
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
  )
  form.append('file', blob, fileName)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Drive upload failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.webViewLink ?? null
}

export function DriveSyncButton({ proposal, className }: DriveSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const updateProposal = useProposalsStore((s) => s.updateProposal)

  const isSynced = !!proposal.drive_folder_link

  const handleSync = async () => {
    if (!proposal.results) return
    setSyncing(true)
    setError(null)

    try {
      // 1. Generate PDF
      const mapImageUrl =
        proposal.project.lat != null && proposal.project.lon != null
          ? getStaticMapUrlForPdf(proposal.project.lat, proposal.project.lon)
          : null

      const chartImageUrl = renderGenerationChart(
        proposal.results.generacion_mensual_kwh,
        proposal.technical.consumo_mensual_kwh,
        proposal.advanced.bateria.habilitada
      )

      const blob = await pdf(
        <ProposalPdf
          client={proposal.client}
          project={proposal.project}
          technical={proposal.technical}
          advanced={proposal.advanced}
          results={proposal.results}
          mapImageUrl={mapImageUrl}
          chartImageUrl={chartImageUrl}
        />
      ).toBlob()

      const pdfName = `Propuesta_${proposal.client.nombre.replace(/\s+/g, '_')}_${proposal.project.fecha}.pdf`

      // 2. Server action: create folder structure + get access token (small payload, no PDF)
      const driveResult = await prepareDriveUpload(
        proposal.client.nombre,
        proposal.project.ubicacion_label ?? '',
      )

      if (!driveResult.success || !driveResult.uploadFolderId || !driveResult.accessToken) {
        setError(driveResult.error ?? 'Error al preparar carpeta en Drive')
        return
      }

      // 3. Upload PDF directly from browser to Google Drive (bypasses Vercel limit)
      await uploadPdfToDrive(blob, pdfName, driveResult.uploadFolderId, driveResult.accessToken)

      // 4. Update proposal with Drive link
      updateProposal(proposal.id, {
        drive_folder_link: driveResult.folderLink,
        drive_project_name: driveResult.projectName,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
    } finally {
      setSyncing(false)
    }
  }

  if (isSynced) {
    return (
      <div className="flex items-center gap-2">
        <a
          href={proposal.drive_folder_link!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <CheckCircle className="h-3 w-3 text-emerald-600" />
          {proposal.drive_project_name ?? 'Drive'}
          <ExternalLink className="ml-1 h-3 w-3" />
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          title="Re-sincronizar (sobreescribe PDF)"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HardDrive className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={syncing || !proposal.results}
        className={className}
      >
        {syncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <HardDrive className="mr-2 h-4 w-4" />
        )}
        {syncing ? 'Sincronizando...' : 'Guardar en Drive'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
