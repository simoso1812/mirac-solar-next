'use client'

import { use } from 'react'
import { useProposalsStore } from '@/stores/proposals-store'
import { VirtualQuotation } from '@/components/virtual/virtual-quotation'
import { useHydrated } from '@/hooks/use-hydration'
import type { SignatureData } from '@/lib/types'

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
      </div>
    )
  }

  return <VirtualPageContent id={id} />
}

function VirtualPageContent({ id }: { id: string }) {
  const proposal = useProposalsStore((s) => s.getProposal(id))
  const updateProposal = useProposalsStore((s) => s.updateProposal)

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

  const handleSign = (signature: SignatureData) => {
    updateProposal(id, { status: 'accepted', signature })
  }

  return (
    <VirtualQuotation
      proposal={proposal}
      onSign={handleSign}
    />
  )
}
