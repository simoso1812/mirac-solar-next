'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Plus, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-white/5 bg-mirac-dark">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/assets/LogoBlanco.png"
            alt="Mirac Energy"
            width={120}
            height={36}
            priority
            className="h-8 w-auto"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Notificaciones" className="relative flex size-9 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <Bell className="size-[18px]" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-mirac-red ring-2 ring-mirac-dark" />
          </button>
          <Link href="/cotizacion">
            <Button size="sm" className="bg-mirac-red hover:bg-mirac-red-dark text-white shadow-[0_4px_12px_rgba(250,50,63,0.25)] hover:shadow-[0_6px_16px_rgba(250,50,63,0.35)] transition-all hover:-translate-y-0.5">
              <Plus className="mr-1.5 size-4" />
              Nueva Cotización
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
