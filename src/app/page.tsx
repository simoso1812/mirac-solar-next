import type { Metadata } from 'next'
import HomeView from './page-client'

export const metadata: Metadata = {
  title: 'Mirac Energy | Cotizador Solar',
  description: 'Panel de cotizaciones de sistemas solares fotovoltaicos.',
}

export default function Page() {
  return <HomeView />
}
