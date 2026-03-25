/**
 * Types for Energy Bill OCR Scanner
 */

export interface ExtractedBillField<T = string> {
  value: T
  confidence: number // 0-1
}

export interface ExtractedBillData {
  nombre_cliente: ExtractedBillField
  documento: ExtractedBillField // CC or NIT
  direccion: ExtractedBillField
  consumo_mensual_kwh: ExtractedBillField<number>
  tarifa_energia_cop_kwh: ExtractedBillField<number>
  contribucion_20: ExtractedBillField<boolean> // whether the bill includes 20% contribution
  tipo_servicio: ExtractedBillField<'residential' | 'commercial' | 'industrial'>
  periodo_facturacion: ExtractedBillField
  numero_factura: ExtractedBillField
  numero_medidor: ExtractedBillField
  numero_transformador: ExtractedBillField // transformer code (Transfor/Trafo)
  total_factura_cop: ExtractedBillField<number>
}

export interface BillScanResult {
  success: boolean
  data: ExtractedBillData | null
  error?: string
  processing_time_ms: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high'
  if (score >= 0.60) return 'medium'
  return 'low'
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return 'text-emerald-600'
    case 'medium': return 'text-yellow-600'
    case 'low': return 'text-destructive'
  }
}

export function getConfidenceIcon(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return '✓'
    case 'medium': return '⚠'
    case 'low': return '?'
  }
}
