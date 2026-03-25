/**
 * Post-extraction validation for bill scanner data
 */
import type { ExtractedBillData } from './types'

interface ValidationResult {
  field: string
  valid: boolean
  message?: string
  correctedValue?: unknown
}

export function validateExtractedData(data: ExtractedBillData): ValidationResult[] {
  const results: ValidationResult[] = []

  // Consumption: 50-500,000 kWh (matches technicalSchema)
  const consumo = data.consumo_mensual_kwh.value
  if (consumo < 50 || consumo > 500000) {
    results.push({
      field: 'consumo_mensual_kwh',
      valid: false,
      message: consumo === 0
        ? 'No se encontró el consumo mensual'
        : `Consumo ${consumo} kWh fuera de rango (50-500,000)`,
    })
  } else {
    results.push({ field: 'consumo_mensual_kwh', valid: true })
  }

  // Energy rate: 100-3,000 COP/kWh (reasonable Colombian range)
  const tarifa = data.tarifa_energia_cop_kwh.value
  if (tarifa < 100 || tarifa > 3000) {
    results.push({
      field: 'tarifa_energia_cop_kwh',
      valid: false,
      message: tarifa === 0
        ? 'No se encontró la tarifa de energía'
        : `Tarifa ${tarifa} COP/kWh fuera de rango (100-3,000)`,
    })
  } else {
    results.push({ field: 'tarifa_energia_cop_kwh', valid: true })
  }

  // Client name
  const nombre = data.nombre_cliente.value
  if (!nombre || nombre.length < 3) {
    results.push({
      field: 'nombre_cliente',
      valid: false,
      message: 'Nombre del cliente no encontrado o muy corto',
    })
  } else {
    results.push({ field: 'nombre_cliente', valid: true })
  }

  // Document: Colombian CC (6-10 digits) or NIT (9-12 digits with optional dash)
  const doc = data.documento.value.replace(/[.\-\s]/g, '')
  if (doc && doc.length > 0) {
    const isValidCC = /^\d{6,10}$/.test(doc)
    const isValidNIT = /^\d{9,12}$/.test(doc)
    if (!isValidCC && !isValidNIT) {
      results.push({
        field: 'documento',
        valid: false,
        message: 'Formato de documento no válido (CC: 6-10 dígitos, NIT: 9-12 dígitos)',
      })
    } else {
      results.push({ field: 'documento', valid: true })
    }
  }

  // Address
  const dir = data.direccion.value
  if (!dir || dir.length < 5) {
    results.push({
      field: 'direccion',
      valid: false,
      message: 'Dirección no encontrada o muy corta',
    })
  } else {
    results.push({ field: 'direccion', valid: true })
  }

  // Total bill amount
  const total = data.total_factura_cop.value
  if (total > 0 && consumo > 0 && tarifa > 0) {
    // Sanity check: total should be roughly consumo * tarifa (within 3x factor for other charges)
    const estimatedTotal = consumo * tarifa
    if (total > estimatedTotal * 5 || total < estimatedTotal * 0.3) {
      results.push({
        field: 'total_factura_cop',
        valid: false,
        message: 'El total de la factura no coincide con consumo × tarifa',
      })
    }
  }

  return results
}

/**
 * Clean and normalize extracted values
 */
export function normalizeExtractedData(data: ExtractedBillData): ExtractedBillData {
  return {
    ...data,
    // Round consumption to integer
    consumo_mensual_kwh: {
      ...data.consumo_mensual_kwh,
      value: Math.round(data.consumo_mensual_kwh.value),
    },
    // Round tariff to integer
    tarifa_energia_cop_kwh: {
      ...data.tarifa_energia_cop_kwh,
      value: Math.round(data.tarifa_energia_cop_kwh.value),
    },
    // Round total to integer
    total_factura_cop: {
      ...data.total_factura_cop,
      value: Math.round(data.total_factura_cop.value),
    },
    // Trim whitespace from strings
    nombre_cliente: {
      ...data.nombre_cliente,
      value: data.nombre_cliente.value.trim(),
    },
    documento: {
      ...data.documento,
      value: data.documento.value.trim(),
    },
    direccion: {
      ...data.direccion,
      value: data.direccion.value.trim(),
    },
    // Ensure contribucion_20 is a boolean
    contribucion_20: {
      ...data.contribucion_20,
      value: Boolean(data.contribucion_20?.value),
      confidence: data.contribucion_20?.confidence ?? 0,
    },
    // Trim transformer code
    numero_transformador: {
      ...data.numero_transformador,
      value: (data.numero_transformador?.value ?? '').trim(),
      confidence: data.numero_transformador?.confidence ?? 0,
    },
  }
}
