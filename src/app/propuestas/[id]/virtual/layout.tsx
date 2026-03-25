import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export const metadata: Metadata = {
  title: 'Cotización Virtual | Mirac Solar',
  description: 'Propuesta interactiva de energía solar — Mirac Energy',
}

export default function VirtualLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="virtual-quotation min-h-screen bg-[#111827] text-[#F9FAFB]">
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </div>
  )
}
