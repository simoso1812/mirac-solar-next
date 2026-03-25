'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuotationStore } from '@/stores/quotation-store'
import { QuotationWizard } from '@/components/quotation/quotation-wizard'
import { ScanBillDialog } from '@/components/bill-scanner/scan-bill-dialog'
import { Button } from '@/components/ui/button'
import { ScanLine } from 'lucide-react'
import type { ExtractedBillData } from '@/lib/bill-scanner/types'

export default function CotizacionPage() {
  const reset = useQuotationStore((s) => s.reset)
  const setClientData = useQuotationStore((s) => s.setClientData)
  const setTechnicalData = useQuotationStore((s) => s.setTechnicalData)
  const setAdvancedData = useQuotationStore((s) => s.setAdvancedData)
  const hasReset = useRef(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [billScanKey, setBillScanKey] = useState(0)

  // Reset wizard state when entering the page fresh
  useEffect(() => {
    if (!hasReset.current) {
      reset()
      hasReset.current = true
    }
  }, [reset])

  const handleBillData = useCallback((data: ExtractedBillData) => {
    // Pre-fill client data
    setClientData({
      nombre: data.nombre_cliente.value || undefined,
      nit_cc: data.documento.value || undefined,
      direccion: data.direccion.value || undefined,
    })

    // Pre-fill consumption
    if (data.consumo_mensual_kwh.value > 0) {
      setTechnicalData({
        consumo_mensual_kwh: data.consumo_mensual_kwh.value,
      })
    }

    // Pre-fill energy tariff (add 20% if bill includes contribución)
    if (data.tarifa_energia_cop_kwh.value > 0) {
      const baseTarifa = data.tarifa_energia_cop_kwh.value
      const costo_kwh = data.contribucion_20.value
        ? Math.round(baseTarifa * 1.20)
        : baseTarifa
      setAdvancedData({ costo_kwh })
    }

    // Force wizard re-mount so React Hook Form picks up new defaultValues
    setBillScanKey((k) => k + 1)
  }, [setClientData, setTechnicalData, setAdvancedData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva Cotización</h1>
        <Button variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanLine className="mr-2 h-4 w-4" />
          Escanear Factura
        </Button>
      </div>

      <QuotationWizard key={billScanKey} />

      <ScanBillDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDataAccepted={handleBillData}
      />
    </div>
  )
}
