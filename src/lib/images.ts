/**
 * Client-side image compression. Resizes large photos and re-encodes them as
 * JPEG so attached proposal images stay small enough for localStorage.
 */

const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.7

export async function compressImage(
  file: File,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  if (width >= height && width > maxDimension) {
    height = Math.round((height * maxDimension) / width)
    width = maxDimension
  } else if (height > width && height > maxDimension) {
    width = Math.round((width * maxDimension) / height)
    height = maxDimension
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', quality)
}

/** Rough byte size of a base64 data URL. */
export function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.floor((base64.length * 3) / 4)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Archivo de imagen inválido'))
    img.src = src
  })
}
