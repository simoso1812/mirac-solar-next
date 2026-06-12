'use client'

import { formatCOP } from '@/lib/formatting'
import { ppaMetrics } from '@/lib/calculator/derived'
import type { CalculationResults, PpaOption } from '@/lib/types'

interface PpaSectionProps {
  results: CalculationResults
  costoKwh: number
  opciones: PpaOption[]
}

const GRAY = '#9CA3AF'
const YELLOW = '#FAC107'
const RED = '#FA323F'

function BarColumn({
  label,
  value,
  pct,
  color,
  valueColor,
  badge,
}: {
  label: string
  value: number
  pct: number
  color: string
  valueColor: string
  badge?: string
}) {
  return (
    <div className="flex h-full w-24 flex-col items-center">
      <div className="relative flex h-full w-full flex-col justify-end">
        {/* Value label above the bar */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-sm font-bold tabular-nums"
          style={{ bottom: `calc(${pct}% + 8px)`, color: valueColor }}
        >
          ${value.toLocaleString('es-CO')}
        </div>
        {/* Savings badge near the top of the bar */}
        {badge && (
          <div
            className="absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-[#FA323F] px-2 py-0.5 text-xs font-bold text-white shadow-lg"
            style={{ bottom: `calc(${pct}% - 16px)` }}
          >
            {badge}
          </div>
        )}
        {/* Bar */}
        <div
          className="w-full rounded-t-sm"
          style={{ height: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-2 text-center text-xs text-[#9CA3AF]">{label}</p>
    </div>
  )
}

export function PpaSection({ results, costoKwh, opciones }: PpaSectionProps) {
  const generacionAnual = results.generacion_anual_kwh

  const computed = ppaMetrics(costoKwh, generacionAnual, opciones)

  const maxPrice = Math.max(costoKwh, ...opciones.map((o) => o.precio_kwh), 1)

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#BFFF00]" />
        Opción Cero Inversión (PPA)
      </h2>

      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-[#D1D5DB]">
        Con nuestro PPA Cero Inversión, accedes al sistema solar sin costo inicial. Pagas solo por la energía
        generada a una tarifa fija menor a la de la red (${costoKwh.toLocaleString('es-CO')}/kWh), con O&amp;M
        incluido. Elige el plazo que mejor se ajuste a tu negocio.
      </p>

      {/* Bar chart — utility vs each PPA option */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="mb-6 text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
          Precio de la energía (COP/kWh)
        </p>
        <div className="relative flex h-72 items-end justify-center gap-8 pt-10">
          <BarColumn
            label="Red eléctrica"
            value={costoKwh}
            pct={(costoKwh / maxPrice) * 100}
            color={GRAY}
            valueColor="#F9FAFB"
          />
          {computed.map((opt) => (
            <BarColumn
              key={`${opt.duracion_anios}-${opt.precio_kwh}`}
              label={`PPA ${opt.duracion_anios} años`}
              value={opt.precio_kwh}
              pct={(opt.precio_kwh / maxPrice) * 100}
              color={YELLOW}
              valueColor={RED}
              badge={`-${opt.porcentajeAhorro}%`}
            />
          ))}
          {/* Axis baseline */}
          <div className="absolute bottom-7 left-0 right-0 h-px bg-white/20" />
        </div>
      </div>

      {/* Per-option detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {computed.map((opt) => (
          <div key={`${opt.duracion_anios}-${opt.precio_kwh}`} className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
              <span className="text-lg font-semibold text-[#F9FAFB]">{opt.duracion_anios} años</span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#FAC107]">
                ${opt.precio_kwh.toLocaleString('es-CO')}/kWh
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Ahorro vs red</span>
                <span className="rounded bg-[#FA323F] px-2 py-0.5 text-xs font-bold text-white">
                  -{opt.porcentajeAhorro}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Pago mensual a Mirac</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#F9FAFB]">
                  {formatCOP(opt.pagoMiracMensual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Pago anual a Mirac</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#F9FAFB]">
                  {formatCOP(opt.pagoMiracAnual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9CA3AF]">Ahorro anual</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#BFFF00]">
                  {formatCOP(opt.ahorroAnual)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-xs text-[#9CA3AF]">Ahorro total ({opt.duracion_anios} años)</span>
                <span className="font-mono text-base font-bold tabular-nums text-[#BFFF00]">
                  {formatCOP(opt.ahorroTotal)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-[#6B7280]">O&amp;M incluido durante todo el contrato.</p>
          </div>
        ))}
      </div>
    </section>
  )
}
