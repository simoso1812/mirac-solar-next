import type { Metadata, Viewport } from 'next'
import SharedShortView from './page-client'

export const metadata: Metadata = {
  title: 'Propuesta Solar | Mirac Energy',
  description: 'Propuesta solar compartida.',
}

// Declaring a dark scheme stops browser auto-dark from repainting the deck palette.
export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0D0D0D',
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SharedShortView params={params} />
}
