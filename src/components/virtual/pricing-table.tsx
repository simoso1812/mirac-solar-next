'use client'

import { formatCOPShort } from '@/lib/formatting'
import { ivaBreakdown } from '@/lib/calculator/derived'
import type { CalculationResults } from '@/lib/types'

interface PricingTableProps {
  results: CalculationResults
}

export function PricingTable({ results: r }: PricingTableProps) {
  const { costoSinIVA, valorIVA, omAnual } = ivaBreakdown(r)

  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-[#2A2A2A] pb-4 text-xl font-medium tracking-tight text-white">
        <span className="h-5 w-1 rounded-full bg-[#9CA3AF]" />
        Condiciones Comerciales
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#2A2A2A] bg-[#161616]">
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9AA3A7]">Subtotal (sin IVA)</span>
            <span className="tabular-nums font-medium text-white">{formatCOPShort(costoSinIVA)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#9AA3A7]">IVA</span>
            <span className="tabular-nums font-medium text-white">{formatCOPShort(valorIVA)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-4 mt-2 text-lg font-bold">
            <span className="text-white">Inversión Total</span>
            <span className="tabular-nums text-[#C6F500]">{formatCOPShort(r.costo_total_cop)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2A2A2A] pt-3 text-sm">
            <span className="text-[#9AA3A7]">O&M Anual</span>
            <span className="tabular-nums font-medium text-white">{formatCOPShort(omAnual)}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
