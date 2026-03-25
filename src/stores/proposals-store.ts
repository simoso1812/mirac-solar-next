'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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
  getProposal: (id: string) => QuotationData | undefined
  getProposalsByClient: (nombre: string) => QuotationData[]
  getUniqueClients: () => ClientData[]
}

function generateId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
    { name: 'mirac-proposals' }
  )
)
