'use client'

import { Battery, BatteryCharging, Gauge, Clock } from 'lucide-react'
import { formatCOP } from '@/lib/formatting'
import type { CalculationResults } from '@/lib/types'

interface BatterySectionProps {
  results: CalculationResults
}

export function BatterySection({ results }: BatterySectionProps) {
  const b = results.bateria
  if (!b || !b.habilitada) return null

  const dodPct = Math.round(b.profundidad_descarga * 100)
  const effPct = Math.round(b.eficiencia * 100)
  const horas = typeof b.horas_autonomia === 'number' ? b.horas_autonomia : 0

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#BFFF00]" />
        Sistema de Almacenamiento
      </h2>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Headline capacity */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
            <Battery className="h-4 w-4 text-[#BFFF00]" />
            Capacidad Nominal
          </div>
          <h3 className="mt-3 text-5xl font-bold tabular-nums text-white">
            {b.capacidad_nominal_kwh.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
            <span className="ml-1 text-2xl text-[#9CA3AF]">kWh</span>
          </h3>
          <p className="mt-4 text-xs text-[#9CA3AF]">
            Capacidad útil: {b.capacidad_util_kwh.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kWh
            ({horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} {horas === 1 ? 'hora' : 'horas'} de autonomía)
          </p>
          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs text-[#9CA3AF]">Inversión almacenamiento</span>
            <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-[#F9FAFB]">
              {formatCOP(b.costo_cop)}
            </span>
          </div>
        </div>

        {/* DoD */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Profundidad de Descarga</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {dodPct}<span className="text-sm text-[#9CA3AF]">%</span>
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            Energía utilizable por ciclo
          </p>
        </div>

        {/* Efficiency */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <BatteryCharging className="h-4 w-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Eficiencia</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {effPct}<span className="text-sm text-[#9CA3AF]">%</span>
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            Round-trip carga/descarga
          </p>
        </div>

        {/* Autonomy */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Autonomía</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {b.horas_autonomia.toLocaleString('es-CO', { maximumFractionDigits: 1 })}<span className="text-sm text-[#9CA3AF]"> {b.horas_autonomia === 1 ? 'hora' : 'horas'}</span>
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            Sin generación solar
          </p>
        </div>
      </div>
    </section>
  )
}
