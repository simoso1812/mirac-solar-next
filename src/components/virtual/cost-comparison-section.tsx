'use client'

import { formatCOP } from '@/lib/formatting'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts'
import type { CalculationResults } from '@/lib/types'

interface CostComparisonProps {
  results: CalculationResults
  costoKwh: number
  consumoMensualKwh: number
  indexRate: number
  horizonteAnios: number
}

export function CostComparisonSection({
  results, costoKwh, consumoMensualKwh, indexRate, horizonteAnios,
}: CostComparisonProps) {
  // Build year-by-year data
  const data: { anio: number; sinSolar: number; conSolar: number }[] = []
  let acumSinSolar = 0
  let acumConSolar = -results.costo_total_cop // initial investment
  const gastoAnualBase = consumoMensualKwh * costoKwh * 12
  const omAnual = results.costo_total_cop * 0.02

  for (let i = 1; i <= horizonteAnios; i++) {
    const gastoAnual = gastoAnualBase * Math.pow(1 + indexRate, i - 1)
    acumSinSolar += gastoAnual

    const ahorroAnual = results.flujo_caja[i - 1]
      ? results.flujo_caja[i - 1].ahorro_cop
      : results.ahorro_anual_cop * Math.pow(1 + indexRate, i - 1)
    acumConSolar += ahorroAnual - omAnual

    data.push({
      anio: i,
      sinSolar: Math.round(-acumSinSolar),
      conSolar: Math.round(acumConSolar),
    })
  }

  const totalSinSolar = data[data.length - 1]?.sinSolar ?? 0
  const totalConSolar = data[data.length - 1]?.conSolar ?? 0

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#F9FAFB]">
        Costo de No Hacer Nada
      </h2>
      <p className="mb-6 text-sm text-[#9CA3AF]">
        Comparación del gasto acumulado en energía a {horizonteAnios} años: sin solar vs con solar.
      </p>

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-red-400">Sin Solar ({horizonteAnios} años)</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-red-400">
            − {formatCOP(Math.abs(totalSinSolar))}
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">Pagados en facturas de energía</p>
        </div>
        <div className="rounded-2xl border border-[#BFFF00]/20 bg-[#BFFF00]/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#BFFF00]">Con Solar ({horizonteAnios} años)</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#BFFF00]">
            {formatCOP(totalConSolar)}
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">Ganancia neta acumulada después de inversión</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorSinSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#BFFF00" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#BFFF00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
              <XAxis
                dataKey="anio"
                fontSize={11}
                tick={{ fill: '#9CA3AF' }}
                axisLine={{ stroke: '#374151' }}
                interval={Math.max(1, Math.floor(horizonteAnios / 6) - 1)}
              />
              <YAxis
                fontSize={11}
                tick={{ fill: '#9CA3AF' }}
                axisLine={{ stroke: '#374151' }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB',
                }}
                formatter={(v) => formatCOP(Number(v), false)}
                labelFormatter={(label) => `Año ${label}`}
              />
              <Legend
                formatter={(value) => (value === 'sinSolar' ? 'Sin Solar' : 'Con Solar')}
                wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}
              />
              <Area
                type="monotone"
                dataKey="sinSolar"
                stroke="#EF4444"
                strokeWidth={2}
                fill="url(#colorSinSolar)"
                name="sinSolar"
              />
              <Area
                type="monotone"
                dataKey="conSolar"
                stroke="#BFFF00"
                strokeWidth={2}
                fill="url(#colorConSolar)"
                name="conSolar"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
}
