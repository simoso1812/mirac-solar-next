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
      <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#F9FAFB]">
        Simulación de Factura
      </h2>
      <p className="mb-6 text-sm text-[#9CA3AF]">
        Comparación de su factura mensual de energía antes y después de la instalación solar.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Before */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">Factura Actual</p>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#F9FAFB]">
            {formatCOP(facturaActual)}
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            {consumoMensualKwh.toLocaleString('es-CO')} kWh × ${costoKwh}/kWh
          </p>
        </div>

        {/* After */}
        <div className="rounded-2xl border border-[#BFFF00]/20 bg-[#BFFF00]/5 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[#BFFF00]">Factura con Solar</p>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#BFFF00]">
            {formatCOP(facturaConSolar)}
          </p>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            {consumoResidual.toLocaleString('es-CO')} kWh residual × ${costoKwh}/kWh
          </p>
        </div>

        {/* Savings */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">Ahorro Mensual</p>
            <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-[#F9FAFB]">
              {formatCOP(ahorroMensual)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#BFFF00]"
                style={{ width: `${porcentajeAhorro}%` }}
              />
            </div>
            <span className="text-sm font-bold tabular-nums text-[#BFFF00]">{porcentajeAhorro}%</span>
          </div>
        </div>
      </div>
    </section>
  )
}
