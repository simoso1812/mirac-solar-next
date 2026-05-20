/**
 * PDF Proposal Template — ported from pdf_generator.py
 * Uses @react-pdf/renderer with JPG backgrounds and positioned text
 *
 * @react-pdf uses POINTS (pt) as units. A4 = 595.28 × 841.89 pt
 * Python FPDF uses mm. A4 = 210 × 297 mm
 * Conversion: 1mm = 2.8346pt
 */
import {
  Document, Page, Text, View, Image, Font, StyleSheet,
} from '@react-pdf/renderer'
import type { CalculationResults, ClientData, ProjectData, TechnicalData, AdvancedData } from '@/lib/types'
import { PROMEDIOS_COSTO } from '@/lib/constants'

// Register fonts
Font.register({
  family: 'DMSans',
  fonts: [
    { src: '/assets/fonts/DMSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/assets/fonts/DMSans-Bold.ttf', fontWeight: 'bold' },
  ],
})

Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/assets/fonts/Roboto-Regular.ttf', fontWeight: 'normal' },
    { src: '/assets/fonts/Roboto-Bold.ttf', fontWeight: 'bold' },
  ],
})

/** Convert mm (FPDF coordinates) to pt (@react-pdf units) */
const mm = (v: number) => v * 2.8346

const BRAND_RED = '#FA323F'
const BRAND_YELLOW = '#FAC107'
const TEXT_BLACK = '#000000'

const BG = '/assets/pdf-backgrounds'

const styles = StyleSheet.create({
  page: {
    width: mm(210),
    height: mm(297),
    position: 'relative',
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: mm(210),
    height: mm(297),
  },
})

function ceilTo100(v: number): number {
  return Math.ceil(v / 100) * 100
}

function fmtCurrency(value: number): string {
  const rounded = ceilTo100(value)
  return `$ ${rounded.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtLargeMoney(value: number): { val: string; suffix: string } {
  if (value >= 1_000_000) return { val: (value / 1_000_000).toFixed(1), suffix: 'M' }
  if (value >= 1000) return { val: (value / 1000).toFixed(1), suffix: 'k' }
  return { val: Math.round(value).toString(), suffix: '' }
}

/**
 * Absolutely positioned text using mm coordinates (matching Python FPDF positions)
 */
function Pos({
  x, y, children, fontSize = 14, fontFamily = 'DMSans',
  fontWeight = 'normal', color = TEXT_BLACK, align = 'left', width,
}: {
  x: number; y: number; children: React.ReactNode
  fontSize?: number; fontFamily?: string; fontWeight?: 'normal' | 'bold'
  color?: string; align?: 'left' | 'right' | 'center'; width?: number
}) {
  return (
    <Text
      style={{
        position: 'absolute',
        left: mm(x),
        top: mm(y),
        fontSize,
        fontFamily,
        fontWeight,
        color,
        textAlign: align,
        width: width ? mm(width) : undefined,
      }}
    >
      {children}
    </Text>
  )
}

/**
 * Absolutely positioned View (for flexDirection: row layouts) using mm coordinates
 */
function PosRow({
  x, y, children,
}: {
  x: number; y: number; children: React.ReactNode
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: mm(x),
        top: mm(y),
        flexDirection: 'row',
        alignItems: 'baseline',
      }}
    >
      {children}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProposalPdfProps {
  client: ClientData
  project: ProjectData
  technical: TechnicalData
  advanced: AdvancedData
  results: CalculationResults
  mapImageUrl?: string | null
  chartImageUrl?: string | null
  ppaChartImageUrl?: string | null
}

export function ProposalPdf({ client, project, technical, advanced, results, mapImageUrl, chartImageUrl, ppaChartImageUrl }: ProposalPdfProps) {
  const r = results
  const fecha = new Date(project.fecha)
  const fechaStr = `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()}`

  const costoSinIVA = r.costo_total_cop / (1 + PROMEDIOS_COSTO.iva_rate)
  const valorIVA = r.costo_total_cop - costoSinIVA
  const omAnual = r.costo_total_cop * 0.02

  const usaFinanciamiento = advanced.financiamiento.habilitado
  const desembolsoInicial = usaFinanciamiento
    ? r.costo_total_cop * (1 - advanced.financiamiento.porcentaje_financiado)
    : r.costo_total_cop

  const cuotaMensual = usaFinanciamiento
    ? (() => {
        const monto = r.costo_total_cop * advanced.financiamiento.porcentaje_financiado
        const tasaMensual = advanced.financiamiento.tasa_interes / 12
        const n = advanced.financiamiento.plazo_meses
        if (tasaMensual === 0) return monto / n
        const factor = Math.pow(1 + tasaMensual, n)
        return (monto * tasaMensual * factor) / (factor - 1)
      })()
    : 0

  const generacionPromedioMensual = r.generacion_anual_kwh / 12

  return (
    <Document>
      {/* 1. PORTADA */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/1.jpg`} style={styles.bg} />
        {/* Dirección del proyecto — multi-line with max width 85mm */}
        <Pos x={115} y={47.5} fontSize={30} fontWeight="bold" color={BRAND_RED} width={85}>
          {client.direccion || project.ubicacion_label || ''}
        </Pos>
        {/* Nombre del cliente — positioned below address */}
        <Pos x={115} y={75} fontSize={12} color={BRAND_RED}>
          Sr(a): {client.nombre}
        </Pos>
        {/* Fecha */}
        <Pos x={147} y={260} fontSize={12} color={BRAND_RED}>
          {fechaStr}
        </Pos>
      </Page>

      {/* 2. RESUMEN EJECUTIVO */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/3.jpg`} style={styles.bg} />
        {/* kWp — number + colored "k" + "Wp" */}
        <PosRow x={36} y={60}>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
            {fmtNumber(r.kwp, 1)}
          </Text>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
            k
          </Text>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
            Wp
          </Text>
        </PosRow>
        {/* Panel count */}
        <Pos x={49} y={105} fontSize={40} fontWeight="bold">
          {fmtNumber(r.numero_paneles)}
        </Pos>
        {/* Trees */}
        <Pos x={38} y={151} fontSize={40} fontWeight="bold">
          {fmtNumber(Math.round(r.carbon.trees_saved_per_year))}
        </Pos>
        {/* CO2 tons */}
        <PosRow x={25} y={191}>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
            {fmtNumber(r.carbon.annual_co2_avoided_tons, 1)}
          </Text>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
            {' '}Ton
          </Text>
        </PosRow>
      </Page>

      {/* 3. GENERACIÓN MENSUAL */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/5.jpg`} style={styles.bg} />
        {/* Average monthly generation number */}
        <Pos x={87} y={97} fontSize={15} fontFamily="Roboto" fontWeight="bold">
          {fmtNumber(Math.round(generacionPromedioMensual))} kWh
        </Pos>
        {/* Chart image rendered via canvas before PDF generation */}
        {chartImageUrl && (
          <Image
            src={chartImageUrl}
            style={{
              position: 'absolute',
              left: mm(15),
              top: mm(120),
              width: mm(180),
              height: mm(90),
            }}
          />
        )}
      </Page>

      {/* 4. UBICACIÓN */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/6.jpg`} style={styles.bg} />
        {/* Coordinates */}
        <Pos x={20} y={88} fontSize={15} fontFamily="Roboto">
          {project.lat != null && project.lon != null
            ? `${project.lat.toFixed(6)}, ${project.lon.toFixed(6)}`
            : (project.ubicacion_label || client.direccion || 'Ubicación del proyecto')}
        </Pos>
        {/* Static map image — x=15mm, y=120mm, w=180mm (matching Python) */}
        {mapImageUrl && (
          <Image
            src={mapImageUrl}
            style={{
              position: 'absolute',
              left: mm(15),
              top: mm(120),
              width: mm(180),
              height: mm(120),
              objectFit: 'cover',
              borderRadius: 4,
            }}
          />
        )}
        {!mapImageUrl && (
          <View style={{
            position: 'absolute', left: mm(15), top: mm(120),
            width: mm(180), height: mm(120),
            border: '1pt solid #ccc', borderRadius: 4,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 12, fontFamily: 'Roboto', color: '#999' }}>
              No se pudo generar el mapa
            </Text>
          </View>
        )}
      </Page>

      {/* 5. FICHA TÉCNICA */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/7.jpg`} style={styles.bg} />
        {/* Tipo de cubierta */}
        <Pos x={90} y={55} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {technical.tipo_cubierta === 'metalica' ? 'Metálica' : technical.tipo_cubierta === 'teja' ? 'Teja' : 'Losa'}
        </Pos>
        {/* Área requerida */}
        <Pos x={90} y={64} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {Math.ceil(r.numero_paneles * 2.3 * 1.3)} m²
        </Pos>
        {/* Potencia módulos */}
        <Pos x={90} y={108} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {r.potencia_panel_w} Wp
        </Pos>
        {/* Cantidad módulos */}
        <Pos x={90} y={117} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {r.numero_paneles}
        </Pos>
        {/* Potencia total DC */}
        <Pos x={90} y={126} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {fmtNumber(r.kwp, 1)} kWp
        </Pos>
        {/* Inversores */}
        <Pos x={90} y={135} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {r.inversores.map((i) => `${i.cantidad}x${i.potencia_kw}kW`).join(' + ')}
        </Pos>
        {/* Potencia AC */}
        <Pos x={90} y={153} fontSize={14} fontFamily="Roboto" align="right" width={88}>
          {r.inversores.reduce((s, i) => s + i.potencia_total_kw, 0)} kW
        </Pos>
      </Page>

      {/* 6.5 BATERÍAS (conditional) */}
      {r.bateria?.habilitada && (() => {
        const horasAutonomia = typeof r.bateria!.horas_autonomia === 'number' ? r.bateria!.horas_autonomia : 0
        return (
        <Page size="A4" style={styles.page}>
          <View style={{
            position: 'absolute', top: 0, left: 0,
            width: mm(210), height: mm(297),
            backgroundColor: '#FFFFFF',
          }} />
          {/* Title */}
          <Pos x={20} y={25} fontSize={28} fontFamily="DMSans" fontWeight="bold" color={BRAND_RED}>
            Sistema de Almacenamiento
          </Pos>
          <View style={{
            position: 'absolute', left: mm(20), top: mm(38),
            width: mm(170), height: 1, backgroundColor: BRAND_YELLOW,
          }} />
          {/* Headline capacity */}
          <Pos x={20} y={50} fontSize={12} fontFamily="Roboto" color="#666666">
            CAPACIDAD NOMINAL
          </Pos>
          <PosRow x={20} y={58}>
            <Text style={{ fontSize: 48, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
              {fmtNumber(r.bateria.capacidad_nominal_kwh, 1)}
            </Text>
            <Text style={{ fontSize: 48, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
              {' '}kWh
            </Text>
          </PosRow>
          {/* Subtitle */}
          <Pos x={20} y={86} fontSize={11} fontFamily="Roboto" color="#444444" width={170}>
            Capacidad útil de {fmtNumber(r.bateria.capacidad_util_kwh, 1)} kWh por ciclo, dimensionada para
            {' '}{fmtNumber(horasAutonomia, 1)} {horasAutonomia === 1 ? 'hora' : 'horas'} de autonomía sin generación solar.
          </Pos>
          {/* Specs grid */}
          <View style={{
            position: 'absolute', left: mm(20), top: mm(110),
            width: mm(170),
          }}>
            {[
              ['Profundidad de descarga (DoD)', `${Math.round(r.bateria.profundidad_descarga * 100)} %`],
              ['Eficiencia round-trip', `${Math.round(r.bateria.eficiencia * 100)} %`],
              ['Autonomía dimensionada', `${fmtNumber(r.bateria.horas_autonomia, 1)} ${r.bateria.horas_autonomia === 1 ? 'hora' : 'horas'}`],
              ['Capacidad útil por ciclo', `${fmtNumber(r.bateria.capacidad_util_kwh, 1)} kWh`],
              ['Inversión almacenamiento', fmtCurrency(r.bateria.costo_cop)],
            ].map(([label, value], i) => (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: i < 4 ? 0.5 : 0,
                  borderBottomColor: '#E5E5E5',
                  borderBottomStyle: 'solid',
                }}
              >
                <Text style={{ fontSize: 12, fontFamily: 'Roboto', color: '#444444' }}>{label}</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Roboto', fontWeight: 'bold', color: TEXT_BLACK }}>{value}</Text>
              </View>
            ))}
          </View>
          {/* Footer note */}
          <Pos x={20} y={250} fontSize={9} fontFamily="Roboto" color="#888888" width={170}>
            El sistema de almacenamiento permite respaldar el consumo durante eventos sin red o sin generación solar,
            y maximiza el aprovechamiento de la energía generada en horarios de baja demanda.
          </Pos>
        </Page>
        )
      })()}

      {/* PPA — Opción Cero Inversión (conditional) */}
      {advanced.ppa?.habilitada && (() => {
        const precioPpa = advanced.ppa.precio_kwh
        const precioRed = advanced.costo_kwh
        const ahorroPorKwh = Math.max(0, precioRed - precioPpa)
        const porcentajeAhorro = precioRed > 0 ? Math.round((ahorroPorKwh / precioRed) * 100) : 0
        const generacionAnual = r.generacion_anual_kwh
        const ahorroAnual = Math.round(generacionAnual * ahorroPorKwh)
        const duracion = advanced.ppa.duracion_anios
        const ahorroTotal = ahorroAnual * duracion
        const pagoMiracAnual = Math.round(generacionAnual * precioPpa)
        const pagoMiracMensual = Math.round(pagoMiracAnual / 12)

        // Chart geometry (mm)
        const chartLeft = 20
        const chartTop = 115
        const chartWidth = 90
        const chartHeight = 80
        const barWidth = 22
        const barGap = 16
        const barsStartX = chartLeft + 12
        const utilityBarX = barsStartX
        const ppaBarX = barsStartX + barWidth + barGap
        const axisBottomY = chartTop + chartHeight
        const maxPrice = Math.max(precioRed, precioPpa, 1)
        const utilityBarH = (precioRed / maxPrice) * (chartHeight - 14)
        const ppaBarH = (precioPpa / maxPrice) * (chartHeight - 14)

        return (
        <Page size="A4" style={styles.page}>
          <View style={{
            position: 'absolute', top: 0, left: 0,
            width: mm(210), height: mm(297),
            backgroundColor: '#FFFFFF',
          }} />
          {/* Title */}
          <Pos x={20} y={25} fontSize={28} fontFamily="DMSans" fontWeight="bold" color={BRAND_RED}>
            Opción Cero Inversión
          </Pos>
          <View style={{
            position: 'absolute', left: mm(20), top: mm(38),
            width: mm(170), height: 1, backgroundColor: BRAND_YELLOW,
          }} />

          {/* Description */}
          <Pos x={20} y={50} fontSize={11} fontFamily="Roboto" color="#444444" width={170}>
            Con nuestro PPA Cero Inversión, accedes al sistema solar sin costo inicial. Pagas solo por la
            energía generada a ${precioPpa.toLocaleString('en-US')}/kWh (vs. ${precioRed.toLocaleString('en-US')}/kWh
            de la red), con O&amp;M incluido, y ahorras {porcentajeAhorro}% anual = {fmtCurrency(ahorroTotal)} en {duracion} años.
          </Pos>

          {/* Price lines */}
          <Pos x={20} y={88} fontSize={12} fontFamily="Roboto" color="#444444">
            Precio energía red:
          </Pos>
          <Pos x={75} y={88} fontSize={12} fontFamily="Roboto" fontWeight="bold" color={TEXT_BLACK}>
            ${precioRed.toLocaleString('en-US')} / kWh
          </Pos>
          <Pos x={20} y={97} fontSize={12} fontFamily="Roboto" color="#444444">
            Precio energía Mirac:
          </Pos>
          <Pos x={75} y={97} fontSize={12} fontFamily="Roboto" fontWeight="bold" color={BRAND_RED}>
            ${precioPpa.toLocaleString('en-US')} / kWh
          </Pos>

          {/* Bar chart — native @react-pdf View bars (force-rendered with Text children) */}
          {/* Chart container background */}
          <View style={{
            position: 'absolute',
            left: mm(chartLeft),
            top: mm(chartTop),
            width: mm(chartWidth),
            height: mm(chartHeight),
            backgroundColor: '#FAFAFA',
            borderWidth: 0.5,
            borderColor: '#E5E5E5',
            borderStyle: 'solid',
          }}>
            <Text> </Text>
          </View>

          {/* Axis baseline */}
          <View style={{
            position: 'absolute',
            left: mm(chartLeft),
            top: mm(axisBottomY),
            width: mm(chartWidth),
            height: 1,
            backgroundColor: '#888888',
          }}>
            <Text> </Text>
          </View>

          {/* Utility bar */}
          <View style={{
            position: 'absolute',
            left: mm(utilityBarX),
            top: mm(axisBottomY - utilityBarH),
            width: mm(barWidth),
            height: mm(utilityBarH),
            backgroundColor: '#9CA3AF',
          }}>
            <Text> </Text>
          </View>

          {/* PPA bar */}
          <View style={{
            position: 'absolute',
            left: mm(ppaBarX),
            top: mm(axisBottomY - ppaBarH),
            width: mm(barWidth),
            height: mm(ppaBarH),
            backgroundColor: BRAND_YELLOW,
          }}>
            <Text> </Text>
          </View>

          {/* Value labels above each bar */}
          <Pos x={utilityBarX - 4} y={axisBottomY - utilityBarH - 6} fontSize={10} fontFamily="DMSans" fontWeight="bold" width={barWidth + 8} align="center">
            ${precioRed.toLocaleString('en-US')}
          </Pos>
          <Pos x={ppaBarX - 4} y={axisBottomY - ppaBarH - 6} fontSize={10} fontFamily="DMSans" fontWeight="bold" color={BRAND_RED} width={barWidth + 8} align="center">
            ${precioPpa.toLocaleString('en-US')}
          </Pos>

          {/* Category labels below the axis */}
          <Pos x={utilityBarX - 4} y={axisBottomY + 3} fontSize={9} fontFamily="Roboto" color="#444444" width={barWidth + 8} align="center">
            Red eléctrica
          </Pos>
          <Pos x={ppaBarX - 4} y={axisBottomY + 3} fontSize={9} fontFamily="Roboto" color="#444444" width={barWidth + 8} align="center">
            PPA Mirac
          </Pos>

          {/* Savings badge — sits in the gap between the two bar tops */}
          <View style={{
            position: 'absolute',
            left: mm(utilityBarX + barWidth + barGap / 2 - 11),
            top: mm(axisBottomY - utilityBarH + (utilityBarH - ppaBarH) / 2 - 4),
            width: mm(22),
            height: mm(8),
            backgroundColor: BRAND_RED,
            borderRadius: 3,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, fontFamily: 'DMSans', fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' }}>
              -{porcentajeAhorro}%
            </Text>
          </View>

          {/* Stat cards — right side */}
          {[
            { label: 'Ahorro Anual', value: fmtCurrency(ahorroAnual), accent: true },
            { label: 'Pago Mensual a Mirac', value: fmtCurrency(pagoMiracMensual), accent: false, hint: 'O&M incluido' },
            { label: 'Pago Anual a Mirac', value: fmtCurrency(pagoMiracAnual), accent: false },
            { label: `Ahorro Total (${duracion} años)`, value: fmtCurrency(ahorroTotal), accent: false },
          ].map((card, i) => (
            <View
              key={card.label}
              style={{
                position: 'absolute',
                left: mm(115),
                top: mm(115 + i * 24),
                width: mm(80),
                height: mm(20),
                borderWidth: 0.6,
                borderColor: card.accent ? BRAND_YELLOW : '#E5E5E5',
                borderStyle: 'solid',
                backgroundColor: card.accent ? '#FFFBEB' : '#FAFAFA',
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', color: '#666666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {card.label}
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'DMSans', fontWeight: 'bold', color: card.accent ? BRAND_RED : TEXT_BLACK, marginTop: 2 }}>
                {card.value}
              </Text>
              {card.hint && (
                <Text style={{ fontSize: 7, fontFamily: 'Roboto', color: '#888888', marginTop: 1 }}>
                  {card.hint}
                </Text>
              )}
            </View>
          ))}

          {/* Footer note */}
          <Pos x={20} y={245} fontSize={9} fontFamily="Roboto" color="#888888" width={170}>
            Con el modelo PPA (Power Purchase Agreement), Mirac instala, opera y mantiene el sistema solar sin
            inversión inicial del cliente. El cliente paga únicamente por la energía generada a una tarifa fija
            durante la vigencia del contrato, garantizando ahorros desde el primer mes.
          </Pos>
        </Page>
        )
      })()}

      {/* 6. ALCANCE */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/8.jpg`} style={styles.bg} />
      </Page>

      {/* MEDIDOR BIDIRECCIONAL (conditional, before page 7) */}
      {advanced.medidor_bidireccional && (
        <Page size="A4" style={styles.page}>
          <Image src={`${BG}/medidor_bidireccional.jpg`} style={styles.bg} />
        </Page>
      )}

      {/* 7. TÉRMINOS / COSTOS */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/9.jpg`} style={styles.bg} />
        {/* Valor sistema FV sin IVA */}
        <Pos x={110} y={70} fontSize={14} fontFamily="Roboto" align="right" width={80}>
          {fmtCurrency(costoSinIVA)}
        </Pos>
        {/* IVA */}
        <Pos x={110} y={96} fontSize={14} fontFamily="Roboto" fontWeight="bold" align="right" width={80}>
          {fmtCurrency(valorIVA)}
        </Pos>
        {/* Total con IVA */}
        <Pos x={110} y={106} fontSize={14} fontFamily="Roboto" fontWeight="bold" align="right" width={80}>
          {fmtCurrency(r.costo_total_cop)}
        </Pos>
        {/* O&M */}
        <Pos x={110} y={115} fontSize={14} fontFamily="Roboto" fontWeight="bold" align="right" width={80}>
          {fmtCurrency(omAnual)}
        </Pos>
      </Page>

      {/* 8. INFO FINANCIERA */}
      <Page size="A4" style={styles.page}>
        {/* Note: info_financiera.jpg may not exist — page renders without background as fallback */}
        <Image src={`${BG}/info_financiera.jpg`} style={styles.bg} />
        {/* TIR */}
        <PosRow x={46} y={68}>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
            TIR {r.tir.toFixed(1)}
          </Text>
          <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
            %
          </Text>
        </PosRow>
        {/* Payback */}
        <Pos x={153} y={76} fontSize={15} fontFamily="Roboto" fontWeight="bold" align="right" width={30}>
          {r.payback_anios.toFixed(1)} años
        </Pos>
        {/* Annual savings */}
        {(() => {
          const { val, suffix } = fmtLargeMoney(r.ahorro_anual_cop)
          return (
            <PosRow x={25} y={106}>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
                $ {val}
              </Text>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
                {suffix}
              </Text>
            </PosRow>
          )
        })()}
        {/* O&M */}
        {(() => {
          const { val, suffix } = fmtLargeMoney(omAnual)
          return (
            <PosRow x={25} y={148}>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
                $ {val}
              </Text>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
                {suffix}
              </Text>
            </PosRow>
          )
        })()}
        {/* Tax deductible (44% of pre-IVA cost) */}
        {(() => {
          const deducible = costoSinIVA * 0.44
          const { val, suffix } = fmtLargeMoney(deducible)
          return (
            <PosRow x={25} y={186}>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: TEXT_BLACK }}>
                $ {val}
              </Text>
              <Text style={{ fontSize: 40, fontFamily: 'DMSans', fontWeight: 'bold', color: BRAND_YELLOW }}>
                {suffix}
              </Text>
            </PosRow>
          )
        })()}
      </Page>

      {/* 9. FINANCIACIÓN (conditional) */}
      {usaFinanciamiento && (
        <Page size="A4" style={styles.page}>
          <Image src={`${BG}/fin.jpg`} style={styles.bg} />
          {/* Anticipo (millions) */}
          <Pos x={42} y={56} fontSize={35} fontFamily="Roboto" fontWeight="bold" align="center" width={50}>
            {(desembolsoInicial / 1_000_000).toFixed(1)}
          </Pos>
          {/* Cuota mensual (millions) */}
          <Pos x={42} y={94} fontSize={35} fontFamily="Roboto" fontWeight="bold" align="center" width={50}>
            {(cuotaMensual / 1_000_000).toFixed(1)}
          </Pos>
          {/* Ahorro mensual (millions) */}
          <Pos x={42} y={132} fontSize={35} fontFamily="Roboto" fontWeight="bold" align="center" width={50}>
            {(r.ahorro_mensual_cop / 1_000_000).toFixed(1)}
          </Pos>
          {/* Plazo del crédito */}
          <Pos x={104} y={191} fontSize={15} fontFamily="Roboto" fontWeight="bold" align="center" width={50}>
            {advanced.financiamiento.plazo_meses}
          </Pos>
          {/* Vida útil */}
          <Pos x={19} y={214} fontSize={15} fontFamily="Roboto" fontWeight="bold" align="center" width={50}>
            {Math.floor(advanced.financiamiento.plazo_meses / 12)}
          </Pos>
        </Page>
      )}

      {/* 10. ASPECTOS A */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/aspectos_a.jpg`} style={styles.bg} />
      </Page>

      {/* 11. ASPECTOS B */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/aspectos_b.jpg`} style={styles.bg} />
      </Page>

      {/* 12. PROYECTOS */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/13.jpg`} style={styles.bg} />
      </Page>

      {/* 13. CONTACTO */}
      <Page size="A4" style={styles.page}>
        <Image src={`${BG}/14.jpg`} style={styles.bg} />
      </Page>
    </Document>
  )
}
