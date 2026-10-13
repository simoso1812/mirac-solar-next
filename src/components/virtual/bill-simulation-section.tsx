'use client'

import { formatCOP } from '@/lib/formatting'
import type { CalculationResults } from '@/lib/types'

interface BillSimulationProps {
  results: CalculationResults
  costoKwh: number
  consumoMensualKwh: number
}

export function BillSimulationSection({ results, costoKwh, consumoMensualKwh }: BillSimulationProps) {
  const generacionMensual = Math.round(results.generacion_anual_kwh / 12)
  const facturaActual = Math.round(consumoMensualKwh * costoKwh)
  const consumoResidual = Math.max(0, consumoMensualKwh - generacionMensual)
  const facturaConSolar = Math.round(consumoResidual * costoKwh)
  const ahorroMensual = facturaActual - facturaConSolar
  const porcentajeAhorro = facturaActual > 0 ? Math.round((ahorroMensual / facturaActual) * 100) : 0

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-white">
        Simulación de Factura
      </h2>
      <p className="mb-6 text-sm text-[#9AA3A7]">
        Comparación de su factura mensual de energía antes y después de la instalación solar.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Before */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[#9AA3A7]">Factura Actual</p>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-white">
            {formatCOP(facturaActual)}
          </p>
          <p className="mt-2 text-xs text-[#9AA3A7]">
            {consumoMensualKwh.toLocaleString('es-CO')} kWh × ${costoKwh}/kWh
          </p>
        </div>

        {/* After */}
        <div className="rounded-2xl border border-[#C6F500]/40 bg-[#C6F500]/5 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[#C6F500]">Factura con Solar</p>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#C6F500]">
            {formatCOP(facturaConSolar)}
          </p>
          <p className="mt-2 text-xs text-[#9AA3A7]">
            {consumoResidual.toLocaleString('es-CO')} kWh residual × ${costoKwh}/kWh
          </p>
        </div>

        {/* Savings */}
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#161616] p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#9AA3A7]">Ahorro Mensual</p>
            <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-white">
              {formatCOP(ahorroMensual)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#C6F500]/10">
              <div
                className="h-full rounded-full bg-[#C6F500]"
                style={{ width: `${porcentajeAhorro}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums text-[#C6F500]">{porcentajeAhorro}%</span>
          </div>
        </div>
      </div>
    </section>
  )
}
