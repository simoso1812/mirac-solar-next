/**
 * Single year-by-year simulation behind BOTH the headline metrics
 * (TIR/VPN/ROI/payback/ahorro_anual) and the detailed cash-flow table.
 *
 * History: these used to be two hand-synchronized loops (index.ts and
 * cashflow.ts) and they drifted — the table omitted surplus income and
 * the demora6Meses haircut that the headline included (audit X2). Any
 * change to the savings model happens here, once.
 */

export interface YearSimParams {
  consumoMensualKwh: number
  costoKwh: number
  precioExcedentes: number // already resolved per connection mode
  indexRate: number
  monthlyGeneration: number[] // 12 months, base (year-1) generation
  horizonte: number
  incluirBaterias: boolean
  tasaDegradacion: number
  porcentajeMantenimiento: number
  cuotaMensualCredito: number
  plazoCreditoMeses: number
  valorProyectoTotal: number
  incluirBeneficiosTributarios: boolean
  incluirDeduccionRenta: boolean
  incluirDepreciacionAcelerada: boolean
  demora6Meses: boolean
}

export interface YearSim {
  year: number // 1-based
  generacionAnualKwh: number
  consumoAnualKwh: number
  excedentesKwh: number
  coberturaConsumoPct: number
  /** Autoconsumo savings in year-1 money (no indexation, no demora). */
  ahorroBase: number
  /** Surplus income in year-1 money (no indexation, no demora). */
  ingresosExcedentesBase: number
  /** Autoconsumo savings, indexed, with the demora haircut applied. */
  ahorroIndexado: number
  /** Surplus income, indexed, with the demora haircut applied. */
  ingresosExcedentesIndexados: number
  mantenimiento: number
  cuotasCredito: number
  beneficioTributario: number
  flujoNeto: number
}

export function simulateYears(p: YearSimParams): YearSim[] {
  const rows: YearSim[] = []
  const consumoAnual = p.consumoMensualKwh * 12

  for (let i = 0; i < p.horizonte; i++) {
    const currentMonthly = p.monthlyGeneration.map(
      (gen) => gen * Math.pow(1 - p.tasaDegradacion, i)
    )
    const generacionAnual = currentMonthly.reduce((a, b) => a + b, 0)

    let ahorroBase = 0
    let excedentesKwh = 0
    if (p.incluirBaterias) {
      // A battery shifts daytime surplus to night-time load, so the system
      // self-consumes nearly all it generates — but a battery cannot create
      // energy: savings are capped by actual generation.
      const autoConsumo = Math.min(generacionAnual, consumoAnual)
      excedentesKwh = Math.max(0, generacionAnual - consumoAnual)
      ahorroBase = autoConsumo * p.costoKwh
    } else {
      // Month by month: full bill saved in overproducing months, surplus
      // sold at the export price; otherwise only what was generated.
      for (const genMes of currentMonthly) {
        if (genMes >= p.consumoMensualKwh) {
          ahorroBase += p.consumoMensualKwh * p.costoKwh
          excedentesKwh += genMes - p.consumoMensualKwh
        } else {
          ahorroBase += genMes * p.costoKwh
        }
      }
    }
    const ingresosExcedentesBase = excedentesKwh * p.precioExcedentes

    const indexFactor = Math.pow(1 + p.indexRate, i)
    const demoraFactor = p.demora6Meses && i === 0 ? 0.5 : 1
    const ahorroIndexado = ahorroBase * indexFactor * demoraFactor
    const ingresosExcedentesIndexados = ingresosExcedentesBase * indexFactor * demoraFactor

    // Maintenance is a % of total income (savings + surplus), same basis
    // the headline metrics always used.
    const mantenimiento = p.porcentajeMantenimiento * (ahorroIndexado + ingresosExcedentesIndexados)

    // Credit honors the plazo in months: a 18-month loan pays 12 cuotas in
    // year 1 and 6 in year 2 (audit X3 — was rounded to whole years).
    const pagosEsteAnio = Math.max(0, Math.min(12, p.plazoCreditoMeses - 12 * i))
    const cuotasCredito = p.cuotaMensualCredito * pagosEsteAnio

    // Tax benefits (Ley 1715) — do NOT change rates without Simon's sign-off.
    let beneficioTributario = 0
    if (p.incluirBeneficiosTributarios) {
      if (p.incluirDeduccionRenta && i === 1) {
        beneficioTributario += p.valorProyectoTotal * indexFactor * 0.175
      }
      if (p.incluirDepreciacionAcelerada && i < 3) {
        beneficioTributario += p.valorProyectoTotal * 0.33
      }
    }

    const flujoNeto =
      ahorroIndexado + ingresosExcedentesIndexados - mantenimiento - cuotasCredito + beneficioTributario

    rows.push({
      year: i + 1,
      generacionAnualKwh: generacionAnual,
      consumoAnualKwh: consumoAnual,
      excedentesKwh,
      coberturaConsumoPct: consumoAnual > 0 ? Math.min(100, (generacionAnual / consumoAnual) * 100) : 0,
      ahorroBase,
      ingresosExcedentesBase,
      ahorroIndexado,
      ingresosExcedentesIndexados,
      mantenimiento,
      cuotasCredito,
      beneficioTributario,
      flujoNeto,
    })
  }

  return rows
}
