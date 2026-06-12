'use client'

import { formatCOP } from '@/lib/formatting'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import type { AdvancedData, CalculationResults } from '@/lib/types'

interface WhatIfOverrides {
  costoKwh: number
  incluirDeduccionRenta: boolean
  incluirDepreciacionAcelerada: boolean
  horizonteAnios: number
}

interface FinancialSectionProps {
  whatIfResults: CalculationResults
  overrides: WhatIfOverrides
  onOverridesChange: (overrides: WhatIfOverrides) => void
  financiamiento: AdvancedData['financiamiento']
}

function RangeSlider({
  min, max, step, value, onChange, id, label,
}: {
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void; id: string; label: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      id={id}
      aria-label={label}
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

function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06] w-full"
    >
      <div
        className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#BFFF00]' : 'bg-white/20'
        }`}
      >
        <div
          className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-[#F9FAFB]' : 'text-[#9CA3AF]'}`}>
          {label}
        </p>
        <p className="text-xs text-[#9CA3AF]/70 mt-0.5">{description}</p>
      </div>
    </button>
  )
}

export function FinancialSection({
  whatIfResults,
  overrides,
  onOverridesChange,
  financiamiento,
}: FinancialSectionProps) {
  const r = whatIfResults

  // Every financing figure comes straight from the engine's results block
  // (single source of truth shared with the PDF and the MCP summary).
  const fin = financiamiento?.habilitado ? r.financiamiento ?? null : null
  const debtEnabled = fin !== null
  const anticipoPct = fin ? Math.round(100 - fin.porcentaje_financiado) : 0
  const plazoAnios = fin ? Math.round(fin.num_pagos / 12) : 0
  const debtMetrics = fin
    ? [
        { label: '% CAPEX Financiado', value: `${Math.round(fin.porcentaje_financiado)}%` },
        { label: 'Tasa EA', value: `${(fin.tasa_ea * 100).toFixed(2)}%` },
        { label: 'Tasa Mensual Equiv.', value: `${(fin.tasa_mensual * 100).toFixed(4)}%` },
        { label: 'Plazo', value: `${fin.num_pagos} meses (${plazoAnios} años)` },
        { label: `Anticipo (${anticipoPct}%)`, value: formatCOP(fin.desembolso_inicial_cop) },
        { label: 'Monto Financiado', value: formatCOP(fin.monto_financiado_cop) },
        { label: 'Cuota Mensual', value: formatCOP(fin.cuota_mensual_cop) },
        { label: 'Total Cuotas', value: formatCOP(fin.total_pagado_cop) },
        { label: 'Total Intereses', value: formatCOP(fin.total_intereses_cop) },
      ]
    : []

  const cashFlowData = r.flujo_caja.flatMap((row) =>
    row.anio > 0 && row.anio <= overrides.horizonteAnios
      ? [{
          anio: row.anio,
          acumulado: Math.round(row.flujo_acumulado_cop),
          flujo: Math.round(row.flujo_neto_cop),
        }]
      : []
  )

  const financialMetrics = [
    { label: 'Inversión Total', value: formatCOP(r.costo_total_cop) },
    { label: 'Ahorro Anual', value: formatCOP(r.ahorro_anual_cop) },
    { label: 'Payback', value: `${r.payback_anios.toFixed(1)} años` },
    { label: 'TIR', value: `${r.tir.toFixed(1)}%`, highlight: true },
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
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#F9FAFB]">
        Simulador Financiero
      </h2>
      <p className="mb-6 text-sm text-[#9CA3AF]">
        Ajuste las variables para proyectar el impacto financiero.
      </p>
      <div className="grid gap-4 lg:grid-cols-5 rounded-3xl border border-white/10 bg-white/[0.02] p-2 lg:p-6">
        {/* What-if controls */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-[#BFFF00]">
            Calculadora What-If
          </h3>
          <div className="space-y-5">
            {/* Tarifa */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-tarifa" className="text-sm text-[#9CA3AF]">Tarifa energía</label>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold tabular-nums text-[#BFFF00]">
                  ${overrides.costoKwh} COP/kWh
                </span>
              </div>
              <RangeSlider
                id="slider-tarifa"
                label="Tarifa energía"
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

            {/* Horizonte */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-horizonte" className="text-sm text-[#9CA3AF]">Horizonte de evaluación</label>
                <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold tabular-nums text-[#F9FAFB]">
                  {overrides.horizonteAnios} años
                </span>
              </div>
              <RangeSlider
                id="slider-horizonte"
                label="Horizonte de evaluación"
                min={10}
                max={40}
                step={5}
                value={overrides.horizonteAnios}
                onChange={(v) => onOverridesChange({ ...overrides, horizonteAnios: v })}
              />
              <div className="mt-1 flex justify-between text-[10px] text-[#9CA3AF]/60">
                <span>10 años</span>
                <span>40 años</span>
              </div>
            </div>

            {/* Beneficios Tributarios */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Beneficios Tributarios
              </h4>
              <div className="space-y-2">
                <Toggle
                  checked={overrides.incluirDeduccionRenta}
                  onChange={(v) => onOverridesChange({ ...overrides, incluirDeduccionRenta: v })}
                  label="Deducción de Renta"
                  description="17.5% del CAPEX deducible en año 1 (Ley 1715, Art. 11)"
                />
                <Toggle
                  checked={overrides.incluirDepreciacionAcelerada}
                  onChange={(v) => onOverridesChange({ ...overrides, incluirDepreciacionAcelerada: v })}
                  label="Depreciación Acelerada"
                  description="Deprecia en 3 años (Ley 1715, Art. 14) en vez de 10 años lineal; beneficio = gasto × 35% renta"
                />
              </div>
            </div>
          </div>

          {/* Financial metrics */}
          <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
            {financialMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-sm text-[#9CA3AF]">{m.label}</span>
                <span className={`text-sm font-bold tabular-nums ${m.highlight ? 'text-[#BFFF00]' : 'text-[#F9FAFB]'}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cash flow chart */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 lg:col-span-3">
          <h3 className="mb-3 text-sm font-medium text-[#9CA3AF]">
            Flujo de Caja Acumulado ({overrides.horizonteAnios} años)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                  interval={Math.max(1, Math.floor(overrides.horizonteAnios / 6) - 1)}
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

          {debtEnabled && (
            <div className="mt-5 rounded-2xl border border-[#BFFF00]/20 bg-[#BFFF00]/[0.04] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-[#BFFF00]">
                    <span className="h-4 w-1 rounded-full bg-[#BFFF00]" />
                    Financiamiento (Deuda Tradicional)
                  </h3>
                  <p className="mt-1 pl-3 text-[11px] text-[#9CA3AF]">
                    Amortización por método francés: cuota mensual fija.
                  </p>
                </div>
                <span className="rounded-full border border-[#BFFF00]/30 bg-[#BFFF00]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#BFFF00]">
                  Método Francés
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
                {debtMetrics.map((m) => (
                  <div key={m.label} className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wider text-[#9CA3AF]">
                      {m.label}
                    </span>
                    <span className="mt-0.5 text-sm font-bold tabular-nums text-[#F9FAFB]">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
