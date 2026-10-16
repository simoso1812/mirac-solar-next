export interface PrecioModulo {
  producto: string
  wp: number
  proveedor: string
  precioCop: number
  cotizado: string
}

export interface PrecioInversor {
  producto: string
  kw: number
  tipo: 'on_grid' | 'hibrido'
  proveedor: string
  precioCop: number
  cotizado: string
}

export const PRECIOS_EQUIPOS_LEIDO = '2026-10-14'

// Snapshot of the live equipment sheet. Refresh by re-reading the sheet; do not edit prices by hand.
export const MODULOS: PrecioModulo[] = [
  { producto: 'Jinko Solar: Tiger Neo', wp: 720, proveedor: 'Solaire', precioCop: 400_000, cotizado: '2026-08-04' },
  { producto: 'JA SOLAR', wp: 720, proveedor: 'AmaraNZero', precioCop: 455_810, cotizado: '2026-08-06' },
  { producto: 'LONGI LR8-66HVD645M', wp: 645, proveedor: 'AmaraNZero', precioCop: 422_820, cotizado: '2026-08-06' },
  { producto: 'TRINA', wp: 720, proveedor: 'Meico', precioCop: 388_848, cotizado: '2026-08-24' },
  { producto: 'JA SOLAR', wp: 625, proveedor: 'Meico', precioCop: 357_633, cotizado: '2026-08-24' },
]

export const INVERSORES: PrecioInversor[] = [
  { producto: 'Inversor Goodwee hibridos (bifásico)', kw: 3.5, tipo: 'hibrido', proveedor: 'Mas Light Solar', precioCop: 4_275_720, cotizado: '2026-07-30' },
  { producto: 'Inversor Goodwee hibridos (bifásico)', kw: 7.5, tipo: 'hibrido', proveedor: 'Mas Light Solar', precioCop: 5_967_581, cotizado: '2026-07-30' },
  { producto: 'Inversor Deye hibridos', kw: 8, tipo: 'hibrido', proveedor: 'Mas Light Solar', precioCop: 8_500_000, cotizado: '2026-08-04' },
  { producto: 'Inversor Deye hibridos', kw: 8, tipo: 'hibrido', proveedor: 'Meico Solar', precioCop: 7_151_713, cotizado: '2026-08-24' },
  { producto: 'Inversor Deye hibridos', kw: 6, tipo: 'hibrido', proveedor: 'Mas Light Solar', precioCop: 7_800_000, cotizado: '2026-08-04' },
  { producto: 'Inversor Goodwee hibridos', kw: 18, tipo: 'hibrido', proveedor: 'Ferragro', precioCop: 12_576_421, cotizado: '2026-07-31' },
  { producto: 'Inversor Goodwee hibridos', kw: 12, tipo: 'hibrido', proveedor: 'Ferragro', precioCop: 10_921_641, cotizado: '2026-07-31' },
  { producto: 'Invesror SPE GROWATT', kw: 6, tipo: 'hibrido', proveedor: 'Ferragro', precioCop: 4_260_692, cotizado: '2026-07-31' },
  { producto: 'Invesror SPE GROWATT', kw: 8, tipo: 'hibrido', proveedor: 'Ferragro', precioCop: 4_412_858, cotizado: '2026-07-31' },
  { producto: 'Inversor Goodwee hibridos (monofásico)', kw: 3.5, tipo: 'hibrido', proveedor: 'Ferragro', precioCop: 9_262_320, cotizado: '2026-07-30' },
  { producto: 'Inversor Deye hibridos', kw: 5, tipo: 'hibrido', proveedor: 'Improinde', precioCop: 5_818_033, cotizado: '2026-08-04' },
  { producto: 'Split phase inverter 16K, with wifi CT', kw: 16, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 11_850_300, cotizado: '2026-08-25' },
  { producto: 'Solis Hybrid Split phase inverter 8K', kw: 8, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 7_120_900, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-8K-SG02LP2-US-AM2', kw: 8, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 7_050_800, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-12K-SG02LP2-US-AM3', kw: 12, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 9_155_900, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-5K-SG02LP2-US-AM2', kw: 5, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 6_670_800, cotizado: '2026-08-25' },
  { producto: 'Solis Hybrid Split phase inverter 6K', kw: 6, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 3_945_138, cotizado: '2026-08-25' },
  { producto: 'LIVOLTEK, Hybrid Inverter, 220Vac, 15.0KW', kw: 15, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 7_650_900, cotizado: '2026-08-25' },
  { producto: 'LIVOLTEK, Hybrid Inverter, 220Vac, 10.0KW', kw: 10, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 6_855_900, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-8K-SG04LP3-EU-AM2-LV', kw: 8, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 8_550_325, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-12K-SG04LP3-EU-AM2-LV', kw: 12, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 9_250_000, cotizado: '2026-08-25' },
  { producto: 'Solis 30kW Three phase 220V Hybrid inverter HV battery', kw: 30, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 19_244_800, cotizado: '2026-08-25' },
  { producto: 'Solis 60kW Three phase 220V Hybrid inverter HV battery', kw: 60, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 38_947_233, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-30K-SG01HP3-US-BM4 208V', kw: 30, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 17_800_900, cotizado: '2026-08-25' },
  { producto: 'DEYE SUN-15K-SG01HP3-US-AM2', kw: 15, tipo: 'hibrido', proveedor: 'SOLARITY', precioCop: 9_836_640, cotizado: '2026-08-25' },
  { producto: 'HUAWEI SUN2000-3K-LB0', kw: 3, tipo: 'on_grid', proveedor: 'Solaire', precioCop: 1_590_000, cotizado: '2026-09-07' },
  { producto: 'Growatt', kw: 6, tipo: 'on_grid', proveedor: 'Meico Solar', precioCop: 1_969_494, cotizado: '2026-08-05' },
]

export const DIAS_PRECIO_VIGENTE = 60
const MS_DIA = 86_400_000

export interface CogsSugerido {
  modulosCop: number
  modulo: PrecioModulo
  inversorCop: number | null
  inversor: PrecioInversor | null
  referenciaVieja: boolean
}

function masBarato<T>(xs: T[], costo: (x: T) => number): T | null {
  return xs.reduce<T | null>((best, x) => (best === null || costo(x) < costo(best) ? x : best), null)
}

export function cogsSugerido(
  kwp: number,
  conBateria: boolean,
  hoy: Date,
  modulos: PrecioModulo[] = MODULOS,
  inversores: PrecioInversor[] = INVERSORES,
): CogsSugerido | null {
  if (!Number.isFinite(kwp) || kwp <= 0) return null

  const modulo = masBarato(modulos, (m) => m.precioCop / m.wp)
  if (!modulo) return null
  const paneles = Math.ceil((kwp * 1000) / modulo.wp)

  const tipo = conBateria ? 'hibrido' : 'on_grid'
  const inversor = masBarato(
    inversores.filter((i) => i.tipo === tipo && i.kw >= kwp),
    (i) => i.precioCop,
  )

  const viejo = (fecha: string) => hoy.getTime() - new Date(fecha).getTime() > DIAS_PRECIO_VIGENTE * MS_DIA

  return {
    modulosCop: paneles * modulo.precioCop,
    modulo,
    inversorCop: inversor ? inversor.precioCop : null,
    inversor,
    referenciaVieja: viejo(modulo.cotizado) || (inversor !== null && viejo(inversor.cotizado)),
  }
}
