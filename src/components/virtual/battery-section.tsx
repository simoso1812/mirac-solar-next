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
      <h2 className="mb-6 flex items-center gap-3 border-b border-[#2A2A2A] pb-4 text-xl font-medium tracking-tight text-white">
        <span className="h-5 w-1 rounded-full bg-[#C6F500]" />
        Sistema de Almacenamiento
      </h2>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Headline capacity */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-[#9AA3A7]">
            <Battery className="size-4 text-[#C6F500]" />
            Capacidad Nominal
          </div>
          <h3 className="mt-3 text-5xl font-bold tabular-nums text-white">
            {b.capacidad_nominal_kwh.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
            <span className="ml-1 text-2xl text-[#9AA3A7]">kWh</span>
          </h3>
          <p className="mt-4 text-xs text-[#9AA3A7]">
            Capacidad útil: {b.capacidad_util_kwh.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kWh
            ({horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} {horas === 1 ? 'hora' : 'horas'} de autonomía)
          </p>
          <div className="mt-5 flex items-center justify-between border-t border-[#2A2A2A] pt-4">
            <span className="text-xs text-[#9AA3A7]">Inversión almacenamiento</span>
            <span className="rounded bg-[#C6F500]/10 px-2 py-1 text-xs font-medium text-white">
              {formatCOP(b.costo_cop)}
            </span>
          </div>
        </div>

        {/* DoD */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <Gauge className="size-4 text-[#C6F500]" />
            <p className="text-xs text-[#9AA3A7]">Profundidad de Descarga</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {dodPct}<span className="text-sm text-[#9AA3A7]">%</span>
          </p>
          <p className="mt-2 text-xs text-[#9AA3A7]">
            Energía utilizable por ciclo
          </p>
        </div>

        {/* Efficiency */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <BatteryCharging className="size-4 text-[#C6F500]" />
            <p className="text-xs text-[#9AA3A7]">Eficiencia</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {effPct}<span className="text-sm text-[#9AA3A7]">%</span>
          </p>
          <p className="mt-2 text-xs text-[#9AA3A7]">
            Round-trip carga/descarga
          </p>
        </div>

        {/* Autonomy */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5 flex flex-col justify-center">
          <div className="mb-2 flex items-center gap-2">
            <Clock className="size-4 text-[#C6F500]" />
            <p className="text-xs text-[#9AA3A7]">Autonomía</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {b.horas_autonomia.toLocaleString('es-CO', { maximumFractionDigits: 1 })}<span className="text-sm text-[#9AA3A7]"> {b.horas_autonomia === 1 ? 'hora' : 'horas'}</span>
          </p>
          <p className="mt-2 text-xs text-[#9AA3A7]">
            Sin generación solar
          </p>
        </div>
      </div>
    </section>
  )
}
