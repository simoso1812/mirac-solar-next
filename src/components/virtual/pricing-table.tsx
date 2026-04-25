'use client'

import { formatCOPShort } from '@/lib/formatting'
import { PROMEDIOS_COSTO } from '@/lib/constants'
import type { CalculationResults } from '@/lib/types'

interface PricingTableProps {
  results: CalculationResults
}

export function PricingTable({ results: r }: PricingTableProps) {
  const costoSinIVA = r.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
  const valorIVA = r.costo_total_cop - costoSinIVA
  const omAnual = r.costo_total_cop * 0.02
  const costoBateria = r.bateria?.habilitada ? r.bateria.costo_cop : 0
  const costoFvSinIVA = costoSinIVA - costoBateria / (1 + PROMEDIOS_COSTO.iva_rate)
  const bateriaSinIVA = costoBateria / (1 + PROMEDIOS_COSTO.iva_rate)

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#9CA3AF]" />
        Condiciones Comerciales
      </h2>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">Sistema Fotovoltaico (sin IVA)</span>
            <span className="tabular-nums font-medium text-[#F9FAFB]">{formatCOPShort(costoFvSinIVA)}</span>
          </div>
          {costoBateria > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9CA3AF]">Sistema de Almacenamiento (sin IVA)</span>
              <span className="tabular-nums font-medium text-[#F9FAFB]">{formatCOPShort(bateriaSinIVA)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9CA3AF]">IVA</span>
            <span className="tabular-nums font-medium text-[#F9FAFB]">{formatCOPShort(valorIVA)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-2 text-lg font-bold">
            <span className="text-[#F9FAFB]">Inversión Total</span>
            <span className="tabular-nums text-[#BFFF00]">{formatCOPShort(r.costo_total_cop)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
            <span className="text-[#9CA3AF]">O&M Anual</span>
            <span className="tabular-nums font-medium text-[#F9FAFB]">{formatCOPShort(omAnual)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
