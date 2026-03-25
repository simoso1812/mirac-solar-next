'use client'

import { useState, useCallback, useRef } from 'react'
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from '@react-google-maps/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Navigation } from 'lucide-react'

const libraries: ('places' | 'maps')[] = ['places', 'maps']

const mapContainerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: '0.5rem',
}

// Default center: Medellín, Colombia
const defaultCenter = { lat: 6.2442, lng: -75.5812 }

interface InteractiveMapProps {
  initialLat?: number | null
  initialLng?: number | null
  onLocationChange: (lat: number, lng: number, address?: string) => void
}

/**
 * Parse a coordinate string like "6.2442, -75.5812" or "6.2442 -75.5812"
 */
function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim()
  // Match patterns: "6.24, -75.58" or "6.24 -75.58" or "6.24,-75.58"
  const match = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
  if (!match) return null

  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function InteractiveMap({
  initialLat,
  initialLng,
  onLocationChange,
}: InteractiveMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries,
  })

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null
      ? { lat: initialLat, lng: initialLng }
      : null
  )
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [coordInput, setCoordInput] = useState('')

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance)
  }, [])

  const placeMarker = useCallback(
    (lat: number, lng: number, address?: string) => {
      setMarker({ lat, lng })
      map?.panTo({ lat, lng })
      map?.setZoom(17)
      onLocationChange(lat, lng, address)
    },
    [map, onLocationChange]
  )

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      placeMarker(e.latLng.lat(), e.latLng.lng())
    },
    [placeMarker]
  )

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      placeMarker(e.latLng.lat(), e.latLng.lng())
    },
    [placeMarker]
  )

  const onAutocompleteLoad = useCallback(
    (autocomplete: google.maps.places.Autocomplete) => {
      autocompleteRef.current = autocomplete
    },
    []
  )

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.geometry?.location) return

    placeMarker(
      place.geometry.location.lat(),
      place.geometry.location.lng(),
      place.formatted_address ?? place.name ?? ''
    )
  }, [placeMarker])

  const handleCoordSearch = useCallback(() => {
    const parsed = parseCoordinates(coordInput)
    if (parsed) {
      placeMarker(parsed.lat, parsed.lng)
      setCoordInput('')
    }
  }, [coordInput, placeMarker])

  if (!apiKey) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-muted">
        <p className="text-sm text-muted-foreground">
          Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local para el mapa interactivo
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-muted">
        <p className="text-sm text-destructive">Error cargando Google Maps</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando mapa...</span>
      </div>
    )
  }

  const center = marker ?? defaultCenter

  return (
    <div className="space-y-3">
      {/* Place search — no type restriction so establishments, cities, landmarks all appear */}
      <Autocomplete
        onLoad={onAutocompleteLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: 'co' },
          fields: ['geometry', 'formatted_address', 'name'],
        }}
      >
        <Input
          type="text"
          placeholder="Buscar lugar, dirección o establecimiento..."
          className="w-full"
        />
      </Autocomplete>

      {/* Coordinate input */}
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Ej: 6.2442, -75.5812"
          value={coordInput}
          onChange={(e) => setCoordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCoordSearch()
            }
          }}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCoordSearch}
          disabled={!parseCoordinates(coordInput)}
        >
          <Navigation className="mr-1 h-3.5 w-3.5" />
          Ir
        </Button>
      </div>

      {/* Map */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={marker ? 17 : 12}
        onLoad={onMapLoad}
        onClick={onMapClick}
        options={{
          mapTypeId: 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {marker && (
          <Marker
            position={marker}
            draggable
            onDragEnd={onMarkerDragEnd}
            animation={google.maps.Animation.DROP}
          />
        )}
      </GoogleMap>

      {marker && (
        <p className="text-xs text-muted-foreground">
          Coordenadas: {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}
          — Arrastra el pin o haz clic en el mapa para ajustar
        </p>
      )}
    </div>
  )
}
