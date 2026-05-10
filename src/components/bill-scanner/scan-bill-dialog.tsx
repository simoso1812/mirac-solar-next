'use client'

import { useState, useCallback } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { BillUploadZone } from './bill-upload-zone'
import { BillReview } from './bill-review'
import { useBillScanner } from '@/hooks/use-bill-scanner'
import { Loader2, AlertCircle, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExtractedBillData } from '@/lib/bill-scanner/types'

type DialogState = 'upload' | 'processing' | 'review' | 'error'

interface ScanBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDataAccepted: (data: ExtractedBillData) => void
}

export function ScanBillDialog({ open, onOpenChange, onDataAccepted }: ScanBillDialogProps) {
  const [state, setState] = useState<DialogState>('upload')
  const [scanResult, setScanResult] = useState<{ data: ExtractedBillData; time: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const { scanBill } = useBillScanner()

  const handleFilesSelected = useCallback(async (files: File[]) => {
    setState('processing')
    setErrorMessage('')

    // Process first file (single bill for now)
    const result = await scanBill(files[0])

    if (result.success && result.data) {
      setScanResult({ data: result.data, time: result.processing_time_ms })
      setState('review')
    } else {
      setErrorMessage(result.error ?? 'Error desconocido al procesar la factura')
      setState('error')
    }
  }, [scanBill])

  const handleAccept = useCallback((data: ExtractedBillData) => {
    onDataAccepted(data)
    // Reset dialog state for next use
    setState('upload')
    setScanResult(null)
    onOpenChange(false)
  }, [onDataAccepted, onOpenChange])

  const handleDiscard = useCallback(() => {
    setState('upload')
    setScanResult(null)
  }, [])

  const handleRetry = useCallback(() => {
    setState('upload')
    setErrorMessage('')
  }, [])

  // Reset state when dialog closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Delay reset to allow close animation
      setTimeout(() => {
        setState('upload')
        setScanResult(null)
        setErrorMessage('')
      }, 200)
    }
    onOpenChange(newOpen)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-mirac-red" />
            Escanear Factura de Energía
          </DialogTitle>
          <DialogDescription>
            {state === 'upload' && 'Sube una foto o PDF de tu factura de energía para extraer los datos automáticamente.'}
            {state === 'processing' && 'Analizando la factura con inteligencia artificial...'}
            {state === 'review' && 'Revisa los datos extraídos. Haz clic en el lápiz para editar cualquier campo.'}
            {state === 'error' && 'Hubo un error al procesar la factura.'}
          </DialogDescription>
        </DialogHeader>

        {/* Upload state */}
        {state === 'upload' && (
          <BillUploadZone onFilesSelected={handleFilesSelected} maxFiles={1} />
        )}

        {/* Processing state */}
        {state === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-mirac-red" />
            <p className="text-sm font-medium">Analizando factura...</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Esto puede tomar unos segundos
            </p>
          </div>
        )}

        {/* Review state */}
        {state === 'review' && scanResult && (
          <BillReview
            data={scanResult.data}
            processingTime={scanResult.time}
            onAccept={handleAccept}
            onDiscard={handleDiscard}
          />
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
            <p className="mb-1 text-sm font-medium">Error al procesar</p>
            <p className="mb-4 text-center text-xs text-muted-foreground">
              {errorMessage}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRetry} className="bg-mirac-red hover:bg-mirac-red-dark">
                Intentar de Nuevo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
