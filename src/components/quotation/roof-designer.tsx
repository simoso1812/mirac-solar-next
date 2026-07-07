'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { GoogleMap, useJsApiLoader, Polygon, Polyline } from '@react-google-maps/api'
import { MAPS_LIBRARIES } from '@/components/maps-libraries'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Trash2, Zap, Undo2 } from 'lucide-react'
import { packPanels, repack, defaultRowGap, type Cubierta, type Orientacion } from '@/lib/roof/packing'
import { polygonAreaM2 } from '@/lib/roof/geometry'
import { toLatLng } from '@/lib/roof/geometry'
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

const nextId = () => `area-${nanoid()}`

// Build the 4 lat/lng corners of a panel rectangle for rendering.
function panelCorners(center: { lat: number; lng: number }, w: number, h: number, rotationDeg: number) {
  const r = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
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
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  // Underlying google.maps.Polygon instances, keyed by area id. Needed to read
  // the edited path back after a vertex drag (only written in onLoad/onUnmount,
  // never read during render).
  const polygonRefs = useRef(new Map<string, google.maps.Polygon>())
  // Drawing mode + the vertices the user has clicked for the in-progress roof.
  // google.maps.drawing.DrawingManager was removed from the Maps JS API at
  // v3.65, so we collect polygon vertices from map clicks ourselves.
  const [drawing, setDrawing] = useState(true)
  const [drawingVertices, setDrawingVertices] = useState<{ lat: number; lng: number }[]>([])
  const [saving, setSaving] = useState(false)
  const mapRef = useRef<google.maps.Map | null>(null)
  // Guards the async snapshot path: the user can close the dialog (unmounting
  // this component) while renderRoofSnapshot is still fetching/rendering. We
  // must not setState or call onApply after unmount.
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const totalPanels = useMemo(() => areas.reduce((s, a) => s + a.panels.length, 0), [areas])
  const totalAreaM2 = useMemo(() => areas.reduce((s, a) => s + a.area_m2, 0), [areas])
  const kwp = (totalPanels * potenciaPanelW) / 1000
  const selectedIndex = useMemo(() => areas.findIndex((a) => a.id === selectedAreaId), [areas, selectedAreaId])
  const selectedArea = selectedIndex >= 0 ? areas[selectedIndex] : null

  const startDrawing = useCallback(() => {
    setSelectedAreaId(null)
    setDrawingVertices([])
    setDrawing(true)
  }, [])

  const addVertex = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const point = { lat: e.latLng.lat(), lng: e.latLng.lng() }
    setDrawingVertices((prev) => [...prev, point])
  }, [])

  const undoVertex = useCallback(() => {
    setDrawingVertices((prev) => prev.slice(0, -1))
  }, [])

  const cancelDrawing = useCallback(() => {
    setDrawingVertices([])
    setDrawing(false)
  }, [])

  const finishDrawing = useCallback(() => {
    if (drawingVertices.length < 3) return
    const vertices = drawingVertices
    setAreas((prev) => [
      ...prev,
      {
        id: nextId(),
        vertices,
        area_m2: polygonAreaM2(vertices),
        panels: [],
        rotation_deg: 0,
        row_gap_m: defaultRowGap(tipoCubierta),
      },
    ])
    setDrawingVertices([])
    setDrawing(false)
  }, [drawingVertices, tipoCubierta])

  const autoFill = useCallback(() => {
    setAreas((prev) => prev.map((a) => ({
      ...a,
      panels: packPanels({
        vertices: a.vertices,
        anchoM, altoM, rowGapM: a.row_gap_m, orientacion, rotationDeg: a.rotation_deg,
      }),
    })))
  }, [anchoM, altoM, orientacion])

  const deleteArea = useCallback((id: string) => {
    setAreas((prev) => prev.filter((a) => a.id !== id))
    setSelectedAreaId((sel) => (sel === id ? null : sel))
  }, [])

  // Re-pack the selected area with a changed rotation or row gap. Manual panel
  // deletions are discarded on any re-pack (the grid is regenerated).
  const setAreaRotation = useCallback((id: string, deg: number) => {
    setAreas((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const { areaM2, panels } = repack({ vertices: a.vertices, anchoM, altoM, rowGapM: a.row_gap_m, orientacion, rotationDeg: deg })
      return { ...a, rotation_deg: deg, area_m2: areaM2, panels }
    }))
  }, [anchoM, altoM, orientacion])

  const setAreaRowGap = useCallback((id: string, gap: number) => {
    setAreas((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const { areaM2, panels } = repack({ vertices: a.vertices, anchoM, altoM, rowGapM: gap, orientacion, rotationDeg: a.rotation_deg })
      return { ...a, row_gap_m: gap, area_m2: areaM2, panels }
    }))
  }, [anchoM, altoM, orientacion])

  const refillArea = useCallback((id: string) => {
    setAreas((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const { areaM2, panels } = repack({ vertices: a.vertices, anchoM, altoM, rowGapM: a.row_gap_m, orientacion, rotationDeg: a.rotation_deg })
      return { ...a, area_m2: areaM2, panels }
    }))
  }, [anchoM, altoM, orientacion])

  const deletePanel = useCallback((areaId: string, index: number) => {
    setAreas((prev) => prev.map((a) => (
      a.id === areaId ? { ...a, panels: a.panels.filter((_, j) => j !== index) } : a
    )))
  }, [])

  // Read the edited polygon path back after a vertex drag (fires on mouseup on
  // the editable polygon) and commit it if it actually changed. Reading on
  // mouseup instead of listening to the MVCArray set_at/insert_at events avoids
  // the feedback loop those events create when React pushes the paths prop back.
  const syncAreaPath = useCallback((id: string) => {
    const poly = polygonRefs.current.get(id)
    if (!poly) return
    const vertices = poly.getPath().getArray().map((ll) => ({ lat: ll.lat(), lng: ll.lng() }))
    if (vertices.length < 3) return
    setAreas((prev) => prev.map((a) => {
      if (a.id !== id) return a
      const same = a.vertices.length === vertices.length
        && a.vertices.every((v, i) => v.lat === vertices[i].lat && v.lng === vertices[i].lng)
      if (same) return a
      // Only re-pack roofs that already have panels; a never-filled roof stays empty.
      if (a.panels.length > 0) {
        const { areaM2, panels } = repack({ vertices, anchoM, altoM, rowGapM: a.row_gap_m, orientacion, rotationDeg: a.rotation_deg })
        return { ...a, vertices, area_m2: areaM2, panels }
      }
      return { ...a, vertices, area_m2: polygonAreaM2(vertices) }
    }))
  }, [anchoM, altoM, orientacion])

  // Orientation is design-level: changing it re-packs every filled roof with
  // the new value (passed explicitly; state would be stale inside the updater).
  const changeOrientacion = useCallback((v: Orientacion) => {
    setOrientacion(v)
    setAreas((prev) => prev.map((a) => {
      if (a.panels.length === 0) return a
      const { areaM2, panels } = repack({ vertices: a.vertices, anchoM, altoM, rowGapM: a.row_gap_m, orientacion: v, rotationDeg: a.rotation_deg })
      return { ...a, area_m2: areaM2, panels }
    }))
  }, [anchoM, altoM])

  const deselect = useCallback(() => setSelectedAreaId(null), [])

  const handleApply = useCallback(async () => {
    setSaving(true)
    const snapshot = await renderRoofSnapshot(areas, orientacion, { anchoM, altoM })
    // Bail out if the dialog was closed while the snapshot was rendering.
    if (!isMountedRef.current) return
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
        {!drawing ? (
          <Button type="button" size="sm" variant="default" onClick={startDrawing}>
            Dibujar techo
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="default" onClick={finishDrawing} disabled={drawingVertices.length < 3}>
              Terminar techo ({drawingVertices.length})
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={undoVertex} disabled={drawingVertices.length === 0}>
              <Undo2 className="mr-1 size-4" /> Deshacer punto
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelDrawing}>
              Cancelar dibujo
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="outline" onClick={autoFill} disabled={areas.length === 0}>
          <Zap className="mr-1 size-4" /> Auto-llenar paneles
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Orientación</Label>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={orientacion}
            onChange={(e) => changeOrientacion(e.target.value as Orientacion)}
          >
            <option value="vertical">Vertical</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" className="bg-mirac-red hover:bg-mirac-red-dark" onClick={handleApply} disabled={saving || totalPanels === 0}>
            {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
            Aplicar a la cotización ({totalPanels} paneles)
          </Button>
        </div>
      </div>

      {drawing ? (
        <div className="border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          Haz clic en el mapa para marcar las esquinas del techo. Con 3 o más puntos, pulsa &quot;Terminar techo&quot;.
        </div>
      ) : areas.length > 0 ? (
        <div className="border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
          {selectedArea
            ? 'Arrastra los puntos del techo para ajustarlo. Haz clic en un panel para quitarlo. Cambiar el techo, la rotación o la separación vuelve a colocar todos los paneles.'
            : 'Haz clic en un techo para editarlo.'}
        </div>
      ) : null}

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
              onClick={drawing ? addVertex : deselect}
              options={{ mapTypeId: 'satellite', tilt: 0, disableDefaultUI: false, zoomControl: true, draggableCursor: drawing ? 'crosshair' : undefined }}
            >
              {/* In-progress roof being drawn */}
              {drawing && drawingVertices.length >= 3 && (
                <Polygon
                  paths={drawingVertices}
                  options={{ fillColor: '#facc15', fillOpacity: 0.1, strokeColor: '#facc15', strokeWeight: 2, clickable: false }}
                />
              )}
              {drawing && drawingVertices.length === 2 && (
                <Polyline
                  path={drawingVertices}
                  options={{ strokeColor: '#facc15', strokeWeight: 2 }}
                />
              )}
              {/* Committed roofs + their panels */}
              {areas.map((area) => {
                const selected = area.id === selectedAreaId && !drawing
                return (
                  <div key={area.id}>
                    <Polygon
                      paths={area.vertices}
                      onLoad={(poly) => polygonRefs.current.set(area.id, poly)}
                      onUnmount={() => polygonRefs.current.delete(area.id)}
                      onClick={() => { if (!drawing) setSelectedAreaId(area.id) }}
                      onMouseUp={() => { if (selected) syncAreaPath(area.id) }}
                      options={{
                        fillColor: '#facc15',
                        fillOpacity: selected ? 0.18 : 0.08,
                        strokeColor: '#facc15',
                        strokeWeight: selected ? 4 : 2,
                        clickable: !drawing,
                        editable: selected,
                      }}
                    />
                    {area.panels.map((p, i) => (
                      <Polygon
                        key={`${area.id}-p-${p.lat}-${p.lng}`}
                        paths={panelCorners(p, w, h, area.rotation_deg)}
                        onClick={selected ? () => deletePanel(area.id, i) : undefined}
                        options={{ fillColor: '#2563eb', fillOpacity: 0.85, strokeColor: '#93c5fd', strokeWeight: 0.5, clickable: selected }}
                      />
                    ))}
                  </div>
                )
              })}
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
          {selectedArea && (
            <div className="space-y-3 rounded-md border border-mirac-yellow-dark/40 bg-muted/40 p-3">
              <p className="text-xs font-medium">Techo {selectedIndex + 1} seleccionado</p>
              <div className="space-y-1">
                <Label className="text-xs">Rotación de filas: {selectedArea.rotation_deg}°</Label>
                <input
                  type="range" min={-90} max={90} step={5} value={selectedArea.rotation_deg}
                  aria-label="Rotación de filas"
                  className="w-full"
                  onChange={(e) => setAreaRotation(selectedArea.id, Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Separación filas: {selectedArea.row_gap_m.toFixed(2)} m</Label>
                <input
                  type="range" min={0} max={2} step={0.05} value={selectedArea.row_gap_m}
                  aria-label="Separación entre filas"
                  className="w-full"
                  onChange={(e) => setAreaRowGap(selectedArea.id, Number(e.target.value))}
                />
              </div>
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => refillArea(selectedArea.id)}>
                <Zap className="mr-1 size-4" /> Rellenar paneles
              </Button>
            </div>
          )}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium">Techos ({areas.length})</p>
            {areas.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center justify-between rounded-sm px-1 text-xs ${a.id === selectedAreaId ? 'bg-muted font-medium' : ''}`}
              >
                <button
                  type="button"
                  className="flex-1 py-0.5 text-left"
                  onClick={() => { if (!drawing) setSelectedAreaId(a.id) }}
                >
                  Techo {i + 1}: {a.panels.length}p · {Math.round(a.area_m2)} m²
                </button>
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
