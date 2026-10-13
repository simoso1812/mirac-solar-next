'use client'

import Image from 'next/image'
import type { CalculationResults, QuotationData } from '@/lib/types'
import { CIUDADES } from '@/lib/constants'
import { formatCOPShort } from '@/lib/formatting'
import { MiracBar } from './mirac-lines'

const DEFAULT_HERO = '/virtual/hero-default.webp'

interface VirtualHeaderProps {
  proposal: QuotationData
  results?: CalculationResults
}

function HeroKpi({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p
        className={`font-['DM_Sans',Arial,sans-serif] text-[2rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums sm:text-5xl ${accent ? 'text-[#C6F500]' : 'text-white'}`}
      >
        {value}
        {unit && <small className="ml-1.5 text-sm font-medium tracking-normal text-[#9AA3A7] sm:text-lg">{unit}</small>}
      </p>
      <p className="mirac-ey mt-2 text-[10px] sm:text-[11px]">{label}</p>
    </div>
  )
}

function millones(v: number): { value: string; unit?: string } {
  if (Math.abs(v) < 1_000_000) return { value: formatCOPShort(v) }
  return { value: `$${(v / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}`, unit: 'M COP' }
}

export function VirtualHeader({ proposal, results: r }: VirtualHeaderProps) {
  const ciudadLabel =
    CIUDADES.find((c) => c.value === proposal.project.ciudad)?.label ??
    proposal.project.ciudad

  const fecha = new Date(proposal.created_at).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
  })

  const foto = proposal.advanced?.imagenes?.[0]?.data

  return (
    <header className="relative overflow-hidden bg-[#0D0D0D] text-white">
      {/* Deck cover (El Zulia slide 1): grayscale photo, always present. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center grayscale"
        style={{ backgroundImage: `url(${foto ?? DEFAULT_HERO})` }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg,rgba(13,13,13,.93),rgba(13,13,13,.6) 60%,rgba(13,13,13,.3)), linear-gradient(180deg,transparent 55%,rgba(13,13,13,.9))' }}
      />
      <div className="relative mx-auto flex min-h-[560px] max-w-6xl flex-col px-4 pt-6 pb-10 sm:px-6 md:min-h-[640px] md:pb-14">
        <div className="flex items-start justify-between gap-4">
          <p className="mirac-ey text-[10px] sm:text-[11px]">Mirac · Propuesta de energía solar</p>
          <p className="mirac-ey shrink-0 text-right text-[10px] sm:text-[11px]">{fecha}</p>
        </div>
        <div className="mt-auto pt-16">
          <h1 className="break-words font-['DM_Sans',Arial,sans-serif] text-[2.75rem] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-7xl md:text-[6.5rem]">
            {proposal.client.nombre}
          </h1>
          <p className="mt-4 text-sm text-[#C6CFD2] sm:text-base">
            {r && (
              <b className="font-medium text-white">
                {r.kwp.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kWp · {r.numero_paneles} módulos
              </b>
            )}
            {r && ' · '}
            {ciudadLabel}
          </p>
          {r && (
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 md:mt-10 md:grid-cols-4">
              <HeroKpi {...millones(r.costo_total_cop)} label="Inversión" />
              <HeroKpi {...millones(r.ahorro_anual_cop)} label="Ahorro anual" />
              <HeroKpi value={r.payback_anios.toFixed(1)} unit="años" label="Payback" />
              <HeroKpi value={`${r.tir.toFixed(1)} %`} label="TIR" accent />
            </div>
          )}
          <div className="mt-10 flex items-center gap-4">
            <Image
              src="/assets/LogoBlanco.png"
              alt="Mirac Energy"
              width={300}
              height={100}
              className="h-7 w-auto sm:h-8"
              priority
            />
          </div>
        </div>
      </div>
      <MiracBar />
    </header>
  )
}
