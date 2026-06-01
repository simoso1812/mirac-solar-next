import type { Metadata } from 'next'
import ClienteDetailView from './page-client'

export const metadata: Metadata = {
  title: 'Cliente | Mirac Energy',
  description: 'Detalle del cliente.',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ClienteDetailView params={params} />
}
