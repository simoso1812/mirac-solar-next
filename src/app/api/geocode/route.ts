import { NextRequest, NextResponse } from 'next/server'
import { getCordsFromAddress, getStaticMapUrl } from '@/lib/integrations/geocoding'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'address parameter required' }, { status: 400 })
  }

  const coords = await getCordsFromAddress(address)

  if (!coords) {
    return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  const mapUrl = apiKey ? getStaticMapUrl(coords.lat, coords.lon, apiKey) : null

  return NextResponse.json({ ...coords, mapUrl })
}
