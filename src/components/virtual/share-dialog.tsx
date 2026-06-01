'use client'

import { useState } from 'react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Share2, Copy, Check, MessageCircle } from 'lucide-react'
import { generateShareUrl, generateMultiShareUrl } from '@/lib/share'
import { useProposalsStore } from '@/stores/proposals-store'
import { formatKWp, formatCOPMillones } from '@/lib/formatting'
import { toast } from 'sonner'
import type { QuotationData } from '@/lib/types'

interface ShareDialogProps {
  proposal: QuotationData
}

interface VersionEntry {
  id: string
  proposal: QuotationData
  label: string
  selected: boolean
}

export function ShareDialog({ proposal }: ShareDialogProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [versions, setVersions] = useState<VersionEntry[]>([])

  const getProposalsByClient = useProposalsStore((s) => s.getProposalsByClient)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Snapshot the client's other proposals when the dialog opens.
      const clientProposals = getProposalsByClient(proposal.client.nombre).filter(
        (p) => p.results != null
      )
      setVersions(
        clientProposals.length > 1
          ? clientProposals.map((p, i) => ({
              id: p.id,
              proposal: p,
              label: `Opción ${i + 1}`,
              selected: p.id === proposal.id, // pre-select current
            }))
          : []
      )
      setUrl('')
    }
    setOpen(next)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const selected = versions.filter((v) => v.selected)

      if (selected.length > 1) {
        // Multi-version share
        const shareUrl = await generateMultiShareUrl(
          selected.map((v) => ({ label: v.label, proposal: v.proposal }))
        )
        setUrl(shareUrl)
      } else {
        // Single share
        const shareUrl = await generateShareUrl(proposal)
        setUrl(shareUrl)
      }
    } catch {
      toast.error('Error al generar el enlace')
    } finally {
      setGenerating(false)
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

  const toggleVersion = (id: string) => {
    setVersions((prev) =>
      prev.map((v) => (v.id === id ? { ...v, selected: !v.selected } : v))
    )
    setUrl('') // reset URL when selection changes
  }

  const updateLabel = (id: string, label: string) => {
    setVersions((prev) =>
      prev.map((v) => (v.id === id ? { ...v, label } : v))
    )
    setUrl('')
  }

  const selectedCount = versions.filter((v) => v.selected).length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-white/20 bg-white/5 text-[#F9FAFB] hover:bg-white/10">
            <Share2 className="mr-2 size-4" />
            Compartir
          </Button>
        }
      />
      <DialogContent className="bg-[#1F2937] border-white/10 text-[#F9FAFB] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F9FAFB]">Compartir Propuesta</DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            {versions.length > 1
              ? 'Selecciona las versiones que quieres incluir en el enlace.'
              : 'Comparte esta cotización con tu cliente mediante un enlace.'}
          </DialogDescription>
        </DialogHeader>

        {/* Version selection (only if multiple proposals for client) */}
        {versions.length > 1 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  v.selected ? 'border-[#BFFF00]/40 bg-[#BFFF00]/5' : 'border-white/10 bg-white/5'
                }`}
              >
                <input
                  type="checkbox"
                  checked={v.selected}
                  onChange={() => toggleVersion(v.id)}
                  aria-label={`Incluir ${v.label}`}
                  className="size-4 accent-[#BFFF00]"
                />
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={v.label}
                    onChange={(e) => updateLabel(v.id, e.target.value)}
                    aria-label="Nombre de la versión"
                    className="w-full bg-transparent text-sm font-medium text-[#F9FAFB] outline-none placeholder:text-[#9CA3AF]"
                  />
                  {v.proposal.results && (
                    <p className="text-xs text-[#9CA3AF]">
                      {formatKWp(v.proposal.results.kwp)} · {formatCOPMillones(v.proposal.results.costo_total_cop)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate or show URL */}
        {!url ? (
          <Button
            onClick={handleGenerate}
            disabled={generating || (versions.length > 1 && selectedCount === 0)}
            className="w-full bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80"
          >
            {generating ? (
              <>
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-[#111827] border-t-transparent" />
                Generando…
              </>
            ) : (
              <>
                Generar Enlace
                {versions.length > 1 && selectedCount > 1 && ` (${selectedCount} versiones)`}
              </>
            )}
          </Button>
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
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full border-white/20 bg-white/5 text-[#F9FAFB] hover:bg-white/10"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="mr-2 size-4 text-green-400" />
              Compartir por WhatsApp
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
