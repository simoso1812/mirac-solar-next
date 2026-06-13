import type { Libraries } from '@react-google-maps/api'

// Single source of truth for useJsApiLoader libraries across the app.
// @react-google-maps/api warns/reloads if different mounts pass different arrays.
export const MAPS_LIBRARIES: Libraries = ['places', 'maps', 'drawing', 'geometry']
