import type { Metadata } from 'next'
import PropuestaDetailView from './page-client'

export const metadata: Metadata = {
  title: 'Propuesta | Mirac Energy',
  description: 'Detalle de la propuesta solar.',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <PropuestaDetailView params={params} />
}
