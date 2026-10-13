'use client'

import { useState, useMemo } from 'react'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { VirtualHeader } from './virtual-header'
import { VirtualFooter } from './virtual-footer'
import { ExecutiveSummary } from './executive-summary'
import { SystemDesignSection } from './system-design-section'
import { RoofDesignSection } from './roof-design-section'
import { BatterySection } from './battery-section'
import { PricingTable } from './pricing-table'
import { PaymentScheduleSection } from './payment-schedule-section'
import { BillSimulationSection } from './bill-simulation-section'
import { FinancialSection } from './financial-section'
import { CostComparisonSection } from './cost-comparison-section'
import { PpaSection } from './ppa-section'
import { ImageGallerySection } from './image-gallery-section'
import { ProjectDetailsSection } from './project-details-section'
import { ImportantAspectsSection } from './important-aspects-section'
import { FaqSection } from './faq-section'
import { CallToAction } from './call-to-action'
import { PhotoBand } from './mirac-lines'
import { ofertaValidezHasta, formatFechaLarga, OFERTA_VALIDEZ_DIAS } from '@/lib/formatting'
import type { ClientData, DocusealSignatureData, QuotationData } from '@/lib/types'

interface VirtualQuotationProps {
  proposal: QuotationData
  isShared?: boolean
  onDocusealUpdate?: (docuseal: DocusealSignatureData, accepted?: boolean) => void
  onClientUpdate?: (clientPatch: Partial<ClientData>) => Promise<void> | void
}

function ValidityNotice({ validezHasta }: { validezHasta: Date | null }) {
  const [now] = useState(() => Date.now())
  if (!validezHasta) {
    return (
      <p className="text-center text-xs text-[#9AA3A7]">
        Oferta válida por {OFERTA_VALIDEZ_DIAS} días a partir de la fecha de emisión.
      </p>
    )
  }
  const vencida = validezHasta.getTime() < now
  if (vencida) {
    return (
      <div className="rounded-xl border border-[#FF9E1B]/30 bg-[#FF9E1B]/10 px-4 py-3 text-center text-xs text-[#FF9E1B]">
        Esta oferta venció el {formatFechaLarga(validezHasta)}. Contáctanos para actualizar tu cotización.
      </div>
    )
  }
  return (
    <p className="text-center text-xs text-[#9AA3A7]">
      Oferta válida hasta el {formatFechaLarga(validezHasta)}.
    </p>
  )
}

function NotesSection({ notas }: { notas: string }) {
  const [open, setOpen] = useState(true)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-[#2A2A2A] bg-[#161616] px-6 py-4 text-left transition-colors hover:bg-[#1E1E1E]"
      >
        <span className="text-sm font-medium text-[#9AA3A7]">Notas del Proyecto</span>
        <svg
          className={`h-4 w-4 text-[#9AA3A7] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-[#2A2A2A] bg-[#161616] px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#C6CFD2]">{notas}</p>
        </div>
      )}
    </section>
  )
}

export function VirtualQuotation({ proposal, isShared, onDocusealUpdate, onClientUpdate }: VirtualQuotationProps) {
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

  const validezHasta = ofertaValidezHasta(proposal.project.fecha)

  return (
    <>
      <VirtualHeader proposal={proposal} results={whatIfResults} />
      <main className="mirac-virtual mx-auto max-w-6xl space-y-16 px-4 py-8 sm:px-6 md:py-12">
        <ValidityNotice validezHasta={validezHasta} />
        <ExecutiveSummary
          results={whatIfResults}
          technical={proposal.technical}
          modoConexion={proposal.advanced.modo_conexion}
          precioExcedentes={proposal.advanced.precio_excedentes}
          incluirDeduccionRenta={overrides.incluirDeduccionRenta}
          incluirDepreciacionAcelerada={overrides.incluirDepreciacionAcelerada}
        />
        <PhotoBand src="/virtual/band-site.webp" eyebrow="El sistema" title="Ingeniería y equipos para generar tu propia energía" />
        <SystemDesignSection results={whatIfResults} technical={proposal.technical} />
        <RoofDesignSection
          diseno={proposal.technical.diseno_techo}
          potenciaPanelW={proposal.technical.potencia_panel_w}
        />
        <BatterySection results={whatIfResults} />
        <PricingTable results={whatIfResults} />
        {!proposal.advanced.financiamiento?.habilitado && (
          <PaymentScheduleSection total={whatIfResults.costo_total_cop} />
        )}
        <BillSimulationSection
          results={whatIfResults}
          costoKwh={overrides.costoKwh}
          consumoMensualKwh={baseInput.consumoMensualKwh}
        />
        <FinancialSection
          whatIfResults={whatIfResults}
          overrides={overrides}
          onOverridesChange={setOverrides}
          financiamiento={proposal.advanced.financiamiento}
        />
        <CostComparisonSection
          results={whatIfResults}
          costoKwh={overrides.costoKwh}
          consumoMensualKwh={baseInput.consumoMensualKwh}
          indexRate={baseInput.indexRate}
          horizonteAnios={overrides.horizonteAnios}
        />
        {proposal.advanced.ppa?.habilitada && proposal.advanced.ppa.opciones?.length > 0 && (
          <PpaSection
            results={whatIfResults}
            costoKwh={overrides.costoKwh}
            opciones={proposal.advanced.ppa.opciones}
          />
        )}
        {proposal.advanced.imagenes?.length > 0 && (
          <ImageGallerySection imagenes={proposal.advanced.imagenes} />
        )}
        <ProjectDetailsSection proposal={proposal} results={whatIfResults} />
        <ImportantAspectsSection
          bateriaHabilitada={!!whatIfResults.bateria?.habilitada}
          mostrarIncentivos={!!proposal.advanced.beneficios_tributarios}
        />
        <FaqSection />
        {proposal.advanced.notas?.trim() && (
          <NotesSection notas={proposal.advanced.notas} />
        )}
        <CallToAction
          proposal={proposal}
          isShared={isShared}
          onDocusealUpdate={onDocusealUpdate}
          onClientUpdate={onClientUpdate}
          validezHasta={validezHasta}
        />
      </main>
      <VirtualFooter />
    </>
  )
}
