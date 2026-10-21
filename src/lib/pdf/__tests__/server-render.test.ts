import { describe, expect, it } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { ProposalPdf } from '@/lib/pdf/proposal-pdf'
import { GenerationChartPdf } from '@/lib/pdf/generation-chart-pdf'
import { cotizacion, buildInputFromStore } from '@/lib/calculator/index'
import { deepMerge, initialAdvancedData, initialClientData, initialProjectData, initialTechnicalData } from '@/lib/defaults'

describe('ProposalPdf server render', () => {
  it('renders without a browser, with the vector chart', async () => {
    const technical = deepMerge(initialTechnicalData, { consumo_mensual_kwh: 800 })
    const results = cotizacion(buildInputFromStore(technical, initialProjectData, initialAdvancedData))
    const doc = createElement(ProposalPdf, {
      client: { ...initialClientData, nombre: 'Cliente Prueba' },
      project: initialProjectData,
      technical,
      advanced: initialAdvancedData,
      results,
      chartElement: createElement(GenerationChartPdf, {
        monthlyGeneration: results.generacion_mensual_kwh,
        load: 800,
        incluirBaterias: false,
        width: 500,
        height: 250,
      }),
    }) as unknown as ReactElement<DocumentProps>
    const buf = await renderToBuffer(doc)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    expect(buf.length).toBeGreaterThan(50_000)
    if (process.env.PDF_OUT) (await import('fs')).writeFileSync(process.env.PDF_OUT, buf)
  }, 30_000)
})
