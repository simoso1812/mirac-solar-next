'use client'

import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const media = window.matchMedia(query)
    media.addEventListener('change', callback)
    return () => media.removeEventListener('change', callback)
  }, [query])

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false
    const media = window.matchMedia(query)
    return media.matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)')
}
