/**
 * Renders the PPA comparison chart (utility vs Mirac price) to a PNG data URL.
 * Two bars side by side with a red savings badge on the gap.
 * Called client-side before PDF generation.
 */
export function renderPpaChart(
  precioRed: number,
  precioPpa: number,
): string {
  const W = 600
  const H = 500
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Colors
  const GRAY = '#9CA3AF'
  const YELLOW = '#FAC107'
  const RED = '#FA323F'

  // Solid white background (transparent PNGs render unreliably in @react-pdf)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  // Margins
  const mLeft = 110
  const mRight = 60
  const mTop = 60
  const mBottom = 90

  const plotW = W - mLeft - mRight
  const plotH = H - mTop - mBottom

  const maxPrice = Math.max(precioRed, precioPpa, 1)
  const yScale = (v: number) => plotH * (v / maxPrice)

  // Bars
  const barW = 140
  const gap = 100
  const totalBarsW = barW * 2 + gap
  const startX = mLeft + (plotW - totalBarsW) / 2
  const utilityX = startX
  const ppaX = startX + barW + gap
  const axisY = mTop + plotH

  // Y axis ticks
  ctx.strokeStyle = '#E0E0E0'
  ctx.lineWidth = 1
  ctx.font = 'bold 18px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#555'

  const nTicks = 4
  // Round max up to a nice tick boundary
  const niceMax = Math.ceil(maxPrice / 100) * 100
  for (let i = 0; i <= nTicks; i++) {
    const val = (niceMax / nTicks) * i
    const y = axisY - (val / maxPrice) * plotH
    ctx.beginPath()
    ctx.moveTo(mLeft, y)
    ctx.lineTo(W - mRight, y)
    ctx.stroke()
    ctx.fillText(Math.round(val).toLocaleString('en-US'), mLeft - 10, y + 6)
  }

  // Y-axis label
  ctx.save()
  ctx.translate(36, mTop + plotH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#444'
  ctx.font = 'bold 20px Arial, sans-serif'
  ctx.fillText('Precio de la energía ($COP)', 0, 0)
  ctx.restore()

  // Axis line
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(mLeft, axisY)
  ctx.lineTo(W - mRight, axisY)
  ctx.stroke()

  // Utility bar
  const utilityH = yScale(precioRed)
  ctx.fillStyle = GRAY
  ctx.fillRect(utilityX, axisY - utilityH, barW, utilityH)

  // PPA bar
  const ppaH = yScale(precioPpa)
  ctx.fillStyle = YELLOW
  ctx.fillRect(ppaX, axisY - ppaH, barW, ppaH)

  // Bar value labels (above each bar)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#000'
  ctx.font = 'bold 26px Arial, sans-serif'
  ctx.fillText(`$${precioRed.toLocaleString('en-US')}`, utilityX + barW / 2, axisY - utilityH - 14)
  ctx.fillStyle = RED
  ctx.fillText(`$${precioPpa.toLocaleString('en-US')}`, ppaX + barW / 2, axisY - ppaH - 14)

  // X-axis category labels (below)
  ctx.fillStyle = '#333'
  ctx.font = 'bold 22px Arial, sans-serif'
  ctx.fillText('Red eléctrica', utilityX + barW / 2, axisY + 36)
  ctx.fillText('PPA Mirac', ppaX + barW / 2, axisY + 36)

  // Percentage savings badge — in the gap, vertically between the two bar tops
  const ahorroPorKwh = Math.max(0, precioRed - precioPpa)
  const porcentajeAhorro = precioRed > 0 ? Math.round((ahorroPorKwh / precioRed) * 100) : 0
  const badgeY = (axisY - utilityH + axisY - ppaH) / 2 // midpoint between bar tops
  const badgeX = (utilityX + barW + ppaX) / 2
  const badgeW = 110
  const badgeH = 50
  // Rounded red rectangle
  const rx = badgeX - badgeW / 2
  const ry = badgeY - badgeH / 2
  ctx.fillStyle = RED
  const radius = 10
  ctx.beginPath()
  ctx.moveTo(rx + radius, ry)
  ctx.lineTo(rx + badgeW - radius, ry)
  ctx.quadraticCurveTo(rx + badgeW, ry, rx + badgeW, ry + radius)
  ctx.lineTo(rx + badgeW, ry + badgeH - radius)
  ctx.quadraticCurveTo(rx + badgeW, ry + badgeH, rx + badgeW - radius, ry + badgeH)
  ctx.lineTo(rx + radius, ry + badgeH)
  ctx.quadraticCurveTo(rx, ry + badgeH, rx, ry + badgeH - radius)
  ctx.lineTo(rx, ry + radius)
  ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 28px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`-${porcentajeAhorro}%`, badgeX, badgeY + 2)

  return canvas.toDataURL('image/png')
}
