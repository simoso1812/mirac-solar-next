/**
 * Golden-master suite for the financial engine.
 *
 * These tests lock down the numbers that go into client proposals and signed
 * contracts. Snapshot changes are NEVER routine — a diff here means quoted
 * TIR/VPN/payback/cuota values changed for clients.
 */
import { describe, it, expect } from 'vitest'
import { cotizacion, buildInputFromStore, pmt } from '@/lib/calculator'
import type { CotizacionInput } from '@/lib/calculator'
import { initialProjectData, initialTechnicalData, initialAdvancedData, deepMerge } from '@/lib/defaults'
import { PROMEDIOS_COSTO } from '@/lib/constants'
import type { CalculationResults } from '@/lib/types'

function baseInput(overrides: Partial<CotizacionInput> = {}): CotizacionInput {
  return {
    consumoMensualKwh: 800,
    potenciaPanelW: 615,
    factorSeguridad: 1.1,
    ciudad: 'MEDELLIN',
    cubierta: 'METALICA',
    clima: 'TEMPLADO',
    costoKwh: 850,
    indexRate: 0.05,
    discountRate: 0.1,
    percFinanciamiento: 0,
    tasaInteresCredito: 0.12,
    plazoCreditoMeses: 60,
    incluirBaterias: false,
    costoKwhBateria: 400000,
    capacidadBateriaKwh: 0,
    profundidadDescarga: 0.9,
    eficienciaBateria: 0.95,
    horasAutonomia: 48,
    horizonteTiempo: 25,
    incluirBeneficiosTributarios: false,
    incluirDeduccionRenta: false,
    incluirDepreciacionAcelerada: false,
    precioManual: null,
    demora6Meses: false,
    hspMensualPVGIS: null,
    modoConexion: 'net_metering',
    precioExcedentes: 300,
    tasaDegradacion: 0.001,
    porcentajeMantenimiento: 0.05,
    performanceRatioBase: 0.75,
    marcaInversor: 'Automatico',
    marcaInversorCustom: '',
    modeloInversor: '',
    marcaPanel: '',
    modeloPanel: '',
    overridePaneles: null,
    overrideInversores: null,
    medidorBidireccional: false,
    ...overrides,
  }
}

/** Stable, rounded view of headline metrics (the numbers clients see). */
function headline(r: CalculationResults) {
  return {
    kwp: Number(r.kwp.toFixed(3)),
    numero_paneles: r.numero_paneles,
    generacion_anual_kwh: Math.round(r.generacion_anual_kwh),
    costo_total_cop: r.costo_total_cop,
    ahorro_anual_cop: r.ahorro_anual_cop,
    ahorro_mensual_cop: r.ahorro_mensual_cop,
    roi_porcentaje: Number(r.roi_porcentaje.toFixed(2)),
    payback_anios: Number(r.payback_anios.toFixed(2)),
    tir: Number(r.tir.toFixed(2)),
    vpn: Math.round(r.vpn),
    bateria: r.bateria
      ? {
          capacidad_nominal_kwh: Number(r.bateria.capacidad_nominal_kwh.toFixed(2)),
          capacidad_util_kwh: Number(r.bateria.capacidad_util_kwh.toFixed(2)),
          horas_autonomia: Number(r.bateria.horas_autonomia.toFixed(2)),
          costo_cop: r.bateria.costo_cop,
        }
      : null,
  }
}

/** Stable, rounded view of the year-by-year table (first rows + totals). */
function tableSummary(r: CalculationResults) {
  const rows = r.flujo_caja
  const year = (n: number) => {
    const row = rows.find((x) => x.anio === n)
    if (!row) return null
    return {
      anio: row.anio,
      generacion_kwh: Math.round(row.generacion_kwh),
      ahorro_cop: Math.round(row.ahorro_cop),
      excedentes_cop: Math.round(row.excedentes_cop),
      mantenimiento_cop: Math.round(row.mantenimiento_cop),
      cuota_financiamiento_cop: Math.round(row.cuota_financiamiento_cop),
      flujo_neto_cop: Math.round(row.flujo_neto_cop),
    }
  }
  return {
    year0_flujo: Math.round(rows[0]?.flujo_neto_cop ?? 0),
    year1: year(1),
    year2: year(2),
    final_acumulado: Math.round(rows[rows.length - 1]?.flujo_acumulado_cop ?? 0),
  }
}

const MODES = ['net_metering', 'net_billing', 'autoconsumo'] as const

describe('golden masters: connection mode x battery x financing', () => {
  for (const modo of MODES) {
    for (const bateria of [false, true]) {
      for (const financiado of [false, true]) {
        const name = `${modo} | bateria=${bateria} | financiado=${financiado}`
        it(name, () => {
          const r = cotizacion(
            baseInput({
              modoConexion: modo,
              incluirBaterias: bateria,
              capacidadBateriaKwh: bateria ? 10 : 0,
              percFinanciamiento: financiado ? 70 : 0,
              tasaInteresCredito: 0.15,
              plazoCreditoMeses: 60,
            })
          )
          expect(headline(r)).toMatchSnapshot('headline')
          expect(tableSummary(r)).toMatchSnapshot('table')
        })
      }
    }
  }
})

describe('golden masters: tax benefit toggles', () => {
  const cases: Array<[string, Partial<CotizacionInput>]> = [
    ['solo deduccion renta', { incluirBeneficiosTributarios: true, incluirDeduccionRenta: true }],
    ['solo depreciacion', { incluirBeneficiosTributarios: true, incluirDepreciacionAcelerada: true }],
    [
      'ambos beneficios',
      { incluirBeneficiosTributarios: true, incluirDeduccionRenta: true, incluirDepreciacionAcelerada: true },
    ],
  ]
  for (const [name, overrides] of cases) {
    it(name, () => {
      const r = cotizacion(baseInput(overrides))
      expect(headline(r)).toMatchSnapshot('headline')
      expect(tableSummary(r)).toMatchSnapshot('table')
    })
  }

  it('children without master flag are ignored', () => {
    const off = cotizacion(baseInput())
    const gatedOff = cotizacion(
      baseInput({
        incluirBeneficiosTributarios: false,
        incluirDeduccionRenta: true,
        incluirDepreciacionAcelerada: true,
      })
    )
    expect(headline(gatedOff)).toEqual(headline(off))
  })
})

describe('depreciation rule (audit X4 — Simon-confirmed 2026-06)', () => {
  // Depreciation is a deduction: cash value = expense x 35% renta, on the
  // pre-IVA basis. Accelerated = 33.33%/yr x 3y; toggle off = 10%/yr x 10y.
  const benefitInYear = (withDep: CalculationResults, without: CalculationResults, anio: number) => {
    const a = withDep.flujo_caja.find((row) => row.anio === anio)!.flujo_neto_cop
    const b = without.flujo_caja.find((row) => row.anio === anio)!.flujo_neto_cop
    return a - b
  }

  it('accelerated: 33.33%/yr x 3 years on pre-IVA basis x 35% renta', () => {
    const off = cotizacion(baseInput())
    const on = cotizacion(
      baseInput({ incluirBeneficiosTributarios: true, incluirDepreciacionAcelerada: true })
    )
    const baseDepreciable = on.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
    const expectedPerYear = baseDepreciable * (1 / 3) * 0.35
    for (const anio of [1, 2, 3]) {
      expect(benefitInYear(on, off, anio)).toBeCloseTo(expectedPerYear, 0)
    }
    expect(benefitInYear(on, off, 4)).toBeCloseTo(0, 0)
    // Total over 3 years ~= 35% of the pre-IVA basis, never ~99% of CAPEX.
    const total = expectedPerYear * 3
    expect(total / on.costo_total_cop).toBeLessThan(0.35)
  })

  it('toggle off: normal linear depreciation, 10%/yr x 10 years', () => {
    const off = cotizacion(baseInput())
    // Master on (renta payer) but accelerated off -> normal schedule applies.
    const normal = cotizacion(baseInput({ incluirBeneficiosTributarios: true }))
    const baseDepreciable = normal.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
    const expectedPerYear = baseDepreciable * 0.1 * 0.35
    for (const anio of [1, 5, 10]) {
      expect(benefitInYear(normal, off, anio)).toBeCloseTo(expectedPerYear, 0)
    }
    expect(benefitInYear(normal, off, 11)).toBeCloseTo(0, 0)
  })

  it('deduccion renta: 50% x 35% renta on the pre-IVA basis, indexed, year 2', () => {
    // Both runs carry normal depreciation; the diff isolates the deduction.
    const sinDeduccion = cotizacion(baseInput({ incluirBeneficiosTributarios: true }))
    const conDeduccion = cotizacion(
      baseInput({ incluirBeneficiosTributarios: true, incluirDeduccionRenta: true })
    )
    const baseSinIva = conDeduccion.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
    // indexRate 0.05, applied at i === 1 (anio 2): base x 1.05 x 0.175
    expect(benefitInYear(conDeduccion, sinDeduccion, 2)).toBeCloseTo(baseSinIva * 1.05 * 0.175, 0)
    expect(benefitInYear(conDeduccion, sinDeduccion, 1)).toBeCloseTo(0, 0)
    expect(benefitInYear(conDeduccion, sinDeduccion, 3)).toBeCloseTo(0, 0)
  })
})

describe('financing: Excel-verified fixture (AGENTS.md item 24)', () => {
  // Simon's Excel: 76.8M financed @ 15% EA, 60 months → cuota $1.789.308.
  // precioManual 96M at 80% financed = 76.8M.
  const input = baseInput({
    precioManual: 96_000_000,
    percFinanciamiento: 80,
    tasaInteresCredito: 0.15,
    plazoCreditoMeses: 60,
  })

  it('engine cuota matches the Excel value', () => {
    const r = cotizacion(input)
    const cuotaY1 = r.flujo_caja.find((row) => row.anio === 1)!.cuota_financiamiento_cop
    const cuotaMensual = cuotaY1 / 12
    expect(Math.abs(cuotaMensual - 1_789_308)).toBeLessThanOrEqual(15)
  })

  it('results.financiamiento exposes the same figures (PDF/web/MCP source)', () => {
    const r = cotizacion(input)
    const fin = r.financiamiento!
    expect(fin).not.toBeNull()
    expect(Math.abs(fin.cuota_mensual_cop - 1_789_308)).toBeLessThanOrEqual(15)
    expect(fin.monto_financiado_cop).toBe(76_800_000)
    expect(fin.desembolso_inicial_cop).toBe(96_000_000 - 76_800_000)
    expect(fin.num_pagos).toBe(60)
    expect(fin.total_pagado_cop).toBe(fin.cuota_mensual_cop * 60)
    expect(fin.total_intereses_cop).toBe(fin.total_pagado_cop - 76_800_000)
    // Same cuota the year-1 table row carries.
    const cuotaY1 = r.flujo_caja.find((row) => row.anio === 1)!.cuota_financiamiento_cop
    expect(fin.cuota_mensual_cop * 12).toBe(cuotaY1)
  })

  it('financiamiento is null without credit', () => {
    const r = cotizacion(baseInput())
    expect(r.financiamiento).toBeNull()
  })

  it('pmt() with geometric EA conversion reproduces the cuota directly', () => {
    const tasaMensual = Math.pow(1.15, 1 / 12) - 1
    const cuota = Math.abs(pmt(tasaMensual, 60, -76_800_000))
    expect(Math.abs(cuota - 1_789_308)).toBeLessThanOrEqual(15)
  })

  it('nominal /12 conversion does NOT match (the old PDF bug)', () => {
    const cuotaNominal = Math.abs(pmt(0.15 / 12, 60, -76_800_000))
    expect(Math.abs(cuotaNominal - 1_789_308)).toBeGreaterThan(30_000)
  })
})

describe('battery savings cap (AGENTS.md item 25)', () => {
  it('savings never exceed the value of what the system generates', () => {
    // Deliberately undersized array (factor 0.6): battery cannot create energy.
    const r = cotizacion(
      baseInput({
        incluirBaterias: true,
        capacidadBateriaKwh: 20,
        factorSeguridad: 0.6,
      })
    )
    const valorGeneracion = r.generacion_anual_kwh * 850
    expect(r.ahorro_anual_cop).toBeLessThanOrEqual(valorGeneracion + 1)
    // And metrics stay sane — the old bug produced TIR ~310%.
    expect(r.tir).toBeLessThan(100)
  })
})

describe('headline vs year-by-year table consistency (audit X2)', () => {
  // The table and the headline metrics must describe the SAME cash flow.
  // sum(table year flows) must equal the headline's total returns
  // (reconstructed from ROI: totalReturns = roi * desembolsoInicial).

  function sumsFor(input: CotizacionInput) {
    const r = cotizacion(input)
    const desembolso =
      input.precioManual && input.percFinanciamiento > 0
        ? r.costo_total_cop - Math.ceil(r.costo_total_cop * (input.percFinanciamiento / 100))
        : r.costo_total_cop
    const headlineTotal = (r.roi_porcentaje / 100) * desembolso
    const tableTotal = r.flujo_caja
      .filter((row) => row.anio >= 1)
      .reduce((s, row) => s + row.flujo_neto_cop, 0)
    return { headlineTotal, tableTotal, r }
  }

  it('net metering with surplus: table flow total equals headline flow total', () => {
    const { headlineTotal, tableTotal } = sumsFor(baseInput({ factorSeguridad: 1.3 }))
    expect(tableTotal / headlineTotal).toBeCloseTo(1, 3)
  })

  it('net billing with surplus: table flow total equals headline flow total', () => {
    const { headlineTotal, tableTotal } = sumsFor(
      baseInput({ modoConexion: 'net_billing', factorSeguridad: 1.3 })
    )
    expect(tableTotal / headlineTotal).toBeCloseTo(1, 3)
  })

  it('demora6Meses: table reflects the first-year haircut the headline applies', () => {
    const { headlineTotal, tableTotal } = sumsFor(baseInput({ demora6Meses: true }))
    expect(tableTotal / headlineTotal).toBeCloseTo(1, 3)
  })

  it('table break-even year matches payback_anios within a year', () => {
    const { r } = sumsFor(baseInput({ factorSeguridad: 1.3 }))
    const breakEven = r.flujo_caja.find((row) => row.flujo_acumulado_cop >= 0)?.anio ?? Infinity
    expect(Math.abs(breakEven - r.payback_anios)).toBeLessThanOrEqual(1)
  })
})

describe('loan term in months (audit X3)', () => {
  it('an 18-month plazo amortizes over exactly 18 payments', () => {
    const advanced = deepMerge(initialAdvancedData, {
      financiamiento: {
        habilitado: true,
        tasa_interes: 0.15,
        plazo_meses: 18,
        porcentaje_financiado: 0.8,
      },
      precio_manual: 96_000_000,
    })
    const technical = deepMerge(initialTechnicalData, { consumo_mensual_kwh: 800 })
    const input = buildInputFromStore(technical, initialProjectData, advanced)
    const r = cotizacion(input)

    const tasaMensual = Math.pow(1.15, 1 / 12) - 1
    const cuota18 = Math.ceil(Math.abs(pmt(tasaMensual, 18, -76_800_000)))
    const cuotaY1 = r.flujo_caja.find((row) => row.anio === 1)!.cuota_financiamiento_cop
    expect(cuotaY1 / 12).toBeCloseTo(cuota18, 0)

    // Year 2 carries only the remaining 6 cuotas; year 3 none.
    const cuotaY2 = r.flujo_caja.find((row) => row.anio === 2)!.cuota_financiamiento_cop
    const cuotaY3 = r.flujo_caja.find((row) => row.anio === 3)!.cuota_financiamiento_cop
    expect(cuotaY2).toBeCloseTo(cuota18 * 6, 0)
    expect(cuotaY3).toBe(0)
  })
})

describe('buildInputFromStore', () => {
  it('maps defaults without surprises', () => {
    const input = buildInputFromStore(
      deepMerge(initialTechnicalData, { consumo_mensual_kwh: 500 }),
      initialProjectData,
      initialAdvancedData
    )
    expect(input.consumoMensualKwh).toBe(500)
    expect(input.ciudad).toBe('MEDELLIN')
    expect(input.clima).toBe('TEMPLADO')
    expect(input.modoConexion).toBe('net_metering')
    expect(input.percFinanciamiento).toBe(0) // financiamiento disabled
    // master on + both children on by default
    expect(input.incluirBeneficiosTributarios).toBe(true)
    expect(input.incluirDeduccionRenta).toBe(true)
    expect(input.incluirDepreciacionAcelerada).toBe(true)
  })

  it('tax children are gated by the master toggle', () => {
    const advanced = deepMerge(initialAdvancedData, { beneficios_tributarios: false })
    const input = buildInputFromStore(initialTechnicalData, initialProjectData, advanced)
    expect(input.incluirBeneficiosTributarios).toBe(false)
    expect(input.incluirDeduccionRenta).toBe(false)
    expect(input.incluirDepreciacionAcelerada).toBe(false)
  })
})
