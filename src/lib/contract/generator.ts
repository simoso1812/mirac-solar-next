/**
 * Contract .docx generator — ported from contract_generator.py
 *
 * Loads contrato_plantilla.docx template, replaces placeholders,
 * and returns the resulting .docx as a Uint8Array (browser-compatible).
 */
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'

const MESES_ESPANOL: Record<number, string> = {
  0: 'enero', 1: 'febrero', 2: 'marzo', 3: 'abril',
  4: 'mayo', 5: 'junio', 6: 'julio', 7: 'agosto',
  8: 'septiembre', 9: 'octubre', 10: 'noviembre', 11: 'diciembre',
}

/**
 * Convert a number to Spanish words (simplified — handles up to billions).
 * Replaces Python's num2words dependency.
 */
function numberToSpanishWords(n: number): string {
  if (n === 0) return 'cero'

  const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
  const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  function convertBelow1000(num: number): string {
    if (num === 0) return ''
    if (num === 100) return 'cien'

    let result = ''
    if (num >= 100) {
      result += hundreds[Math.floor(num / 100)] + ' '
      num %= 100
    }
    if (num >= 20) {
      const t = Math.floor(num / 10)
      const u = num % 10
      if (t === 2 && u > 0) {
        result += 'veinti' + units[u]
      } else {
        result += tens[t]
        if (u > 0) result += ' y ' + units[u]
      }
    } else if (num >= 10) {
      result += teens[num - 10]
    } else if (num > 0) {
      result += units[num]
    }
    return result.trim()
  }

  const parts: string[] = []
  const value = Math.floor(Math.abs(n))

  const billions = Math.floor(value / 1_000_000_000)
  const millions = Math.floor((value % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1_000)
  const remainder = value % 1_000

  if (billions > 0) {
    if (billions === 1) parts.push('mil')
    else parts.push(convertBelow1000(billions) + ' mil')
    // billions of millions
    parts[parts.length - 1] += ' millones'
  }

  if (millions > 0) {
    if (millions === 1) parts.push('un millón')
    else parts.push(convertBelow1000(millions) + ' millones')
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('mil')
    else parts.push(convertBelow1000(thousands) + ' mil')
  }

  if (remainder > 0) {
    parts.push(convertBelow1000(remainder))
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Format a date string (YYYY-MM-DD) to Spanish: "25 de marzo de 2026"
 */
function formatFechaEspanol(fecha: string): string {
  try {
    const d = new Date(fecha + 'T12:00:00') // noon to avoid timezone issues
    const dia = d.getDate()
    const mes = MESES_ESPANOL[d.getMonth()]
    const anio = d.getFullYear()
    return `${dia} de ${mes} de ${anio}`
  } catch {
    return fecha
  }
}

/**
 * Format a number as Colombian pesos: $1,234,567
 */
function formatCOP(value: number): string {
  return '$' + Math.round(value).toLocaleString('es-CO')
}

export interface ContractData {
  nombreCliente: string
  documentoCliente: string
  telefonoCliente?: string
  emailCliente?: string
  direccionProyecto: string
  tamanoSistemaKwp: number
  cantidadPaneles: number
  potenciaPanel: number
  inversorRecomendado: string
  valorTotalCOP: number
  fechaPropuesta: string // YYYY-MM-DD
}

export function renderContratoDocx(templateBuffer: ArrayBuffer | Uint8Array, data: ContractData): Uint8Array {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Use double-brace delimiters to match the existing template
    delimiters: { start: '{{', end: '}}' },
  })

  // 3. Value in Spanish words
  const valorLetras = numberToSpanishWords(Math.round(data.valorTotalCOP)).toUpperCase() + ' PESOS M/CTE'

  // 4. Render with context
  doc.render({
    NOMBRE_CLIENTE: data.nombreCliente,
    DOCUMENTO_CLIENTE: data.documentoCliente,
    TELEFONO_CLIENTE: data.telefonoCliente ?? '',
    EMAIL_CLIENTE: data.emailCliente ?? '',
    DIRECCION_PROYECTO: data.direccionProyecto,
    TAMANO_DEL_SISTEMA_KWP: String(data.tamanoSistemaKwp),
    CANTIDAD_PANELES: String(data.cantidadPaneles),
    POTENCIA_PANEL: String(data.potenciaPanel),
    INVERSOR_RECOMENDADO: data.inversorRecomendado,
    VALOR_TOTAL_PROYECTO_NUMEROS: formatCOP(data.valorTotalCOP),
    VALOR_TOTAL_PROYECTO_LETRAS: valorLetras,
    FECHA_FIRMA: formatFechaEspanol(data.fechaPropuesta),
    DOCUSEAL_SIGNATURE: '{{signature}}',
  })

  // 5. Generate output
  const output = doc.getZip().generate({ type: 'uint8array' })
  return output
}

/**
 * Generate a contract .docx from template.
 * Must be called in the browser (fetches template from /assets/).
 */
export async function generarContratoDocx(data: ContractData): Promise<Uint8Array> {
  const templateRes = await fetch('/assets/contrato_plantilla.docx')
  if (!templateRes.ok) throw new Error('No se pudo cargar la plantilla del contrato')
  const templateBuffer = await templateRes.arrayBuffer()
  return renderContratoDocx(templateBuffer, data)
}
