// src/lib/roof/snapshot.ts
// Browser-only: composite a Google Static Maps satellite image with the roof
// polygons + panels drawn on top, exported as a JPEG data URL for web + PDF.
import { latLngToWorldPixel, type LatLng } from './geometry'
import type { RoofArea } from '@/lib/types'

const SIZE = 640 // base px (Static Maps max 640; scale=2 -> 1280 effective)
const SCALE = 2

function boundsOf(areas: RoofArea[]): { center: LatLng; zoom: number } {
  const pts = areas.flatMap((a) => a.vertices)
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  // pick the largest zoom that fits the bbox in SIZE px
  let zoom = 21
  for (; zoom > 1; zoom--) {
    const ne = latLngToWorldPixel({ lat: Math.max(...lats), lng: Math.max(...lngs) }, zoom)
    const sw = latLngToWorldPixel({ lat: Math.min(...lats), lng: Math.min(...lngs) }, zoom)
    const w = Math.abs(ne.x - sw.x)
    const h = Math.abs(ne.y - sw.y)
    if (w < SIZE * 0.85 && h < SIZE * 0.85) break
  }
  return { center, zoom }
}

export async function renderRoofSnapshot(
  areas: RoofArea[],
  orientacion: 'vertical' | 'horizontal',
  panelDims: { anchoM: number; altoM: number }
): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey || areas.length === 0) return null

  const { center, zoom } = boundsOf(areas)
  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${center.lat},${center.lng}&zoom=${zoom}` +
    `&size=${SIZE}x${SIZE}&scale=${SCALE}&maptype=satellite&key=${apiKey}`

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  }).catch(() => null)
  if (!img) return null

  const canvas = document.createElement('canvas')
  canvas.width = SIZE * SCALE
  canvas.height = SIZE * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // world-pixel of the image center; convert any latlng to canvas px.
  const centerWp = latLngToWorldPixel(center, zoom)
  const half = SIZE / 2
  const toCanvas = (p: LatLng) => {
    const wp = latLngToWorldPixel(p, zoom)
    return {
      x: (wp.x - centerWp.x + half) * SCALE,
      y: (wp.y - centerWp.y + half) * SCALE,
    }
  }

  for (const area of areas) {
    // polygon outline
    ctx.beginPath()
    area.vertices.forEach((v, i) => {
      const c = toCanvas(v)
      if (i === 0) ctx.moveTo(c.x, c.y)
      else ctx.lineTo(c.x, c.y)
    })
    ctx.closePath()
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 3
    ctx.stroke()

    // panels (small filled squares at their centers)
    ctx.fillStyle = 'rgba(37,99,235,0.85)'
    ctx.strokeStyle = '#93c5fd'
    ctx.lineWidth = 1
    for (const panel of area.panels) {
      const c = toCanvas(panel)
      const s = 4 * SCALE
      ctx.fillRect(c.x - s / 2, c.y - s / 2, s, s)
      ctx.strokeRect(c.x - s / 2, c.y - s / 2, s, s)
    }
  }

  return canvas.toDataURL('image/jpeg', 0.7)
}
