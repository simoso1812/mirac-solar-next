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
  // Build year-by-year data. The con-solar line reads the engine's own
  // accumulated cash flow (flujo_caja row i = year i; row 0 is the year-0
  // investment) — no parallel savings math here, so the chart's break-even
  // always matches payback_anios.
  const data: { anio: number; sinSolar: number; conSolar: number }[] = []
  let acumSinSolar = 0
  const gastoAnualBase = consumoMensualKwh * costoKwh * 12

  const rows = results.flujo_caja
  let acumConSolar = rows[0]?.flujo_acumulado_cop ?? 0
  const ultimoFlujoNeto = rows[rows.length - 1]?.flujo_neto_cop ?? 0

  for (let i = 1; i <= horizonteAnios; i++) {
    const gastoAnual = gastoAnualBase * Math.pow(1 + indexRate, i - 1)
    acumSinSolar += gastoAnual

    // Beyond the engine's horizon (shouldn't normally happen — both come from
    // horizonte_anios), extrapolate with the last known net flow.
    acumConSolar = rows[i]?.flujo_acumulado_cop ?? acumConSolar + ultimoFlujoNeto

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
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-white">
        Costo de No Hacer Nada
      </h2>
      <p className="mb-6 text-sm text-[#9AA3A7]">
        Comparación del gasto acumulado en energía a {horizonteAnios} años: sin solar vs con solar.
      </p>

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#FB2150]">Sin Solar ({horizonteAnios} años)</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#FB2150]">
            − {formatCOP(Math.abs(totalSinSolar))}
          </p>
          <p className="mt-1 text-xs text-[#9AA3A7]">Pagados en facturas de energía</p>
        </div>
        <div className="rounded-2xl border border-[#C6F500]/40 bg-[#C6F500]/5 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#C6F500]">Con Solar ({horizonteAnios} años)</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#C6F500]">
            {formatCOP(totalConSolar)}
          </p>
          <p className="mt-1 text-xs text-[#9AA3A7]">Ganancia neta acumulada después de inversión</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorSinSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FB2150" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#FB2150" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C6F500" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C6F500" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2A2A2A" strokeDasharray="3 3" />
              <XAxis
                dataKey="anio"
                fontSize={11}
                tick={{ fill: '#9AA3A7' }}
                axisLine={{ stroke: '#2A2A2A' }}
                interval={Math.max(1, Math.floor(horizonteAnios / 6) - 1)}
              />
              <YAxis
                fontSize={11}
                tick={{ fill: '#9AA3A7' }}
                axisLine={{ stroke: '#2A2A2A' }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#161616',
                  border: "1px solid #E2E2E2",
                  borderRadius: '0.5rem',
                  color: '#FFFFFF',
                }}
                formatter={(v) => formatCOP(Number(v), false)}
                labelFormatter={(label) => `Año ${label}`}
              />
              <Legend
                formatter={(value) => (value === 'sinSolar' ? 'Sin Solar' : 'Con Solar')}
                wrapperStyle={{ fontSize: 12, color: '#9AA3A7' }}
              />
              <Area
                type="monotone"
                dataKey="sinSolar"
                stroke="#FB2150"
                strokeWidth={2}
                fill="url(#colorSinSolar)"
                name="sinSolar"
              />
              <Area
                type="monotone"
                dataKey="conSolar"
                stroke="#C6F500"
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
