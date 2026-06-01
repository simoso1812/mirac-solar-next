import type { Metadata } from 'next'
import SharedShortView from './page-client'

export const metadata: Metadata = {
  title: 'Propuesta Solar | Mirac Energy',
  description: 'Propuesta solar compartida.',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SharedShortView params={params} />
}
