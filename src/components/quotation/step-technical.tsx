'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { technicalSchema, type TechnicalFormValues } from '@/lib/schemas'
import { useQuotationStore } from '@/stores/quotation-store'
import { HSP_POR_CIUDAD, DEFAULT_PARAMS } from '@/lib/constants'
import { redondearAPar } from '@/lib/calculator/inverter'
import { formatKWp, formatKWh, formatNumber } from '@/lib/formatting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Settings, ArrowLeft, ArrowRight, Zap, Sun, Hash, Map as MapIcon } from 'lucide-react'
import { RoofDesigner } from './roof-designer'
import type { RoofDesign } from '@/lib/types'

export function StepTechnical() {
  const { technicalData, projectData, setTechnicalData, setStep } = useQuotationStore()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<TechnicalFormValues>({
    resolver: zodResolver(technicalSchema),
    defaultValues: technicalData,
  })

  const watched = useWatch({ control })
  const consumo = watched.consumo_mensual_kwh ?? 0
  const potenciaPanel = watched.potencia_panel_w ?? 580
  const factorSeg = watched.factor_seguridad ?? 1.1
  const overridePaneles = watched.override_paneles

  const [designerOpen, setDesignerOpen] = useState(false)
  const anchoM = watched.ancho_m ?? 1.13
  const altoM = watched.alto_m ?? 2.38
  const disenoTecho = watched.diseno_techo as RoofDesign | null | undefined
  const cubierta = (watched.tipo_cubierta ?? 'metalica') as 'metalica' | 'teja' | 'losa'

  // Live calculation preview
  const hsp = HSP_POR_CIUDAD[projectData.ciudad] ?? 4.5
  const eficiencia = DEFAULT_PARAMS.eficiencia_sistema_estimacion
  const kwpRaw = consumo > 0 ? (consumo / (hsp * 30 * eficiencia)) * factorSeg : 0
  const panelesCalc = kwpRaw > 0 ? redondearAPar(Math.ceil(kwpRaw / (potenciaPanel / 1000))) : 0
  const paneles = overridePaneles ?? panelesCalc
  const kwp = paneles * (potenciaPanel / 1000)
  const generacionEstimada = kwp * hsp * 30 * eficiencia

  // A saved roof design's panel centers were packed for a specific panel size.
  // If the user changes the panel dimensions, that geometry (centers + count)
  // is no longer valid, so we clear the design and force a re-run of the
  // designer. We skip the very first render so loading a saved design (which
  // sets ancho_m/alto_m at mount time) doesn't wipe it.
  const prevDimsRef = useRef<{ ancho: number; alto: number } | null>(null)
  useEffect(() => {
    const prev = prevDimsRef.current
    prevDimsRef.current = { ancho: anchoM, alto: altoM }
    if (prev === null) return
    if (prev.ancho !== anchoM || prev.alto !== altoM) {
      setValue('diseno_techo', null)
    }
  }, [anchoM, altoM, setValue])

  const onSubmit = (data: TechnicalFormValues) => {
    setTechnicalData(data)
    setStep(3)
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5 text-mirac-red" />
          Especificaciones Técnicas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Consumption */}
          <div className="space-y-2">
            <Label htmlFor="consumo_mensual_kwh">Consumo Mensual (kWh)</Label>
            <Input
              id="consumo_mensual_kwh"
              type="number"
              placeholder="Ej: 500"
              {...register('consumo_mensual_kwh', { valueAsNumber: true })}
            />
            {errors.consumo_mensual_kwh && (
              <p className="text-sm text-destructive">{errors.consumo_mensual_kwh.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Panel wattage — manual input */}
            <div className="space-y-2">
              <Label htmlFor="potencia_panel_w">Potencia del Panel (W)</Label>
              <Input
                id="potencia_panel_w"
                type="number"
                min={300}
                max={1000}
                step={5}
                placeholder="Ej: 615"
                {...register('potencia_panel_w', { valueAsNumber: true })}
              />
              {errors.potencia_panel_w && (
                <p className="text-sm text-destructive">{errors.potencia_panel_w.message}</p>
              )}
            </div>

            {/* Panel brand */}
            <div className="space-y-2">
              <Label htmlFor="marca_panel">Marca del Panel (opcional)</Label>
              <Input
                id="marca_panel"
                type="text"
                placeholder="Ej: Jinko, Longi, Trina"
                {...register('marca_panel')}
              />
            </div>

            {/* Panel model */}
            <div className="space-y-2">
              <Label htmlFor="modelo_panel">Modelo del Panel (opcional)</Label>
              <Input
                id="modelo_panel"
                type="text"
                placeholder="Ej: Tiger Neo 615W"
                {...register('modelo_panel')}
              />
            </div>

            {/* Panel width */}
            <div className="space-y-2">
              <Label htmlFor="ancho_m">Ancho del panel (m)</Label>
              <Input id="ancho_m" type="number" step={0.01} min={0.3} max={3}
                {...register('ancho_m', { valueAsNumber: true })} />
              {errors.ancho_m && <p className="text-sm text-destructive">{errors.ancho_m.message}</p>}
            </div>

            {/* Panel height */}
            <div className="space-y-2">
              <Label htmlFor="alto_m">Alto del panel (m)</Label>
              <Input id="alto_m" type="number" step={0.01} min={0.3} max={3}
                {...register('alto_m', { valueAsNumber: true })} />
              {errors.alto_m && <p className="text-sm text-destructive">{errors.alto_m.message}</p>}
            </div>

            {/* Safety factor */}
            <div className="space-y-2">
              <Label>Factor de Seguridad: {factorSeg?.toFixed(2) ?? '1.10'}</Label>
              <input
                type="range"
                aria-label="Factor de seguridad"
                min={1.0}
                max={1.5}
                step={0.05}
                value={factorSeg ?? 1.1}
                onChange={(e) => setValue('factor_seguridad', Number(e.target.value))}
                className="w-full h-2 appearance-none rounded-full bg-muted outline-none cursor-pointer accent-mirac-red"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1.00</span>
                <span>1.50</span>
              </div>
            </div>

            {/* Roof type */}
            <div className="space-y-2">
              <Label htmlFor="tipo_cubierta">Tipo de Cubierta</Label>
              <select
                id="tipo_cubierta"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('tipo_cubierta')}
              >
                <option value="metalica">Metálica / Lámina</option>
                <option value="teja">Teja</option>
                <option value="losa">Losa / Concreto</option>
              </select>
            </div>

            {/* Climate */}
            <div className="space-y-2">
              <Label htmlFor="clima">Clima Predominante</Label>
              <select
                id="clima"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('clima')}
              >
                <option value="templado">Templado</option>
                <option value="calido">Cálido / Soleado</option>
                <option value="frio">Frío / Nublado</option>
              </select>
            </div>
          </div>

          {/* Manual panel override */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="override-toggle" className="text-sm font-medium">
                Definir cantidad de paneles manualmente
              </Label>
              <Switch
                id="override-toggle"
                checked={overridePaneles != null}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setValue('override_paneles', panelesCalc || 10)
                  } else {
                    // Clear the roof design too: the calculator only reads
                    // override_paneles, so a lingering diseno_techo would be
                    // silently ignored while still showing in the web/PDF.
                    setValue('override_paneles', null)
                    setValue('diseno_techo', null)
                  }
                }}
              />
            </div>
            {overridePaneles != null && (
              <div className="space-y-2">
                <Input
                  type="number"
                  min={2}
                  max={5000}
                  step={1}
                  value={overridePaneles}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    if (Number.isNaN(parsed)) return
                    // Clamp to the schema bounds so the live preview never
                    // reflects an out-of-range count before form submit.
                    setValue('override_paneles', Math.max(2, Math.min(5000, parsed)))
                  }}
                />
                {panelesCalc > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cálculo automático: {formatNumber(panelesCalc)} paneles
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Roof designer */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Diseño del techo (opcional)</Label>
                <p className="text-xs text-muted-foreground">
                  Dibuja el techo en el mapa para ubicar los paneles reales. El total reemplaza la cantidad.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDesignerOpen(true)}
                disabled={projectData.lat == null || projectData.lon == null}
              >
                <MapIcon className="mr-2 size-4" />
                Diseñar en el mapa
              </Button>
            </div>
            {projectData.lat == null && (
              <p className="text-xs text-destructive">Primero fija la ubicación en el paso Proyecto.</p>
            )}
            {disenoTecho && disenoTecho.areas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Diseño guardado: {disenoTecho.total_panels} paneles · {Math.round(disenoTecho.total_area_m2)} m²
                en {disenoTecho.areas.length} techo(s).
              </p>
            )}
          </div>

          {/* Live preview */}
          {consumo > 0 && (
            <div className="rounded-lg border border-mirac-yellow/30 bg-mirac-yellow/5 p-4">
              <p className="mb-3 text-sm font-semibold text-mirac-yellow-dark">
                Vista Previa del Dimensionamiento
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-mirac-yellow" />
                  <div>
                    <p className="text-xs text-muted-foreground">Potencia</p>
                    <p className="text-sm font-bold">{formatKWp(kwp)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-mirac-yellow" />
                  <div>
                    <p className="text-xs text-muted-foreground">Paneles</p>
                    <p className="text-sm font-bold">{formatNumber(paneles)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="size-4 text-mirac-yellow" />
                  <div>
                    <p className="text-xs text-muted-foreground">Generación Est.</p>
                    <p className="text-sm font-bold">{formatKWh(Math.round(generacionEstimada))}/mes</p>
                  </div>
                </div>
              </div>
              {generacionEstimada > 0 && (
                <div className="mt-2">
                  <Badge variant={generacionEstimada >= consumo ? 'default' : 'secondary'}>
                    {generacionEstimada >= consumo
                      ? `Cubre ${Math.round((generacionEstimada / consumo) * 100)}% del consumo`
                      : `Cubre ${Math.round((generacionEstimada / consumo) * 100)}% del consumo`}
                  </Badge>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 size-4" />
              Anterior
            </Button>
            <Button type="submit" className="bg-mirac-red hover:bg-mirac-red-dark">
              Siguiente
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    {designerOpen && projectData.lat != null && projectData.lon != null && (
      <RoofDesigner
        lat={projectData.lat}
        lng={projectData.lon}
        potenciaPanelW={potenciaPanel}
        tipoCubierta={cubierta}
        anchoM={anchoM}
        altoM={altoM}
        panelesSugeridos={panelesCalc}
        initialDesign={disenoTecho ?? null}
        onClose={() => setDesignerOpen(false)}
        onApply={(design) => {
          setValue('diseno_techo', design)
          setValue('override_paneles', design.total_panels)
          setDesignerOpen(false)
        }}
      />
    )}
    </>
  )
}
