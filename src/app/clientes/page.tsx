'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useProposalsStore } from '@/stores/proposals-store'
import { useHydrated } from '@/hooks/use-hydration'
import { formatKWp } from '@/lib/formatting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users, Search, Mail, Phone, FileText } from 'lucide-react'

export default function ClientesPage() {
  const hydrated = useHydrated()
  const storeProposals = useProposalsStore((s) => s.proposals)
  const proposals = hydrated ? storeProposals : []
  const [search, setSearch] = useState('')

  // Build unique clients with stats
  const clients = useMemo(() => {
    const map = new Map<
      string,
      {
        client: typeof proposals[0]['client']
        proposalCount: number
        totalKwp: number
        lastDate: string
      }
    >()

    for (const p of proposals) {
      const key = p.client.nit_cc || p.client.nombre.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.proposalCount++
        existing.totalKwp += p.results?.kwp ?? 0
        if (p.created_at > existing.lastDate) existing.lastDate = p.created_at
      } else {
        map.set(key, {
          client: p.client,
          proposalCount: 1,
          totalKwp: p.results?.kwp ?? 0,
          lastDate: p.created_at,
        })
      }
    }

    let result = Array.from(map.values())

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.client.nombre.toLowerCase().includes(q) ||
          c.client.email.toLowerCase().includes(q) ||
          c.client.nit_cc.includes(q)
      )
    }

    return result.sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [proposals, search])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Clientes</h1>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o NIT..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              {proposals.length === 0
                ? 'No hay clientes aún. Los clientes se crean al generar cotizaciones.'
                : 'No se encontraron clientes con esta búsqueda.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const encodedId = encodeURIComponent(c.client.nit_cc || c.client.nombre)
            return (
              <Link key={encodedId} href={`/clientes/${encodedId}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{c.client.nombre}</CardTitle>
                      <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" />
                        {c.proposalCount}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {c.client.email && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> {c.client.email}
                      </p>
                    )}
                    {c.client.telefono && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> {c.client.telefono}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                      <span>Total: {formatKWp(c.totalKwp)}</span>
                      <span>{new Date(c.lastDate).toLocaleDateString('es-CO')}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
