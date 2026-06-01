import type { Metadata } from 'next'
import CargadoresView from './page-client'

export const metadata: Metadata = {
  title: 'Cargadores EV | Mirac Energy',
  description: 'Cotizador de puntos de carga para vehículos eléctricos.',
}

export default function Page() {
  return <CargadoresView />
}
