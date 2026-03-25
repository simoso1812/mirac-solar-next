/**
 * Geocoding and maps — ported from location_service.py
 *
 * Uses free Nominatim API for geocoding (no API key needed)
 * and Google Maps Static API for map images (needs GOOGLE_MAPS_API_KEY)
 */

export interface Coordinates {
  lat: number
  lon: number
}

/**
 * Geocode an address string to coordinates using Nominatim
 */
export async function getCordsFromAddress(address: string): Promise<Coordinates | null> {
  try {
    const encoded = encodeURIComponent(address)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'mirac-solar-calculator' },
      }
    )

    if (!res.ok) return null
    const data = await res.json()

    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Generate Google Maps Static API URL for a location
 */
export function getStaticMapUrl(
  lat: number,
  lon: number,
  apiKey: string,
  options?: { zoom?: number; size?: string; maptype?: string }
): string {
  const zoom = options?.zoom ?? 16
  const size = options?.size ?? '600x400'
  const maptype = options?.maptype ?? 'hybrid'

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lon}&zoom=${zoom}&size=${size}&scale=2` +
    `&maptype=${maptype}&markers=color:red%7C${lat},${lon}` +
    `&key=${apiKey}`
  )
}
