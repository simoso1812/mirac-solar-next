'use client'

import { useState, useMemo } from 'react'
import { cotizacionCargadoresCostos, calcularMaterialesCargador } from '@/lib/chargers'
import { generarPdfCargadores } from '@/lib/chargers-pdf'
import { formatCOP } from '@/lib/formatting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Zap, Calculator, Package, DollarSign, Ruler, FileText, Download, Loader2,
} from 'lucide-react'

export default function CargadoresPage() {
  const [distancia, setDistancia] = useState<number>(10)
  const [precioTotal, setPrecioTotal] = useState<string>('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  const costos = useMemo(() => {
    if (!showResults) return null
    const precio = parseFloat(precioTotal)
    if (!precio || precio <= 0) return null
    return cotizacionCargadoresCostos(precio)
  }, [precioTotal, showResults])

  const materiales = useMemo(() => {
    if (!showResults) return []
    return calcularMaterialesCargador(distancia)
  }, [distancia, showResults])

  const handleCalculate = () => {
    setShowResults(true)
  }

  const handleDownloadPdf = async () => {
    if (!costos) return
    setGeneratingPdf(true)
    try {
      const pdfBytes = await generarPdfCargadores(
        clienteNombre || 'Cliente',
        costos,
      )
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Propuesta_Mirac_Cargador_${(clienteNombre || 'Cliente').replace(/\s+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Error generating charger PDF:', e)
    } finally {
      setGeneratingPdf(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cargadores EV</h1>

      {/* Input form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-mirac-red" />
            Cotizador de Punto de Carga
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cliente">Nombre / Ubicación</Label>
              <Input
                id="cliente"
                placeholder="Ej: Edificio Mirac - Sótano 2"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_total">
                <DollarSign className="mr-1 inline h-3.5 w-3.5" />
                Precio Total (COP, IVA incluido)
              </Label>
              <Input
                id="precio_total"
                type="number"
                min={1}
                placeholder="Ingrese el precio total del proyecto"
                value={precioTotal}
                onChange={(e) => {
                  setPrecioTotal(e.target.value)
                  setShowResults(false)
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="distancia">
              <Ruler className="mr-1 inline h-3.5 w-3.5" />
              Distancia del cableado (metros)
            </Label>
            <Input
              id="distancia"
              type="number"
              min={1}
              max={200}
              value={distancia}
              onChange={(e) => {
                setDistancia(Number(e.target.value))
                setShowResults(false)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Se usa para estimar la lista de materiales
            </p>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={!precioTotal || parseFloat(precioTotal) <= 0}
            className="bg-mirac-red hover:bg-mirac-red-dark"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Cotización
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {costos && (
        <>
          {/* Cost breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-mirac-red" />
                Desglose de Costos
              </CardTitle>
              {clienteNombre && (
                <p className="text-sm text-muted-foreground">{clienteNombre}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <CostRow label="Diseño (35%)" value={costos.diseno} />
                <CostRow label="Materiales (65%)" value={costos.materiales} />
                <Separator />
                <CostRow label="Subtotal" value={costos.subtotalAntesIva} />
                <CostRow label="IVA (19%)" value={costos.iva} />
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-lg font-bold text-mirac-red">
                    {formatCOP(costos.costoTotal)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PDF Download */}
          <Button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="w-full bg-mirac-red hover:bg-mirac-red-dark"
          >
            {generatingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {generatingPdf ? 'Generando PDF...' : 'Descargar PDF de Cargadores'}
          </Button>

          {/* Materials list */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-5 w-5 text-mirac-yellow" />
                Lista de Materiales Aproximada
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Basada en {distancia}m de distancia de cableado
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiales.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{m.nombre}</TableCell>
                      <TableCell className="text-right font-medium">{m.cantidad}</TableCell>
                      <TableCell className="text-muted-foreground">{m.unidad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Summary card */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Ruler className="h-5 w-5 text-mirac-yellow" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distancia</p>
                    <p className="text-xl font-bold">{distancia} m</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Materiales</p>
                    <p className="text-xl font-bold">{materiales.length} ítems</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Costo Total</p>
                    <p className="text-xl font-bold">{formatCOP(costos.costoTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatCOP(value)}</span>
    </div>
  )
}
