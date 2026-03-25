'use client'

import { usePathname } from 'next/navigation'
import { Header } from './header'
import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandalone = pathname.endsWith('/virtual') || pathname.startsWith('/propuestas/shared')

  if (isStandalone) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Sidebar />
      <main className="pt-16 pb-16 md:pb-0 md:pl-[280px]">
        <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
