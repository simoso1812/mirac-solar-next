'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ClientData, ProjectData, TechnicalData, AdvancedData, CalculationResults } from '@/lib/types'

interface QuotationState {
  currentStep: number
  clientData: ClientData
  projectData: ProjectData
  technicalData: TechnicalData
  advancedData: AdvancedData
  results: CalculationResults | null

  // Actions
  setStep: (step: number) => void
  setClientData: (data: Partial<ClientData>) => void
  setProjectData: (data: Partial<ProjectData>) => void
  setTechnicalData: (data: Partial<TechnicalData>) => void
  setAdvancedData: (data: Partial<AdvancedData>) => void
  setResults: (results: CalculationResults | null) => void
  reset: () => void
}

const initialClientData: ClientData = {
  nombre: '',
  nit_cc: '',
  email: '',
  telefono: '',
  direccion: '',
}

const initialProjectData: ProjectData = {
  ciudad: 'MEDELLIN',
  ubicacion_label: '',
  fecha: new Date().toISOString().split('T')[0],
  plantilla: 'standard',
  lat: null,
  lon: null,
  hsp_mensual_pvgis: null,
  map_url: null,
}

const initialTechnicalData: TechnicalData = {
  consumo_mensual_kwh: 0,
  potencia_panel_w: 615,
  factor_seguridad: 1.1,
  tipo_cubierta: 'metalica',
  clima: 'templado',
  override_paneles: null,
}

const initialAdvancedData: AdvancedData = {
  marca_inversor: 'Automatico',
  override_inversores: null,
  medidor_inteligente: false,
  modo_conexion: 'net_metering',
  financiamiento: {
    habilitado: false,
    tasa_interes: 0.12,
    plazo_meses: 60,
    porcentaje_financiado: 0.7,
  },
  bateria: {
    habilitada: false,
    capacidad_kwh: 5,
    profundidad_descarga: 0.9,
    eficiencia: 0.95,
  },
  beneficios_tributarios: true,
  precio_manual: null,
  notas: '',
  costo_kwh: 850,
  indexacion_energia: 0.05,
  tasa_descuento: 0.10,
  horizonte_anios: 25,
  precio_excedentes: 300,
  tasa_degradacion: 0.001,
  porcentaje_mantenimiento: 0.05,
  performance_ratio_base: 0.75,
  demora_6_meses: false,
}

export const useQuotationStore = create<QuotationState>()(
  persist(
    (set) => ({
      currentStep: 0,
      clientData: initialClientData,
      projectData: initialProjectData,
      technicalData: initialTechnicalData,
      advancedData: initialAdvancedData,
      results: null,

      setStep: (step) => set({ currentStep: step }),

      setClientData: (data) =>
        set((state) => ({
          clientData: { ...state.clientData, ...data },
        })),

      setProjectData: (data) =>
        set((state) => ({
          projectData: { ...state.projectData, ...data },
        })),

      setTechnicalData: (data) =>
        set((state) => ({
          technicalData: { ...state.technicalData, ...data },
        })),

      setAdvancedData: (data) =>
        set((state) => ({
          advancedData: { ...state.advancedData, ...data },
        })),

      setResults: (results) => set({ results }),

      reset: () =>
        set({
          currentStep: 0,
          clientData: initialClientData,
          projectData: initialProjectData,
          technicalData: initialTechnicalData,
          advancedData: initialAdvancedData,
          results: null,
        }),
    }),
    {
      name: 'mirac-quotation',
    }
  )
)
