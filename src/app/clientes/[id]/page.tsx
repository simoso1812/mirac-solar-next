'use client'

import { use, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProposalsStore } from '@/stores/proposals-store'
import { formatCOP, formatKWp } from '@/lib/formatting'
import { CIUDADES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, User, Mail, Phone, MapPin, FileText, Zap, DollarSign,
} from 'lucide-react'
import type { QuotationData } from '@/lib/types'

export default function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const storeProposals = useProposalsStore((s) => s.proposals)
  const proposals = hydrated ? storeProposals : []

  const decodedId = decodeURIComponent(id)

  // Find client and their proposals
  const clientProposals = useMemo(() => {
    return proposals.filter(
      (p) =>
        p.client.nit_cc === decodedId ||
        p.client.nombre.toLowerCase() === decodedId.toLowerCase()
    )
  }, [proposals, decodedId])

  const client = clientProposals[0]?.client

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <div className="h-10" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cargando...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/clientes')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cliente no encontrado.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalKwp = clientProposals.reduce((s, p) => s + (p.results?.kwp ?? 0), 0)
  const totalInvestment = clientProposals.reduce((s, p) => s + (p.results?.costo_total_cop ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => router.push('/clientes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{client.nombre}</h1>
          <p className="text-sm text-muted-foreground">NIT/CC: {client.nit_cc}</p>
        </div>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Información de Contacto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.telefono}</span>
            </div>
            <div className="flex items-center gap-2 text-sm sm:col-span-2">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{client.direccion}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-mirac-red" />
              <div>
                <p className="text-xs text-muted-foreground">Propuestas</p>
                <p className="text-xl font-bold">{clientProposals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-mirac-yellow" />
              <div>
                <p className="text-xs text-muted-foreground">Total kWp</p>
                <p className="text-xl font-bold">{formatKWp(totalKwp)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground">Inversión Total</p>
                <p className="text-xl font-bold">{formatCOP(totalInvestment)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Proposals list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Propuestas Asociadas</h2>
        <div className="space-y-3">
          {clientProposals.map((p) => {
            const ciudadLabel = CIUDADES.find((c) => c.value === p.project.ciudad)?.label ?? p.project.ciudad
            return (
              <Link key={p.id} href={`/propuestas/${p.id}`}>
                <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent">
                  <div>
                    <p className="font-medium">
                      {ciudadLabel} — {formatKWp(p.results?.kwp ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('es-CO')} — TIR: {(p.results?.tir ?? 0).toFixed(1)}% — Payback: {(p.results?.payback_anios ?? 0).toFixed(1)} años
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} />
                    <span className="font-semibold">{formatCOP(p.results?.costo_total_cop ?? 0)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
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
