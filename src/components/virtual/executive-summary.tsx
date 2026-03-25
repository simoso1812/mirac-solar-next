'use client'

import { Zap, Sun, DollarSign, Clock, TrendingUp, TreePine } from 'lucide-react'
import { formatKWp, formatCOP, formatPercent } from '@/lib/formatting'
import type { CalculationResults } from '@/lib/types'

interface ExecutiveSummaryProps {
  results: CalculationResults
}

const metrics = [
  {
    key: 'kwp',
    label: 'Potencia del Sistema',
    icon: Zap,
    getValue: (r: CalculationResults) => formatKWp(r.kwp),
    sub: (r: CalculationResults) => `${r.numero_paneles} paneles de ${r.potencia_panel_w}W`,
  },
  {
    key: 'panels',
    label: 'Generación Anual',
    icon: Sun,
    getValue: (r: CalculationResults) =>
      `${Math.round(r.generacion_anual_kwh).toLocaleString('es-CO')} kWh`,
    sub: (r: CalculationResults) => `PR: ${formatPercent(r.performance_ratio)}`,
  },
  {
    key: 'savings',
    label: 'Ahorro Anual',
    icon: DollarSign,
    getValue: (r: CalculationResults) => formatCOP(r.ahorro_anual_cop),
    sub: (r: CalculationResults) => `${formatCOP(r.ahorro_mensual_cop)}/mes`,
  },
  {
    key: 'payback',
    label: 'Retorno de Inversión',
    icon: Clock,
    getValue: (r: CalculationResults) => `${r.payback_anios.toFixed(1)} años`,
    sub: (r: CalculationResults) => `ROI: ${r.roi_porcentaje.toFixed(0)}%`,
  },
  {
    key: 'tir',
    label: 'TIR',
    icon: TrendingUp,
    getValue: (r: CalculationResults) => `${r.tir.toFixed(1)}%`,
    sub: (r: CalculationResults) => `VPN: ${formatCOP(r.vpn, false)}`,
  },
  {
    key: 'co2',
    label: 'CO₂ Evitado/año',
    icon: TreePine,
    getValue: (r: CalculationResults) =>
      `${r.carbon.annual_co2_avoided_tons.toFixed(1)} ton`,
    sub: (r: CalculationResults) =>
      `≈ ${Math.round(r.carbon.trees_saved_per_year)} árboles equivalentes`,
  },
] as const

export function ExecutiveSummary({ results }: ExecutiveSummaryProps) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-[#F9FAFB]">Resumen Ejecutivo</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.key}
              className="rounded-xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-[#BFFF00]/10 p-2">
                  <Icon className="h-5 w-5 text-[#BFFF00]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#9CA3AF]">{m.label}</p>
                  <p className="text-xl font-bold text-[#BFFF00]">
                    {m.getValue(results)}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">{m.sub(results)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
