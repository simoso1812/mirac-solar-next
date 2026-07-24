/**
 * Veredicto Mirac de viabilidad de conexión FV sobre un transformador EPM,
 * a partir del semáforo CREG 030 y las reglas de negocio conocidas:
 * - Semáforo de potencia = dato autoritativo de EPM.
 * - Ocupación de potencia = comprometido_kW / kVA nominal × 100. Umbrales EPM:
 *   VERDE ≤30 · AMARILLO 30–40 · NARANJA 40–50 · ROJO >50.
 * - Cupo restante hasta el rojo = 0.5·kVA nominal − comprometido.
 * - Trafo compartido/de EPM → riesgo de medida indirecta (migración de
 *   medidor ~50M COP, mata proyectos <100–120 kWp).
 * - Nota NT2 (medida en NT2 si es monousuario) solo aplica con trafo >15 kVA.
 */
import type { SemaforoColor, Simulacion, TrafoCapacidad, Veredicto } from './schemas'

/** Umbrales oficiales EPM de ocupación (% sobre capacidad nominal). */
export function colorPorOcupacion(pct: number): SemaforoColor {
  if (pct <= 30) return 'VERDE'
  if (pct <= 40) return 'AMARILLO'
  if (pct <= 50) return 'NARANJA'
  return 'ROJO'
}

/**
 * Reproduce la "Disponibilidad según potencia" del visor: ocupación que
 * tendría el trafo si se conecta `potenciaPropuestaKw` de generación.
 * Equivale a (comprometido + propuesta) / kVA nominal × 100. Coincide con el
 * popup de EPM para el término de POTENCIA (el de ENERGÍA depende de la
 * cantidad horaria que el usuario declara en el visor y no es derivable aquí).
 */
export function simularConexion(trafo: TrafoCapacidad, potenciaPropuestaKw: number): Simulacion | null {
  const nominal = trafo.capacidadNominalKva
  if (nominal === null || nominal <= 0) return null
  const comprometido = trafo.comprometido.potenciaKw ?? 0
  const ocupacionResultante = ((comprometido + potenciaPropuestaKw) / nominal) * 100
  return {
    potenciaPropuestaKw,
    ocupacionActualPotenciaPct: trafo.ocupacionPotenciaPct,
    ocupacionResultantePotenciaPct: Math.round(ocupacionResultante * 1000) / 1000,
    colorResultante: colorPorOcupacion(ocupacionResultante),
    dentroDelLimite: ocupacionResultante <= 50,
  }
}

export function evaluarViabilidad(trafo: TrafoCapacidad, kwpPropuesto?: number): Veredicto {
  const notas: string[] = []
  const cupo = trafo.cupoEstimadoKva
  const sim = kwpPropuesto !== undefined ? simularConexion(trafo, kwpPropuesto) : null

  // Advertencias Mirac independientes del semáforo.
  const propietarioEpm =
    (trafo.tipoPropietario ?? trafo.propietario ?? '').toUpperCase().includes('EPM') ||
    (trafo.propietario ?? '').toUpperCase().includes('EMPRESAS')
  if (propietarioEpm) {
    notas.push(
      'Trafo de propiedad EPM (probable trafo compartido): si el cliente es monousuario o se exige medida indirecta, la migración de medidor puede costar ~50M COP — validar frontera de medida antes de cotizar.',
    )
  }
  if (trafo.capacidadNominalKva !== null && trafo.capacidadNominalKva > 15) {
    notas.push('Trafo >15 kVA: aplica la nota de propuesta "medida en NT2 si es monousuario del transformador".')
  }
  if (trafo.cargabilidadPct !== null && trafo.cargabilidadPct >= 90) {
    notas.push(`Cargabilidad reportada ${trafo.cargabilidadPct.toFixed(0)}%: trafo cerca de su límite térmico.`)
  }

  // Sin datos del semáforo no hay veredicto confiable.
  if (trafo.semaforo.potencia === 'DESCONOCIDO' && cupo === null) {
    notas.push('EPM no reporta semáforo ni capacidad para este trafo; validar directamente con el operador.')
    return { viable: 'indeterminado', kvaDisponiblesEstimados: null, notas, simulacion: sim }
  }

  if (trafo.semaforo.potencia === 'ROJO') {
    notas.push(
      'Semáforo CREG 030 en ROJO: el cupo de autogeneración del trafo está agotado (comprometido >50% de la capacidad nominal). Conexión AGPE requiere estudio/refuerzo de red de EPM.',
    )
    return { viable: 'no', kvaDisponiblesEstimados: cupo !== null ? Math.max(0, cupo) : 0, notas, simulacion: sim }
  }

  const parcial = trafo.semaforo.potencia === 'AMARILLO' || trafo.semaforo.potencia === 'NARANJA'

  // Con propuesta: comparamos con el método real de EPM (ocupación resultante
  // ≤ 50% de la capacidad nominal), igual que el popup del visor.
  if (sim !== null) {
    if (sim.dentroDelLimite) {
      notas.push(
        `Con ${kwpPropuesto} kW propuestos la ocupación de potencia quedaría en ${sim.ocupacionResultantePotenciaPct}% (${sim.colorResultante}); dentro del límite CREG 030 del 50%.`,
      )
      return {
        viable: sim.colorResultante === 'VERDE' ? 'si' : 'condicionado',
        kvaDisponiblesEstimados: cupo,
        notas: sim.colorResultante === 'VERDE'
          ? notas
          : [...notas, `Quedaría en ${sim.colorResultante}: cupo parcialmente comprometido; confirmar con EPM antes de firmar.`],
        simulacion: sim,
      }
    }
    notas.push(
      `Con ${kwpPropuesto} kW propuestos la ocupación de potencia subiría a ${sim.ocupacionResultantePotenciaPct}% (ROJO), superando el límite CREG 030 del 50%. El sistema excede el cupo del trafo (${cupo?.toFixed(1) ?? '?'} kW disponibles).`,
    )
    return { viable: 'no', kvaDisponiblesEstimados: cupo, notas, simulacion: sim }
  }

  // Sin kWp propuesto: reportar el cupo y el color.
  if (parcial) {
    notas.push(
      `Semáforo ${trafo.semaforo.potencia}: hay cupo pero parcialmente comprometido (ocupación ${trafo.ocupacionPotenciaPct?.toFixed(1) ?? '?'}%); confirmar con EPM.`,
    )
    return { viable: 'condicionado', kvaDisponiblesEstimados: cupo, notas, simulacion: sim }
  }
  notas.push('Semáforo VERDE: hay cupo de autogeneración disponible en el trafo.')
  return { viable: 'si', kvaDisponiblesEstimados: cupo, notas, simulacion: sim }
}
