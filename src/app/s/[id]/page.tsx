'use client'

import { use, useEffect, useState } from 'react'
import { fetchSharedProposal } from '@/lib/share'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import type { QuotationData } from '@/lib/types'

export default function SharedShortPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [proposal, setProposal] = useState<QuotationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSharedProposal(id)
      .then((data) => {
        if (data.technical && data.project && data.advanced) {
          const input = buildInputFromStore(data.technical, data.project, data.advanced)
          data.results = cotizacion(input)
        }
        setProposal(data)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la propuesta.')
      })
      .finally(() => setLoading(false))
  }, [id])

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
          <h1 className="text-xl font-bold text-[#F9FAFB]">Propuesta no encontrada</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            {error ?? 'El enlace puede estar expirado o ser inválido.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      <VirtualQuotation proposal={proposal} isShared />
    </div>
  )
}
