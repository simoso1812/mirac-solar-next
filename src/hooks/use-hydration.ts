'use client'

import { useState, useEffect } from 'react'

/**
 * Returns true after the component has mounted on the client.
 * Use this to guard against Zustand persisted store hydration mismatches.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
