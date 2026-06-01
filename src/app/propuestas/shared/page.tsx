import type { Metadata } from 'next'
import SharedView from './page-client'

export const metadata: Metadata = {
  title: 'Propuesta Compartida | Mirac Energy',
  description: 'Vista de propuesta compartida.',
}

export default function Page() {
  return <SharedView />
}
