'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertTriangle, HelpCircle, Edit3 } from 'lucide-react'
import type { ExtractedBillData, ExtractedBillField } from '@/lib/bill-scanner/types'
import { getConfidenceLevel } from '@/lib/bill-scanner/types'
import { validateExtractedData } from '@/lib/bill-scanner/validator'

interface BillReviewProps {
  data: ExtractedBillData
  processingTime: number
  onAccept: (data: ExtractedBillData) => void
  onDiscard: () => void
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence)
  const pct = Math.round(confidence * 100)

  if (level === 'high') {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle className="h-3 w-3" /> {pct}%
      </Badge>
    )
  }
  if (level === 'medium') {
    return (
      <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertTriangle className="h-3 w-3" /> {pct}%
      </Badge>
    )
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <HelpCircle className="h-3 w-3" /> {pct}%
    </Badge>
  )
}

function EditableField({
  label,
  field,
  type = 'text',
  onChange,
}: {
  label: string
  field: ExtractedBillField<string | number>
  type?: 'text' | 'number'
  onChange: (value: string | number) => void
}) {
  const [editing, setEditing] = useState(false)
  const level = getConfidenceLevel(field.confidence)

  return (
    <div className={`rounded-lg border p-3 ${
      level === 'low' ? 'border-destructive/50 bg-destructive/5' :
      level === 'medium' ? 'border-yellow-500/50 bg-yellow-500/5' : ''
    }`}>
      <div className="mb-1.5 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1.5">
          <ConfidenceBadge confidence={field.confidence} />
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded p-0.5 hover:bg-accent"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <Input
          type={type}
          defaultValue={String(field.value)}
          autoFocus
          onBlur={(e) => {
            setEditing(false)
            const val = type === 'number' ? Number(e.target.value) : e.target.value
            onChange(val)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          className="h-8 text-sm"
        />
      ) : (
        <p className="text-sm font-medium">
          {field.value === 0 || field.value === '' ? (
            <span className="italic text-muted-foreground">No encontrado</span>
          ) : (
            String(field.value)
          )}
        </p>
      )}
    </div>
  )
}

export function BillReview({ data, processingTime, onAccept, onDiscard }: BillReviewProps) {
  const [editedData, setEditedData] = useState<ExtractedBillData>(data)

  const updateField = <K extends keyof ExtractedBillData>(
    key: K,
    value: ExtractedBillData[K]['value']
  ) => {
    setEditedData((prev) => ({
      ...prev,
      [key]: { ...prev[key], value, confidence: 1.0 }, // manual edit = full confidence
    }))
  }

  const validationResults = validateExtractedData(editedData)
  const hasErrors = validationResults.some((r) => !r.valid)

  // Overall confidence: weighted average
  const overallConfidence = (
    editedData.consumo_mensual_kwh.confidence * 0.30 +
    editedData.tarifa_energia_cop_kwh.confidence * 0.25 +
    editedData.nombre_cliente.confidence * 0.15 +
    editedData.direccion.confidence * 0.10 +
    editedData.documento.confidence * 0.10 +
    editedData.total_factura_cop.confidence * 0.10
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Datos Extraídos</p>
          <p className="text-xs text-muted-foreground">
            Procesado en {(processingTime / 1000).toFixed(1)}s
          </p>
        </div>
        <ConfidenceBadge confidence={overallConfidence} />
      </div>

      {/* Client section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Información del Cliente</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditableField
            label="Nombre del Cliente"
            field={editedData.nombre_cliente}
            onChange={(v) => updateField('nombre_cliente', String(v))}
          />
          <EditableField
            label="Documento (CC/NIT)"
            field={editedData.documento}
            onChange={(v) => updateField('documento', String(v))}
          />
        </div>
        <EditableField
          label="Dirección"
          field={editedData.direccion}
          onChange={(v) => updateField('direccion', String(v))}
        />
      </div>

      {/* Consumption section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Consumo y Tarifa</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditableField
            label="Consumo Mensual (kWh)"
            field={editedData.consumo_mensual_kwh}
            type="number"
            onChange={(v) => updateField('consumo_mensual_kwh', Number(v))}
          />
          <EditableField
            label="Tarifa Energía (COP/kWh)"
            field={editedData.tarifa_energia_cop_kwh}
            type="number"
            onChange={(v) => updateField('tarifa_energia_cop_kwh', Number(v))}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditableField
            label="Total Factura (COP)"
            field={editedData.total_factura_cop}
            type="number"
            onChange={(v) => updateField('total_factura_cop', Number(v))}
          />
          <EditableField
            label="Tipo de Servicio"
            field={editedData.tipo_servicio}
            onChange={(v) => updateField('tipo_servicio', String(v) as 'residential' | 'commercial' | 'industrial')}
          />
        </div>
        {/* Contribución 20% toggle */}
        <div className={`rounded-lg border p-3 ${
          editedData.contribucion_20.confidence < 0.6 ? 'border-destructive/50 bg-destructive/5' :
          editedData.contribucion_20.confidence < 0.85 ? 'border-yellow-500/50 bg-yellow-500/5' : ''
        }`}>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Contribución 20%</Label>
            <ConfidenceBadge confidence={editedData.contribucion_20.confidence} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateField('contribucion_20', !editedData.contribucion_20.value)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                editedData.contribucion_20.value ? 'bg-mirac-red' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                editedData.contribucion_20.value ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm font-medium">
              {editedData.contribucion_20.value ? 'Sí (se sumará 20% a tarifa)' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Metadata section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Datos de la Factura</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditableField
            label="Período de Facturación"
            field={editedData.periodo_facturacion}
            onChange={(v) => updateField('periodo_facturacion', String(v))}
          />
          <EditableField
            label="No. Factura"
            field={editedData.numero_factura}
            onChange={(v) => updateField('numero_factura', String(v))}
          />
          <EditableField
            label="No. Medidor"
            field={editedData.numero_medidor}
            onChange={(v) => updateField('numero_medidor', String(v))}
          />
          <EditableField
            label="No. Transformador"
            field={editedData.numero_transformador}
            onChange={(v) => updateField('numero_transformador', String(v))}
          />
        </div>
      </div>

      {/* Validation warnings */}
      {hasErrors && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-3">
          <p className="mb-1 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
            Campos a revisar:
          </p>
          <ul className="space-y-0.5 text-xs text-yellow-600 dark:text-yellow-400/80">
            {validationResults
              .filter((r) => !r.valid)
              .map((r) => (
                <li key={r.field}>• {r.message}</li>
              ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-600" /> Alta confianza (&gt;85%)
        </span>
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-yellow-600" /> Revisar (60-85%)
        </span>
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3 text-destructive" /> Ingreso manual (&lt;60%)
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onDiscard} className="flex-1">
          Descartar
        </Button>
        <Button
          onClick={() => onAccept(editedData)}
          className="flex-1 bg-mirac-red hover:bg-mirac-red-dark"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Usar Datos
        </Button>
      </div>
    </div>
  )
}
