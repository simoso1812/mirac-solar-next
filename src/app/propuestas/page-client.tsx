'use client'

import { useState, useMemo, useRef, type ChangeEvent } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useProposalsStore } from '@/stores/proposals-store'
import { useHydrated } from '@/hooks/use-hydration'
import { formatCOP, formatKWp } from '@/lib/formatting'
import { CIUDADES } from '@/lib/constants'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  FolderOpen, Plus, Search, ArrowUpDown, LayoutGrid, List,
  ChevronLeft, ChevronRight, MapPin, Download, Upload,
} from 'lucide-react'
import type { QuotationData } from '@/lib/types'

type SortKey = 'date' | 'client' | 'kwp' | 'cost'
type ViewMode = 'table' | 'cards'

interface ClientGroup {
  clientName: string
  proposals: QuotationData[]
}

function groupByClient(proposals: QuotationData[]): ClientGroup[] {
  const map = new Map<string, QuotationData[]>()
  for (const p of proposals) {
    const key = p.client.nombre.toLowerCase()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }
  return Array.from(map.entries()).map(([, props]) => ({
    clientName: props[0].client.nombre,
    proposals: props,
  }))
}

function isImportableProposal(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false
  const p = item as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.client === 'object' &&
    p.client !== null &&
    !Array.isArray(p.client)
  )
}

function extractProposalList(parsed: unknown): QuotationData[] | null {
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { proposals?: unknown }).proposals)
      ? (parsed as { proposals: unknown[] }).proposals
      : null
  if (!list || !list.every(isImportableProposal)) return null
  return list as QuotationData[]
}

const statusConfig = {
  draft: { label: 'Borrador', color: 'bg-gray-400', badgeClass: 'bg-muted/50 text-muted-foreground border-muted' },
  sent: { label: 'Enviada', color: 'bg-blue-500', badgeClass: 'bg-blue-50 text-blue-600 border-blue-200' },
  accepted: { label: 'Aceptada', color: 'bg-emerald-500', badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  rejected: { label: 'Rechazada', color: 'bg-mirac-red', badgeClass: 'bg-red-50 text-red-600 border-red-200' },
}

export default function PropuestasPage() {
  const hydrated = useHydrated()
  const storeProposals = useProposalsStore((s) => s.proposals)
  const importProposals = useProposalsStore((s) => s.importProposals)
  const proposals = useMemo(() => hydrated ? storeProposals : [], [hydrated, storeProposals])
  const importInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortKey>('date')
  const [sortAsc, setSortAsc] = useState(false)
  const [view, setView] = useState<ViewMode>('cards')
  const [activeVersions, setActiveVersions] = useState<Record<string, number>>({})

  const filtered = useMemo(() => {
    let result = [...proposals]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.client.nombre.toLowerCase().includes(q) ||
          p.project.ciudad.toLowerCase().includes(q) ||
          p.client.email.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

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

  const groups = useMemo(() => groupByClient(filtered), [filtered])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(false) }
  }

  const getActiveIndex = (clientName: string, total: number) => {
    const key = clientName.toLowerCase()
    const idx = activeVersions[key] ?? 0
    return Math.min(idx, total - 1)
  }

  const setActiveIndex = (clientName: string, index: number) => {
    const key = clientName.toLowerCase()
    setActiveVersions((prev) => ({ ...prev, [key]: index }))
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: proposals.length }
    for (const p of proposals) counts[p.status] = (counts[p.status] ?? 0) + 1
    return counts
  }, [proposals])

  const handleExport = () => {
    if (proposals.length === 0) {
      toast.info('No hay propuestas para exportar')
      return
    }
    const payload = {
      version: 1,
      exported_at: new Date().toISOString(),
      proposals,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mirac-propuestas-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(
      proposals.length === 1
        ? '1 propuesta exportada'
        : `${proposals.length} propuestas exportadas`
    )
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      const list = extractProposalList(parsed)
      if (!list) {
        toast.error('Archivo inválido')
        return
      }
      const { added, updated } = importProposals(list)
      toast.success(`Importadas: ${added} nuevas, ${updated} actualizadas`)
    } catch {
      toast.error('Archivo inválido')
    } finally {
      // Reset so re-importing the same file fires onChange again
      input.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propuestas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de cotizaciones solares</p>
        </div>
        <Link href="/cotizacion">
          <Button className="bg-mirac-red hover:bg-mirac-red-dark shadow-[0_4px_12px_rgba(250,50,63,0.25)] hover:shadow-[0_6px_16px_rgba(250,50,63,0.35)] transition-all hover:-translate-y-0.5">
            <Plus className="mr-2 size-4" />
            Nueva Cotización
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1">
          {([
            { value: 'all', label: 'Todas' },
            { value: 'draft', label: 'Borradores' },
            { value: 'sent', label: 'Enviadas' },
            { value: 'accepted', label: 'Aceptadas' },
          ] as const).map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                statusFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {(statusCounts[tab.value] ?? 0) > 0 && (
                <span className="ml-1.5 text-xs opacity-60">({statusCounts[tab.value]})</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, ciudad..."
            className="w-[240px] pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Export / Import */}
        <Button variant="outline" className="h-9" onClick={handleExport}>
          <Download className="mr-2 size-4" />
          Exportar
        </Button>
        <Button variant="outline" className="h-9" onClick={() => importInputRef.current?.click()}>
          <Upload className="mr-2 size-4" />
          Importar
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleImportFile}
        />

        {/* View toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          <Button
            variant={view === 'cards' ? 'default' : 'ghost'}
            size="icon"
            className="size-9 rounded-none"
            onClick={() => setView('cards')}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="icon"
            className="size-9 rounded-none"
            onClick={() => setView('table')}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderOpen className="mx-auto size-12 text-muted-foreground/40" />
            <p className="mt-4 font-medium text-muted-foreground">
              {proposals.length === 0
                ? 'No hay propuestas aún'
                : 'No se encontraron propuestas con estos filtros'}
            </p>
            {proposals.length === 0 && (
              <Link href="/cotizacion">
                <Button variant="outline" className="mt-4">
                  <Plus className="mr-2 size-4" /> Crear primera cotización
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

      ) : view === 'cards' ? (
        /* ─── Card Grid ─── */
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const idx = getActiveIndex(group.clientName, group.proposals.length)
            const p = group.proposals[idx]
            const r = p.results
            const hasVersions = group.proposals.length > 1
            const status = statusConfig[p.status] ?? statusConfig.draft
            const ciudad = CIUDADES.find((c) => c.value === p.project.ciudad)?.label ?? p.project.ciudad

            return (
              <article
                key={group.clientName}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1"
              >
                {/* Top accent line */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${status.color}`} />

                {/* Header */}
                <div className="p-5 pb-3">
                  <div className="mb-2 flex items-start justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('es-CO')}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.badgeClass}`}>
                      <span className={`size-1.5 rounded-full ${status.color}`} />
                      {status.label}
                    </span>
                  </div>
                  <Link href={`/propuestas/${p.id}`}>
                    <h3 className="text-lg font-bold leading-tight text-foreground hover:text-mirac-red transition-colors truncate">
                      {p.client.nombre}
                    </h3>
                  </Link>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {ciudad}
                  </p>
                </div>

                {/* Technical data */}
                <div className="mx-5 grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Potencia</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                      {r ? formatKWp(r.kwp) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Inversión</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                      {r ? formatCOP(r.costo_total_cop) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">TIR</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                      {r ? `${r.tir.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payback</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tabular-nums">
                      {r ? `${r.payback_anios.toFixed(1)} años` : '—'}
                    </p>
                  </div>
                </div>

                {/* Footer with actions + version slider */}
                <div className="mt-auto p-5 pt-4">
                  <div className="flex gap-2">
                    <Link href={`/propuestas/${p.id}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs font-semibold">
                        Ver Detalle
                      </Button>
                    </Link>
                  </div>

                  {/* Version dots */}
                  {hasVersions && (
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <button
                        type="button"
                        aria-label="Versión anterior"
                        className="rounded p-1 hover:bg-accent disabled:opacity-30 transition-colors"
                        disabled={idx === 0}
                        onClick={() => setActiveIndex(group.clientName, idx - 1)}
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        {group.proposals.map((vp, i) => (
                          <button
                            key={vp.id}
                            type="button"
                            aria-label={`Ver versión ${i + 1}`}
                            onClick={() => setActiveIndex(group.clientName, i)}
                            className={`rounded-full transition-all ${
                              i === idx ? 'h-2 w-5 bg-mirac-red' : 'size-2 bg-muted-foreground/25 hover:bg-muted-foreground/40'
                            }`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label="Versión siguiente"
                        className="rounded p-1 hover:bg-accent disabled:opacity-30 transition-colors"
                        disabled={idx === group.proposals.length - 1}
                        onClick={() => setActiveIndex(group.clientName, idx + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>

      ) : (
        /* ─── Table View ─── */
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('client')}>
                  Cliente <ArrowUpDown className="inline size-3" />
                </TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('kwp')}>
                  kWp <ArrowUpDown className="inline size-3" />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('cost')}>
                  Inversión <ArrowUpDown className="inline size-3" />
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('date')}>
                  Fecha <ArrowUpDown className="inline size-3" />
                </TableHead>
                <TableHead className="w-[100px]">Versión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const idx = getActiveIndex(group.clientName, group.proposals.length)
                const p = group.proposals[idx]
                const status = statusConfig[p.status] ?? statusConfig.draft
                const hasVersions = group.proposals.length > 1
                return (
                  <TableRow key={group.clientName} className="cursor-pointer" onClick={() => window.location.href = `/propuestas/${p.id}`}>
                    <TableCell className="font-semibold">{p.client.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{CIUDADES.find((c) => c.value === p.project.ciudad)?.label ?? p.project.ciudad}</TableCell>
                    <TableCell className="font-mono tabular-nums">{formatKWp(p.results?.kwp ?? 0)}</TableCell>
                    <TableCell className="font-mono tabular-nums">{formatCOP(p.results?.costo_total_cop ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status.badgeClass}`}>
                        <span className={`size-1.5 rounded-full ${status.color}`} />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      {new Date(p.created_at).toLocaleDateString('es-CO')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {hasVersions ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Versión anterior"
                            className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
                            disabled={idx === 0}
                            onClick={() => setActiveIndex(group.clientName, idx - 1)}
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <span className="min-w-[2.5rem] text-center font-mono text-xs tabular-nums">
                            {idx + 1}/{group.proposals.length}
                          </span>
                          <button
                            type="button"
                            aria-label="Versión siguiente"
                            className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
                            disabled={idx === group.proposals.length - 1}
                            onClick={() => setActiveIndex(group.clientName, idx + 1)}
                          >
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground/50">1/1</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
