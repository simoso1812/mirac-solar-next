'use client'

import type { UseFormReturn } from 'react-hook-form'
import type { AdvancedFormValues } from '@/lib/schemas'
import { INVERTER_DATABASE } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'

// Positional keys for the controlled, append/remove-only inverter override rows.
// This list is fully form-controlled and never reordered, so a position-based
// key is correct here.
const ROW_KEYS = Array.from({ length: 64 }, (_, i) => `row-${i}`)

interface InverterOverrideSectionProps {
  form: UseFormReturn<AdvancedFormValues>
}

// Manual inverter config — shown when brand is not Automatico
export function InverterOverrideSection({ form }: InverterOverrideSectionProps) {
  const { watch, setValue } = form
  const marcaInversor = watch('marca_inversor')
  const overrideInversores = watch('override_inversores')
  const brandInfo = INVERTER_DATABASE[marcaInversor]

  if (marcaInversor === 'Automatico' || overrideInversores == null) return null

  const overrides = overrideInversores
  const availableModels = brandInfo?.models ?? []
  const isCustomBrand = marcaInversor === 'Otro' || !brandInfo
  const availableKw = availableModels.length > 0
    ? availableModels.map((m) => m.potencia_kw)
    : [3, 5, 6, 8, 10, 20, 30, 40, 50, 100]
  const totalAcKw = overrides.reduce((s, i) => s + i.potencia_kw * i.cantidad, 0)

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground mb-2">
        {isCustomBrand ? 'Potencia y cantidad de inversores' : 'Configuración de inversores'}
      </p>
      {overrides.map((inv, idx) => (
        <div key={ROW_KEYS[idx]} className="flex items-center gap-2">
          {isCustomBrand ? (
            <div className="flex flex-1 items-center gap-2">
              <Input
                type="number"
                min={1}
                max={500}
                step={0.5}
                className="h-9"
                value={inv.potencia_kw}
                onChange={(e) => {
                  const updated = [...overrides]
                  updated[idx] = { ...updated[idx], potencia_kw: Number(e.target.value) || 0 }
                  setValue('override_inversores', updated)
                }}
              />
              <span className="text-sm text-muted-foreground">kW</span>
            </div>
          ) : (
            <select
              className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={inv.potencia_kw}
              onChange={(e) => {
                const updated = [...overrides]
                updated[idx] = { ...updated[idx], potencia_kw: Number(e.target.value) }
                setValue('override_inversores', updated)
              }}
            >
              {availableKw.map((kw) => {
                const m = availableModels.find((mod) => mod.potencia_kw === kw)
                return (
                  <option key={kw} value={kw}>
                    {m ? `${m.modelo} (${kw}kW)` : `${kw} kW`}
                  </option>
                )
              })}
            </select>
          )}
          <span className="text-sm text-muted-foreground">×</span>
          <Input
            type="number"
            min={1}
            max={20}
            className="h-9 w-20"
            value={inv.cantidad}
            onChange={(e) => {
              const updated = [...overrides]
              updated[idx] = { ...updated[idx], cantidad: Math.max(1, parseInt(e.target.value) || 1) }
              setValue('override_inversores', updated)
            }}
          />
          {overrides.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-9 p-0"
              onClick={() => {
                setValue('override_inversores', overrides.filter((_, i) => i !== idx))
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setValue('override_inversores', [...overrides, { potencia_kw: availableKw[0], cantidad: 1 }])
          }}
        >
          <Plus className="mr-1 size-3.5" />
          Agregar Inversor
        </Button>
        <span className="text-xs font-medium text-muted-foreground">
          Total AC: {totalAcKw} kW
        </span>
      </div>
    </div>
  )
}
