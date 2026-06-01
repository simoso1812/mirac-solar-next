// Process-wide constants for the bill scanner. Kept out of the 'use server'
// action module so they live at module scope without tripping
// server-no-mutable-module-state.

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const MIN_USEFUL_CHARS = 200
export const MARKITDOWN_TIMEOUT = 45_000

export const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const VISION_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const BILL_KEYWORDS = ['kwh', 'consumo', 'factura', 'tarifa', 'cop', 'energía', 'energia', 'medidor', 'periodo']
