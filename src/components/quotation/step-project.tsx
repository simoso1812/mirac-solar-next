'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { projectSchema, type ProjectFormValues } from '@/lib/schemas'
import { useQuotationStore } from '@/stores/quotation-store'
import { CIUDADES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InteractiveMap } from '@/components/interactive-map'
import { MapPin, ArrowLeft, ArrowRight, Loader2, Sun } from 'lucide-react'

export function StepProject() {
  const { projectData, setProjectData, setStep } = useQuotationStore()

  const [isFetchingHSP, setIsFetchingHSP] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    projectData.lat != null && projectData.lon != null
      ? { lat: projectData.lat, lon: projectData.lon }
      : null
  )
  const [hspData, setHspData] = useState<number[] | null>(projectData.hsp_mensual_pvgis)
  const [hspSource, setHspSource] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: projectData,
  })

  const fetchPVGIS = useCallback(async (lat: number, lon: number) => {
    setIsFetchingHSP(true)
    try {
      const res = await fetch(`/api/pvgis?lat=${lat}&lon=${lon}`)
      if (res.ok) {
        const data = await res.json()
        setHspData(data.hsp)
        setHspSource(data.source)
      }
    } catch {
      // silent — will use city-based HSP
    } finally {
      setIsFetchingHSP(false)
    }
  }, [])

  const handleLocationChange = useCallback(
    (lat: number, lng: number) => {
      setCoords({ lat, lon: lng })
      fetchPVGIS(lat, lng)
    },
    [fetchPVGIS]
  )

  const onSubmit = (data: ProjectFormValues) => {
    setProjectData({
      ...data,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      hsp_mensual_pvgis: hspData,
      map_url: null, // no longer using static map
    })
    setStep(2)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5 text-mirac-red" />
          Parámetros del Proyecto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <select
                id="ciudad"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('ciudad')}
              >
                {CIUDADES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.ciudad && (
                <p className="text-sm text-destructive">{errors.ciudad.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion_label">Ubicación (opcional)</Label>
              <Input
                id="ubicacion_label"
                placeholder="Ej: Bodega principal"
                {...register('ubicacion_label')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" type="date" {...register('fecha')} />
              {errors.fecha && (
                <p className="text-sm text-destructive">{errors.fecha.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="plantilla">Plantilla</Label>
              <select
                id="plantilla"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('plantilla')}
              >
                <option value="standard">Estándar</option>
                <option value="premium">Premium</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
          </div>

          {/* Interactive Map */}
          <div className="space-y-3 rounded-lg border p-4">
            <Label className="text-base font-medium">
              <MapPin className="mr-1 inline size-4" />
              Ubicación del Proyecto
            </Label>
            <p className="text-xs text-muted-foreground">
              Busca la dirección o haz clic en el mapa para colocar el pin. Puedes arrastrar el pin para ajustar.
            </p>

            <InteractiveMap
              initialLat={coords?.lat}
              initialLng={coords?.lon}
              onLocationChange={handleLocationChange}
            />
          </div>

          {/* PVGIS HSP Data */}
          {isFetchingHSP && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Obteniendo datos de irradiancia solar (PVGIS)...
            </div>
          )}

          {hspData && !isFetchingHSP && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Sun className="size-4 text-mirac-yellow" />
                <Label className="text-base font-medium">
                  Irradiancia Solar (HSP)
                </Label>
                <span className="rounded bg-mirac-yellow/20 px-2 py-0.5 text-xs font-medium text-mirac-yellow">
                  {hspSource === 'pvgis' ? 'PVGIS' : 'Estimado'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map(
                  (mes, i) => (
                    <div key={mes} className="rounded bg-muted p-2 text-center">
                      <p className="text-xs text-muted-foreground">{mes}</p>
                      <p className="text-sm font-bold">{hspData[i]}</p>
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Promedio: {(hspData.reduce((a, b) => a + b, 0) / 12).toFixed(2)} kWh/m²/día.
                Estos datos reemplazarán los valores por defecto de la ciudad en el cálculo.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(0)}>
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
  )
}
