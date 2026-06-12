'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
