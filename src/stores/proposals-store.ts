'use client'

import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { toast } from 'sonner'
import type { QuotationData, ClientData, ProjectData, TechnicalData, AdvancedData, CalculationResults } from '@/lib/types'

interface ProposalsState {
  proposals: QuotationData[]
  addProposal: (data: {
    client: ClientData
    project: ProjectData
    technical: TechnicalData
    advanced: AdvancedData
    results: CalculationResults
  }) => string // returns id
  updateProposal: (id: string, updates: Partial<QuotationData>) => void
  deleteProposal: (id: string) => void
  duplicateProposal: (id: string) => string | null
  importProposals: (incoming: QuotationData[]) => { added: number; updated: number }
  getProposal: (id: string) => QuotationData | undefined
  getProposalsByClient: (nombre: string) => QuotationData[]
  getUniqueClients: () => ClientData[]
}

function generateId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// localStorage facade that surfaces quota failures instead of swallowing them.
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
      console.error('No se pudo guardar el estado de propuestas en localStorage:', error)
      toast.error(
        'No se pudo guardar: el almacenamiento del navegador está lleno. Exporta tus propuestas y elimina las antiguas.'
      )
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

export const useProposalsStore = create<ProposalsState>()(
  persist(
    (set, get) => ({
      proposals: [],

      addProposal: (data) => {
        const id = generateId()
        const now = new Date().toISOString()
        const proposal: QuotationData = {
          id,
          created_at: now,
          updated_at: now,
          status: 'draft',
          client: data.client,
          project: data.project,
          technical: data.technical,
          advanced: data.advanced,
          results: data.results,
          drive_folder_link: null,
          drive_project_name: null,
        }
        set((state) => ({ proposals: [proposal, ...state.proposals] }))
        return id
      },

      updateProposal: (id, updates) => {
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
          ),
        }))
      },

      deleteProposal: (id) => {
        set((state) => ({
          proposals: state.proposals.filter((p) => p.id !== id),
        }))
      },

      duplicateProposal: (id) => {
        const original = get().proposals.find((p) => p.id === id)
        if (!original) return null
        const newId = generateId()
        const now = new Date().toISOString()
        const duplicate: QuotationData = {
          ...original,
          id: newId,
          created_at: now,
          updated_at: now,
          status: 'draft',
          drive_folder_link: null,
          drive_project_name: null,
        }
        set((state) => ({ proposals: [duplicate, ...state.proposals] }))
        return newId
      },

      importProposals: (incoming) => {
        let added = 0
        let updated = 0
        set((state) => {
          const byId = new Map(state.proposals.map((p) => [p.id, p]))
          for (const proposal of incoming) {
            if (byId.has(proposal.id)) updated += 1
            else added += 1
            // Replace existing entries; append unknown ids. Imported id and
            // created_at are preserved as-is.
            byId.set(proposal.id, proposal)
          }
          return { proposals: Array.from(byId.values()) }
        })
        return { added, updated }
      },

      getProposal: (id) => get().proposals.find((p) => p.id === id),

      getProposalsByClient: (nombre) =>
        get().proposals.filter(
          (p) => p.client.nombre.toLowerCase() === nombre.toLowerCase()
        ),

      getUniqueClients: () => {
        const seen = new Map<string, ClientData>()
        for (const p of get().proposals) {
          const key = p.client.nit_cc || p.client.nombre.toLowerCase()
          if (!seen.has(key)) seen.set(key, p.client)
        }
        return Array.from(seen.values())
      },
    }),
    {
      name: 'mirac-proposals',
      version: 1,
      // Identity migrate: without it, zustand discards persisted state saved
      // before `version` existed (treated as version 0) and users lose data.
      migrate: (persisted) => persisted as ProposalsState,
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
)
