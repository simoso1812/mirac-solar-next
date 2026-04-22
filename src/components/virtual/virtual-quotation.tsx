'use client'

import { useState, useMemo } from 'react'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualHeader } from './virtual-header'
import { VirtualFooter } from './virtual-footer'
import { ExecutiveSummary } from './executive-summary'
import { SystemDesignSection } from './system-design-section'
import { PricingTable } from './pricing-table'
import { BillSimulationSection } from './bill-simulation-section'
import { FinancialSection } from './financial-section'
import { CostComparisonSection } from './cost-comparison-section'
import { ProjectDetailsSection } from './project-details-section'
import { CallToAction } from './call-to-action'
import type { QuotationData, SignatureData } from '@/lib/types'

interface VirtualQuotationProps {
  proposal: QuotationData
  isShared?: boolean
  onSign?: (signature: SignatureData) => void
}

function NotesSection({ notas }: { notas: string }) {
  const [open, setOpen] = useState(true)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-left transition-colors hover:bg-white/[0.08]"
      >
        <span className="text-sm font-medium text-[#9CA3AF]">Notas del Proyecto</span>
        <svg
          className={`h-4 w-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#D1D5DB]">{notas}</p>
        </div>
      )}
    </section>
  )
}

export function VirtualQuotation({ proposal, isShared, onSign }: VirtualQuotationProps) {
  const baseInput = useMemo(
    () => buildInputFromStore(proposal.technical, proposal.project, proposal.advanced),
    [proposal.technical, proposal.project, proposal.advanced]
  )

  const [overrides, setOverrides] = useState({
    costoKwh: baseInput.costoKwh,
    incluirDeduccionRenta: baseInput.incluirDeduccionRenta,
    incluirDepreciacionAcelerada: baseInput.incluirDepreciacionAcelerada,
    horizonteAnios: baseInput.horizonteTiempo,
  })

  const baseResults = proposal.results!

  const whatIfResults = useMemo(() => {
    const input = {
      ...baseInput,
      costoKwh: overrides.costoKwh,
      // Master gate must be true so individual toggles take effect
      incluirBeneficiosTributarios: overrides.incluirDeduccionRenta || overrides.incluirDepreciacionAcelerada,
      incluirDeduccionRenta: overrides.incluirDeduccionRenta,
      incluirDepreciacionAcelerada: overrides.incluirDepreciacionAcelerada,
      horizonteTiempo: overrides.horizonteAnios,
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
        <BillSimulationSection
          results={whatIfResults}
          costoKwh={overrides.costoKwh}
          consumoMensualKwh={baseInput.consumoMensualKwh}
        />
        <FinancialSection
          baseResults={baseResults}
          whatIfResults={whatIfResults}
          overrides={overrides}
          onOverridesChange={setOverrides}
        />
        <CostComparisonSection
          results={whatIfResults}
          costoKwh={overrides.costoKwh}
          consumoMensualKwh={baseInput.consumoMensualKwh}
          indexRate={baseInput.indexRate}
          horizonteAnios={overrides.horizonteAnios}
        />
        <ProjectDetailsSection proposal={proposal} />
        {proposal.advanced.notas?.trim() && (
          <NotesSection notas={proposal.advanced.notas} />
        )}
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
