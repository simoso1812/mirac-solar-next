'use client'

import { use, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProposalsStore } from '@/stores/proposals-store'
import { formatCOP, formatKWp, formatKWh, formatPercent } from '@/lib/formatting'
import { CIUDADES, MESES } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PdfDownloadButton } from '@/components/pdf-download-button'
import { DriveSyncButton } from '@/components/drive-sync-button'
import Link from 'next/link'
import {
  ArrowLeft, Copy, Trash2, DollarSign, Zap, Sun, TreePine,
  TrendingUp, Clock, BarChart3, User, MapPin, ExternalLink,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, LineChart, Line,
} from 'recharts'
import {
  GoogleMap, useJsApiLoader, Marker,
} from '@react-google-maps/api'
import type { QuotationData } from '@/lib/types'

export default function PropuestaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const proposal = useProposalsStore((s) => s.getProposal(id))
  const updateProposal = useProposalsStore((s) => s.updateProposal)
  const deleteProposal = useProposalsStore((s) => s.deleteProposal)
  const duplicateProposal = useProposalsStore((s) => s.duplicateProposal)

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

  if (!proposal) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/propuestas')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Propuesta no encontrada.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const r = proposal.results
  const ciudadLabel = CIUDADES.find((c) => c.value === proposal.project.ciudad)?.label ?? proposal.project.ciudad

  const handleDuplicate = () => {
    const newId = duplicateProposal(id)
    if (newId) router.push(`/propuestas/${newId}`)
  }

  const handleDelete = () => {
    if (confirm('¿Eliminar esta propuesta?')) {
      deleteProposal(id)
      router.push('/propuestas')
    }
  }

  const handleStatusChange = (status: QuotationData['status']) => {
    updateProposal(id, { status })
  }

  // Chart data
  const monthlyGenData = r
    ? r.generacion_mensual_kwh.map((kwh, i) => ({
        mes: MESES[i].substring(0, 3),
        generacion: Math.round(kwh),
        consumo: proposal.technical.consumo_mensual_kwh,
      }))
    : []

  const cashFlowData = r
    ? r.flujo_caja
        .filter((row) => row.anio > 0 && row.anio <= 25)
        .map((row) => ({
          anio: `${row.anio}`,
          flujo: Math.round(row.flujo_neto_cop),
          acumulado: Math.round(row.flujo_acumulado_cop),
        }))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/propuestas')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{proposal.client.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              {ciudadLabel} — {new Date(proposal.created_at).toLocaleDateString('es-CO')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status changer */}
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={proposal.status}
            onChange={(e) => handleStatusChange(e.target.value as QuotationData['status'])}
          >
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="accepted">Aceptada</option>
            <option value="rejected">Rechazada</option>
          </select>
          <Link href={`/propuestas/${id}/virtual`} target="_blank">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1 h-3 w-3" /> Cotización Virtual
            </Button>
          </Link>
          <PdfDownloadButton proposal={proposal} />
          <DriveSyncButton proposal={proposal} />
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy className="mr-1 h-3 w-3" /> Duplicar
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-3 w-3" /> Eliminar
          </Button>
        </div>
      </div>

      {!r ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Esta propuesta no tiene resultados calculados.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={<DollarSign />} label="Inversión" value={formatCOP(r.costo_total_cop)} color="text-mirac-red" />
            <MetricCard icon={<Zap />} label="Potencia" value={formatKWp(r.kwp)} sub={`${r.numero_paneles} paneles`} color="text-mirac-yellow" />
            <MetricCard icon={<TrendingUp />} label="TIR" value={formatPercent(r.tir / 100)} sub={`VPN: ${formatCOP(r.vpn, false)}`} color="text-emerald-600" />
            <MetricCard icon={<Clock />} label="Payback" value={`${r.payback_anios.toFixed(1)} años`} sub={`ROI: ${r.roi_porcentaje.toFixed(0)}%`} color="text-blue-600" />
          </div>

          {/* Client & project info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" /> Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Nombre:</span> {proposal.client.nombre}</p>
                <p><span className="text-muted-foreground">NIT/CC:</span> {proposal.client.nit_cc}</p>
                <p><span className="text-muted-foreground">Email:</span> {proposal.client.email}</p>
                <p><span className="text-muted-foreground">Teléfono:</span> {proposal.client.telefono}</p>
                <p><span className="text-muted-foreground">Dirección:</span> {proposal.client.direccion}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Proyecto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Ciudad:</span> {ciudadLabel}</p>
                <p><span className="text-muted-foreground">Consumo:</span> {formatKWh(proposal.technical.consumo_mensual_kwh)}/mes</p>
                <p><span className="text-muted-foreground">Cubierta:</span> {proposal.technical.tipo_cubierta}</p>
                <p><span className="text-muted-foreground">Generación:</span> {formatKWh(Math.round(r.generacion_anual_kwh))}/año</p>
                <p><span className="text-muted-foreground">Ahorro:</span> {formatCOP(r.ahorro_anual_cop)}/año</p>
              </CardContent>
            </Card>
          </div>

          {/* Location map */}
          {proposal.project.lat != null && proposal.project.lon != null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" /> Ubicación del Proyecto
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Coordenadas: {proposal.project.lat.toFixed(6)}, {proposal.project.lon.toFixed(6)}
                </p>
              </CardHeader>
              <CardContent>
                <ProposalMap lat={proposal.project.lat} lon={proposal.project.lon} />
              </CardContent>
            </Card>
          )}

          {/* Generation & carbon */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard icon={<Sun />} label="Generación Anual" value={formatKWh(Math.round(r.generacion_anual_kwh))} color="text-mirac-yellow" />
            <MetricCard icon={<BarChart3 />} label="Costo por kWp" value={formatCOP(r.costo_por_kwp_cop)} sub={`PR: ${formatPercent(r.performance_ratio)}`} color="text-muted-foreground" />
            <MetricCard icon={<TreePine />} label="CO₂ Evitado/año" value={`${r.carbon.annual_co2_avoided_tons.toFixed(1)} ton`} sub={`≈ ${Math.round(r.carbon.trees_saved_per_year)} árboles`} color="text-emerald-600" />
          </div>

          {/* Inverters */}
          <Card>
            <CardHeader><CardTitle className="text-base">Inversores</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {r.inversores.map((inv, i) => (
                  <Badge key={i} variant="outline">{inv.cantidad}x {inv.marca} {inv.modelo} ({inv.potencia_kw}kW)</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly generation chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Generación Mensual vs Consumo</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyGenData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" fontSize={12} />
                    <YAxis fontSize={12} />
                    <RechartsTooltip />
                    <Bar dataKey="generacion" fill="#FAC107" name="Generación (kWh)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="consumo" fill="#FA323F" name="Consumo (kWh)" radius={[4, 4, 0, 0]} opacity={0.5} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cash flow chart */}
          <Card>
            <CardHeader><CardTitle className="text-base">Flujo de Caja Acumulado</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="anio" fontSize={10} interval={4} />
                    <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                    <RechartsTooltip formatter={(v) => formatCOP(Number(v), false)} />
                    <Line type="monotone" dataKey="acumulado" stroke="#FA323F" strokeWidth={2} dot={false} name="Acumulado" />
                    <Line type="monotone" dataKey="flujo" stroke="#FAC107" strokeWidth={1} dot={false} name="Flujo Neto" opacity={0.6} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Cost breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">Desglose de Costos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Equipos</p>
                  <p className="font-semibold">{formatCOP(r.desglose_costos.equipos)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Materiales</p>
                  <p className="font-semibold">{formatCOP(r.desglose_costos.materiales)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IVA</p>
                  <p className="font-semibold">{formatCOP(r.desglose_costos.iva)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margen</p>
                  <p className="font-semibold">{formatCOP(r.desglose_costos.margen)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function ProposalMap({ lat, lon }: { lat: number; lon: number }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  })

  const onLoad = useCallback((map: google.maps.Map) => {
    map.setCenter({ lat, lng: lon })
  }, [lat, lon])

  if (!isLoaded) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">Cargando mapa...</p>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '300px', borderRadius: '0.5rem' }}
      center={{ lat, lng: lon }}
      zoom={17}
      onLoad={onLoad}
      options={{
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeControl: false,
      }}
    >
      <Marker position={{ lat, lng: lon }} />
    </GoogleMap>
  )
}

function MetricCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`${color} [&>svg]:h-5 [&>svg]:w-5`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
