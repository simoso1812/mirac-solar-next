/**
 * Renders the monthly generation vs consumption chart to a PNG data URL
 * using an off-screen canvas. Matches the old matplotlib chart exactly.
 *
 * Called client-side before PDF generation.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function renderGenerationChart(
  monthlyGeneration: number[],
  load: number,
  incluirBaterias: boolean
): string {
  const W = 1000
  const H = 500
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Colors
  const ORANGE = '#FFA500'
  const RED = '#E74C3C'
  const GREEN = '#2ECC71'
  const GREY = '#888888'

  // Margins
  const mLeft = 95
  const mRight = 25
  const mTop = 50
  const mBottom = 90

  const plotW = W - mLeft - mRight
  const plotH = H - mTop - mBottom

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // Data
  const autoconsumo: number[] = []
  const excedentes: number[] = []
  const importado: number[] = []
  const bateria: number[] = []

  for (const gen of monthlyGeneration) {
    if (incluirBaterias) {
      const ac = Math.min(gen, load)
      autoconsumo.push(ac)
      bateria.push(Math.max(0, gen - ac))
    } else {
      if (gen >= load) {
        autoconsumo.push(load)
        excedentes.push(gen - load)
        importado.push(0)
      } else {
        autoconsumo.push(gen)
        excedentes.push(0)
        importado.push(load - gen)
      }
    }
  }

  // Max value for Y axis
  const stackTotals = monthlyGeneration.map((gen, i) => {
    if (incluirBaterias) return autoconsumo[i] + bateria[i]
    return autoconsumo[i] + excedentes[i] + importado[i]
  })
  const maxData = Math.max(...stackTotals, load)
  const maxY = Math.ceil(maxData / 100) * 100 * 1.1

  // Helper
  const xForBar = (i: number) => mLeft + (i + 0.15) * (plotW / 12)
  const barW = (plotW / 12) * 0.7
  const yForVal = (v: number) => mTop + plotH - (v / maxY) * plotH
  const hForVal = (v: number) => (v / maxY) * plotH

  // Grid lines & Y axis labels
  ctx.strokeStyle = '#E0E0E0'
  ctx.lineWidth = 1
  ctx.fillStyle = '#333'
  ctx.font = 'bold 18px Arial, sans-serif'
  ctx.textAlign = 'right'

  const nTicks = 5
  for (let i = 0; i <= nTicks; i++) {
    const val = (maxY / nTicks) * i
    const y = yForVal(val)
    ctx.beginPath()
    ctx.moveTo(mLeft, y)
    ctx.lineTo(W - mRight, y)
    ctx.stroke()
    ctx.fillStyle = '#333'
    ctx.fillText(Math.round(val).toLocaleString('en-US'), mLeft - 10, y + 6)
  }

  // Draw bars
  for (let i = 0; i < 12; i++) {
    const x = xForBar(i)

    // Autoconsumo (orange)
    const hAC = hForVal(autoconsumo[i])
    const yAC = yForVal(autoconsumo[i])
    ctx.fillStyle = ORANGE
    ctx.fillRect(x, yAC, barW, hAC)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 0.8
    ctx.strokeRect(x, yAC, barW, hAC)

    if (incluirBaterias) {
      const hB = hForVal(bateria[i])
      ctx.fillStyle = GREEN
      ctx.fillRect(x, yAC - hB, barW, hB)
      ctx.strokeStyle = '#333'
      ctx.strokeRect(x, yAC - hB, barW, hB)
    } else {
      if (excedentes[i] > 0) {
        const hE = hForVal(excedentes[i])
        ctx.fillStyle = RED
        ctx.fillRect(x, yAC - hE, barW, hE)
        ctx.strokeStyle = '#333'
        ctx.strokeRect(x, yAC - hE, barW, hE)
      }
      if (importado[i] > 0) {
        const hI = hForVal(importado[i])
        ctx.fillStyle = GREEN
        ctx.fillRect(x, yAC - hI, barW, hI)
        ctx.strokeStyle = '#333'
        ctx.strokeRect(x, yAC - hI, barW, hI)
      }
    }

    // X axis label
    ctx.fillStyle = '#333'
    ctx.font = 'bold 20px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(MESES[i], x + barW / 2, mTop + plotH + 25)
  }

  // Consumption dashed line
  const loadY = yForVal(load)
  ctx.strokeStyle = GREY
  ctx.lineWidth = 2.5
  ctx.setLineDash([8, 5])
  ctx.beginPath()
  ctx.moveTo(mLeft, loadY)
  ctx.lineTo(W - mRight, loadY)
  ctx.stroke()
  ctx.setLineDash([])

  // Title
  ctx.fillStyle = '#000'
  ctx.font = 'bold 24px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(
    incluirBaterias
      ? 'Flujo de Energía Mensual Estimado (Off-Grid)'
      : 'Generación Vs. Consumo Mensual (On-Grid)',
    W / 2,
    32
  )

  // Legend
  const legendY = H - 22
  const legendFont = 'bold 17px Arial, sans-serif'
  const swatchSize = 16
  const legendItems: { color: string; label: string }[] = []

  legendItems.push({ color: ORANGE, label: 'Generación Autoconsumida' })
  if (incluirBaterias) {
    legendItems.push({ color: GREEN, label: 'Energía Almacenada en Batería' })
  } else {
    legendItems.push({ color: RED, label: 'Excedentes Vendidos' })
    legendItems.push({ color: GREEN, label: 'Importado de la Red' })
  }

  ctx.font = legendFont
  ctx.textAlign = 'left'

  // Measure total legend width to center it
  const gap = 25
  let totalLegendW = 0
  for (const item of legendItems) {
    totalLegendW += swatchSize + 6 + ctx.measureText(item.label).width + gap
  }
  // Dashed line legend item
  totalLegendW += 18 + 6 + ctx.measureText('Consumo Mensual').width

  let lx = (W - totalLegendW) / 2

  for (const item of legendItems) {
    ctx.fillStyle = item.color
    ctx.fillRect(lx, legendY - swatchSize + 2, swatchSize, swatchSize)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 0.5
    ctx.strokeRect(lx, legendY - swatchSize + 2, swatchSize, swatchSize)
    ctx.fillStyle = '#333'
    ctx.font = legendFont
    ctx.fillText(item.label, lx + swatchSize + 6, legendY + 2)
    lx += swatchSize + 6 + ctx.measureText(item.label).width + gap
  }

  // Dashed line legend
  ctx.strokeStyle = GREY
  ctx.lineWidth = 2.5
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(lx, legendY - 5)
  ctx.lineTo(lx + 18, legendY - 5)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#333'
  ctx.font = legendFont
  ctx.fillText('Consumo Mensual', lx + 24, legendY + 2)

  // Axes border
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(mLeft, mTop)
  ctx.lineTo(mLeft, mTop + plotH)
  ctx.lineTo(W - mRight, mTop + plotH)
  ctx.stroke()

  return canvas.toDataURL('image/png')
}
