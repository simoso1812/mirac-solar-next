import type { Metadata } from 'next'
import ClientesView from './page-client'

export const metadata: Metadata = {
  title: 'Clientes | Mirac Energy',
  description: 'Gestión de clientes de Mirac Energy.',
}

export default function Page() {
  return <ClientesView />
}
