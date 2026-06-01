'use client'

import { useState, useCallback } from 'react'
import { scanBillAction } from '@/app/actions/scan-bill'
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

      const result = await scanBillAction(formData)

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

    let completed = 0
    const results = await Promise.all(
      files.map(async (file) => {
        const result = await scanBill(file)
        completed += 1
        setProgress({ current: completed, total: files.length })
        return result
      })
    )

    setProgress(null)
    setIsScanning(false)
    return results
  }, [scanBill])

  const clearError = useCallback(() => setError(null), [])

  return { isScanning, progress, scanBill, scanBills, error, clearError }
}
