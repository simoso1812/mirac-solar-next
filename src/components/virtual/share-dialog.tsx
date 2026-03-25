'use client'

import { useState } from 'react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Share2, Copy, Check, MessageCircle } from 'lucide-react'
import { generateShareUrl } from '@/lib/share'
import { toast } from 'sonner'
import type { QuotationData } from '@/lib/types'

interface ShareDialogProps {
  proposal: QuotationData
}

export function ShareDialog({ proposal }: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && !url) {
      setGenerating(true)
      try {
        const shareUrl = await generateShareUrl(proposal)
        setUrl(shareUrl)
      } catch {
        toast.error('Error al generar el enlace')
      } finally {
        setGenerating(false)
      }
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Enlace copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hola, te comparto la propuesta solar de Mirac Energy para ${proposal.client.nombre}:\n${url}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-white/20 bg-white/5 text-[#F9FAFB] hover:bg-white/10">
            <Share2 className="mr-2 h-4 w-4" />
            Compartir
          </Button>
        }
      />
      <DialogContent className="bg-[#1F2937] border-white/10 text-[#F9FAFB] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F9FAFB]">Compartir Propuesta</DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            Comparte esta cotización con tu cliente mediante un enlace.
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
            <span className="ml-3 text-sm text-[#9CA3AF]">Generando enlace...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={url}
                readOnly
                className="bg-white/5 border-white/10 text-[#F9FAFB] text-xs"
              />
              <Button
                size="sm"
                onClick={handleCopy}
                className="shrink-0 bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/5 text-[#F9FAFB] hover:bg-white/10"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="mr-2 h-4 w-4 text-green-400" />
              Compartir por WhatsApp
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
