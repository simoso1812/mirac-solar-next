'use client'

import { formatCOP } from '@/lib/formatting'
import type { CalculationResults } from '@/lib/types'

interface PpaSectionProps {
  results: CalculationResults
  costoKwh: number
  precioKwhPpa: number
  duracionAnios: number
}

export function PpaSection({ results, costoKwh, precioKwhPpa, duracionAnios }: PpaSectionProps) {
  const ahorroPorKwh = Math.max(0, costoKwh - precioKwhPpa)
  const porcentajeAhorro = costoKwh > 0 ? Math.round((ahorroPorKwh / costoKwh) * 100) : 0
  const ahorroAnual = Math.round(results.generacion_anual_kwh * ahorroPorKwh)
  const ahorroTotal = ahorroAnual * duracionAnios
  const pagoMiracAnual = Math.round(results.generacion_anual_kwh * precioKwhPpa)
  const pagoMiracMensual = Math.round(pagoMiracAnual / 12)

  // Bar heights normalized to the higher value (utility)
  const maxPrice = Math.max(costoKwh, precioKwhPpa, 1)
  const utilityBarPct = (costoKwh / maxPrice) * 100
  const miracBarPct = (precioKwhPpa / maxPrice) * 100

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#BFFF00]" />
        Opción Cero Inversión (PPA)
      </h2>

      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-[#D1D5DB]">
        Con nuestro PPA Cero Inversión, accedes al sistema solar sin costo inicial. Pagas solo por la energía
        generada a <span className="font-semibold text-[#F9FAFB]">${precioKwhPpa.toLocaleString('es-CO')}/kWh</span>{' '}
        (vs. ${costoKwh.toLocaleString('es-CO')}/kWh de la red), con O&amp;M incluido, y ahorras{' '}
        <span className="font-semibold text-[#BFFF00]">{porcentajeAhorro}%</span> anual ={' '}
        <span className="font-semibold text-[#F9FAFB]">{formatCOP(ahorroTotal)}</span> en {duracionAnios} años.
      </p>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Bar chart */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
          <p className="mb-6 text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
            Precio de la energía (COP/kWh)
          </p>
          <div className="flex h-64 items-end gap-8">
            {/* Utility bar */}
            <div className="flex flex-1 flex-col items-center">
              <p className="mb-2 font-mono text-lg font-bold tabular-nums text-[#F9FAFB]">
                ${costoKwh.toLocaleString('es-CO')}
              </p>
              <div className="relative w-full max-w-[140px] flex-1 overflow-hidden rounded-t-lg bg-white/10">
                <div
                  className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-cyan-500/40 to-cyan-400/30"
                  style={{ height: `${utilityBarPct}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#9CA3AF]">Red eléctrica</p>
            </div>

            {/* Mirac PPA bar */}
            <div className="flex flex-1 flex-col items-center">
              <p className="mb-2 font-mono text-lg font-bold tabular-nums text-[#BFFF00]">
                ${precioKwhPpa.toLocaleString('es-CO')}
              </p>
              <div className="relative w-full max-w-[140px] flex-1 overflow-hidden rounded-t-lg bg-white/10">
                <div
                  className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-[#BFFF00]/60 to-[#BFFF00]/40"
                  style={{ height: `${miracBarPct}%` }}
                />
                {/* Savings label */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-md bg-[#BFFF00] px-2 py-1 text-sm font-bold text-black shadow-lg"
                  style={{ top: `${100 - utilityBarPct + (utilityBarPct - miracBarPct) / 2}%`, transform: 'translate(-50%, -50%)' }}
                >
                  -{porcentajeAhorro}%
                </div>
              </div>
              <p className="mt-3 text-xs text-[#9CA3AF]">PPA Mirac</p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[#BFFF00]/20 bg-[#BFFF00]/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[#BFFF00]">Ahorro Anual</p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-[#BFFF00]">
              {formatCOP(ahorroAnual)}
            </p>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              {results.generacion_anual_kwh.toLocaleString('es-CO', { maximumFractionDigits: 0 })} kWh × $
              {ahorroPorKwh.toLocaleString('es-CO')}/kWh
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
              Pago Mensual a Mirac
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#F9FAFB]">
              {formatCOP(pagoMiracMensual)}
            </p>
            <p className="mt-1 text-xs text-[#9CA3AF]">O&amp;M incluido</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
              Pago Anual a Mirac
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-[#F9FAFB]">
              {formatCOP(pagoMiracAnual)}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
              Ahorro Total ({duracionAnios} años)
            </p>
            <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-[#F9FAFB]">
              {formatCOP(ahorroTotal)}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
