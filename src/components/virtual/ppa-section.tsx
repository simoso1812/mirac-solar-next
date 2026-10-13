'use client'

import { formatCOP } from '@/lib/formatting'
import { ppaMetrics } from '@/lib/calculator/derived'
import type { CalculationResults, PpaOption } from '@/lib/types'

interface PpaSectionProps {
  results: CalculationResults
  costoKwh: number
  opciones: PpaOption[]
}

const GRAY = '#9AA3A7'
const YELLOW = '#C6F500'
const RED = '#C6F500'

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
            className="absolute left-1/2 z-10 -translate-x-1/2 rounded-md bg-[#C6F500] px-2 py-0.5 text-xs font-bold text-[#0D0D0D] shadow-lg"
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
      <p className="mt-2 text-center text-xs text-[#9AA3A7]">{label}</p>
    </div>
  )
}

export function PpaSection({ results, costoKwh, opciones }: PpaSectionProps) {
  const generacionAnual = results.generacion_anual_kwh

  const computed = ppaMetrics(costoKwh, generacionAnual, opciones)

  const maxPrice = Math.max(costoKwh, ...opciones.map((o) => o.precio_kwh), 1)

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-[#2A2A2A] pb-4 text-xl font-medium tracking-tight text-white">
        <span className="h-5 w-1 rounded-full bg-[#C6F500]" />
        Opción Cero Inversión (PPA)
      </h2>

      <p className="mb-8 max-w-3xl text-sm leading-relaxed text-[#C6CFD2]">
        Con nuestro PPA Cero Inversión, accedes al sistema solar sin costo inicial. Pagas solo por la energía
        generada a una tarifa fija menor a la de la red (${costoKwh.toLocaleString('es-CO')}/kWh), con O&amp;M
        incluido. Elige el plazo que mejor se ajuste a tu negocio.
      </p>
      <p className="mb-8 max-w-3xl text-xs leading-relaxed text-[#9AA3A7]">
        Ilustración comercial. La tarifa evitada de esta tarjeta crece al 4,25% anual (Índice Mirac) y el precio del PPA queda fijo. No incluye ICA, beneficios de la Ley 1715 ni servicio de deuda, y no es el modelo de evaluación de ACP.
      </p>

      {/* Bar chart — utility vs each PPA option */}
      <div className="mb-6 rounded-2xl border border-[#2A2A2A] bg-[#161616] p-6">
        <p className="mb-6 text-xs font-medium uppercase tracking-wider text-[#9AA3A7]">
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
          <div className="absolute bottom-7 left-0 right-0 h-px bg-[#2A2A2A]" />
        </div>
      </div>

      {/* Per-option detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {computed.map((opt) => (
          <div key={`${opt.duracion_anios}-${opt.precio_kwh}`} className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-6">
            <div className="flex items-baseline justify-between border-b border-[#2A2A2A] pb-3">
              <span className="text-lg font-semibold text-white">{opt.duracion_anios} años</span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#FF9E1B]">
                ${opt.precio_kwh.toLocaleString('es-CO')}/kWh
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA3A7]">Ahorro vs red</span>
                <span className="rounded bg-[#C6F500] px-2 py-0.5 text-xs font-bold text-[#0D0D0D]">
                  -{opt.porcentajeAhorro}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA3A7]">Pago mensual a Mirac</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-white">
                  {formatCOP(opt.pagoMiracMensual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA3A7]">Pago anual a Mirac</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-white">
                  {formatCOP(opt.pagoMiracAnual)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA3A7]">Ahorro anual</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-[#C6F500]">
                  {formatCOP(opt.ahorroAnual)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-3">
                <span className="text-xs text-[#9AA3A7]">Ahorro total ({opt.duracion_anios} años)</span>
                <span className="font-mono text-base font-bold tabular-nums text-[#C6F500]">
                  {formatCOP(opt.ahorroTotal)}
                </span>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-[#9AA3A7]">O&amp;M incluido durante todo el contrato.</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-[#9AA3A7]">
        Ahorro total proyectado con la tarifa de energía indexada al Índice Mirac (4.25% anual);
        el precio del PPA permanece fijo durante todo el contrato.
      </p>
    </section>
  )
}
