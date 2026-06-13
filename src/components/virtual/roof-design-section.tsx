'use client'

import type { RoofDesign } from '@/lib/types'

interface RoofDesignSectionProps {
  diseno: RoofDesign | null | undefined
  potenciaPanelW: number
}

export function RoofDesignSection({ diseno, potenciaPanelW }: RoofDesignSectionProps) {
  if (!diseno || diseno.areas.length === 0) return null
  const kwp = (diseno.total_panels * potenciaPanelW) / 1000

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">Diseño del Techo</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Área total</p>
          <p className="text-lg font-bold">{Math.round(diseno.total_area_m2)} m²</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Paneles ubicados</p>
          <p className="text-lg font-bold">{diseno.total_panels}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Potencia</p>
          <p className="text-lg font-bold">{kwp.toFixed(1)} kWp</p>
        </div>
      </div>
      {diseno.snapshot_data_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={diseno.snapshot_data_url}
          alt="Diseño del techo con paneles"
          className="w-full rounded-lg border"
        />
      )}
    </section>
  )
}
