import Image from 'next/image'

export function VirtualFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0d1117] py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center">
        <Image
          src="/assets/LogoBlanco.png"
          alt="Mirac Energy"
          width={100}
          height={33}
          className="h-6 w-auto opacity-60"
        />
        <p className="text-xs text-[#9CA3AF]">
          Mirac Energy S.A.S. — Soluciones de energía solar fotovoltaica para Colombia
        </p>
        <p className="text-xs text-[#9CA3AF]/60">
          Esta cotización es informativa y está sujeta a verificación técnica en sitio.
        </p>
      </div>
    </footer>
  )
}
