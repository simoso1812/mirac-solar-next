'use client'

import { useState, useMemo } from 'react'
import { getFullEstimate } from '@/lib/calculator/cost'
import { formatCOP } from '@/lib/formatting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Calculator, TrendingUp, AlertTriangle } from 'lucide-react'

const SEGMENT_COLORS = {
  small: 'bg-blue-50 text-blue-600 border-blue-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  large: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

export function PriceEstimator() {
  const [kwpInput, setKwpInput] = useState('')
  const kwp = parseFloat(kwpInput) || 0

  const estimate = useMemo(() => {
    if (kwp <= 0) return null
    try {
      return getFullEstimate(kwp)
    } catch {
      return null
    }
  }, [kwp])

  const outOfRange = kwp > 300

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="size-4 text-mirac-red" />
          Estimador de Precio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kwp-input">Tamaño del sistema (kWp)</Label>
          <Input
            id="kwp-input"
            type="number"
            min={0.1}
            step={0.1}
            placeholder="Ej: 10"
            value={kwpInput}
            onChange={(e) => setKwpInput(e.target.value)}
          />
        </div>

        {estimate && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            {/* Segment badge */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={SEGMENT_COLORS[estimate.segment]}>
                {estimate.segmentLabel}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">
                R² = {estimate.r2.toFixed(2)}
              </span>
            </div>

            {/* Price */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Precio estimado</p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
                {formatCOP(estimate.price)}
              </p>
            </div>

            {/* Price per kWp */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Precio por kWp</p>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                {formatCOP(estimate.pricePerKwp)}/kWp
              </p>
            </div>

            {/* Range ±15% */}
            <div className="flex items-start gap-2 rounded-md border bg-background p-3">
              <TrendingUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium">Rango estimado (±15%)</p>
                <p className="mt-1 font-mono tabular-nums">
                  {formatCOP(Math.ceil(estimate.price * 0.85))} a {formatCOP(Math.ceil(estimate.price * 1.15))}
                </p>
                <p className="mt-1.5 text-[10px] leading-relaxed opacity-70">
                  Modelo calibrado con 80 proyectos solares en Colombia (2025–2026).
                </p>
              </div>
            </div>

            {outOfRange && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-700">
                  Sistema de {kwp} kWp está fuera del rango del modelo (&gt;300 kWp). La estimación puede ser menos precisa.
                </p>
              </div>
            )}
          </div>
        )}

        {!estimate && kwp > 0 && (
          <p className="text-sm text-muted-foreground">Ingresa un valor válido mayor a 0.</p>
        )}
      </CardContent>
    </Card>
  )
}
