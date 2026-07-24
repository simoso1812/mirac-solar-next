/**
 * Tests del módulo ETER/EPM: parser y veredicto sobre fixtures reales
 * capturados del servicio ArcGIS de EPM (2026-07-23). El cliente HTTP no se
 * ejerce aquí (servicio externo).
 */
import { describe, it, expect } from 'vitest'
import { parseTrafo, distanceM } from '@/lib/eter/parse'
import { evaluarViabilidad } from '@/lib/eter/veredicto'
import type { ArcgisFeature } from '@/lib/eter/client'

const T = 'SIGMAENERGIA.MOV_VETRANSFO_PT'
const S = 'CREG030.C30_CALCULO_SEMAFORO'

// Trafo real 63465 (ITAGÜÍ, 75 kVA, VERDE-VERDE) — respuesta capturada.
const fixtureVerde: ArcgisFeature = {
  attributes: {
    [`${T}.NRO_TRANSFORMADOR`]: 63465,
    [`${T}.CAPACIDAD_NOMINAL`]: 75.0,
    [`${T}.CARGABILIDAD`]: 42.3,
    [`${T}.MUNICIPIO`]: 'ITAGÜÍ',
    [`${T}.SUBESTACION_CONN`]: 'ITAGUI',
    [`${T}.CIRCUITO_CONN`]: 'I23-105',
    [`${T}.TENSION_CONN`]: '13.2',
    [`${T}.FASES_CONN`]: '3',
    [`${T}.PROPIETARIO`]: 'EPM',
    [`${T}.TIPO_PROPIETARIO`]: 'EPM',
    [`${S}.COLOR_POTENCIA`]: 'VERDE',
    [`${S}.COLOR_ENERGIA`]: 'VERDE',
    [`${S}.COLOR_MIXTO`]: 'VERDE-VERDE',
    [`${S}.VALOR_POTENCIA`]: 0.0,
    [`${S}.VALOR_ENERGIA`]: 0.0,
    [`${S}.SUMATORIA_POTENCIA`]: 0.0,
    [`${S}.SUMATORIA_ENERGIA`]: 0.0,
  },
  geometry: { x: -75.61, y: 6.17 },
}

// Trafo real 46563 (ROJO en potencia: SUMATORIA 27 ≥ 50% de 50 kVA).
const fixtureRojo: ArcgisFeature = {
  attributes: {
    [`${T}.NRO_TRANSFORMADOR`]: 46563,
    [`${T}.CAPACIDAD_NOMINAL`]: 50.0,
    [`${T}.CARGABILIDAD`]: null,
    [`${T}.MUNICIPIO`]: 'MEDELLÍN',
    [`${T}.PROPIETARIO`]: 'PARTICULAR',
    [`${T}.TIPO_PROPIETARIO`]: 'PARTICULAR',
    [`${S}.COLOR_POTENCIA`]: 'ROJO',
    [`${S}.COLOR_ENERGIA`]: 'VERDE',
    [`${S}.COLOR_MIXTO`]: 'ROJO-VERDE',
    [`${S}.VALOR_POTENCIA`]: 54.0,
    [`${S}.VALOR_ENERGIA`]: 0.0,
    [`${S}.SUMATORIA_POTENCIA`]: 27.0,
    [`${S}.SUMATORIA_ENERGIA`]: 0.0,
  },
}

describe('parseTrafo', () => {
  it('mapea el fixture verde a TrafoCapacidad', () => {
    const t = parseTrafo(fixtureVerde)
    expect(t.nroTransformador).toBe(63465)
    expect(t.capacidadNominalKva).toBe(75)
    expect(t.semaforo).toEqual({ potencia: 'VERDE', energia: 'VERDE', mixto: 'VERDE-VERDE' })
    // Cupo CREG 030: 50% de 75 kVA sin nada comprometido.
    expect(t.cupoEstimadoKva).toBeCloseTo(37.5)
    expect(t.municipio).toBe('ITAGÜÍ')
    expect(t.ubicacion).toEqual({ lat: 6.17, lon: -75.61 })
  })

  it('calcula cupo restante con comprometido y tolera nulls', () => {
    const t = parseTrafo(fixtureRojo)
    expect(t.cargabilidadPct).toBeNull()
    expect(t.ubicacion).toBeUndefined()
    // 0.5·50 − 27 = −2 → clampeado a 0.
    expect(t.cupoEstimadoKva).toBe(0)
    expect(t.semaforo.potencia).toBe('ROJO')
  })

  it('marca colores desconocidos como DESCONOCIDO', () => {
    const t = parseTrafo({ attributes: { [`${S}.COLOR_POTENCIA`]: 'MORADO' } })
    expect(t.semaforo.potencia).toBe('DESCONOCIDO')
    expect(t.cupoEstimadoKva).toBeNull()
  })
})

describe('evaluarViabilidad', () => {
  it('verde con cupo suficiente → si', () => {
    const v = evaluarViabilidad(parseTrafo(fixtureVerde), 20)
    expect(v.viable).toBe('si')
    expect(v.kvaDisponiblesEstimados).toBeCloseTo(37.5)
  })

  it('verde pero kWp propuesto excede el cupo → no', () => {
    const v = evaluarViabilidad(parseTrafo(fixtureVerde), 40) // 40/0.95 > 37.5
    expect(v.viable).toBe('no')
  })

  it('semáforo rojo → no, sin importar el kWp', () => {
    const v = evaluarViabilidad(parseTrafo(fixtureRojo), 3)
    expect(v.viable).toBe('no')
    expect(v.notas.join(' ')).toContain('ROJO')
  })

  it('advierte trafo EPM (riesgo de medida indirecta) y nota NT2 >15 kVA', () => {
    const v = evaluarViabilidad(parseTrafo(fixtureVerde))
    const notas = v.notas.join(' ')
    expect(notas).toContain('50M COP')
    expect(notas).toContain('NT2')
  })

  it('no aplica nota NT2 con trafo ≤15 kVA', () => {
    const chico = parseTrafo({
      attributes: {
        ...fixtureVerde.attributes,
        [`${T}.CAPACIDAD_NOMINAL`]: 15.0,
      },
    })
    expect(evaluarViabilidad(chico).notas.join(' ')).not.toContain('NT2')
  })

  it('sin semáforo ni capacidad → indeterminado', () => {
    const v = evaluarViabilidad(parseTrafo({ attributes: {} }))
    expect(v.viable).toBe('indeterminado')
  })

  it('amarillo → condicionado', () => {
    const amarillo = parseTrafo({
      attributes: { ...fixtureVerde.attributes, [`${S}.COLOR_POTENCIA`]: 'AMARILLO' },
    })
    expect(evaluarViabilidad(amarillo).viable).toBe('condicionado')
  })
})

describe('distanceM', () => {
  it('haversine razonable a escala urbana', () => {
    // ~111 m por 0.001° de latitud.
    expect(distanceM(6.24, -75.58, 6.241, -75.58)).toBeGreaterThan(100)
    expect(distanceM(6.24, -75.58, 6.241, -75.58)).toBeLessThan(125)
    expect(distanceM(6.24, -75.58, 6.24, -75.58)).toBe(0)
  })
})
