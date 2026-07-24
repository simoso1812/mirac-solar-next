/**
 * Veredicto Mirac de viabilidad de conexión FV sobre un transformador EPM,
 * a partir del semáforo CREG 030 y las reglas de negocio conocidas:
 * - Semáforo de potencia = dato autoritativo de EPM.
 * - Cupo estimado = 0.5·kVA nominal − comprometido (regla CREG 030 del 50%).
 * - Trafo compartido/de EPM → riesgo de medida indirecta (migración de
 *   medidor ~50M COP, mata proyectos <100–120 kWp).
 * - Nota NT2 (medida en NT2 si es monousuario) solo aplica con trafo >15 kVA.
 */
import type { TrafoCapacidad, Veredicto } from './schemas'

/** Factor de potencia asumido para convertir kWp FV a kVA en el trafo. */
const FP = 0.95

export function evaluarViabilidad(trafo: TrafoCapacidad, kwpPropuesto?: number): Veredicto {
  const notas: string[] = []
  const cupo = trafo.cupoEstimadoKva
  const kvaNecesarios = kwpPropuesto !== undefined ? kwpPropuesto / FP : null

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
    return { viable: 'indeterminado', kvaDisponiblesEstimados: null, notas }
  }

  if (trafo.semaforo.potencia === 'ROJO') {
    notas.push(
      'Semáforo CREG 030 en ROJO: el cupo de autogeneración del trafo está agotado (comprometido ≥50% de la capacidad nominal). Conexión AGPE requiere estudio/refuerzo de red de EPM.',
    )
    return { viable: 'no', kvaDisponiblesEstimados: cupo !== null ? Math.max(0, cupo) : 0, notas }
  }

  if (kvaNecesarios !== null && cupo !== null) {
    if (kvaNecesarios <= cupo) {
      notas.push(
        `Cupo estimado ${cupo.toFixed(1)} kVA ≥ ${kvaNecesarios.toFixed(1)} kVA requeridos (${kwpPropuesto} kWp @ FP ${FP}).`,
      )
      return {
        viable: trafo.semaforo.potencia === 'AMARILLO' ? 'condicionado' : 'si',
        kvaDisponiblesEstimados: cupo,
        notas:
          trafo.semaforo.potencia === 'AMARILLO'
            ? [...notas, 'Semáforo AMARILLO: cupo parcialmente comprometido; confirmar con EPM antes de firmar.']
            : notas,
      }
    }
    notas.push(
      `Cupo estimado ${cupo.toFixed(1)} kVA < ${kvaNecesarios.toFixed(1)} kVA requeridos: el sistema propuesto (${kwpPropuesto} kWp) excede el 50% disponible del trafo.`,
    )
    return { viable: 'no', kvaDisponiblesEstimados: cupo, notas }
  }

  // Sin kWp propuesto: reportar el cupo y el color.
  if (trafo.semaforo.potencia === 'AMARILLO') {
    notas.push('Semáforo AMARILLO: hay cupo pero parcialmente comprometido; confirmar con EPM.')
    return { viable: 'condicionado', kvaDisponiblesEstimados: cupo, notas }
  }
  notas.push('Semáforo VERDE: hay cupo de autogeneración disponible en el trafo.')
  return { viable: 'si', kvaDisponiblesEstimados: cupo, notas }
}
