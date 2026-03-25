'use client'

import Image from 'next/image'
import { User } from 'lucide-react'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-mirac-dark">
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
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
