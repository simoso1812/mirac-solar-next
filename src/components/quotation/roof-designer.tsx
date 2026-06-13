'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from '@react-google-maps/api'
import { MAPS_LIBRARIES } from '@/components/maps-libraries'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, Zap } from 'lucide-react'
import { packPanels, defaultRowGap, type Cubierta, type Orientacion } from '@/lib/roof/packing'
import { polygonAreaM2 } from '@/lib/roof/geometry'
import { toLocalMeters, toLatLng } from '@/lib/roof/geometry'
import { renderRoofSnapshot } from '@/lib/roof/snapshot'
import type { RoofArea, RoofDesign } from '@/lib/types'

interface RoofDesignerProps {
  lat: number
  lng: number
  potenciaPanelW: number
  tipoCubierta: Cubierta
  anchoM: number
  altoM: number
  panelesSugeridos: number // consumption-derived count, shown as reference
  initialDesign: RoofDesign | null
  onApply: (design: RoofDesign) => void
  onClose: () => void
}

let _id = 0
const nextId = () => `area-${Date.now()}-${_id++}`

// Build the 4 lat/lng corners of a panel rectangle for rendering.
function panelCorners(center: { lat: number; lng: number }, w: number, h: number, rotationDeg: number) {
  const r = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  const local = toLocalMeters(center, center) // {0,0}
  void local
  const offs = [
    { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
  ]
  return offs.map((o) => {
    const rx = o.x * cos - o.y * sin
    const ry = o.x * sin + o.y * cos
    return toLatLng({ x: rx, y: ry }, center)
  })
}

export function RoofDesigner({
  lat, lng, potenciaPanelW, tipoCubierta, anchoM, altoM,
  panelesSugeridos, initialDesign, onApply, onClose,
}: RoofDesignerProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: MAPS_LIBRARIES,
  })

  const [areas, setAreas] = useState<RoofArea[]>(initialDesign?.areas ?? [])
  const [orientacion, setOrientacion] = useState<Orientacion>(initialDesign?.orientacion ?? 'vertical')
  const [rowGap, setRowGap] = useState<number>(
    initialDesign?.areas[0]?.row_gap_m ?? defaultRowGap(tipoCubierta)
  )
  const [drawing, setDrawing] = useState(true)
  const [saving, setSaving] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)

  const totalPanels = useMemo(() => areas.reduce((s, a) => s + a.panels.length, 0), [areas])
  const totalAreaM2 = useMemo(() => areas.reduce((s, a) => s + a.area_m2, 0), [areas])
  const kwp = (totalPanels * potenciaPanelW) / 1000

  const onPolygonComplete = useCallback((poly: google.maps.Polygon) => {
    const path = poly.getPath()
    const vertices = path.getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }))
    poly.setMap(null) // we render our own <Polygon>
    setAreas((prev) => [
      ...prev,
      {
        id: nextId(),
        vertices,
        area_m2: polygonAreaM2(vertices),
        panels: [],
        rotation_deg: 0,
        row_gap_m: rowGap,
      },
    ])
    setDrawing(false)
  }, [rowGap])

  const autoFill = useCallback(() => {
    setAreas((prev) => prev.map((a) => ({
      ...a,
      row_gap_m: rowGap,
      panels: packPanels({
        vertices: a.vertices,
        anchoM, altoM, rowGapM: rowGap, orientacion, rotationDeg: a.rotation_deg,
      }),
    })))
  }, [anchoM, altoM, rowGap, orientacion])

  const deleteArea = useCallback((id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleApply = useCallback(async () => {
    setSaving(true)
    const snapshot = await renderRoofSnapshot(areas, orientacion, { anchoM, altoM })
    const design: RoofDesign = {
      areas,
      total_panels: totalPanels,
      total_area_m2: totalAreaM2,
      orientacion,
      snapshot_data_url: snapshot,
      updated_at: new Date().toISOString(),
    }
    setSaving(false)
    onApply(design)
  }, [areas, orientacion, anchoM, altoM, totalPanels, totalAreaM2, onApply])

  const w = orientacion === 'vertical' ? anchoM : altoM
  const h = orientacion === 'vertical' ? altoM : anchoM

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button type="button" size="sm" variant={drawing ? 'default' : 'outline'} onClick={() => setDrawing(true)}>
          Dibujar techo
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={autoFill} disabled={areas.length === 0}>
          <Zap className="mr-1 size-4" /> Auto-llenar paneles
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Orientación</Label>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={orientacion}
            onChange={(e) => setOrientacion(e.target.value as Orientacion)}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Separación filas: {rowGap.toFixed(2)} m</Label>
          <input
            type="range" min={0} max={2} step={0.05} value={rowGap}
            aria-label="Separación entre filas"
            onChange={(e) => setRowGap(Number(e.target.value))}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" className="bg-mirac-red hover:bg-mirac-red-dark" onClick={handleApply} disabled={saving || totalPanels === 0}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Aplicar a la cotización ({totalPanels} paneles)
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          {!isLoaded ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat, lng }}
              zoom={20}
              onLoad={(m) => { mapRef.current = m }}
              options={{ mapTypeId: 'satellite', tilt: 0, disableDefaultUI: false, zoomControl: true }}
            >
              {drawing && (
                <DrawingManager
                  onPolygonComplete={onPolygonComplete}
                  options={{
                    drawingControl: false,
                    drawingMode: google.maps.drawing.OverlayType.POLYGON,
                    polygonOptions: { fillColor: '#facc15', fillOpacity: 0.1, strokeColor: '#facc15', strokeWeight: 2 },
                  }}
                />
              )}
              {areas.map((area) => (
                <div key={area.id}>
                  <Polygon
                    paths={area.vertices}
                    options={{ fillColor: '#facc15', fillOpacity: 0.08, strokeColor: '#facc15', strokeWeight: 2 }}
                  />
                  {area.panels.map((p, i) => (
                    <Polygon
                      key={`${area.id}-p-${i}`}
                      paths={panelCorners(p, w, h, area.rotation_deg)}
                      options={{ fillColor: '#2563eb', fillOpacity: 0.85, strokeColor: '#93c5fd', strokeWeight: 0.5, clickable: false }}
                    />
                  ))}
                </div>
              ))}
            </GoogleMap>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-56 shrink-0 space-y-4 border-l p-4">
          <div>
            <p className="text-xs text-muted-foreground">Área total</p>
            <p className="text-lg font-bold">{Math.round(totalAreaM2)} m²</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paneles ubicados</p>
            <p className="text-lg font-bold text-mirac-yellow-dark">{totalPanels}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Potencia ({potenciaPanelW} W)</p>
            <p className="text-lg font-bold">{kwp.toFixed(1)} kWp</p>
          </div>
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground">Sugerido por consumo</p>
            <p className="text-sm text-muted-foreground">{panelesSugeridos} paneles</p>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium">Techos ({areas.length})</p>
            {areas.map((a, i) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span>Techo {i + 1}: {a.panels.length}p · {Math.round(a.area_m2)} m²</span>
                <button type="button" aria-label="Borrar techo" onClick={() => deleteArea(a.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
