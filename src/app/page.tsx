'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useProposalsStore } from '@/stores/proposals-store'
import { formatCOP, formatKWp } from '@/lib/formatting'
import { CIUDADES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText, Users, Zap, TrendingUp, Plus, ArrowRight,
} from 'lucide-react'
import { PriceEstimator } from '@/components/price-estimator'

export default function DashboardPage() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const proposals = useProposalsStore((s) => s.proposals)
  const uniqueClients = useProposalsStore((s) => s.getUniqueClients)

  const totalProposals = hydrated ? proposals.length : 0
  const totalKwp = hydrated ? proposals.reduce((sum, p) => sum + (p.results?.kwp ?? 0), 0) : 0
  const totalInvestment = hydrated ? proposals.reduce((sum, p) => sum + (p.results?.costo_total_cop ?? 0), 0) : 0
  const clients = hydrated ? uniqueClients() : []

  // Recent proposals (last 5)
  const recent = hydrated ? proposals.slice(0, 5) : []

  // This month's proposals
  const now = new Date()
  const thisMonth = hydrated ? proposals.filter((p) => {
    const d = new Date(p.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/cotizacion">
          <Button className="bg-mirac-red hover:bg-mirac-red-dark">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Cotización
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Propuestas"
          value={totalProposals.toString()}
          sub={`${thisMonth.length} este mes`}
          color="text-mirac-red"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="kWp Cotizados"
          value={formatKWp(totalKwp)}
          sub={`${proposals.filter((p) => p.status === 'accepted').length} aceptadas`}
          color="text-mirac-yellow"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Inversión Total"
          value={totalInvestment > 0 ? formatCOP(totalInvestment) : '$0'}
          sub="valor cotizado"
          color="text-emerald-600"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Clientes"
          value={clients.length.toString()}
          sub="únicos"
          color="text-blue-600"
        />
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/cotizacion">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mirac-red/10 text-mirac-red">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Nueva Cotización</p>
                <p className="text-xs text-muted-foreground">Crear propuesta solar</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/propuestas">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-mirac-yellow/10 text-mirac-yellow">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Ver Propuestas</p>
                <p className="text-xs text-muted-foreground">{totalProposals} propuestas</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/clientes">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Clientes</p>
                <p className="text-xs text-muted-foreground">{clients.length} registrados</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent proposals + Estimator */}
      <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Propuestas Recientes</CardTitle>
          {totalProposals > 0 && (
            <Link href="/propuestas">
              <Button variant="ghost" size="sm">
                Ver todas <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay propuestas aún. Crea tu primera cotización.
            </p>
          ) : (
            <div className="space-y-3">
              {recent.map((p) => {
                const ciudadLabel =
                  CIUDADES.find((c) => c.value === p.project.ciudad)?.label ?? p.project.ciudad
                return (
                  <Link key={p.id} href={`/propuestas/${p.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.client.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {ciudadLabel} — {formatKWp(p.results?.kwp ?? 0)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        <span className="text-sm font-semibold">
                          {formatCOP(p.results?.costo_total_cop ?? 0)}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <PriceEstimator />
      </div>
    </div>
  )
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={color}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
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

// Need to import this type for StatusBadge
import type { QuotationData } from '@/lib/types'
