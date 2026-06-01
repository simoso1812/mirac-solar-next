'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuotationStore } from '@/stores/quotation-store'
import { useProposalsStore } from '@/stores/proposals-store'
import { QuotationWizard } from '@/components/quotation/quotation-wizard'
import { ScanBillDialog } from '@/components/bill-scanner/scan-bill-dialog'
import { Button } from '@/components/ui/button'
import { ScanLine } from 'lucide-react'
import type { ExtractedBillData } from '@/lib/bill-scanner/types'

function CotizacionContent() {
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const reset = useQuotationStore((s) => s.reset)
  const loadProposal = useQuotationStore((s) => s.loadProposal)
  const editingId = useQuotationStore((s) => s.editingId)
  const setClientData = useQuotationStore((s) => s.setClientData)
  const setTechnicalData = useQuotationStore((s) => s.setTechnicalData)
  const setAdvancedData = useQuotationStore((s) => s.setAdvancedData)
  const proposalToEdit = useProposalsStore((s) => editId ? s.getProposal(editId) : undefined)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [billScanKey, setBillScanKey] = useState(0)
  const lastEditId = useRef<string | null>(null)

  useEffect(() => {
    // Skip if we already initialized for this same editId
    if (lastEditId.current === (editId ?? '__new__')) return
    lastEditId.current = editId ?? '__new__'

    if (editId) {
      if (proposalToEdit) {
        loadProposal(proposalToEdit)
      } else {
        reset()
      }
    } else {
      reset()
    }
  }, [editId, proposalToEdit, loadProposal, reset])

  const handleBillData = useCallback((data: ExtractedBillData) => {
    setClientData({
      nombre: data.nombre_cliente.value || undefined,
      nit_cc: data.documento.value || undefined,
      direccion: data.direccion.value || undefined,
    })

    if (data.consumo_mensual_kwh.value > 0) {
      setTechnicalData({
        consumo_mensual_kwh: data.consumo_mensual_kwh.value,
      })
    }

    if (data.tarifa_energia_cop_kwh.value > 0) {
      const baseTarifa = data.tarifa_energia_cop_kwh.value
      const costo_kwh = data.contribucion_20.value
        ? Math.round(baseTarifa * 1.20)
        : baseTarifa
      setAdvancedData({ costo_kwh })
    }

    setBillScanKey((k) => k + 1)
  }, [setClientData, setTechnicalData, setAdvancedData])

  const ready = editId
    ? (!proposalToEdit && editingId === null) || editingId === editId
    : editingId === null

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-mirac-red border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {editingId ? 'Editar Cotización' : 'Nueva Cotización'}
        </h1>
        <Button variant="outline" onClick={() => setScannerOpen(true)}>
          <ScanLine className="mr-2 size-4" />
          Escanear Factura
        </Button>
      </div>

      <QuotationWizard key={`${editId ?? 'new'}-${billScanKey}`} />

      <ScanBillDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDataAccepted={handleBillData}
      />
    </div>
  )
}

export default function CotizacionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="size-8 animate-spin rounded-full border-2 border-mirac-red border-t-transparent" /></div>}>
      <CotizacionContent />
    </Suspense>
  )
}
