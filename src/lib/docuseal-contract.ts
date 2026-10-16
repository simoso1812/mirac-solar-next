/**
 * Contract generation + DocuSeal submission for a proposal. Server-only: the
 * proposal must come from a trusted source (the stored share payload, or the
 * password-gated internal route), never from a public request body.
 */
import { readFile } from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import { buildInputFromStore, cotizacion } from '@/lib/calculator'
import { renderContratoDocx } from '@/lib/contract/generator'
import { createDocusealDocxSubmission } from '@/lib/docuseal'
import type { QuotationData } from '@/lib/types'

// Read the static contract template once at module load, not per request.
const templatePath = path.join(process.cwd(), 'public', 'assets', 'contrato_plantilla.docx')
const templateBufferPromise = readFile(templatePath)

const signerSchema = z.looseObject({
  client: z.looseObject({
    nombre: z.string().min(1).max(200),
    email: z.email().max(254),
  }),
  project: z.record(z.string(), z.unknown()),
  technical: z.record(z.string(), z.unknown()),
  advanced: z.record(z.string(), z.unknown()),
})

/** Spanish error when the proposal can't be signed, else null. */
export function errorParaFirma(proposal: unknown): string | null {
  const parsed = signerSchema.safeParse(proposal)
  if (parsed.success) return null
  const emailIssue = parsed.error.issues.some(
    (issue) => issue.path[0] === 'client' && issue.path[1] === 'email',
  )
  return emailIssue
    ? 'El cliente debe tener un correo electrónico válido para firmar'
    : 'Datos de la propuesta inválidos'
}

export async function crearSubmissionContrato(proposal: QuotationData) {
  const liveResults = cotizacion(
    buildInputFromStore(proposal.technical, proposal.project, proposal.advanced)
  )
  const templateBuffer = await templateBufferPromise
  const inversorLabel = liveResults.inversores.length > 0
    ? liveResults.inversores.map((i) => `${i.cantidad}x ${i.modelo}`).join(', ')
    : ''
  const contractBytes = renderContratoDocx(templateBuffer, {
    nombreCliente: proposal.client.nombre,
    documentoCliente: proposal.client.nit_cc ?? '',
    telefonoCliente: proposal.client.telefono ?? '',
    emailCliente: proposal.client.email ?? '',
    direccionProyecto: proposal.project.ubicacion_label || proposal.client.direccion || '',
    tamanoSistemaKwp: liveResults.kwp,
    cantidadPaneles: liveResults.numero_paneles,
    potenciaPanel: proposal.technical.potencia_panel_w,
    inversorRecomendado: inversorLabel,
    valorTotalCOP: liveResults.costo_total_cop,
    fechaPropuesta: proposal.project.fecha,
  })

  const name = `Contrato_${proposal.client.nombre.replace(/\s+/g, '_')}_${proposal.project.fecha}`
  return createDocusealDocxSubmission({
    name,
    fileBase64: Buffer.from(contractBytes).toString('base64'),
    submitterName: proposal.client.nombre,
    submitterEmail: proposal.client.email,
    externalId: proposal.id,
    metadata: {
      proposalId: proposal.id,
      clientName: proposal.client.nombre,
      projectDate: proposal.project.fecha,
      systemKwp: liveResults.kwp,
      totalCop: liveResults.costo_total_cop,
    },
  })
}
