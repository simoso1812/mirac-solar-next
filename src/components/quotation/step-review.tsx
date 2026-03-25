'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuotationStore } from '@/stores/quotation-store'
import { useProposalsStore } from '@/stores/proposals-store'
import { cotizacion, buildInputFromStore } from '@/lib/calculator'
import { formatCOP, formatKWp, formatKWh, formatPercent } from '@/lib/formatting'
import { CIUDADES, MESES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, CheckCircle, DollarSign, Zap, Sun, TreePine,
  TrendingUp, Clock, BarChart3, Save,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, LineChart, Line,
} from 'recharts'

export function StepReview() {
  const {
    clientData, projectData, technicalData, advancedData,
    setStep, setResults,
  } = useQuotationStore()

  const results = useMemo(() => {
    if (technicalData.consumo_mensual_kwh <= 0) return null
    try {
      const input = buildInputFromStore(technicalData, projectData, advancedData)
      return cotizacion(input)
    } catch (e) {
      console.error('Calculation error:', e)
      return null
    }
  }, [technicalData, projectData, advancedData])

  const ciudadLabel = CIUDADES.find((c) => c.value === projectData.ciudad)?.label ?? projectData.ciudad

  const router = useRouter()
  const addProposal = useProposalsStore((s) => s.addProposal)

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!results) return
    setIsSaving(true)

    setResults(results)
    const id = addProposal({
      client: clientData,
      project: projectData,
      technical: technicalData,
      advanced: advancedData,
      results,
    })

    // Save client to Notion CRM (fire-and-forget)
    try {
      await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: clientData.nombre,
          documento: clientData.nit_cc,
          direccion: clientData.direccion,
          proyecto: `${results.kwp.toFixed(1)} kWp - ${ciudadLabel}`,
          fecha: projectData.fecha,
          estado: 'Cotización',
        }),
      })
    } catch {
      // Notion save failed silently — not blocking
    }

    setIsSaving(false)
    router.push(`/propuestas/${id}`)
  }

  if (!results) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No se pudo calcular. Verifica que el consumo mensual sea mayor a 0.
          </p>
          <Button variant="outline" onClick={() => setStep(2)} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Especificaciones
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Chart data
  const monthlyGenData = results.generacion_mensual_kwh.map((kwh, i) => ({
    mes: MESES[i].substring(0, 3),
    generacion: Math.round(kwh),
    consumo: technicalData.consumo_mensual_kwh,
  }))

  const cashFlowData = results.flujo_caja
    .filter((row) => row.anio > 0 && row.anio <= 25)
    .map((row) => ({
      anio: `Año ${row.anio}`,
      flujo: Math.round(row.flujo_neto_cop),
      acumulado: Math.round(row.flujo_acumulado_cop),
    }))

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <Card className="border-mirac-red/20 bg-mirac-red/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-mirac-red" />
            Resumen de Cotización
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {clientData.nombre} — {ciudadLabel} — {projectData.fecha}
          </p>
        </CardHeader>
      </Card>

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Inversión Total"
          value={formatCOP(results.costo_total_cop)}
          color="red"
        />
        <MetricCard
          icon={<Zap className="h-5 w-5" />}
          label="Potencia del Sistema"
          value={formatKWp(results.kwp)}
          sub={`${results.numero_paneles} paneles`}
          color="yellow"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="TIR"
          value={formatPercent(results.tir / 100)}
          sub={`VPN: ${formatCOP(results.vpn, false)}`}
          color="green"
        />
        <MetricCard
          icon={<Clock className="h-5 w-5" />}
          label="Payback"
          value={`${results.payback_anios.toFixed(1)} años`}
          sub={`ROI: ${results.roi_porcentaje.toFixed(0)}%`}
          color="blue"
        />
      </div>

      {/* Generation & savings */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={<Sun className="h-5 w-5" />}
          label="Generación Anual"
          value={formatKWh(Math.round(results.generacion_anual_kwh))}
          sub={`Ahorro: ${formatCOP(results.ahorro_anual_cop)}/año`}
          color="yellow"
        />
        <MetricCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="Costo por kWp"
          value={formatCOP(results.costo_por_kwp_cop)}
          sub={`PR: ${formatPercent(results.performance_ratio)}`}
          color="gray"
        />
        <MetricCard
          icon={<TreePine className="h-5 w-5" />}
          label="CO₂ Evitado/año"
          value={`${results.carbon.annual_co2_avoided_tons.toFixed(1)} ton`}
          sub={`≈ ${Math.round(results.carbon.trees_saved_per_year)} árboles`}
          color="green"
        />
      </div>

      {/* Inverter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inversores Recomendados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {results.inversores.map((inv, i) => (
              <Badge key={i} variant="outline" className="text-sm">
                {inv.cantidad}x {inv.marca} {inv.modelo} ({inv.potencia_kw}kW)
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly generation chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generación Mensual vs Consumo</CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle className="text-base">Flujo de Caja Acumulado (25 años)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="anio" fontSize={10} interval={4} />
                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                <RechartsTooltip formatter={(v) => formatCOP(Number(v), false)} />
                <Line
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#FA323F"
                  strokeWidth={2}
                  dot={false}
                  name="Acumulado"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(3)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="bg-mirac-red hover:bg-mirac-red-dark">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar Propuesta'}
        </Button>
      </div>
    </div>
  )
}

function MetricCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: string
}) {
  const colorMap: Record<string, string> = {
    red: 'text-mirac-red',
    yellow: 'text-mirac-yellow',
    green: 'text-emerald-600',
    blue: 'text-blue-600',
    gray: 'text-muted-foreground',
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={colorMap[color] ?? 'text-muted-foreground'}>{icon}</div>
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
