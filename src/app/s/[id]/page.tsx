'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { fetchSharedData, type SharedVersion } from '@/lib/share'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import { VersionSelector } from '@/components/virtual/version-selector'

export default function SharedShortPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [versions, setVersions] = useState<SharedVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    fetchSharedData(id)
      .then((data) => {
        // Recalculate results for each version
        const withResults = data.map((v) => {
          const p = v.proposal
          if (p.technical && p.project && p.advanced) {
            const input = buildInputFromStore(p.technical, p.project, p.advanced)
            p.results = cotizacion(input)
          }
          return v
        })
        setVersions(withResults)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la propuesta.')
      })
      .finally(() => setLoading(false))
  }, [id])

  const activeProposal = versions?.[activeIndex]?.proposal ?? null

  const versionMeta = useMemo(() => {
    if (!versions) return []
    return versions.map((v) => ({
      label: v.label,
      results: v.proposal.results,
    }))
  }, [versions])

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

  if (error || !activeProposal || !activeProposal.results) {
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
      {versions && versions.length > 1 && (
        <div className="pt-6">
          <VersionSelector
            versions={versionMeta}
            activeIndex={activeIndex}
            onSelect={setActiveIndex}
          />
        </div>
      )}
      <VirtualQuotation
        key={activeIndex}
        proposal={activeProposal}
        isShared
      />
    </div>
  )
}
