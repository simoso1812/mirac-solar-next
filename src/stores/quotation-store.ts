'use client'

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { toast } from 'sonner'
import type { ClientData, ProjectData, TechnicalData, AdvancedData, CalculationResults, QuotationData } from '@/lib/types'
export {
  initialClientData,
  initialProjectData,
  initialTechnicalData,
  initialAdvancedData,
  deepMerge,
} from '@/lib/defaults'
import {
  initialClientData,
  initialProjectData,
  initialTechnicalData,
  initialAdvancedData,
  deepMerge,
} from '@/lib/defaults'

// localStorage facade that surfaces quota failures instead of swallowing them.
// A large roof design + inline images can exceed the browser quota; without
// this, the persist middleware fails silently and the user loses work.
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      // QuotaExceededError (a DOMException) or any other storage failure
      console.error('No se pudo guardar la cotización en localStorage:', error)
      toast.error(
        'No se pudo guardar: el almacenamiento del navegador está lleno. Reduce las imágenes o el diseño del techo.'
      )
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

interface QuotationState {
  currentStep: number
  editingId: string | null
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
  loadProposal: (proposal: QuotationData) => void
  reset: () => void
}

export const useQuotationStore = create<QuotationState>()(
  persist(
    (set) => ({
      currentStep: 0,
      editingId: null,
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

      loadProposal: (proposal) =>
        set({
          currentStep: 0,
          editingId: proposal.id,
          clientData: deepMerge(initialClientData, proposal.client),
          projectData: deepMerge(initialProjectData, proposal.project),
          technicalData: deepMerge(initialTechnicalData, proposal.technical),
          advancedData: deepMerge(initialAdvancedData, proposal.advanced),
          results: proposal.results,
        }),

      reset: () =>
        set({
          currentStep: 0,
          editingId: null,
          clientData: initialClientData,
          projectData: initialProjectData,
          technicalData: initialTechnicalData,
          advancedData: initialAdvancedData,
          results: null,
        }),
    }),
    {
      name: 'mirac-quotation',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      // Identity migrate: without it, zustand discards persisted state saved
      // before `version` existed (treated as version 0).
      migrate: (persisted) => persisted as QuotationState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<QuotationState>
        return {
          ...current,
          ...p,
          clientData: deepMerge(current.clientData, p.clientData),
          projectData: deepMerge(current.projectData, p.projectData),
          technicalData: deepMerge(current.technicalData, p.technicalData),
          advancedData: deepMerge(current.advancedData, p.advancedData),
        }
      },
    }
  )
)
