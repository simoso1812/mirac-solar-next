'use client'

import { MESES } from '@/lib/constants'
import { formatKWh, formatKWp, formatPercent } from '@/lib/formatting'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts'
import type { CalculationResults, TechnicalData } from '@/lib/types'

interface SystemDesignSectionProps {
  results: CalculationResults
  technical: TechnicalData
}

export function SystemDesignSection({ results, technical }: SystemDesignSectionProps) {
  const chartData = results.generacion_mensual_kwh.map((kwh, i) => ({
    mes: MESES[i].substring(0, 3),
    generacion: Math.round(kwh),
    consumo: technical.consumo_mensual_kwh,
  }))

  const panelLabel = [results.marca_panel, results.modelo_panel].filter(Boolean).join(' ').trim()
  const specs = [
    { label: 'Potencia Total', value: formatKWp(results.kwp) },
    {
      label: 'Paneles',
      value: panelLabel
        ? `${results.numero_paneles} × ${panelLabel} (${results.potencia_panel_w}W)`
        : `${results.numero_paneles} × ${results.potencia_panel_w}W`,
    },
    { label: 'Generación Anual', value: formatKWh(Math.round(results.generacion_anual_kwh)) },
    { label: 'Performance Ratio', value: formatPercent(results.performance_ratio) },
    {
      label: 'Inversores',
      value: results.inversores
        .map((inv) => `${inv.cantidad}× ${inv.marca} ${inv.modelo}`)
        .join(', '),
    },
    { label: 'Tipo de Cubierta', value: technical.tipo_cubierta.charAt(0).toUpperCase() + technical.tipo_cubierta.slice(1) },
  ]

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-[#F9FAFB]">Diseño del Sistema</h2>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Chart */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 lg:col-span-3">
          <h3 className="mb-3 text-sm font-medium text-[#9CA3AF]">
            Generación Mensual vs Consumo
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis dataKey="mes" fontSize={11} tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#374151' }} />
                <YAxis fontSize={11} tick={{ fill: '#9CA3AF' }} axisLine={{ stroke: '#374151' }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.5rem',
                    color: '#F9FAFB',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
                <Bar dataKey="generacion" fill="#BFFF00" name="Generación (kWh)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="consumo" fill="#FA323F" name="Consumo (kWh)" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tech specs */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-[#9CA3AF]">
            Especificaciones Técnicas
          </h3>
          <div className="space-y-3">
            {specs.map((s) => (
              <div key={s.label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <span className="text-sm text-[#9CA3AF]">{s.label}</span>
                <span className="text-sm font-medium text-[#F9FAFB]">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
