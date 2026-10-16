'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { fetchSharedData, updateSharedClient, updateSharedDocuseal, type SharedVersion } from '@/lib/share'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import { VersionSelector } from '@/components/virtual/version-selector'
import type { ClientData, DocusealSignatureData } from '@/lib/types'

export default function SharedShortPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [state, setState] = useState<{
    versions: SharedVersion[] | null
    error: string | null
    loading: boolean
  }>({ versions: null, error: null, loading: true })
  const [activeIndex, setActiveIndex] = useState(0)

  const { versions, error, loading } = state

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
        setState({ versions: withResults, error: null, loading: false })
      })
      .catch((err) => {
        setState({
          versions: null,
          error: err instanceof Error ? err.message : 'No se pudo cargar la propuesta.',
          loading: false,
        })
      })
  }, [id])

  const activeProposal = versions?.[activeIndex]?.proposal ?? null

  const handleDocusealUpdate = (docuseal: DocusealSignatureData, accepted?: boolean) => {
    // Persist on the share payload so a reload keeps the submission instead of
    // minting a duplicate contract. Server-verified; best-effort from here.
    if (docuseal.submission_id && docuseal.submitter_slug) {
      updateSharedDocuseal(id, {
        submission_id: docuseal.submission_id,
        submitter_slug: docuseal.submitter_slug,
        ...(versions && versions.length > 1 ? { version_index: activeIndex } : {}),
      }).catch((err) => console.warn('No se pudo persistir el estado de la firma:', err))
    }
    setState((current) => {
      if (!current.versions) return current
      return {
        ...current,
        versions: current.versions.map((version, index) => {
          if (index !== activeIndex) return version
          return {
            ...version,
            proposal: {
              ...version.proposal,
              docuseal,
              ...(accepted ? { status: 'accepted' as const } : {}),
            },
          }
        }),
      }
    })
  }

  const handleClientUpdate = async (clientPatch: Partial<ClientData>) => {
    await updateSharedClient(id, {
      email: clientPatch.email,
      telefono: clientPatch.telefono,
      nit_cc: clientPatch.nit_cc,
    })
    setState((current) => {
      if (!current.versions) return current
      return {
        ...current,
        versions: current.versions.map((version) => ({
          ...version,
          proposal: {
            ...version.proposal,
            client: { ...version.proposal.client, ...clientPatch },
          },
        })),
      }
    })
  }

  const versionMeta = useMemo(() => {
    if (!versions) return []
    return versions.map((v) => ({
      label: v.label,
      results: v.proposal.results,
    }))
  }, [versions])

  if (loading) {
    return (
      <div className="mirac-share flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-[#C6F500] border-t-transparent" />
          <p className="mt-4 text-sm text-[#9AA3A7]">Cargando propuesta…</p>
        </div>
      </div>
    )
  }

  if (error || !activeProposal || !activeProposal.results) {
    return (
      <div className="mirac-share flex min-h-screen items-center justify-center bg-[#0D0D0D]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">Propuesta no encontrada</h1>
          <p className="mt-2 text-sm text-[#9AA3A7]">
            {error ?? 'El enlace puede estar expirado o ser inválido.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mirac-share min-h-screen overflow-x-hidden bg-[#0D0D0D] font-[Roboto,Arial,sans-serif] text-white">
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
        onDocusealUpdate={handleDocusealUpdate}
        onClientUpdate={handleClientUpdate}
        shareRef={{
          shareId: id,
          ...(versions && versions.length > 1 ? { optionIndex: activeIndex } : {}),
        }}
      />
    </div>
  )
}
