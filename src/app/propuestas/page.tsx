import type { Metadata } from 'next'
import PropuestasView from './page-client'

export const metadata: Metadata = {
  title: 'Propuestas | Mirac Energy',
  description: 'Listado y gestión de propuestas solares.',
}

export default function Page() {
  return <PropuestasView />
}
