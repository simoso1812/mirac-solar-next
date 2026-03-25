/**
 * EV Charger PDF generator — ported from chargers.py generar_pdf_cargadores()
 *
 * Loads Plantilla_MIRAC_CARGADORES.pdf (3-page template) and overlays
 * cost data, client name, and date using pdf-lib.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ChargerCostBreakdown } from './chargers'

function formatCurrency(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

function formatDate(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export async function generarPdfCargadores(
  nombreClienteLugar: string,
  costos: ChargerCostBreakdown,
): Promise<Uint8Array> {
  // 1. Fetch the template
  const templateRes = await fetch('/assets/Plantilla_MIRAC_CARGADORES.pdf')
  if (!templateRes.ok) throw new Error('No se pudo cargar la plantilla de cargadores')
  const templateBytes = await templateRes.arrayBuffer()

  // 2. Load into pdf-lib
  const pdfDoc = await PDFDocument.load(templateBytes)
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()

  if (pages.length < 3) {
    throw new Error('La plantilla de cargadores debe tener 3 páginas')
  }

  const fechaActual = formatDate()
  const black = rgb(0, 0, 0)

  // --- Page 1: Total cost, date, client name ---
  const page1 = pages[0]
  const h1 = page1.getHeight()

  // Total cost (large, bottom-left) — y=82 in ReportLab (bottom-origin)
  page1.drawText(`${Math.round(costos.costoTotal).toLocaleString('es-CO')}`, {
    x: 100,
    y: 82,
    size: 26,
    font,
    color: black,
  })

  // Date (top-right) — y=757 in ReportLab
  page1.drawText(fechaActual, {
    x: 462,
    y: h1 - (h1 - 757),
    size: 13,
    font,
    color: black,
  })

  // Client name — y=624 in ReportLab
  page1.drawText(nombreClienteLugar, {
    x: 195,
    y: h1 - (h1 - 624),
    size: 14,
    font,
    color: black,
  })

  // --- Page 2: Cost table ---
  const page2 = pages[1]
  const h2 = page2.getHeight()
  const offsetY = 56

  // Date (top-right)
  page2.drawText(fechaActual, {
    x: 462,
    y: h2 - (h2 - 757),
    size: 14,
    font,
    color: black,
  })

  // Cost rows (x=465 in ReportLab, various y values + offset)
  const costRows: [number, number][] = [
    [576 + offsetY, costos.diseno],
    [551 + offsetY, costos.materiales],
    [500 + offsetY, costos.subtotalAntesIva],
    [474 + offsetY, costos.iva],
    [448 + offsetY, costos.costoTotal],
  ]

  for (const [y, value] of costRows) {
    page2.drawText(formatCurrency(value), {
      x: 465,
      y: h2 - (h2 - y),
      size: 14,
      font,
      color: black,
    })
  }

  // 3. Serialize
  return pdfDoc.save()
}
