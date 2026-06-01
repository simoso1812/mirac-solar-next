'use client'

import { Zap, Sun, DollarSign, Clock, TreePine } from 'lucide-react'
import { formatCOP, formatNumber } from '@/lib/formatting'
import type { CalculationResults, TechnicalData } from '@/lib/types'

interface ExecutiveSummaryProps {
  results: CalculationResults
  technical?: TechnicalData
}

export function ExecutiveSummary({ results: r, technical }: ExecutiveSummaryProps) {
  const generacionMensual = Math.round(r.generacion_anual_kwh / 12)
  const consumo = technical?.consumo_mensual_kwh ?? 0
  const cobertura = consumo > 0 ? Math.round((generacionMensual / consumo) * 100) : 0

  return (
    <section>
      <h2 className="mb-6 text-2xl font-light tracking-tight text-[#F9FAFB]">Resumen Ejecutivo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Primary: System Power */}
        <div className="col-span-2 rounded-2xl border border-white/5 bg-white/5 p-6">
          <p className="text-sm text-[#9CA3AF] flex items-center gap-2">
            <Zap className="size-4 text-[#BFFF00]" />
            Potencia Instalada
          </p>
          <h3 className="mt-3 text-5xl font-bold tabular-nums text-white">
            {r.kwp.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
            <span className="ml-1 text-2xl text-[#9CA3AF]">kWp</span>
          </h3>
          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
            <span className="text-xs text-[#9CA3AF]">{r.potencia_panel_w}W por panel</span>
            <span className="rounded bg-white/10 px-2 py-1 text-xs text-[#F9FAFB]">
              {r.numero_paneles} Módulos
            </span>
          </div>
        </div>

        {/* Monthly Generation */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="size-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Generación Mensual</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {formatNumber(generacionMensual)} <span className="text-sm text-[#9CA3AF]">kWh</span>
          </p>
          {cobertura > 0 && (
            <p className="mt-2 text-xs text-emerald-400">
              Cubre {cobertura}% del consumo
            </p>
          )}
        </div>

        {/* Annual Savings */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="size-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Ahorro Anual</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {formatCOP(r.ahorro_anual_cop)}
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            {formatCOP(r.ahorro_mensual_cop)}/mes
          </p>
        </div>

        {/* Payback */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="size-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">Retorno de Inversión</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {r.payback_anios.toFixed(1)} <span className="text-sm text-[#9CA3AF]">Años</span>
          </p>
          <p className="mt-2 text-xs text-[#BFFF00]">
            TIR: {r.tir.toFixed(1)}%
          </p>
        </div>

        {/* CO2 */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <TreePine className="size-4 text-[#BFFF00]" />
            <p className="text-xs text-[#9CA3AF]">CO₂ Evitado</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-white">
            {r.carbon.annual_co2_avoided_tons.toFixed(1)} <span className="text-sm text-[#9CA3AF]">Ton/Año</span>
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            ≈ {Math.round(r.carbon.trees_saved_per_year)} árboles
          </p>
        </div>
      </div>
    </section>
  )
}
