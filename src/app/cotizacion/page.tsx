import type { Metadata } from 'next'
import CotizacionView from './page-client'

export const metadata: Metadata = {
  title: 'Nueva Cotización | Mirac Energy',
  description: 'Asistente para crear una cotización solar.',
}

export default function Page() {
  return <CotizacionView />
}
