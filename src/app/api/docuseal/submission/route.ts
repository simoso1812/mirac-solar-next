import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { buildInputFromStore, cotizacion } from '@/lib/calculator'
import { renderContratoDocx } from '@/lib/contract/generator'
import {
  createDocusealDocxSubmission,
  getDocusealSubmission,
  toDocusealSignatureData,
} from '@/lib/docuseal'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import type { QuotationData } from '@/lib/types'

// Proposals carry inline base64 images, so allow a generous (but bounded) body.
const MAX_BODY_BYTES = 6_000_000

// Read the static contract template once at module load, not per request.
const templatePath = path.join(process.cwd(), 'public', 'assets', 'contrato_plantilla.docx')
const templateBufferPromise = readFile(templatePath)

const bodySchema = z.object({
  submissionId: z.number().int().positive().optional(),
  submitterSlug: z.string().max(120).optional(),
  proposal: z.record(z.string(), z.unknown()).optional(),
})

// Gate only: validates the fields the contract needs; the original proposal
// object (not zod output) is what flows into contract generation.
const proposalSchema = z.looseObject({
  client: z.looseObject({
    nombre: z.string().min(1).max(200),
    email: z.email().max(254),
  }),
  project: z.record(z.string(), z.unknown()),
  technical: z.record(z.string(), z.unknown()),
  advanced: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limit only when Upstash is configured. Redis stays lazy (inside the
    // handler) so `next build` never logs missing-env warnings.
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken })
      if (!(await rateLimit(redis, `rl:docuseal:post:${getClientIp(request)}`, 10, 60))) {
        return NextResponse.json(
          { error: 'Demasiadas solicitudes, intenta más tarde' },
          { status: 429 },
        )
      }
    }

    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload demasiado grande' }, { status: 413 })
    }

    let rawBody: unknown
    try {
      rawBody = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const parsedBody = bodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }
    const { submissionId, submitterSlug } = parsedBody.data

    if (submissionId) {
      // Refreshing an existing submission requires its submitter slug as proof
      // of access. DocuSeal submission IDs are sequential, so every failure
      // mode answers 404 to avoid leaking whether an ID exists.
      if (!submitterSlug) {
        return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      }
      try {
        const submission = await getDocusealSubmission(submissionId)
        if (!submission.submitters?.some((s) => s.slug === submitterSlug)) {
          return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
        }
        return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
      } catch {
        return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      }
    }

    if (!parsedBody.data.proposal) {
      return NextResponse.json({ error: 'No se proporcionó la propuesta' }, { status: 400 })
    }

    const proposalParsed = proposalSchema.safeParse(parsedBody.data.proposal)
    if (!proposalParsed.success) {
      const emailIssue = proposalParsed.error.issues.some(
        (issue) => issue.path[0] === 'client' && issue.path[1] === 'email',
      )
      return NextResponse.json(
        {
          error: emailIssue
            ? 'El cliente debe tener un correo electrónico válido para firmar'
            : 'Datos de la propuesta inválidos',
        },
        { status: 400 },
      )
    }

    const proposal = parsedBody.data.proposal as unknown as QuotationData

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
