'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileSignature, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ClientData, DocusealSignatureData, QuotationData } from '@/lib/types'

interface DocusealSignDialogProps {
  proposal: QuotationData
  onUpdate: (docuseal: DocusealSignatureData, accepted?: boolean) => void
  onClientUpdate?: (clientPatch: Partial<ClientData>) => Promise<void> | void
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
  const submissionId = proposal.docuseal?.submission_id
  const res = await fetch('/api/docuseal/submission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposal,
      // The API requires the submitter slug alongside the submission id as
      // proof of access (DocuSeal ids are sequential and enumerable).
      ...(submissionId
        ? { submissionId, submitterSlug: proposal.docuseal?.submitter_slug }
        : {}),
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'No se pudo preparar el contrato')
  return data.docuseal as DocusealSignatureData
}

function hasMissingClientData(client: ClientData): boolean {
  return !client.email?.trim() || !client.nit_cc?.trim()
}

type Stage = 'idle' | 'collect-data' | 'embed'

export function DocusealSignDialog({ proposal, onUpdate, onClientUpdate, disabled }: DocusealSignDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [docuseal, setDocuseal] = useState<DocusealSignatureData | null>(proposal.docuseal ?? null)
  const [stage, setStage] = useState<Stage>('idle')
  const [emailInput, setEmailInput] = useState(proposal.client.email ?? '')
  const [cedulaInput, setCedulaInput] = useState(proposal.client.nit_cc ?? '')
  const [telefonoInput, setTelefonoInput] = useState(proposal.client.telefono ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const formHostRef = useRef<HTMLDivElement>(null)
  // Latest signing-result handlers, read inside DocuSeal event listeners so the
  // embed effect never needs to re-run (and tear down the form) when they change.
  const handlersRef = useRef<{ completed: () => void; declined: () => void }>({
    completed: () => {},
    declined: () => {},
  })

  const createSubmission = async (effectiveProposal: QuotationData) => {
    setLoading(true)
    try {
      const nextDocuseal = await requestDocusealSubmission(effectiveProposal)
      setDocuseal(nextDocuseal)
      onUpdate(nextDocuseal, nextDocuseal.status === 'completed')
      setStage('embed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo preparar el contrato')
    } finally {
      setLoading(false)
    }
  }

  const prepareSigning = async () => {
    setOpen(true)
    setFormError(null)

    if (docuseal?.embed_src && docuseal.status !== 'completed') {
      setStage('embed')
      return
    }

    if (hasMissingClientData(proposal.client)) {
      // Prefill the form from the latest client data when entering this stage.
      setEmailInput(proposal.client.email ?? '')
      setCedulaInput(proposal.client.nit_cc ?? '')
      setTelefonoInput(proposal.client.telefono ?? '')
      setStage('collect-data')
      return
    }

    await createSubmission(proposal)
  }

  const handleDataSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const email = emailInput.trim()
    const cedula = cedulaInput.trim()
    const telefono = telefonoInput.trim()

    if (!email) {
      setFormError('El correo electrónico es obligatorio para firmar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Ingresa un correo electrónico válido.')
      return
    }
    if (!cedula) {
      setFormError('La cédula o NIT es obligatoria para el contrato.')
      return
    }

    const clientPatch: Partial<ClientData> = { email, nit_cc: cedula, telefono }

    if (onClientUpdate) {
      try {
        await onClientUpdate(clientPatch)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'No se pudieron guardar los datos')
        return
      }
    }

    const effective: QuotationData = {
      ...proposal,
      client: { ...proposal.client, ...clientPatch },
    }
    await createSubmission(effective)
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

  useEffect(() => {
    handlersRef.current = { completed: handleCompleted, declined: handleDeclined }
  })

  useEffect(() => {
    if (!open || stage !== 'embed' || !docuseal?.embed_src || !formHostRef.current) return

    let formEl: HTMLElement | null = null
    let cancelled = false
    const onCompleted = () => handlersRef.current.completed()
    const onDeclined = () => handlersRef.current.declined()

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

        formEl.addEventListener('completed', onCompleted)
        formEl.addEventListener('declined', onDeclined)
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar DocuSeal')
      })

    return () => {
      cancelled = true
      if (formEl) {
        formEl.removeEventListener('completed', onCompleted)
        formEl.removeEventListener('declined', onDeclined)
      }
    }
  }, [open, stage, docuseal?.embed_src, proposal.id, proposal.client.email, proposal.client.nombre])

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
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <FileSignature className="mr-2 size-4" />
            )}
            {loading ? 'Preparando…' : 'Firmar Contrato'}
          </Button>
        }
      />
      <DialogContent className="bg-[#111827] border-white/10 text-[#F9FAFB] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F9FAFB]">
            {stage === 'collect-data' ? 'Confirma tus datos' : 'Firma del Contrato'}
          </DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            {stage === 'collect-data'
              ? 'Necesitamos estos datos para preparar tu contrato.'
              : 'Revisa y firma el contrato de prestación de servicios.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'collect-data' && !loading && (
          <form onSubmit={handleDataSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="presign-email" className="text-[#D1D5DB]">Correo electrónico</Label>
              <Input
                id="presign-email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="cliente@ejemplo.com"
                autoFocus
                required
                className="bg-white/5 border-white/10 text-[#F9FAFB]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presign-cedula" className="text-[#D1D5DB]">Cédula o NIT</Label>
              <Input
                id="presign-cedula"
                value={cedulaInput}
                onChange={(e) => setCedulaInput(e.target.value)}
                placeholder="1234567890"
                required
                className="bg-white/5 border-white/10 text-[#F9FAFB]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presign-telefono" className="text-[#D1D5DB]">
                Teléfono <span className="text-[#6B7280]">(opcional)</span>
              </Label>
              <Input
                id="presign-telefono"
                value={telefonoInput}
                onChange={(e) => setTelefonoInput(e.target.value)}
                placeholder="+57 300 123 4567"
                className="bg-white/5 border-white/10 text-[#F9FAFB]"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#BFFF00] text-[#111827] hover:bg-[#BFFF00]/80 font-bold"
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Continuar a la firma
            </Button>
          </form>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-[#9CA3AF]">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Preparando contrato…
          </div>
        )}
        {!loading && stage === 'embed' && docuseal?.embed_src && (
          <div ref={formHostRef} className="min-h-[640px] overflow-hidden rounded-lg bg-white text-black" />
        )}
        {!loading && stage === 'embed' && !docuseal?.embed_src && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-[#9CA3AF]">
            No se pudo preparar el formulario de firma.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
