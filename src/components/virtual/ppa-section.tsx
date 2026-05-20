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
        {/* Bar chart — matches PDF design: gray utility / yellow PPA / red -X% badge in gap */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-3">
          <p className="mb-6 text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
            Precio de la energía (COP/kWh)
          </p>
          <div className="relative flex h-72 items-end justify-center gap-12 pt-8">
            {/* Utility bar */}
            <div className="flex h-full w-32 flex-col items-center">
              <div className="relative flex h-full w-full flex-col justify-end">
                {/* Value label above bar */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 font-mono text-base font-bold tabular-nums text-[#F9FAFB]"
                  style={{ bottom: `calc(${utilityBarPct}% + 8px)` }}
                >
                  ${costoKwh.toLocaleString('es-CO')}
                </div>
                {/* Bar */}
                <div
                  className="w-full bg-[#9CA3AF]"
                  style={{ height: `${utilityBarPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#9CA3AF]">Red eléctrica</p>
            </div>

            {/* Mirac PPA bar */}
            <div className="flex h-full w-32 flex-col items-center">
              <div className="relative flex h-full w-full flex-col justify-end">
                {/* Value label above bar */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 font-mono text-base font-bold tabular-nums text-[#FA323F]"
                  style={{ bottom: `calc(${miracBarPct}% + 8px)` }}
                >
                  ${precioKwhPpa.toLocaleString('es-CO')}
                </div>
                {/* Bar */}
                <div
                  className="w-full bg-[#FAC107]"
                  style={{ height: `${miracBarPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[#9CA3AF]">PPA Mirac</p>
            </div>

            {/* Savings badge — centered in the gap between the two bar tops */}
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-md bg-[#FA323F] px-3 py-1 text-sm font-bold text-white shadow-lg"
              style={{
                bottom: `calc(${(utilityBarPct + miracBarPct) / 2}% + 28px)`,
              }}
            >
              -{porcentajeAhorro}%
            </div>

            {/* Axis baseline */}
            <div className="absolute bottom-6 left-0 right-0 h-px bg-white/20" />
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
