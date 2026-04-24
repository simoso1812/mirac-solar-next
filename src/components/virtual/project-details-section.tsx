'use client'

import { useCallback } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCOP, formatKWp } from '@/lib/formatting'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import type { QuotationData } from '@/lib/types'

interface ProjectDetailsSectionProps {
  proposal: QuotationData
}

export function ProjectDetailsSection({ proposal }: ProjectDetailsSectionProps) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-[#F9FAFB]">Detalles del Proyecto</h2>
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <Tabs defaultValue="tech">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="tech" className="text-[#9CA3AF] data-active:text-[#BFFF00] data-active:bg-white/10">
              Técnico
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-[#9CA3AF] data-active:text-[#BFFF00] data-active:bg-white/10">
              Cronograma
            </TabsTrigger>
            <TabsTrigger value="legal" className="text-[#9CA3AF] data-active:text-[#BFFF00] data-active:bg-white/10">
              Legal
            </TabsTrigger>
            <TabsTrigger value="location" className="text-[#9CA3AF] data-active:text-[#BFFF00] data-active:bg-white/10">
              Ubicación
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tech" className="mt-4">
            <TechTab proposal={proposal} />
          </TabsContent>
          <TabsContent value="timeline" className="mt-4">
            <TimelineTab />
          </TabsContent>
          <TabsContent value="legal" className="mt-4">
            <LegalTab />
          </TabsContent>
          <TabsContent value="location" className="mt-4">
            <LocationTab proposal={proposal} />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

function TechTab({ proposal }: { proposal: QuotationData }) {
  const r = proposal.results!
  const panelLabel = [r.marca_panel, r.modelo_panel].filter(Boolean).join(' ').trim()
  const rows = [
    ['Potencia del Sistema', formatKWp(r.kwp)],
    ['Número de Paneles', `${r.numero_paneles} unidades`],
    ['Potencia por Panel', `${r.potencia_panel_w}W`],
    ...(panelLabel ? [['Módulo FV', panelLabel]] : []),
    ['Inversores', r.inversores.map((i) => `${i.cantidad}× ${i.marca} ${i.modelo} (${i.potencia_kw}kW)`).join(', ')],
    ['Tipo de Cubierta', proposal.technical.tipo_cubierta.charAt(0).toUpperCase() + proposal.technical.tipo_cubierta.slice(1)],
    ['Clima', proposal.technical.clima.charAt(0).toUpperCase() + proposal.technical.clima.slice(1)],
    ['Costo Total', formatCOP(r.costo_total_cop)],
    ['Costo por kWp', formatCOP(r.costo_por_kwp_cop)],
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-white/5 pb-2">
          <span className="text-sm text-[#9CA3AF]">{label}</span>
          <span className="text-sm font-medium text-[#F9FAFB]">{value}</span>
        </div>
      ))}
    </div>
  )
}

function TimelineTab() {
  const steps = [
    { phase: 'Propuesta y Contratación', duration: 'Semana 1-2', description: 'Revisión técnica, firma de contrato y anticipo' },
    { phase: 'Ingeniería y Diseño', duration: 'Semana 2-3', description: 'Diseño detallado, memorias de cálculo, planos' },
    { phase: 'Adquisiciones', duration: 'Semana 3-5', description: 'Compra de equipos, logística y transporte' },
    { phase: 'Instalación', duration: 'Semana 5-7', description: 'Montaje de estructura, paneles, inversores y cableado' },
    { phase: 'Puesta en Marcha', duration: 'Semana 7-8', description: 'Pruebas, configuración del inversor y entrega' },
  ]

  return (
    <div className="space-y-4">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#BFFF00]/20 text-sm font-bold text-[#BFFF00]">
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="mt-1 h-full w-px bg-white/10" />}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium text-[#F9FAFB]">{s.phase}</p>
            <p className="text-xs text-[#BFFF00]">{s.duration}</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{s.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function LegalTab() {
  return (
    <div className="space-y-4 text-sm text-[#9CA3AF]">
      <div>
        <h4 className="mb-1 font-medium text-[#F9FAFB]">Ley 1715 de 2014</h4>
        <p>
          Regula la integración de energías renovables no convencionales al sistema energético
          nacional. Establece incentivos tributarios para proyectos de autogeneración solar:
        </p>
      </div>
      <ul className="list-inside list-disc space-y-1">
        <li>Deducción del 50% del valor de inversión en renta (Art. 11)</li>
        <li>Depreciación acelerada de activos (Art. 14)</li>
        <li>Exclusión del IVA en equipos y servicios (Art. 12)</li>
        <li>Exención de aranceles en importación de equipos (Art. 13)</li>
      </ul>
      <div>
        <h4 className="mb-1 font-medium text-[#F9FAFB]">Resolución CREG 030 de 2018</h4>
        <p>
          Define las condiciones para la autogeneración a pequeña escala y la venta de
          excedentes de energía a la red. Los excedentes se remuneran al precio del mercado.
        </p>
      </div>
    </div>
  )
}

function LocationTab({ proposal }: { proposal: QuotationData }) {
  const { lat, lon } = proposal.project

  if (lat == null || lon == null) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-white/5">
        <p className="text-sm text-[#9CA3AF]">Ubicación no disponible</p>
      </div>
    )
  }

  return <LocationMap lat={lat} lon={lon} />
}

const gmapLibraries: ('places' | 'maps')[] = ['places', 'maps']

function LocationMap({ lat, lon }: { lat: number; lon: number }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries: gmapLibraries,
  })

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      map.setCenter({ lat, lng: lon })
    },
    [lat, lon]
  )

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-white/5">
        <p className="text-sm text-[#9CA3AF]">Cargando mapa...</p>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '300px', borderRadius: '0.75rem' }}
      center={{ lat, lng: lon }}
      zoom={17}
      onLoad={onLoad}
      options={{
        mapTypeId: 'hybrid',
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeControl: false,
      }}
    >
      <Marker position={{ lat, lng: lon }} />
    </GoogleMap>
  )
}
