'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { decompressProposal } from '@/lib/share'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import type { QuotationData } from '@/lib/types'
import { Suspense } from 'react'

function SharedContent() {
  const searchParams = useSearchParams()
  const [proposal, setProposal] = useState<QuotationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const encoded = searchParams.get('d')
    if (!encoded) {
      setError('No se proporcionaron datos de la propuesta.')
      setLoading(false)
      return
    }

    decompressProposal(encoded)
      .then((data) => {
        // Recalculate results (flujo_caja was stripped for compression)
        if (data.technical && data.project && data.advanced) {
          const input = buildInputFromStore(data.technical, data.project, data.advanced)
          data.results = cotizacion(input)
        }
        setProposal(data)
      })
      .catch(() => {
        setError('No se pudo cargar la propuesta. El enlace puede estar corrupto.')
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111827]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
          <p className="mt-4 text-sm text-[#9CA3AF]">Cargando propuesta...</p>
        </div>
      </div>
    )
  }

  if (error || !proposal || !proposal.results) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111827]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#F9FAFB]">Error</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            {error ?? 'No se pudo cargar la propuesta.'}
          </p>
        </div>
      </div>
    )
  }

  return <VirtualQuotation proposal={proposal} isShared />
}

export default function SharedPage() {
  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
          </div>
        }
      >
        <SharedContent />
      </Suspense>
    </div>
  )
}
