import type { Metadata } from 'next'
import VirtualQuotationView from './page-client'

export const metadata: Metadata = {
  title: 'Cotización Virtual | Mirac Energy',
  description: 'Vista virtual de la propuesta solar.',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <VirtualQuotationView params={params} />
}
