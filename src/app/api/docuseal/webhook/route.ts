import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDocusealSubmission } from '@/lib/docuseal'
import { getProposalDriveMapping } from '@/lib/proposal-drive-map'
import { uploadBytesToDriveFolder } from '@/lib/integrations/drive'

interface DocusealWebhookData {
  external_id?: string | null
  submission_id?: number
  status?: string
  submission?: {
    id?: number
    status?: string
    documents?: Array<{ name?: string; url?: string }>
  }
  metadata?: Record<string, unknown>
}

interface DocusealWebhookEvent {
  event_type?: string
  data?: DocusealWebhookData
}

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET
  if (!secret) return true // verification disabled
  if (!header) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get('x-docuseal-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: DocusealWebhookEvent
  try {
    payload = JSON.parse(rawBody) as DocusealWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // We only act on completed submissions.
  if (payload.event_type !== 'form.completed' && payload.event_type !== 'submission.completed') {
    return NextResponse.json({ ok: true, skipped: 'event ignored' })
  }

  const data = payload.data ?? {}
  const proposalId =
    (typeof data.external_id === 'string' && data.external_id) ||
    (typeof data.metadata?.proposalId === 'string' && (data.metadata.proposalId as string)) ||
    null

  if (!proposalId) {
    return NextResponse.json({ ok: true, skipped: 'no proposal id' })
  }

  const mapping = await getProposalDriveMapping(proposalId)
  if (!mapping) {
    // Proposal has not been Drive-synced yet — nothing to do.
    // It will be picked up when the user clicks "Guardar en Drive".
    return NextResponse.json({ ok: true, skipped: 'no drive mapping yet' })
  }

  const submissionId = data.submission_id ?? data.submission?.id
  if (!submissionId) {
    return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
  }

  // Fetch the submission via API so we always get a fresh document URL,
  // regardless of what the webhook payload included.
  const submission = await getDocusealSubmission(submissionId)
  const docUrl = submission.documents?.[0]?.url
  if (!docUrl) {
    return NextResponse.json({ error: 'DocuSeal did not return a signed document' }, { status: 502 })
  }

  const pdfRes = await fetch(docUrl, { cache: 'no-store' })
  if (!pdfRes.ok) {
    return NextResponse.json({ error: `Could not download signed PDF (${pdfRes.status})` }, { status: 502 })
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

  const link = await uploadBytesToDriveFolder(
    mapping.uploadFolderId,
    `${mapping.fileBaseName}.pdf`,
    pdfBuffer,
    'application/pdf',
  )

  return NextResponse.json({ ok: true, link })
}
