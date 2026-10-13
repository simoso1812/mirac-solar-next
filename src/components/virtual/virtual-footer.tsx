import Image from 'next/image'
import { MiracBar } from './mirac-lines'

export function VirtualFooter() {
  return (
    <footer className="bg-[#0D0D0D] text-white">
      <MiracBar />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <Image
            src="/assets/LogoBlanco.png"
            alt="Mirac Energy"
            width={100}
            height={33}
            className="h-7 w-auto self-start"
          />
          <p className="text-xs text-[#C6CFD2]">
            Mirac Energy S.A.S. · Soluciones de energía solar fotovoltaica para Colombia
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#9AA3A7]">www.mirac.energy</p>
          <p className="text-xs text-[#9AA3A7]">
            Esta cotización es informativa y está sujeta a verificación técnica en sitio.
          </p>
        </div>
      </div>
    </footer>
  )
}
