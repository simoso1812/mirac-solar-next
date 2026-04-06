'use client'

import { useState, useMemo } from 'react'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualHeader } from './virtual-header'
import { VirtualFooter } from './virtual-footer'
import { ExecutiveSummary } from './executive-summary'
import { SystemDesignSection } from './system-design-section'
import { PricingTable } from './pricing-table'
import { FinancialSection } from './financial-section'
import { ProjectDetailsSection } from './project-details-section'
import { CallToAction } from './call-to-action'
import type { QuotationData, SignatureData } from '@/lib/types'

interface VirtualQuotationProps {
  proposal: QuotationData
  isShared?: boolean
  onSign?: (signature: SignatureData) => void
}

export function VirtualQuotation({ proposal, isShared, onSign }: VirtualQuotationProps) {
  const baseInput = useMemo(
    () => buildInputFromStore(proposal.technical, proposal.project, proposal.advanced),
    [proposal.technical, proposal.project, proposal.advanced]
  )

  const [overrides, setOverrides] = useState({
    costoKwh: baseInput.costoKwh,
    consumoMensualKwh: baseInput.consumoMensualKwh,
  })

  const baseResults = proposal.results!

  const whatIfResults = useMemo(() => {
    const input = {
      ...baseInput,
      costoKwh: overrides.costoKwh,
      consumoMensualKwh: overrides.consumoMensualKwh,
    }
    return cotizacion(input)
  }, [baseInput, overrides])

  return (
    <>
      <VirtualHeader proposal={proposal} />
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-8">
        <ExecutiveSummary results={whatIfResults} technical={proposal.technical} />
        <SystemDesignSection results={whatIfResults} technical={proposal.technical} />
        <PricingTable results={whatIfResults} />
        <FinancialSection
          baseResults={baseResults}
          whatIfResults={whatIfResults}
          overrides={overrides}
          onOverridesChange={setOverrides}
        />
        <ProjectDetailsSection proposal={proposal} />
        <CallToAction
          proposal={proposal}
          isShared={isShared}
          onSign={onSign}
        />
      </main>
      <VirtualFooter />
    </>
  )
}
