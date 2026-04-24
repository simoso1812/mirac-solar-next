'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'
import type { QuotationData } from '@/lib/types'
import { CIUDADES } from '@/lib/constants'

interface VirtualHeaderProps {
  proposal: QuotationData
}

export function VirtualHeader({ proposal }: VirtualHeaderProps) {
  const ciudadLabel =
    CIUDADES.find((c) => c.value === proposal.project.ciudad)?.label ??
    proposal.project.ciudad

  return (
    <header className="border-b border-white/10 bg-[#0d1117]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Image
          src="/assets/LogoBlanco.png"
          alt="Mirac Energy"
          width={240}
          height={80}
          className="h-16 w-auto"
        />
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#F9FAFB]">
            {proposal.client.nombre}
          </h1>
          <div className="flex items-center justify-end gap-2 text-sm text-[#9CA3AF]">
            <Badge className="bg-white/10 text-[#9CA3AF] border-white/10 hover:bg-white/15">
              <MapPin className="mr-1 h-3 w-3" />
              {ciudadLabel}
            </Badge>
            <span>
              {new Date(proposal.created_at).toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
