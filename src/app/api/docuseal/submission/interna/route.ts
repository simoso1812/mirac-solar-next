import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { toDocusealSignatureData } from '@/lib/docuseal'
import { crearSubmissionContrato, errorParaFirma } from '@/lib/docuseal-contract'
import type { QuotationData } from '@/lib/types'

// Internal signing from /propuestas/<id>/virtual, where the proposal lives only
// in the operator's localStorage. This path is NOT in the public allowlist
// (src/lib/auth-gate.ts), so the proxy requires APP_PASSWORD before it runs.
// Proposals carry inline base64 images, so allow a generous (but bounded) body.
const MAX_BODY_BYTES = 6_000_000

const bodySchema = z.strictObject({
  proposal: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  try {
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

    const error = errorParaFirma(parsedBody.data.proposal)
    if (error) return NextResponse.json({ error }, { status: 400 })

    const proposal = parsedBody.data.proposal as unknown as QuotationData
    const submission = await crearSubmissionContrato(proposal)
    return NextResponse.json({ docuseal: toDocusealSignatureData(submission) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando firma en DocuSeal'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
