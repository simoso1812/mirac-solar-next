import type { Libraries } from '@react-google-maps/api'

// Single source of truth for useJsApiLoader libraries across the app.
// @react-google-maps/api warns/reloads if different mounts pass different arrays.
// NOTE: no 'drawing' (DrawingManager was removed from the Maps JS API at v3.65 —
// the roof designer collects polygon vertices from map clicks instead) and no
// 'geometry' (the roof math uses our own pure helpers in src/lib/roof/).
export const MAPS_LIBRARIES: Libraries = ['places', 'maps']
