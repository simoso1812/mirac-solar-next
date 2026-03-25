'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PenLine, RotateCcw, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { SignatureData } from '@/lib/types'

interface ESignDialogProps {
  onSign: (signature: SignatureData) => void
  disabled?: boolean
}

export function ESignDialog({ onSign, disabled }: ESignDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const canvasInitialized = useRef(false)

  const initCanvas = useRef((canvas: HTMLCanvasElement | null) => {
    if (!canvas || canvasInitialized.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.strokeStyle = '#BFFF00'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    canvasRef.current = canvas
    canvasInitialized.current = true
  })

  useEffect(() => {
    if (!open) {
      canvasInitialized.current = false
    }
  }, [open])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const endDraw = () => setIsDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Ingresa tu nombre')
      return
    }
    if (!email.trim()) {
      toast.error('Ingresa tu correo electrónico')
      return
    }
    if (!hasDrawn) {
      toast.error('Dibuja tu firma en el recuadro')
      return
    }

    const canvas = canvasRef.current!
    const signature: SignatureData = {
      name: name.trim(),
      email: email.trim(),
      image: canvas.toDataURL('image/png'),
      timestamp: new Date().toISOString(),
    }

    onSign(signature)
    setOpen(false)
    setName('')
    setEmail('')
    setHasDrawn(false)
    toast.success('Propuesta firmada exitosamente')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            disabled={disabled}
            className="bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80 font-bold"
          >
            <PenLine className="mr-2 h-4 w-4" />
            Firmar Propuesta
          </Button>
        }
      />
      <DialogContent className="bg-[#1F2937] border-white/10 text-[#F9FAFB] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F9FAFB]">Firma Digital</DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            Firma esta propuesta para confirmar tu aceptación.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[#9CA3AF]">Nombre completo</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre completo"
              className="mt-1 bg-white/5 border-white/10 text-[#F9FAFB] placeholder:text-[#9CA3AF]/50"
            />
          </div>
          <div>
            <Label className="text-[#9CA3AF]">Correo electrónico</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="mt-1 bg-white/5 border-white/10 text-[#F9FAFB] placeholder:text-[#9CA3AF]/50"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-[#9CA3AF]">Tu firma</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCanvas}
                className="text-[#9CA3AF] hover:text-[#F9FAFB] h-7"
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Limpiar
              </Button>
            </div>
            <canvas
              ref={initCanvas.current}
              className="h-32 w-full cursor-crosshair rounded-lg border border-white/10 bg-white/5 touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
        </div>

        <DialogFooter className="bg-[#1F2937] border-white/10">
          <Button
            onClick={handleSubmit}
            className="bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80 font-bold"
          >
            <Check className="mr-2 h-4 w-4" />
            Confirmar Firma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
