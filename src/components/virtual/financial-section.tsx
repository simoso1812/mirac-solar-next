'use client'

import { formatCOP } from '@/lib/formatting'
import { paybackSimpleAnios, textoBeneficios } from '@/lib/proposal-disclosure'
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
      className="virtual-range w-full h-1 appearance-none rounded-full bg-[#C6F500]/10 outline-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #C6F500 0%, #C6F500 ${pct}%, #E2E2E2 ${pct}%, #E2E2E2 100%)`,
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
      className="flex items-start gap-3 rounded-xl border border-[#2A2A2A] bg-[#161616] p-3 text-left transition-colors hover:bg-[#1E1E1E] w-full"
    >
      <div
        className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#C6F500]' : 'bg-[#2A2A2A]'
        }`}
      >
        <div
          className={`h-3.5 w-3.5 rounded-full bg-[#161616] shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${checked ? 'text-white' : 'text-[#9AA3A7]'}`}>
          {label}
        </p>
        <p className="text-xs text-[#9AA3A7]/70 mt-0.5">{description}</p>
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

  const notaBeneficios = textoBeneficios(overrides.incluirDeduccionRenta, overrides.incluirDepreciacionAcelerada)

  const financialMetrics = [
    { label: 'Inversión Total', value: formatCOP(r.costo_total_cop) },
    { label: 'Ahorro Anual', value: formatCOP(r.ahorro_anual_cop) },
    { label: 'Payback', value: `${r.payback_anios.toFixed(1)} años` },
    {
      label: 'Payback simple',
      value: (() => {
        const simple = paybackSimpleAnios(r.costo_total_cop, r.ahorro_anual_cop)
        return simple === null ? 'n/d' : `${simple.toFixed(1)} años`
      })(),
    },
    { label: 'TIR', value: `${r.tir.toFixed(1)}%`, highlight: true },
    { label: 'VPN', value: formatCOP(r.vpn, false) },
    // With credit, roi_porcentaje is levered (equity) — label both ROIs so the
    // client sees the project return and the return on their down payment.
    ...(r.financiamiento
      ? [
          { label: 'ROI Proyecto', value: `${(r.roi_proyecto_porcentaje ?? r.roi_porcentaje).toFixed(0)}%` },
          { label: 'ROI Inversionista', value: `${r.roi_porcentaje.toFixed(0)}%` },
        ]
      : [{ label: 'ROI', value: `${r.roi_porcentaje.toFixed(0)}%` }]),
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
          border: 1px solid #C6F500;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(104,168,40,0.2);
        }
        .virtual-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #C6F500;
          cursor: pointer;
          box-shadow: 0 0 0 3px rgba(104,168,40,0.2);
        }
      `}</style>
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-white">
        Simulador Financiero
      </h2>
      <p className="mb-6 text-sm text-[#9AA3A7]">
        Ajuste las variables para proyectar el impacto financiero.
      </p>
      <div className="grid gap-4 lg:grid-cols-5 rounded-3xl border border-[#2A2A2A] bg-[#161616] p-2 lg:p-6">
        {/* What-if controls */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5 lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-[#C6F500]">
            Calculadora What-If
          </h3>
          <div className="space-y-5">
            {/* Tarifa */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-tarifa" className="text-sm text-[#9AA3A7]">Tarifa energía</label>
                <span className="rounded-md border border-[#2A2A2A] bg-[#161616] px-3 py-1 text-sm font-bold tabular-nums text-[#C6F500]">
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
              <div className="mt-1 flex justify-between text-[10px] text-[#9AA3A7]/60">
                <span>$400</span>
                <span>$1,500</span>
              </div>
            </div>

            {/* Horizonte */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="slider-horizonte" className="text-sm text-[#9AA3A7]">Horizonte de evaluación</label>
                <span className="rounded-md border border-[#2A2A2A] bg-[#161616] px-3 py-1 text-sm font-bold tabular-nums text-white">
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
              <div className="mt-1 flex justify-between text-[10px] text-[#9AA3A7]/60">
                <span>10 años</span>
                <span>40 años</span>
              </div>
            </div>

            {/* Beneficios Tributarios */}
            <div className="border-t border-[#2A2A2A] pt-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#9AA3A7]">
                Beneficios Tributarios
              </h4>
              <div className="space-y-2">
                <Toggle
                  checked={overrides.incluirDeduccionRenta}
                  onChange={(v) => onOverridesChange({ ...overrides, incluirDeduccionRenta: v })}
                  label="Deducción de Renta"
                  description="50% del valor sin IVA deducible de renta (Ley 1715, Art. 11); beneficio = 17.5%"
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
          <div className="mt-6 space-y-2 border-t border-[#2A2A2A] pt-4">
            {financialMetrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-sm text-[#9AA3A7]">{m.label}</span>
                <span className={`text-sm font-bold tabular-nums ${m.highlight ? 'text-[#C6F500]' : 'text-white'}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
          {notaBeneficios && (
            <p className="mt-3 text-xs text-[#9AA3A7]">{notaBeneficios}</p>
          )}
        </div>

        {/* Cash flow chart */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-5 lg:col-span-3">
          <h3 className="mb-3 text-sm font-medium text-[#9AA3A7]">
            Flujo de Caja Acumulado ({overrides.horizonteAnios} años)
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
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
                  interval={Math.max(1, Math.floor(overrides.horizonteAnios / 6) - 1)}
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
                />
                <Area
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#C6F500"
                  strokeWidth={2}
                  fill="url(#colorAcumulado)"
                  name="Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {debtEnabled && (
            <div className="mt-5 rounded-2xl border border-[#C6F500]/40 bg-[#C6F500]/[0.04] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium text-[#C6F500]">
                    <span className="h-4 w-1 rounded-full bg-[#C6F500]" />
                    Financiamiento (Deuda Tradicional)
                  </h3>
                  <p className="mt-1 pl-3 text-[11px] text-[#9AA3A7]">
                    Amortización por método francés: cuota mensual fija.
                  </p>
                </div>
                <span className="rounded-full border border-[#C6F500]/40 bg-[#C6F500]/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#C6F500]">
                  Método Francés
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
                {debtMetrics.map((m) => (
                  <div key={m.label} className="flex flex-col">
                    <span className="text-[11px] uppercase tracking-wider text-[#9AA3A7]">
                      {m.label}
                    </span>
                    <span className="mt-0.5 text-sm font-bold tabular-nums text-white">
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
