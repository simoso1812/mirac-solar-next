'use client'

import { use, useEffect } from 'react'
import { useProposalsStore } from '@/stores/proposals-store'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import { useHydrated } from '@/hooks/use-hydration'
import { fetchSharedData } from '@/lib/share'
import type { ClientData, DocusealSignatureData } from '@/lib/types'

export default function VirtualPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const hydrated = useHydrated()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
      </div>
    )
  }

  return <VirtualPageContent id={id} />
}

function VirtualPageContent({ id }: { id: string }) {
  const proposal = useProposalsStore((s) => s.getProposal(id))
  const updateProposal = useProposalsStore((s) => s.updateProposal)

  // If this proposal was shared, pull signing state back from the share
  // payload (the client signs on /s/<id>, which persists via PATCH). This is
  // how "firmado" reaches /propuestas without a manual status change.
  const shareId = proposal?.share_id ?? null
  const localDocusealUpdatedAt = proposal?.docuseal?.updated_at ?? null
  const localDocusealStatus = proposal?.docuseal?.status ?? null
  useEffect(() => {
    if (!shareId || localDocusealStatus === 'completed') return
    let cancelled = false
    fetchSharedData(shareId)
      .then((versions) => {
        if (cancelled) return
        const remote = versions[0]?.proposal.docuseal
        if (!remote) return
        if (remote.updated_at === localDocusealUpdatedAt && remote.status === localDocusealStatus) return
        updateProposal(id, {
          docuseal: remote,
          ...(remote.status === 'completed' ? { status: 'accepted' as const } : {}),
        })
      })
      .catch(() => {}) // expired/unreachable share — keep local state
    return () => {
      cancelled = true
    }
  }, [shareId, localDocusealStatus, localDocusealUpdatedAt, id, updateProposal])

  if (!proposal || !proposal.results) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#F9FAFB]">Propuesta no encontrada</h1>
          <p className="mt-2 text-sm text-[#9CA3AF]">
            La propuesta solicitada no existe o no tiene resultados calculados.
          </p>
        </div>
      </div>
    )
  }

  const handleDocusealUpdate = (docuseal: DocusealSignatureData, accepted?: boolean) => {
    updateProposal(id, {
      docuseal,
      ...(accepted ? { status: 'accepted' as const } : {}),
    })
  }

  const handleClientUpdate = (clientPatch: Partial<ClientData>) => {
    updateProposal(id, {
      client: { ...proposal.client, ...clientPatch },
    })
  }

  return (
    <VirtualQuotation
      proposal={proposal}
      onDocusealUpdate={handleDocusealUpdate}
      onClientUpdate={handleClientUpdate}
    />
  )
}
