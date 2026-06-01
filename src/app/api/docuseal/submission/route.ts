import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { buildInputFromStore, cotizacion } from '@/lib/calculator'
import { renderContratoDocx } from '@/lib/contract/generator'
import {
  createDocusealDocxSubmission,
  getDocusealSubmission,
  toDocusealSignatureData,
} from '@/lib/docuseal'
import type { QuotationData } from '@/lib/types'

// Read the static contract template once at module load, not per request.
const templatePath = path.join(process.cwd(), 'public', 'assets', 'contrato_plantilla.docx')
const templateBufferPromise = readFile(templatePath)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      proposal?: QuotationData
      submissionId?: number
    }

    if (body.submissionId) {
      const submission = await getDocusealSubmission(body.submissionId)
      return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
    }

    const proposal = body.proposal
    if (!proposal) {
      return NextResponse.json({ error: 'No se proporcionó la propuesta' }, { status: 400 })
    }

    if (!proposal.client.email?.trim()) {
      return NextResponse.json({ error: 'El cliente debe tener correo electrónico para firmar' }, { status: 400 })
    }

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
    const submission = await createDocusealDocxSubmission({
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

    return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando firma en DocuSeal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
