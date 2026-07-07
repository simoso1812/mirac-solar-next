'use client'

import { formatCOPShort } from '@/lib/formatting'

interface PaymentScheduleSectionProps {
  total: number
}

const HITOS = [
  { pct: 0.5, label: 'Anticipo' },
  { pct: 0.45, label: 'Fin de instalación' },
  { pct: 0.05, label: 'Legalización ante el OR' },
]

function Arrow() {
  return (
    <svg
      className="h-4 w-4 shrink-0 -rotate-90 text-[#9CA3AF] sm:rotate-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function PaymentScheduleSection({ total }: PaymentScheduleSectionProps) {
  return (
    <section>
      <h2 className="mb-6 flex items-center gap-3 border-b border-white/10 pb-4 text-xl font-medium tracking-tight text-[#F9FAFB]">
        <span className="h-5 w-1 rounded-full bg-[#9CA3AF]" />
        Esquema de Pagos
      </h2>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        {HITOS.map((hito, i) => (
          <div key={hito.label} className="contents">
            {i > 0 && <Arrow />}
            <div className="w-full flex-1 rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-2xl font-bold text-[#BFFF00]">{Math.round(hito.pct * 100)}%</p>
              <p className="mt-1 text-sm font-medium text-[#F9FAFB]">{hito.label}</p>
              <p className="mt-1 text-xs tabular-nums text-[#9CA3AF]">
                {formatCOPShort(total * hito.pct)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
