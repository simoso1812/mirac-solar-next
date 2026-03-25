/**
 * Inverter recommendation — ported from recomendar_inversor()
 */

const INVERTERS_DISPONIBLES = [3, 5, 6, 8, 10, 20, 30, 40, 50, 100]

/**
 * Calculate acceptable inverter margin based on system size
 */
function calcularMargenInversor(sizeKwp: number): number {
  if (sizeKwp < 20) return 0.2
  if (sizeKwp < 50) return 0.25
  if (sizeKwp < 100) return 0.30
  return 0.35
}

/** Round to nearest even number (up if odd) */
export function redondearAPar(numero: number): number {
  const rounded = Math.round(numero)
  return rounded % 2 === 0 ? rounded : rounded + 1
}

export interface InverterResult {
  label: string
  totalPower: number
  combo: Record<number, number>
}

/**
 * Recommend optimal inverter combination to maximize AC power
 * while respecting design rules for different system sizes
 */
export function recomendarInversor(sizeKwp: number): InverterResult {
  if (sizeKwp <= 0) {
    return { label: 'Potencia del sistema no válida.', totalPower: 0, combo: {} }
  }

  const margen = calcularMargenInversor(sizeKwp)
  const minPower = sizeKwp * (1 - margen)
  const maxPower = Math.floor(sizeKwp)

  if (maxPower <= 0) {
    return { label: 'Potencia del sistema demasiado baja.', totalPower: 0, combo: {} }
  }

  let bestCombo: Record<number, number> | null = null
  let bestTotalPower = 0

  // 1. Evaluate single inverters
  for (const inv of INVERTERS_DISPONIBLES) {
    if (inv >= minPower && inv <= maxPower && inv > bestTotalPower) {
      bestCombo = { [inv]: 1 }
      bestTotalPower = inv
    }
  }

  // 2. Evaluate combinations by system size
  if (sizeKwp < 20) {
    // DP algorithm for small systems
    const disponibles = INVERTERS_DISPONIBLES.filter((inv) => inv <= maxPower)
    if (disponibles.length > 0) {
      const dp = new Map<number, Record<number, number>>()
      dp.set(0, {})

      for (const inv of disponibles) {
        const entries = Array.from(dp.entries())
        for (const [total, combo] of entries) {
          const newTotal = total + inv
          if (newTotal <= maxPower) {
            const existingCombo = dp.get(newTotal)
            const existingCount = existingCombo
              ? Object.values(existingCombo).reduce((a, b) => a + b, 0)
              : Infinity
            const newCount = Object.values(combo).reduce((a, b) => a + b, 0) + 1
            if (!existingCombo || existingCount > newCount) {
              const newCombo = { ...combo }
              newCombo[inv] = (newCombo[inv] || 0) + 1
              dp.set(newTotal, newCombo)
            }
          }
        }
      }

      for (let total = maxPower; total >= Math.floor(minPower); total--) {
        const combo = dp.get(total)
        if (combo && total > bestTotalPower) {
          bestCombo = combo
          bestTotalPower = total
          break
        }
      }
    }
  } else if (sizeKwp < 100) {
    // Medium systems: max 2 inverters >= 20kW
    const disponibles = INVERTERS_DISPONIBLES.filter((inv) => inv >= 20 && inv <= maxPower)
    for (let i = 0; i < disponibles.length; i++) {
      for (let j = i; j < disponibles.length; j++) {
        const total = disponibles[i] + disponibles[j]
        if (total >= minPower && total <= maxPower && total > bestTotalPower) {
          bestTotalPower = total
          const combo: Record<number, number> = {}
          combo[disponibles[i]] = (combo[disponibles[i]] || 0) + 1
          combo[disponibles[j]] = (combo[disponibles[j]] || 0) + 1
          bestCombo = combo
        }
      }
    }
  } else {
    // Large systems (>=100 kW): max 3 inverters, secondary >= 25% of total
    const minSecondary = Math.max(20, sizeKwp * 0.25)
    const disponibles = INVERTERS_DISPONIBLES.filter(
      (inv) => inv >= minSecondary && inv <= maxPower
    )

    // Combinations of 2
    for (let i = 0; i < disponibles.length; i++) {
      for (let j = i; j < disponibles.length; j++) {
        const total = disponibles[i] + disponibles[j]
        if (total >= minPower && total <= maxPower && total > bestTotalPower) {
          bestTotalPower = total
          const combo: Record<number, number> = {}
          combo[disponibles[i]] = (combo[disponibles[i]] || 0) + 1
          combo[disponibles[j]] = (combo[disponibles[j]] || 0) + 1
          bestCombo = combo
        }
      }
    }

    // Combinations of 3
    for (let i = 0; i < disponibles.length; i++) {
      for (let j = i; j < disponibles.length; j++) {
        for (let k = j; k < disponibles.length; k++) {
          const total = disponibles[i] + disponibles[j] + disponibles[k]
          if (total >= minPower && total <= maxPower && total > bestTotalPower) {
            bestTotalPower = total
            const combo: Record<number, number> = {}
            combo[disponibles[i]] = (combo[disponibles[i]] || 0) + 1
            combo[disponibles[j]] = (combo[disponibles[j]] || 0) + 1
            combo[disponibles[k]] = (combo[disponibles[k]] || 0) + 1
            bestCombo = combo
          }
        }
      }
    }
  }

  // 3. Format result
  if (!bestCombo) {
    const disponibles = INVERTERS_DISPONIBLES.filter((inv) => inv <= maxPower)
    if (disponibles.length === 0) {
      return { label: 'No hay inversores disponibles.', totalPower: 0, combo: {} }
    }
    const bestSingle = Math.max(...disponibles)
    return { label: `1x${bestSingle}kW`, totalPower: bestSingle, combo: { [bestSingle]: 1 } }
  }

  const partes = Object.entries(bestCombo)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([kw, count]) => `${count}x${Number(kw)}kW`)

  return { label: partes.join(' + '), totalPower: bestTotalPower, combo: bestCombo }
}
