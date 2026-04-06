'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const sections = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/cotizacion', label: 'Nueva Cotización', icon: FileText },
      { href: '/propuestas', label: 'Propuestas', icon: FolderOpen },
      { href: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Ingeniería',
    items: [
      { href: '/cargadores', label: 'Cargadores EV', icon: Zap },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-16 hidden h-[calc(100vh-4rem)] w-[280px] border-r border-border/50 bg-card md:block">
      <nav className="flex flex-col gap-1 p-4">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-2 pt-5 first:pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                {section.label}
              </span>
            </div>
            {section.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'border-l-2 border-mirac-red bg-mirac-red/8 text-mirac-red'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors',
                    isActive ? 'text-mirac-red' : 'text-muted-foreground/70 group-hover:text-foreground'
                  )} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
