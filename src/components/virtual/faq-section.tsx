'use client'

import { useState } from 'react'

const PREGUNTAS = [
  {
    pregunta: '¿Qué mantenimiento requiere el sistema?',
    respuesta: 'El sistema requiere un mantenimiento anual; su precio está incluido en esta propuesta.',
  },
  {
    pregunta: '¿Qué pasa en días nublados o de lluvia?',
    respuesta:
      'El sistema sigue generando energía, aunque en menor proporción. La diferencia la cubre automáticamente la red eléctrica, por lo que nunca te quedas sin suministro.',
  },
  {
    pregunta: '¿Qué pasa con la energía que no consumo?',
    respuesta:
      'Los excedentes se entregan a la red y tu proveedor de energía los compensa de acuerdo con la normativa vigente (Resolución CREG). El detalle depende del modo de conexión definido en esta propuesta.',
  },
  {
    pregunta: '¿Qué pasa si vendo la propiedad?',
    respuesta:
      'El sistema solar queda instalado en el inmueble y lo valoriza: el nuevo propietario hereda la generación y los ahorros. Las garantías de los equipos se mantienen.',
  },
  {
    pregunta: '¿Cuánto dura la instalación?',
    respuesta:
      'La instalación física toma típicamente entre unos días y pocas semanas según el tamaño del sistema. El cronograma detallado de esta propuesta incluye también los tiempos de legalización ante el operador de red.',
  },
  {
    pregunta: '¿Los paneles resisten granizo y viento?',
    respuesta:
      'Sí. Los módulos cuentan con certificaciones internacionales que exigen resistencia a impacto de granizo y a cargas de viento y nieve muy superiores a las condiciones típicas de Colombia.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-left transition-colors hover:bg-white/[0.08]"
      >
        <span className="text-sm font-medium text-[#9CA3AF]">Preguntas frecuentes</span>
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
        <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
          {PREGUNTAS.map((item, i) => (
            <div key={item.pregunta} className="border-b border-white/10 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenIndex((prev) => (prev === i ? null : i))}
                className="flex w-full items-center justify-between gap-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-[#F9FAFB]">{item.pregunta}</span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 text-[#9CA3AF] transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === i && (
                <p className="pb-4 text-sm leading-relaxed text-[#D1D5DB]">{item.respuesta}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
