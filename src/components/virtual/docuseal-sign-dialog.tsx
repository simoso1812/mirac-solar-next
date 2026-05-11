'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileSignature, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DocusealSignatureData, QuotationData } from '@/lib/types'

interface DocusealSignDialogProps {
  proposal: QuotationData
  onUpdate: (docuseal: DocusealSignatureData, accepted?: boolean) => void
  disabled?: boolean
}

declare global {
  interface HTMLElementTagNameMap {
    'docuseal-form': HTMLElement
  }
}

const DOCUSEAL_SCRIPT_ID = 'docuseal-form-script'

function loadDocusealScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(DOCUSEAL_SCRIPT_ID)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = DOCUSEAL_SCRIPT_ID
    script.src = 'https://cdn.docuseal.com/js/form.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar DocuSeal'))
    document.head.appendChild(script)
  })
}

async function requestDocusealSubmission(proposal: QuotationData): Promise<DocusealSignatureData> {
  const res = await fetch('/api/docuseal/submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal,
      submissionId: proposal.docuseal?.submission_id,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No se pudo preparar el contrato')
  return data.docuseal as DocusealSignatureData
}

export function DocusealSignDialog({ proposal, onUpdate, disabled }: DocusealSignDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [docuseal, setDocuseal] = useState<DocusealSignatureData | null>(proposal.docuseal ?? null)
  const formHostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDocuseal(proposal.docuseal ?? null)
  }, [proposal.docuseal])

  useEffect(() => {
    if (!open || !docuseal?.embed_src || !formHostRef.current) return

    let formEl: HTMLElement | null = null
    let cancelled = false

    loadDocusealScript()
      .then(() => {
        if (cancelled || !formHostRef.current) return
        formHostRef.current.innerHTML = ''
        formEl = document.createElement('docuseal-form')
        formEl.setAttribute('data-src', docuseal.embed_src)
        formEl.setAttribute('data-email', proposal.client.email)
        formEl.setAttribute('data-name', proposal.client.nombre)
        formEl.setAttribute('data-language', 'es')
        formEl.setAttribute('data-external-id', proposal.id)
        formEl.setAttribute('data-send-copy-email', 'true')
        formEl.setAttribute('data-with-decline', 'true')
        formEl.setAttribute('data-completed-message-title', 'Contrato firmado')
        formEl.setAttribute('data-completed-message-body', 'Gracias. Mirac Energy recibió tu contrato firmado.')
        formHostRef.current.appendChild(formEl)

        formEl.addEventListener('completed', handleCompleted)
        formEl.addEventListener('declined', handleDeclined)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar DocuSeal')
      })

    return () => {
      cancelled = true
      if (formEl) {
        formEl.removeEventListener('completed', handleCompleted)
        formEl.removeEventListener('declined', handleDeclined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docuseal?.embed_src, proposal.id, proposal.client.email, proposal.client.nombre])

  const prepareSigning = async () => {
    setOpen(true)
    if (docuseal?.embed_src && docuseal.status !== 'completed') return

    setLoading(true)
    try {
      const nextDocuseal = await requestDocusealSubmission(proposal)
      setDocuseal(nextDocuseal)
      onUpdate(nextDocuseal, nextDocuseal.status === 'completed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo preparar el contrato')
    } finally {
      setLoading(false)
    }
  }

  const refreshSubmission = async (accepted: boolean) => {
    if (!docuseal?.submission_id) return
    try {
      const nextDocuseal = await requestDocusealSubmission({
        ...proposal,
        docuseal,
      })
      setDocuseal(nextDocuseal)
      onUpdate(nextDocuseal, accepted || nextDocuseal.status === 'completed')
    } catch {
      onUpdate(
        {
          ...docuseal,
          status: accepted ? 'completed' : 'declined',
          completed_at: accepted ? new Date().toISOString() : docuseal.completed_at,
          declined_at: accepted ? docuseal.declined_at : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        accepted,
      )
    }
  }

  const handleCompleted = () => {
    toast.success('Contrato firmado exitosamente')
    void refreshSubmission(true)
  }

  const handleDeclined = () => {
    toast.error('Firma rechazada')
    void refreshSubmission(false)
  }

  const isCompleted = proposal.docuseal?.status === 'completed'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            disabled={disabled || isCompleted}
            onClick={prepareSigning}
            className="bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80 font-bold"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSignature className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Preparando...' : 'Firmar Contrato'}
          </Button>
        }
      />
      <DialogContent className="bg-[#111827] border-white/10 text-[#F9FAFB] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F9FAFB]">Firma del Contrato</DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            Revisa y firma el contrato de prestación de servicios.
          </DialogDescription>
        </DialogHeader>
        {loading && (
          <div className="flex items-center justify-center py-16 text-[#9CA3AF]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Preparando contrato...
          </div>
        )}
        {!loading && docuseal?.embed_src && (
          <div ref={formHostRef} className="min-h-[640px] overflow-hidden rounded-lg bg-white text-black" />
        )}
        {!loading && !docuseal?.embed_src && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-[#9CA3AF]">
            No se pudo preparar el formulario de firma.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
