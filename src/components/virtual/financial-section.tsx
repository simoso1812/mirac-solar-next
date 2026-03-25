'use client'

import { formatCOP } from '@/lib/formatting'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import type { CalculationResults } from '@/lib/types'

interface WhatIfOverrides {
  costoKwh: number
  factorSeguridad: number
  indexRate: number
}

interface FinancialSectionProps {
  baseResults: CalculationResults
  whatIfResults: CalculationResults
  overrides: WhatIfOverrides
  onOverridesChange: (overrides: WhatIfOverrides) => void
}

function RangeSlider({
  min, max, step, value, onChange, id,
}: {
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void; id: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="virtual-range w-full h-1 appearance-none rounded-full bg-white/10 outline-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #BFFF00 0%, #BFFF00 ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
      }}
    />
  )
}

export function FinancialSection({
  baseResults,
  whatIfResults,
  overrides,
  onOverridesChange,
}: FinancialSectionProps) {
  const r = whatIfResults

  const cashFlowData = r.flujo_caja
    .filter((row) => row.anio > 0 && row.anio <= 25)
    .map((row) => ({
      anio: row.anio,
      acumulado: Math.round(row.flujo_acumulado_cop),
      flujo: Math.round(row.flujo_neto_cop),
    }))

  const financialMetrics = [
    { label: 'Inversión Total', value: formatCOP(r.costo_total_cop) },
    { label: 'Ahorro Anual', value: formatCOP(r.ahorro_anual_cop) },
    { label: 'Payback', value: `${r.payback_anios.toFixed(1)} años` },
    { label: 'TIR', value: `${r.tir.toFixed(1)}%` },
    { label: 'VPN', value: formatCOP(r.vpn, false) },
    { label: 'ROI', value: `${r.roi_porcentaje.toFixed(0)}%` },
  ]

  return (
    <section>
      <style>{`
        .virtual-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #BFFF00;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(191,255,0,0.2);
        }
        .virtual-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #BFFF00;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(191,255,0,0.2);
        }
      `}</style>
      <h2 className="mb-4 text-xl font-bold text-[#F9FAFB]">Análisis Financiero</h2>
      <div className="grid gap-4 lg:grid-cols-5">
        {/* What-if sliders */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-[#BFFF00]">
            Calculadora What-If
          </h3>
          <p className="mb-5 text-xs text-[#9CA3AF]">
            Ajusta los parámetros para ver cómo cambian los resultados financieros en tiempo real.
          </p>
          <div className="space-y-6">
            {/* Tarifa */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-tarifa" className="text-sm text-[#9CA3AF]">Tarifa energía</label>
                <span className="text-sm font-bold text-[#BFFF00]">
                  ${overrides.costoKwh} COP/kWh
                </span>
              </div>
              <RangeSlider
                id="slider-tarifa"
                min={400}
                max={1500}
                step={50}
                value={overrides.costoKwh}
                onChange={(v) => onOverridesChange({ ...overrides, costoKwh: v })}
              />
              <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]/60">
                <span>$400</span>
                <span>$1,500</span>
              </div>
            </div>

            {/* Factor seguridad */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-factor" className="text-sm text-[#9CA3AF]">Factor de seguridad</label>
                <span className="text-sm font-bold text-[#BFFF00]">
                  {overrides.factorSeguridad.toFixed(2)}
                </span>
              </div>
              <RangeSlider
                id="slider-factor"
                min={0.8}
                max={1.5}
                step={0.05}
                value={overrides.factorSeguridad}
                onChange={(v) => onOverridesChange({ ...overrides, factorSeguridad: v })}
              />
              <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]/60">
                <span>0.80</span>
                <span>1.50</span>
              </div>
            </div>

            {/* Incremento anual */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-index" className="text-sm text-[#9CA3AF]">Incremento anual tarifa</label>
                <span className="text-sm font-bold text-[#BFFF00]">
                  {(overrides.indexRate * 100).toFixed(1)}%
                </span>
              </div>
              <RangeSlider
                id="slider-index"
                min={2}
                max={12}
                step={0.5}
                value={overrides.indexRate * 100}
                onChange={(v) => onOverridesChange({ ...overrides, indexRate: v / 100 })}
              />
              <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]/60">
                <span>2%</span>
                <span>12%</span>
              </div>
            </div>
          </div>

          {/* Financial metrics */}
          <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
            {financialMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-sm text-[#9CA3AF]">{m.label}</span>
                <span className="text-sm font-bold text-[#F9FAFB]">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cash flow chart */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 lg:col-span-3">
          <h3 className="mb-3 text-sm font-medium text-[#9CA3AF]">
            Flujo de Caja Acumulado (25 años)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
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
                  interval={4}
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
                />
                <Area
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#BFFF00"
                  strokeWidth={2}
                  fill="url(#colorAcumulado)"
                  name="Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  )
}
