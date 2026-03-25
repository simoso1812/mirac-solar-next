'use client'

import { useState, useCallback } from 'react'
import type { BillScanResult } from '@/lib/bill-scanner/types'

interface UseBillScannerReturn {
  isScanning: boolean
  progress: { current: number; total: number } | null
  scanBill: (file: File) => Promise<BillScanResult>
  scanBills: (files: File[]) => Promise<BillScanResult[]>
  error: string | null
  clearError: () => void
}

export function useBillScanner(): UseBillScannerReturn {
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scanBill = useCallback(async (file: File): Promise<BillScanResult> => {
    setIsScanning(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/bill-scanner', {
        method: 'POST',
        body: formData,
      })

      const result: BillScanResult = await response.json()

      if (!result.success && result.error) {
        setError(result.error)
      }

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error de conexión'
      setError(message)
      return {
        success: false,
        data: null,
        error: message,
        processing_time_ms: 0,
      }
    } finally {
      setIsScanning(false)
    }
  }, [])

  const scanBills = useCallback(async (files: File[]): Promise<BillScanResult[]> => {
    setIsScanning(true)
    setError(null)
    setProgress({ current: 0, total: files.length })

    const results: BillScanResult[] = []

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length })
      const result = await scanBill(files[i])
      results.push(result)
    }

    setProgress(null)
    setIsScanning(false)
    return results
  }, [scanBill])

  const clearError = useCallback(() => setError(null), [])

  return { isScanning, progress, scanBill, scanBills, error, clearError }
}
