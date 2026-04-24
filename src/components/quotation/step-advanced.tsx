'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { advancedSchema, type AdvancedFormValues } from '@/lib/schemas'
import { useQuotationStore } from '@/stores/quotation-store'
import { INVERTER_DATABASE } from '@/lib/constants'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { formatCOP } from '@/lib/formatting'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  SlidersHorizontal, ArrowLeft, ArrowRight, ChevronDown, ChevronUp,
  Plug, DollarSign, Settings2, Plus, Trash2,
} from 'lucide-react'

export function StepAdvanced() {
  const { advancedData, technicalData, projectData, setAdvancedData, setStep } = useQuotationStore()
  const [showAdvancedParams, setShowAdvancedParams] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<AdvancedFormValues>({
    resolver: zodResolver(advancedSchema),
    defaultValues: advancedData,
  })

  const financiamientoHabilitado = watch('financiamiento.habilitado')
  const bateriaHabilitada = watch('bateria.habilitada')
  const modoConexion = watch('modo_conexion')
  const marcaInversor = watch('marca_inversor')

  const onSubmit = (data: AdvancedFormValues) => {
    setAdvancedData(data)
    setStep(4)
  }

  const brandInfo = INVERTER_DATABASE[marcaInversor]

  // Run the real calculator to get the exact price that will appear on the quote
  const formValues = watch()
  const calcResults = useMemo(() => {
    if (technicalData.consumo_mensual_kwh <= 0) return null
    // Build advanced data from current form state (not yet submitted)
    const currentAdvanced = { ...advancedData, ...formValues, precio_manual: null } as typeof advancedData
    const input = buildInputFromStore(technicalData, projectData, currentAdvanced)
    // Force no manual price so we see the calculated price
    input.precioManual = null
    return cotizacion(input)
  }, [technicalData, projectData, advancedData, formValues])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-mirac-red" />
          Opciones Avanzadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ─── Connection Mode ─── */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Plug className="h-4 w-4" />
              Modo de Conexión
            </Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                { value: 'net_metering' as const, label: 'Net Metering', desc: 'Excedentes valorados al mismo precio de compra (1:1)' },
                { value: 'net_billing' as const, label: 'Net Billing', desc: 'Excedentes a precio reducido' },
                { value: 'autoconsumo' as const, label: 'Autoconsumo', desc: 'Sin venta de excedentes' },
              ]).map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setValue('modo_conexion', mode.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    modoConexion === mode.value
                      ? 'border-mirac-red bg-mirac-red/5'
                      : 'border-input hover:bg-accent'
                  }`}
                >
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* ─── Financial Parameters ─── */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <DollarSign className="h-4 w-4" />
              Parámetros Financieros
            </Label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="costo_kwh">Tarifa Energía (COP/kWh)</Label>
                <Input
                  id="costo_kwh"
                  type="number"
                  min={1}
                  max={5000}
                  step={1}
                  {...register('costo_kwh', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="indexacion_energia">Indexación Anual (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="indexacion_energia"
                    type="number"
                    min={0}
                    max={20}
                    step={0.5}
                    value={Number((watch('indexacion_energia') * 100).toFixed(1))}
                    onChange={(e) => setValue('indexacion_energia', Number(e.target.value) / 100)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tasa_descuento">Tasa de Descuento (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="tasa_descuento"
                    type="number"
                    min={0}
                    max={25}
                    step={0.5}
                    value={Number((watch('tasa_descuento') * 100).toFixed(1))}
                    onChange={(e) => setValue('tasa_descuento', Number(e.target.value) / 100)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="horizonte_anios">Horizonte de Análisis</Label>
                <select
                  id="horizonte_anios"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={watch('horizonte_anios')}
                  onChange={(e) => setValue('horizonte_anios', Number(e.target.value))}
                >
                  <option value={15}>15 años</option>
                  <option value={20}>20 años</option>
                  <option value={25}>25 años</option>
                  <option value={30}>30 años</option>
                  <option value={35}>35 años</option>
                  <option value={40}>40 años</option>
                </select>
              </div>
              {modoConexion === 'net_billing' && (
                <div className="space-y-2">
                  <Label htmlFor="precio_excedentes">Precio Excedentes (COP/kWh)</Label>
                  <Input
                    id="precio_excedentes"
                    type="number"
                    min={0}
                    max={2000}
                    step={10}
                    {...register('precio_excedentes', { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* ─── Inverter Configuration ─── */}
          <div className="space-y-3">
            <Label htmlFor="marca_inversor">Marca del Inversor</Label>
            <select
              id="marca_inversor"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('marca_inversor')}
              onChange={(e) => {
                register('marca_inversor').onChange(e)
                const brand = e.target.value
                if (brand === 'Automatico') {
                  setValue('override_inversores', null)
                  setValue('modelo_inversor', '')
                } else if (brand === 'Otro') {
                  setValue('override_inversores', [{ potencia_kw: 10, cantidad: 1 }])
                } else {
                  const db = INVERTER_DATABASE[brand]
                  const defaultKw = db?.models[4]?.potencia_kw ?? db?.models[0]?.potencia_kw ?? 10
                  setValue('override_inversores', [{ potencia_kw: defaultKw, cantidad: 1 }])
                  setValue('modelo_inversor', '')
                }
              }}
            >
              {Object.entries(INVERTER_DATABASE).map(([key, brand]) => (
                <option key={key} value={key}>
                  {brand.flag ? `${brand.flag} ` : ''}{brand.label}
                  {brand.type ? ` — ${brand.type}` : ''}
                </option>
              ))}
            </select>

            {/* Custom brand/model text fields — shown when brand is Otro */}
            {marcaInversor === 'Otro' && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                <div className="space-y-2">
                  <Label htmlFor="marca_inversor_custom" className="text-xs">Nombre de Marca</Label>
                  <Input
                    id="marca_inversor_custom"
                    type="text"
                    placeholder="Ej: SMA, Fronius, GoodWe"
                    {...register('marca_inversor_custom')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelo_inversor_custom" className="text-xs">Modelo</Label>
                  <Input
                    id="modelo_inversor_custom"
                    type="text"
                    placeholder="Ej: Sunny Tripower 25000TL"
                    {...register('modelo_inversor')}
                  />
                </div>
              </div>
            )}

            {/* Manual inverter config — shown when brand is not Automatico */}
            {marcaInversor !== 'Automatico' && watch('override_inversores') != null && (() => {
              const overrides = watch('override_inversores')!
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
                  {overrides.map((inv, idx) => {
                    const model = availableModels.find((m) => m.potencia_kw === inv.potencia_kw)
                    return (
                      <div key={idx} className="flex items-center gap-2">
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
                            className="h-9 w-9 p-0"
                            onClick={() => {
                              setValue('override_inversores', overrides.filter((_, i) => i !== idx))
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setValue('override_inversores', [...overrides, { potencia_kw: availableKw[0], cantidad: 1 }])
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar Inversor
                    </Button>
                    <span className="text-xs font-medium text-muted-foreground">
                      Total AC: {totalAcKw} kW
                    </span>
                  </div>
                </div>
              )
            })()}

            {/* Auto mode info */}
            {marcaInversor === 'Automatico' && (
              <p className="text-xs text-muted-foreground">
                El sistema seleccionará automáticamente la mejor combinación de inversores Huawei.
              </p>
            )}
          </div>

          {/* Smart meter */}
          <div className="flex items-center justify-between">
            <Label htmlFor="medidor_inteligente">Medidor Inteligente</Label>
            <Switch
              id="medidor_inteligente"
              checked={watch('medidor_inteligente')}
              onCheckedChange={(checked) => setValue('medidor_inteligente', checked)}
            />
          </div>

          {/* Bidirectional meter */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="medidor_bidireccional">Medidor Bidireccional</Label>
              <p className="text-xs text-muted-foreground">
                Cambio de medidor con la empresa de energía (+{formatCOP(1_300_000)})
              </p>
            </div>
            <Switch
              id="medidor_bidireccional"
              checked={watch('medidor_bidireccional')}
              onCheckedChange={(checked) => setValue('medidor_bidireccional', checked)}
            />
          </div>

          <Separator />

          {/* ─── Financing ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Financiamiento</Label>
              <Switch
                checked={financiamientoHabilitado}
                onCheckedChange={(checked) => setValue('financiamiento.habilitado', checked)}
              />
            </div>

            {financiamientoHabilitado && (
              <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Tasa Interés Anual (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={Number((watch('financiamiento.tasa_interes') * 100).toFixed(1))}
                    onChange={(e) => setValue('financiamiento.tasa_interes', Number(e.target.value) / 100)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plazo (meses)</Label>
                  <Input
                    type="number"
                    min={12}
                    max={240}
                    step={12}
                    {...register('financiamiento.plazo_meses', { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>% Financiado</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Number((watch('financiamiento.porcentaje_financiado') * 100).toFixed(0))}
                    onChange={(e) => setValue('financiamiento.porcentaje_financiado', Number(e.target.value) / 100)}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Battery ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Baterías</Label>
              <Switch
                checked={bateriaHabilitada}
                onCheckedChange={(checked) => setValue('bateria.habilitada', checked)}
              />
            </div>

            {bateriaHabilitada && (
              <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Capacidad (kWh)</Label>
                  <Input type="number" min={1} step={1} {...register('bateria.capacidad_kwh', { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Prof. Descarga (%)</Label>
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    step={5}
                    value={Number((watch('bateria.profundidad_descarga') * 100).toFixed(0))}
                    onChange={(e) => setValue('bateria.profundidad_descarga', Number(e.target.value) / 100)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Eficiencia (%)</Label>
                  <Input
                    type="number"
                    min={80}
                    max={100}
                    step={1}
                    value={Number((watch('bateria.eficiencia') * 100).toFixed(0))}
                    onChange={(e) => setValue('bateria.eficiencia', Number(e.target.value) / 100)}
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Tax Benefits ─── */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Beneficios Tributarios</Label>
              <p className="text-sm text-muted-foreground">
                Deducción de renta (17.5% CAPEX) y depreciación acelerada (33% x 3 años)
              </p>
            </div>
            <Switch
              checked={watch('beneficios_tributarios')}
              onCheckedChange={(checked) => setValue('beneficios_tributarios', checked)}
            />
          </div>

          {/* ─── 6-month delay ─── */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Demora 6 Meses en Conexión</Label>
              <p className="text-sm text-muted-foreground">
                Reduce los beneficios del primer año al 50%
              </p>
            </div>
            <Switch
              checked={watch('demora_6_meses')}
              onCheckedChange={(checked) => setValue('demora_6_meses', checked)}
            />
          </div>

          <Separator />

          {/* ─── Manual Price ─── */}
          <div className="space-y-2">
            <Label htmlFor="precio_manual">Precio Manual (COP, opcional)</Label>
            <Input
              id="precio_manual"
              type="number"
              min={1000000}
              step={100000}
              placeholder="Dejar vacío para calcular automáticamente"
              value={watch('precio_manual') ?? ''}
              onChange={(e) => {
                const val = e.target.value
                setValue('precio_manual', val === '' ? null : Number(val))
              }}
            />
            <p className="text-xs text-muted-foreground">
              Si se especifica, reemplaza el cálculo automático del costo del proyecto.
            </p>

            {/* Estimated price reference — uses the real calculator */}
            {calcResults && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Precio calculado</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {calcResults.kwp.toFixed(1)} kWp · {formatCOP(calcResults.costo_por_kwp_cop)}/kWp
                  </span>
                </div>
                <p className="font-mono text-lg font-bold tabular-nums">
                  {formatCOP(calcResults.costo_total_cop)}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Advanced Technical Parameters (collapsible) ─── */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              className="flex w-full items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Parámetros Técnicos Avanzados
              </span>
              {showAdvancedParams ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showAdvancedParams && (
              <div className="mt-3 grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Degradación Anual (%)</Label>
                  <Input
                    type="number"
                    min={0.01}
                    max={1}
                    step={0.01}
                    value={Number((watch('tasa_degradacion') * 100).toFixed(2))}
                    onChange={(e) => setValue('tasa_degradacion', Number(e.target.value) / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Pérdida anual de eficiencia de los paneles (típico: 0.1%)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Mantenimiento (% del ahorro)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={15}
                    step={1}
                    value={Number((watch('porcentaje_mantenimiento') * 100).toFixed(0))}
                    onChange={(e) => setValue('porcentaje_mantenimiento', Number(e.target.value) / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Porcentaje del ahorro anual para mantenimiento (típico: 5%)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Performance Ratio Base</Label>
                  <Input
                    type="number"
                    min={50}
                    max={95}
                    step={1}
                    value={Number((watch('performance_ratio_base') * 100).toFixed(0))}
                    onChange={(e) => setValue('performance_ratio_base', Number(e.target.value) / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Eficiencia base del sistema (típico: 75%). Se ajusta por clima y cubierta.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ─── Notes ─── */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones adicionales..."
              {...register('notas')}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Anterior
            </Button>
            <Button type="submit" className="bg-mirac-red hover:bg-mirac-red-dark">
              Revisar y Generar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
