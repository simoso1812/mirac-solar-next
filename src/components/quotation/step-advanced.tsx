'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { advancedSchema, type AdvancedFormValues } from '@/lib/schemas'
import { useQuotationStore } from '@/stores/quotation-store'
import { COGS_KEYS, initialAdvancedData } from '@/lib/defaults'
import { INVERTER_DATABASE, PROMEDIOS_COSTO } from '@/lib/constants'
import { cotizacion, buildInputFromStore, MEDIDOR_BIDIRECCIONAL_COP } from '@/lib/calculator/index'
import { cogsSugerido } from '@/lib/equipment-prices'
import { difiereDeSugerido, margenBruto, MARGEN_MINIMO, precioParaMargen } from '@/lib/proposal-disclosure'
import { formatCOP, formatCOPShort } from '@/lib/formatting'
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
import { InverterOverrideSection } from '@/components/quotation/advanced/inverter-override-section'
import { ImagesSection } from '@/components/quotation/advanced/images-section'

// Positional keys for the controlled, append/remove-only PPA option rows.
// This list is fully form-controlled and never reordered, so a position-based
// key is correct here.
const ROW_KEYS = Array.from({ length: 64 }, (_, i) => `row-${i}`)

const COGS_ETIQUETAS: Record<(typeof COGS_KEYS)[number], string> = {
  cogs_modulos_cop: 'Módulos (COP)',
  cogs_inversor_cop: 'Inversor (COP)',
  cogs_bos_cop: 'BOS (COP)',
  cogs_instalacion_cop: 'Instalación (COP)',
}
const COGS_CAMPOS = COGS_KEYS.map((name) => ({ name, label: COGS_ETIQUETAS[name] }))

const CAMPOS_SUGERIDOS = ['cogs_modulos_cop', 'cogs_inversor_cop'] as const
type CampoSugerido = (typeof CAMPOS_SUGERIDOS)[number]

export function StepAdvanced() {
  const { advancedData, technicalData, projectData, setAdvancedData, setStep } = useQuotationStore()
  const [showAdvancedParams, setShowAdvancedParams] = useState(false)

  const form = useForm<AdvancedFormValues>({
    resolver: zodResolver(advancedSchema),
    defaultValues: {
      ...initialAdvancedData,
      ...advancedData,
      financiamiento: { ...initialAdvancedData.financiamiento, ...advancedData.financiamiento },
      bateria: { ...initialAdvancedData.bateria, ...advancedData.bateria },
      ppa: {
        habilitada: advancedData.ppa?.habilitada ?? initialAdvancedData.ppa.habilitada,
        opciones: advancedData.ppa?.opciones?.length
          ? advancedData.ppa.opciones
          : initialAdvancedData.ppa.opciones,
      },
      imagenes: advancedData.imagenes ?? initialAdvancedData.imagenes,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = form

  const financiamientoHabilitado = watch('financiamiento.habilitado')
  const bateriaHabilitada = watch('bateria.habilitada')
  const horasIngresadas = watch('bateria.horas_autonomia')
  const autonomiaManual = Number.isFinite(horasIngresadas) && horasIngresadas > 0
  const ppaHabilitada = watch('ppa.habilitada')
  const ppaOpciones = watch('ppa.opciones')
  const modoConexion = watch('modo_conexion')
  const marcaInversor = watch('marca_inversor')
  const beneficiosTributarios = watch('beneficios_tributarios')
  const incluirDeduccionRenta = watch('incluir_deduccion_renta')
  const incluirDepreciacionAcelerada = watch('incluir_depreciacion_acelerada')

  const onSubmit = (data: AdvancedFormValues) => {
    setAdvancedData({
      ...data,
      beneficios_tributarios: data.incluir_deduccion_renta || data.incluir_depreciacion_acelerada,
    })
    setStep(4)
  }

  const setAllTaxBenefits = (enabled: boolean) => {
    setValue('beneficios_tributarios', enabled)
    setValue('incluir_deduccion_renta', enabled)
    setValue('incluir_depreciacion_acelerada', enabled)
  }

  const setTaxBenefit = (
    field: 'incluir_deduccion_renta' | 'incluir_depreciacion_acelerada',
    enabled: boolean,
  ) => {
    const otherEnabled = field === 'incluir_deduccion_renta'
      ? incluirDepreciacionAcelerada
      : incluirDeduccionRenta
    setValue(field, enabled)
    setValue('beneficios_tributarios', enabled || otherEnabled)
  }

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

  const kwpCalculado = calcResults?.kwp ?? 0
  const sugerido = useMemo(
    () => cogsSugerido(kwpCalculado, bateriaHabilitada, new Date()),
    [kwpCalculado, bateriaHabilitada],
  )

  // Last value the pre-fill wrote per field. A field absent from the map holds a
  // stored or user-typed number and is never replaced by the suggestion.
  const ultimoPrellenado = useRef<Partial<Record<CampoSugerido, number | null>> | null>(null)
  useEffect(() => {
    const nuevos: Record<CampoSugerido, number | null> = {
      cogs_modulos_cop: sugerido?.modulosCop ?? null,
      cogs_inversor_cop: sugerido?.inversorCop ?? null,
    }
    if (ultimoPrellenado.current === null) {
      const stored: Record<CampoSugerido, number | null> = {
        cogs_modulos_cop: advancedData.cogs_modulos_cop ?? null,
        cogs_inversor_cop: advancedData.cogs_inversor_cop ?? null,
      }
      const inicial: Partial<Record<CampoSugerido, number | null>> = {}
      for (const campo of CAMPOS_SUGERIDOS) {
        if (stored[campo] !== null) continue
        setValue(campo, nuevos[campo])
        inicial[campo] = nuevos[campo]
      }
      ultimoPrellenado.current = inicial
      return
    }
    const previo = ultimoPrellenado.current
    for (const campo of CAMPOS_SUGERIDOS) {
      if (!(campo in previo)) continue
      if (getValues(campo) !== previo[campo]) {
        delete previo[campo]
        continue
      }
      setValue(campo, nuevos[campo])
      previo[campo] = nuevos[campo]
    }
  }, [sugerido, advancedData.cogs_modulos_cop, advancedData.cogs_inversor_cop, getValues, setValue])

  const precioMargen = calcResults
    ? precioParaMargen(
        {
          totalCurvaCop: calcResults.costo_total_cop,
          precioManualCop: formValues.precio_manual,
          costoBateriaCop: calcResults.bateria?.costo_cop ?? 0,
          medidorCop: formValues.medidor_bidireccional ? MEDIDOR_BIDIRECCIONAL_COP : 0,
        },
        PROMEDIOS_COSTO.iva_rate,
      )
    : null
  const hayPrecioMargen = precioMargen !== null && Number.isFinite(precioMargen) && precioMargen > 0
  const margen = hayPrecioMargen
    ? margenBruto(precioMargen, COGS_KEYS.map((key) => formValues[key] ?? null))
    : null
  const precioManualSinCubrir = calcResults !== null && (formValues.precio_manual ?? 0) > 0 && !hayPrecioMargen

  const avisosCogs: Partial<Record<(typeof COGS_KEYS)[number], string>> = {}
  if (sugerido && difiereDeSugerido(formValues.cogs_modulos_cop ?? null, sugerido.modulosCop)) {
    avisosCogs.cogs_modulos_cop = `El costo de módulos no coincide con el tamaño actual del sistema (sugerido ${formatCOPShort(sugerido.modulosCop, false)}).`
  }
  if (sugerido && sugerido.inversorCop !== null && difiereDeSugerido(formValues.cogs_inversor_cop ?? null, sugerido.inversorCop)) {
    avisosCogs.cogs_inversor_cop = `El costo del inversor no coincide con el sugerido para este sistema (${formatCOPShort(sugerido.inversorCop, false)}).`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="size-5 text-mirac-red" />
          Opciones Avanzadas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ─── Connection Mode ─── */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Plug className="size-4" />
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
              <DollarSign className="size-4" />
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
            <InverterOverrideSection form={form} />

            {/* Auto mode info */}
            {marcaInversor === 'Automatico' && (
              <p className="text-xs text-muted-foreground">
                El sistema seleccionará automáticamente la mejor combinación de inversores Huawei.
              </p>
            )}
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
                  <Label>Tasa EA (Efectiva Anual) (%)</Label>
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
                  <Label>Capacidad nominal (kWh)</Label>
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
                <div className="space-y-2 sm:col-span-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Label>Calcular la autonomía automáticamente</Label>
                      <p className="text-xs text-muted-foreground">
                        {autonomiaManual
                          ? 'Autonomía manual: se muestra el valor que indiques abajo.'
                          : 'Se calcula a partir de la capacidad de la batería y el consumo del cliente.'}
                      </p>
                    </div>
                    <Switch
                      checked={!autonomiaManual}
                      onCheckedChange={(auto) => setValue('bateria.horas_autonomia', auto ? 0 : 8)}
                    />
                  </div>
                </div>
                {autonomiaManual && (
                  <div className="space-y-2">
                    <Label>Horas de autonomía</Label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      step={1}
                      {...register('bateria.horas_autonomia', { valueAsNumber: true })}
                    />
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label>Costo por kWh (COP)</Label>
                  <Input
                    type="number"
                    min={100000}
                    max={2000000}
                    step={10000}
                    {...register('bateria.costo_kwh_bateria', { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">Se suma un costo fijo de $3.000.000 por instalación de baterías.</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── PPA (Opción Cero Inversión) ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">PPA: Opción Cero Inversión</Label>
                <p className="text-sm text-muted-foreground">
                  Mostrar al cliente la opción de pagar solo por la energía generada, sin inversión inicial.
                </p>
              </div>
              <Switch
                checked={ppaHabilitada}
                onCheckedChange={(checked) => setValue('ppa.habilitada', checked)}
              />
            </div>

            {ppaHabilitada && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">
                  Define una o más ofertas PPA para presentar al cliente. El precio debe ser menor al de la
                  red ({formValues.costo_kwh} COP/kWh).
                </p>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-3 text-xs font-medium text-muted-foreground">
                  <span>Precio energía Mirac (COP/kWh)</span>
                  <span>Duración del contrato (años)</span>
                  <span />
                </div>
                {(ppaOpciones ?? []).map((_, idx) => (
                  <div key={ROW_KEYS[idx]} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={10000}
                      step="any"
                      {...register(`ppa.opciones.${idx}.precio_kwh`, { valueAsNumber: true })}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={40}
                      step={1}
                      {...register(`ppa.opciones.${idx}.duracion_anios`, { valueAsNumber: true })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={(ppaOpciones?.length ?? 0) <= 1}
                      onClick={() =>
                        setValue(
                          'ppa.opciones',
                          (ppaOpciones ?? []).filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setValue('ppa.opciones', [
                      ...(ppaOpciones ?? []),
                      { precio_kwh: 600, duracion_anios: 15 },
                    ])
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Agregar opción PPA
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Tax Benefits ─── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Beneficios Tributarios</Label>
                <p className="text-sm text-muted-foreground">
                  Activa la deducción de renta y/o la depreciación acelerada de Ley 1715.
                </p>
              </div>
              <Switch
                checked={beneficiosTributarios}
                onCheckedChange={(checked) => setAllTaxBenefits(Boolean(checked))}
              />
            </div>

            {beneficiosTributarios && (
              <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Deducción de renta</Label>
                    <p className="text-xs text-muted-foreground">17.5% del valor sin IVA (50% × renta 35%)</p>
                  </div>
                  <Switch
                    checked={incluirDeduccionRenta}
                    onCheckedChange={(checked) => setTaxBenefit('incluir_deduccion_renta', Boolean(checked))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Depreciación acelerada</Label>
                    <p className="text-xs text-muted-foreground">Deprecia en 3 años en vez de 10; beneficio = gasto × 35% renta</p>
                  </div>
                  <Switch
                    checked={incluirDepreciacionAcelerada}
                    onCheckedChange={(checked) => setTaxBenefit('incluir_depreciacion_acelerada', Boolean(checked))}
                  />
                </div>
              </div>
            )}
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

          {/* ─── Internal COGS (never shared) ─── */}
          <div className="space-y-3">
            <div>
              <Label className="text-base font-semibold">Costo interno</Label>
              <p className="text-sm text-muted-foreground">No sale en el link del cliente.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {COGS_CAMPOS.map((campo) => (
                <div key={campo.name} className="space-y-2">
                  <Label htmlFor={campo.name}>{campo.label}</Label>
                  <Input
                    id={campo.name}
                    type="number"
                    min={0}
                    step={1}
                    value={watch(campo.name) ?? ''}
                    onChange={(e) => {
                      const n = Number(e.target.value)
                      setValue(campo.name, e.target.value === '' || !Number.isFinite(n) ? null : n)
                    }}
                  />
                  {avisosCogs[campo.name] && (
                    <p className="text-xs font-medium text-destructive">{avisosCogs[campo.name]}</p>
                  )}
                </div>
              ))}
            </div>
            {sugerido && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Sugerido: {formatCOPShort(sugerido.modulosCop, false)} — {sugerido.modulo.producto} {sugerido.modulo.wp} W, {sugerido.modulo.proveedor}, cotizado {sugerido.modulo.cotizado}.
                </p>
                <p>
                  {sugerido.inversor && sugerido.inversorCop !== null
                    ? `Sugerido: ${formatCOPShort(sugerido.inversorCop, false)} — ${sugerido.inversor.producto} (${sugerido.inversor.kw} kW), ${sugerido.inversor.proveedor}, cotizado ${sugerido.inversor.cotizado}.`
                    : `Ningún inversor del sheet cubre ${kwpCalculado.toFixed(1).replace('.', ',')} kWp por sí solo; escribe el costo.`}
                </p>
                {sugerido.referenciaVieja && (
                  <p>Precio de referencia viejo: la cotización tiene más de 60 días.</p>
                )}
              </div>
            )}
            <p className={`text-sm ${precioManualSinCubrir || (margen && margen.margen < MARGEN_MINIMO) ? 'font-medium text-destructive' : ''}`}>
              {precioManualSinCubrir
                ? 'El precio manual no cubre batería y medidor.'
                : !hayPrecioMargen
                  ? 'Sin precio calculado todavía.'
                  : margen
                    ? `Margen bruto ${(margen.margen * 100).toFixed(1).replace('.', ',')}%.${margen.margen < MARGEN_MINIMO ? ' Está por debajo del 50%.' : ''}`
                    : 'Completa los cuatro costos para ver el margen.'}
            </p>
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
                <Settings2 className="size-4" />
                Parámetros Técnicos Avanzados
              </span>
              {showAdvancedParams ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
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

          <Separator />

          {/* ─── Project Images ─── */}
          <ImagesSection form={form} />

          <Separator />

          {/* ─── Notes ─── */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              placeholder="Observaciones adicionales..."
              {...register('notas')}
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Hay campos con errores. Revisa:</p>
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(errors).map(([key, err]) => (
                  <li key={key}>
                    {key}: {(err as { message?: string })?.message ?? 'inválido'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="mr-2 size-4" />
              Anterior
            </Button>
            <Button type="submit" className="bg-mirac-red hover:bg-mirac-red-dark">
              Revisar y Generar
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
