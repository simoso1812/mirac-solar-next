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
              key={v.label}
              type="button"
              onClick={() => onSelect(i)}
              className={`shrink-0 rounded-xl border px-5 py-3 text-left transition-all ${
                isActive
                  ? 'border-[#C6F500]/40 bg-[#C6F500]/10'
                  : 'border-[#2A2A2A] bg-[#161616] hover:bg-[#1E1E1E]'
              }`}
            >
              <p className={`text-sm font-semibold ${isActive ? 'text-[#C6F500]' : 'text-white'}`}>
                {v.label}
              </p>
              {r && (
                <p className="mt-1 text-xs text-[#9AA3A7]">
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
