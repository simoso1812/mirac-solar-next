'use client'

import { Suspense } from 'react'

function SharedContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111827]">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[#F9FAFB]">Enlace expirado</h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">
          Este formato de enlace ya no es válido. Solicita un nuevo enlace de la propuesta.
        </p>
      </div>
    </div>
  )
}

export default function SharedPage() {
  return (
    <div className="min-h-screen bg-[#111827] text-[#F9FAFB]">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#BFFF00] border-t-transparent" />
          </div>
        }
      >
        <SharedContent />
      </Suspense>
    </div>
  )
}
