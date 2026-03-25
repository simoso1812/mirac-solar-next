/**
 * Financial math functions — pure TypeScript replacements for numpy_financial
 */

/**
 * PMT — calculate fixed monthly payment for a loan
 * Equivalent to numpy_financial.pmt(rate, nper, pv)
 */
export function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return -pv / nper
  const factor = Math.pow(1 + rate, nper)
  return (-pv * rate * factor) / (factor - 1)
}

/**
 * NPV — net present value of a cash flow series
 * Equivalent to numpy_financial.npv(rate, cashflows)
 */
export function npv(rate: number, cashflows: number[]): number {
  let result = 0
  for (let i = 0; i < cashflows.length; i++) {
    result += cashflows[i] / Math.pow(1 + rate, i)
  }
  return result
}

/**
 * IRR — internal rate of return using Newton-Raphson method
 * Equivalent to numpy_financial.irr(cashflows)
 */
export function irr(cashflows: number[], guess = 0.1, maxIter = 100, tol = 1e-8): number {
  // Ensure there's at least one sign change
  const hasPositive = cashflows.some((c) => c > 0)
  const hasNegative = cashflows.some((c) => c < 0)
  if (!hasPositive || !hasNegative) return NaN

  let rate = guess

  for (let iter = 0; iter < maxIter; iter++) {
    let fValue = 0
    let fDerivative = 0

    for (let i = 0; i < cashflows.length; i++) {
      const factor = Math.pow(1 + rate, i)
      if (!isFinite(factor)) return NaN
      fValue += cashflows[i] / factor
      if (i > 0) {
        fDerivative -= (i * cashflows[i]) / Math.pow(1 + rate, i + 1)
      }
    }

    if (Math.abs(fDerivative) < 1e-14) {
      // Try a different guess
      rate = rate + 0.01
      continue
    }

    const newRate = rate - fValue / fDerivative

    if (Math.abs(newRate - rate) < tol) {
      return newRate
    }

    rate = newRate

    // Guard against divergence
    if (!isFinite(rate) || rate < -1) {
      return NaN
    }
  }

  return rate
}
