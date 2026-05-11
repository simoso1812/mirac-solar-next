'use client'

import { PdfDownloadButton } from '@/components/pdf-download-button'
import { ShareDialog } from './share-dialog'
import { DocusealSignDialog } from './docuseal-sign-dialog'
import type { ClientData, DocusealSignatureData, QuotationData } from '@/lib/types'

interface CallToActionProps {
  proposal: QuotationData
  isShared?: boolean
  onDocusealUpdate?: (docuseal: DocusealSignatureData, accepted?: boolean) => void
  onClientUpdate?: (clientPatch: Partial<ClientData>) => Promise<void> | void
}

export function CallToAction({ proposal, isShared, onDocusealUpdate, onClientUpdate }: CallToActionProps) {
  const isSigned = proposal.status === 'accepted' || proposal.docuseal?.status === 'completed' || !!proposal.signature

  return (
    <section>
      <div className="rounded-xl border border-[#BFFF00]/30 bg-[#BFFF00]/5 p-6 text-center">
        <h2 className="mb-2 text-xl font-bold text-[#F9FAFB]">
          {isSigned ? 'Propuesta Aceptada' : '¿Listo para avanzar?'}
        </h2>
        <p className="mb-6 text-sm text-[#9CA3AF]">
          {isSigned
            ? 'Esta propuesta ha sido firmada y aceptada. Nuestro equipo se pondrá en contacto contigo.'
            : 'Descarga el PDF, comparte con tu equipo o firma el contrato para confirmar.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <PdfDownloadButton
            proposal={proposal}
            className="border-white/20 bg-white/5 text-[#F9FAFB] hover:bg-white/10"
          />
          {!isShared && <ShareDialog proposal={proposal} />}
          {!isSigned && onDocusealUpdate && (
            <DocusealSignDialog
              proposal={proposal}
              onUpdate={onDocusealUpdate}
              onClientUpdate={onClientUpdate}
            />
          )}
        </div>
        {isSigned && proposal.docuseal?.completed_at && (
          <div className="mt-4 inline-block rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-[#9CA3AF]">
            Contrato firmado con DocuSeal el{' '}
            {new Date(proposal.docuseal.completed_at).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
        {isSigned && proposal.signature && (
          <div className="mt-4 inline-block rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-[#9CA3AF]">
            Firmado por {proposal.signature.name} el{' '}
            {new Date(proposal.signature.timestamp).toLocaleDateString('es-CO', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </section>
  )
}
