'use client'

import { useState } from 'react'
import { ShareDialog } from './share-dialog'
import { DocusealSignDialog } from './docuseal-sign-dialog'
import { formatFechaLarga } from '@/lib/formatting'
import type { ClientData, DocusealSignatureData, QuotationData } from '@/lib/types'

interface CallToActionProps {
  proposal: QuotationData
  isShared?: boolean
  onDocusealUpdate?: (docuseal: DocusealSignatureData, accepted?: boolean) => void
  onClientUpdate?: (clientPatch: Partial<ClientData>) => Promise<void> | void
  validezHasta?: Date | null
}

export function CallToAction({ proposal, isShared, onDocusealUpdate, onClientUpdate, validezHasta }: CallToActionProps) {
  const [now] = useState(() => Date.now())
  const isSigned = proposal.status === 'accepted' || proposal.docuseal?.status === 'completed' || !!proposal.signature
  const ofertaVencida = !!validezHasta && validezHasta.getTime() < now

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-[#0D0D0D]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[position:38%_60%] md:bg-[position:center_75%]"
        style={{ backgroundImage: 'url(/virtual/band-contact.webp)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center,rgba(13,13,13,.78),rgba(13,13,13,.5) 70%,rgba(13,13,13,.4))' }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 md:py-32">
        <h2 className="mb-2 text-xl font-bold text-white">
          {isSigned ? 'Propuesta Aceptada' : '¿Listo para avanzar?'}
        </h2>
        <p className="mb-6 text-sm text-[#9AA3A7]">
          {isSigned
            ? 'Esta propuesta ha sido firmada y aceptada. Nuestro equipo se pondrá en contacto contigo.'
            : 'Comparte esta propuesta digital con tu equipo o firma el contrato para confirmar.'}
        </p>
        {!isSigned && validezHasta && (
          <p className={`mb-4 text-xs ${ofertaVencida ? 'text-[#FF9E1B]' : 'text-[#9AA3A7]'}`}>
            {ofertaVencida
              ? `Esta oferta venció el ${formatFechaLarga(validezHasta)}. Contáctanos para actualizar tu cotización.`
              : `Oferta válida hasta el ${formatFechaLarga(validezHasta)}.`}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
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
          <div className="mt-4 inline-block rounded-lg border border-[#2A2A2A] bg-[#161616] px-4 py-2 text-xs text-[#9AA3A7]">
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
          <div className="mt-4 inline-block rounded-lg border border-[#2A2A2A] bg-[#161616] px-4 py-2 text-xs text-[#9AA3A7]">
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
