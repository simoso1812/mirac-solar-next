/**
 * Build a Google Maps Static API URL for embedding in the PDF.
 * Uses the client-side API key (NEXT_PUBLIC_).
 */
export function getStaticMapUrlForPdf(lat: number, lon: number): string | null {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return null

  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lon}&zoom=17&size=1200x800&scale=2` +
    `&maptype=hybrid&markers=color:red%7C${lat},${lon}` +
    `&key=${apiKey}`
  )
}
