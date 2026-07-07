'use client'

import { useState } from 'react'

interface ImportantAspectsSectionProps {
  bateriaHabilitada: boolean
  mostrarIncentivos: boolean
}

const ASPECTOS_SIN_BATERIA = [
  'Este sistema está diseñado para funcionar solo con conexión a la red eléctrica y no operará en ausencias de energía.',
  'Como es un sistema conectado a la red (on grid), no está preparado para incluir baterías.',
]

const ASPECTOS_CON_BATERIA = [
  'Este sistema incluye respaldo con baterías; la autonomía en ausencias de red depende de la capacidad instalada.',
]

const ASPECTOS_COMUNES = [
  'Los techos de concreto y teja deben poder soportar un peso de 20 kg/m².',
  'Cualquier excedente de energía que produzcas y no utilices será compensado por tu actual proveedor de energía, de acuerdo con las normativas vigentes.',
  'Esta propuesta no cubre trabajos eléctricos adicionales ni obras civiles para reforzar estructuras necesarias para sostener los paneles.',
  'Si los equipos mencionados no están disponibles se reemplazarán por unos de igual calidad.',
  'En una vivienda nueva, es necesario contar previamente con conexión eléctrica legalizada para realizar el proyecto.',
]

const GARANTIAS = [
  { anios: '3 años', concepto: 'Instalación' },
  { anios: '12 años', concepto: 'Paneles' },
  { anios: '5 años', concepto: 'Inversores' },
]

const ENTREGABLES = [
  'Planos de diseño y memorias de cálculo',
  'Certificado RETIE de la instalación',
  'Sistema fotovoltaico legalizado ante las entidades competentes',
  'Acceso a plataforma de monitoreo digital de generación de energía',
  'Certificado UPME para acceder a beneficios tributarios',
]

const INCENTIVOS_PARRAFOS = [
  'Como parte del proyecto de energía solar fotovoltaica, en calidad de declarante de renta puedes acceder a los beneficios tributarios previstos en la Ley 1715 de 2014, modificada por la Ley 2099 de 2021. Esta normativa permite tomar como deducción en el impuesto de renta hasta el cincuenta por ciento (50%) del valor invertido en el sistema solar, distribuido en un período máximo de quince (15) años a partir del año gravable siguiente a la entrada en operación del sistema.',
  'Cada año, el valor deducible por este concepto no puede superar el cincuenta por ciento (50%) de tu renta líquida antes de aplicar la deducción, por lo que el beneficio se utiliza de manera gradual según tu nivel de ingresos y la planeación tributaria con tu contador o asesor. Además, si eres persona jurídica puedes acceder a depreciación acelerada, depreciando el activo hasta en 3 años.',
  'Para que la DIAN reconozca este beneficio, la ley exige que la inversión sea certificada como proyecto de generación con fuentes no convencionales por la Unidad de Planeación Minero-Energética (UPME). Dentro del alcance de este proyecto, Mirac Ingenieros incluye la gestión del certificado UPME, de modo que, una vez instalado y legalizado el sistema, recibirás junto con los demás entregables el soporte necesario para sustentar la deducción ante la DIAN.',
]

function GroupTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-[#F9FAFB]">{children}</h3>
}

export function ImportantAspectsSection({ bateriaHabilitada, mostrarIncentivos }: ImportantAspectsSectionProps) {
  const [open, setOpen] = useState(false)

  const aspectos = [
    ...(bateriaHabilitada ? ASPECTOS_CON_BATERIA : ASPECTOS_SIN_BATERIA),
    ...ASPECTOS_COMUNES,
  ]

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-left transition-colors hover:bg-white/[0.08]"
      >
        <span className="text-sm font-medium text-[#9CA3AF]">Aspectos importantes</span>
        <svg
          className={`h-4 w-4 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div>
            <GroupTitle>Condiciones del sistema</GroupTitle>
            <ul className="space-y-2">
              {aspectos.map((texto) => (
                <li key={texto} className="flex gap-2 text-sm leading-relaxed text-[#D1D5DB]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#BFFF00]" />
                  {texto}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <GroupTitle>Garantías</GroupTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {GARANTIAS.map((g) => (
                <div
                  key={g.concepto}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                >
                  <p className="text-xl font-bold text-[#BFFF00]">{g.anios}</p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">{g.concepto}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <GroupTitle>Entregables</GroupTitle>
            <p className="mb-2 text-sm text-[#9CA3AF]">
              Al finalizar la prestación del servicio se entregarán los siguientes documentos:
            </p>
            <ul className="space-y-2">
              {ENTREGABLES.map((texto) => (
                <li key={texto} className="flex gap-2 text-sm leading-relaxed text-[#D1D5DB]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#BFFF00]" />
                  {texto}
                </li>
              ))}
            </ul>
          </div>

          {mostrarIncentivos && (
            <div>
              <GroupTitle>Incentivos tributarios</GroupTitle>
              <div className="space-y-3">
                {INCENTIVOS_PARRAFOS.map((parrafo) => (
                  <p key={parrafo.slice(0, 40)} className="text-sm leading-relaxed text-[#D1D5DB]">
                    {parrafo}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
