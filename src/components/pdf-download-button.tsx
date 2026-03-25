'use client'

import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { ProposalPdf } from '@/lib/pdf/proposal-pdf'
import { getStaticMapUrlForPdf } from '@/lib/pdf/get-map-url'
import { renderGenerationChart } from '@/lib/pdf/render-chart'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import type { QuotationData } from '@/lib/types'

interface PdfDownloadButtonProps {
  proposal: QuotationData
  className?: string
}

export function PdfDownloadButton({ proposal, className }: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    if (!proposal.results) return
    setLoading(true)

    try {
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

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Propuesta_${proposal.client.nombre.replace(/\s+/g, '_')}_${proposal.project.fecha}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={loading || !proposal.results}
      className={className}
      variant="outline"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {loading ? 'Generando...' : 'Descargar PDF'}
    </Button>
  )
}
