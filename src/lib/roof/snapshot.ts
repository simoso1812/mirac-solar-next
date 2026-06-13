// src/lib/roof/snapshot.ts
// Browser-only: composite a Google Static Maps satellite image with the roof
// polygons + panels drawn on top, exported as a JPEG data URL for web + PDF.
import { latLngToWorldPixel, toLatLng, type LatLng } from './geometry'
import type { RoofArea } from '@/lib/types'

const SIZE = 640 // base px (Static Maps max 640; scale=2 -> 1280 effective)
const SCALE = 2
// Colombian satellite tiles may not exist beyond zoom 20; never request higher.
const MAX_ZOOM = 20
// Soft cap on the exported JPEG payload; warn once if exceeded.
const MAX_DATA_URL_BYTES = 500 * 1024

function boundsOf(areas: RoofArea[]): { center: LatLng; zoom: number } {
  const pts = areas.flatMap((a) => a.vertices)
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const center = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  }
  // pick the largest zoom that fits the bbox in SIZE px, capped at MAX_ZOOM
  let zoom = MAX_ZOOM
  for (; zoom > 1; zoom--) {
    const ne = latLngToWorldPixel({ lat: Math.max(...lats), lng: Math.max(...lngs) }, zoom)
    const sw = latLngToWorldPixel({ lat: Math.min(...lats), lng: Math.min(...lngs) }, zoom)
    const w = Math.abs(ne.x - sw.x)
    const h = Math.abs(ne.y - sw.y)
    if (w < SIZE * 0.85 && h < SIZE * 0.85) break
  }
  return { center, zoom }
}

function rotateM(x: number, y: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r), sin = Math.sin(r)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
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

  // Panel footprint in meters, matching the packing/render convention:
  // vertical (portrait) -> width=anchoM along x, height=altoM along y.
  const w = orientacion === 'vertical' ? panelDims.anchoM : panelDims.altoM
  const h = orientacion === 'vertical' ? panelDims.altoM : panelDims.anchoM
  const halfW = w / 2
  const halfH = h / 2

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

    // panels: oriented rectangles reflecting the true footprint. Each corner is
    // the panel center offset by half-dims in local meters, rotated by the
    // area's row orientation, converted back to lat/lng, then projected.
    ctx.fillStyle = 'rgba(37,99,235,0.85)'
    ctx.strokeStyle = '#93c5fd'
    ctx.lineWidth = 1
    const offsets: Array<[number, number]> = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [halfW, halfH],
      [-halfW, halfH],
    ]
    for (const panel of area.panels) {
      ctx.beginPath()
      offsets.forEach(([ox, oy], i) => {
        const m = rotateM(ox, oy, area.rotation_deg)
        const corner = toLatLng({ x: m.x, y: m.y }, panel)
        const c = toCanvas(corner)
        if (i === 0) ctx.moveTo(c.x, c.y)
        else ctx.lineTo(c.x, c.y)
      })
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  let dataUrl: string
  try {
    dataUrl = canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    // Tainted canvas (cross-origin tile without CORS) throws SecurityError.
    return null
  }

  // base64 length ~ 4/3 of the byte payload; warn once if it is large.
  const approxBytes = Math.ceil((dataUrl.length * 3) / 4)
  if (approxBytes > MAX_DATA_URL_BYTES) {
    console.warn(
      `renderRoofSnapshot: snapshot is ~${Math.round(approxBytes / 1024)} KB ` +
        `(> ${Math.round(MAX_DATA_URL_BYTES / 1024)} KB); consider lowering JPEG quality.`
    )
  }
  return dataUrl
}
