/**
 * Monthly generation vs consumption chart drawn with @react-pdf <Svg>
 * primitives, for server-side PDFs where no canvas exists (MCP Drive save).
 * Mirrors render-chart.ts: stacked autoconsumo + excedentes/importado
 * (or batería) bars per month.
 */
import { Svg, Rect, Line, Text } from '@react-pdf/renderer'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const ORANGE = '#FFA500'
const RED = '#E74C3C'
const GREEN = '#2ECC71'

export function GenerationChartPdf({
  monthlyGeneration,
  load,
  incluirBaterias,
  width,
  height,
}: {
  monthlyGeneration: number[]
  load: number
  incluirBaterias: boolean
  width: number
  height: number
}) {
  const W = 1000
  const H = 500
  const mLeft = 95
  const mRight = 25
  const mTop = 50
  const mBottom = 90
  const plotW = W - mLeft - mRight
  const plotH = H - mTop - mBottom

  const stacks = monthlyGeneration.map((gen) => {
    const ac = Math.min(gen, load)
    if (incluirBaterias) return { ac, top: Math.max(0, gen - ac), color: GREEN }
    return gen >= load
      ? { ac, top: gen - load, color: RED }
      : { ac, top: load - gen, color: GREEN }
  })
  const maxData = Math.max(...stacks.map((s) => s.ac + s.top), load)
  const maxY = Math.ceil(maxData / 100) * 100 * 1.1 || 1

  const barW = (plotW / 12) * 0.7
  const xForBar = (i: number) => mLeft + (i + 0.15) * (plotW / 12)
  const yForVal = (v: number) => mTop + plotH - (v / maxY) * plotH
  const hForVal = (v: number) => (v / maxY) * plotH

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} style={{ width, height }}>
      <Rect x={0} y={0} width={W} height={H} fill="#FFFFFF" />
      {Array.from({ length: 6 }, (_, i) => {
        const val = (maxY / 5) * i
        const y = yForVal(val)
        return [
          <Line key={`g${i}`} x1={mLeft} y1={y} x2={W - mRight} y2={y} stroke="#E0E0E0" strokeWidth={1} />,
          <Text key={`t${i}`} x={mLeft - 10} y={y + 6} textAnchor="end" style={{ fontSize: 18, fill: '#333' }}>
            {Math.round(val).toLocaleString('en-US')}
          </Text>,
        ]
      })}
      {stacks.map((s, i) => {
        const x = xForBar(i)
        const yAC = yForVal(s.ac)
        return [
          <Rect key={`a${i}`} x={x} y={yAC} width={barW} height={hForVal(s.ac)} fill={ORANGE} stroke="#333" strokeWidth={0.8} />,
          s.top > 0 ? (
            <Rect key={`b${i}`} x={x} y={yAC - hForVal(s.top)} width={barW} height={hForVal(s.top)} fill={s.color} stroke="#333" strokeWidth={0.8} />
          ) : null,
          <Text key={`m${i}`} x={x + barW / 2} y={mTop + plotH + 25} textAnchor="middle" style={{ fontSize: 20, fill: '#333' }}>
            {MESES[i]}
          </Text>,
        ]
      })}
    </Svg>
  )
}
