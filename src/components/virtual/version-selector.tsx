'use client'

import { formatKWp, formatCOPMillones } from '@/lib/formatting'
import type { CalculationResults } from '@/lib/types'

interface Version {
  label: string
  results: CalculationResults | null
}

interface VersionSelectorProps {
  versions: Version[]
  activeIndex: number
  onSelect: (index: number) => void
}

export function VersionSelector({ versions, activeIndex, onSelect }: VersionSelectorProps) {
  if (versions.length <= 1) return null

  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {versions.map((v, i) => {
          const isActive = i === activeIndex
          const r = v.results
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`shrink-0 rounded-xl border px-5 py-3 text-left transition-all ${
                isActive
                  ? 'border-[#BFFF00]/50 bg-[#BFFF00]/10'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <p className={`text-sm font-semibold ${isActive ? 'text-[#BFFF00]' : 'text-[#F9FAFB]'}`}>
                {v.label}
              </p>
              {r && (
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  {formatKWp(r.kwp)} · {formatCOPMillones(r.costo_total_cop)}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
