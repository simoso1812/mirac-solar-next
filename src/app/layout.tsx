import type { Metadata } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MainLayout } from '@/components/layout/main-layout'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mirac Solar | Calculadora de Energía Solar',
  description: 'Cotizador de sistemas de energía solar fotovoltaica para Colombia — Mirac Energy',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <MainLayout>{children}</MainLayout>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
