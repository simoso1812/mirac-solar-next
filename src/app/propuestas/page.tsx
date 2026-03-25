'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useProposalsStore } from '@/stores/proposals-store'
import { useHydrated } from '@/hooks/use-hydration'
import { formatCOP, formatKWp } from '@/lib/formatting'
import { CIUDADES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  FolderOpen, Plus, Search, ArrowUpDown, LayoutGrid, List,
} from 'lucide-react'
import type { QuotationData } from '@/lib/types'

type SortKey = 'date' | 'client' | 'kwp' | 'cost'
type ViewMode = 'table' | 'cards'

export default function PropuestasPage() {
  const hydrated = useHydrated()
  const storeProposals = useProposalsStore((s) => s.proposals)
  const proposals = hydrated ? storeProposals : []
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [view, setView] = useState<ViewMode>('table')

  const filtered = useMemo(() => {
    let result = [...proposals]

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.client.nombre.toLowerCase().includes(q) ||
          p.project.ciudad.toLowerCase().includes(q) ||
          p.client.email.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'date':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
        case 'client':
          cmp = a.client.nombre.localeCompare(b.client.nombre)
          break
        case 'kwp':
          cmp = (a.results?.kwp ?? 0) - (b.results?.kwp ?? 0)
          break
        case 'cost':
          cmp = (a.results?.costo_total_cop ?? 0) - (b.results?.costo_total_cop ?? 0)
          break
      }
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [proposals, search, statusFilter, sortBy, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Propuestas</h1>
        <Link href="/cotizacion">
          <Button className="bg-mirac-red hover:bg-mirac-red-dark">
            <Plus className="mr-2 h-4 w-4" />
            Nueva
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, ciudad..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="sent">Enviada</option>
          <option value="accepted">Aceptada</option>
          <option value="rejected">Rechazada</option>
        </select>
        <div className="flex rounded-md border">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="icon"
            className="h-10 w-10 rounded-r-none"
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'cards' ? 'default' : 'ghost'}
            size="icon"
            className="h-10 w-10 rounded-l-none"
            onClick={() => setView('cards')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">
              {proposals.length === 0
                ? 'No hay propuestas aún. Crea tu primera cotización.'
                : 'No se encontraron propuestas con estos filtros.'}
            </p>
          </CardContent>
        </Card>
      ) : view === 'table' ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('client')}>
                  Cliente <ArrowUpDown className="inline h-3 w-3" />
                </TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('kwp')}>
                  kWp <ArrowUpDown className="inline h-3 w-3" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('cost')}>
                  Inversión <ArrowUpDown className="inline h-3 w-3" />
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                  Fecha <ArrowUpDown className="inline h-3 w-3" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => window.location.href = `/propuestas/${p.id}`}>
                  <TableCell className="font-medium">{p.client.nombre}</TableCell>
                  <TableCell>{CIUDADES.find((c) => c.value === p.project.ciudad)?.label ?? p.project.ciudad}</TableCell>
                  <TableCell>{formatKWp(p.results?.kwp ?? 0)}</TableCell>
                  <TableCell>{formatCOP(p.results?.costo_total_cop ?? 0)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString('es-CO')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link key={p.id} href={`/propuestas/${p.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{p.client.nombre}</CardTitle>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CIUDADES.find((c) => c.value === p.project.ciudad)?.label} — {new Date(p.created_at).toLocaleDateString('es-CO')}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Potencia</p>
                      <p className="font-semibold">{formatKWp(p.results?.kwp ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Inversión</p>
                      <p className="font-semibold">{formatCOP(p.results?.costo_total_cop ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">TIR</p>
                      <p className="font-semibold">{(p.results?.tir ?? 0).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payback</p>
                      <p className="font-semibold">{(p.results?.payback_anios ?? 0).toFixed(1)} años</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: QuotationData['status'] }) {
  const map = {
    draft: { label: 'Borrador', variant: 'secondary' as const },
    sent: { label: 'Enviada', variant: 'default' as const },
    accepted: { label: 'Aceptada', variant: 'default' as const },
    rejected: { label: 'Rechazada', variant: 'destructive' as const },
  }
  const s = map[status] ?? map.draft
  return <Badge variant={s.variant}>{s.label}</Badge>
}
