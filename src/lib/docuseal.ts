import type { DocusealSignatureData } from '@/lib/types'

interface DocusealSubmitter {
  id: number
  slug: string
  embed_src?: string
  status?: string
  completed_at?: string | null
  declined_at?: string | null
  metadata?: Record<string, unknown> | null
}

interface DocusealDocument {
  url?: string
}

interface DocusealSubmission {
  id: number
  status?: string
  audit_log_url?: string | null
  documents?: DocusealDocument[]
  submitters?: DocusealSubmitter[]
  created_at?: string
  updated_at?: string
}

function getDocusealConfig() {
  const apiKey = process.env.DOCUSEAL_API_KEY
  const apiUrl = process.env.DOCUSEAL_API_URL ?? 'https://api.docuseal.com'
  if (!apiKey) throw new Error('DOCUSEAL_API_KEY no está configurada')
  return { apiKey, apiUrl: apiUrl.replace(/\/$/, '') }
}

async function docusealFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, apiUrl } = getDocusealConfig()
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': apiKey,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`DocuSeal error (${res.status}): ${text}`)
  }

  return await res.json() as T
}

export async function createDocusealDocxSubmission(input: {
  name: string
  fileBase64: string
  submitterName: string
  submitterEmail: string
  externalId: string
  metadata?: Record<string, unknown>
}): Promise<DocusealSubmission> {
  return docusealFetch<DocusealSubmission>('/submissions/docx', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      send_email: false,
      documents: [
        {
          name: input.name,
          file: input.fileBase64,
        },
      ],
      submitters: [
        {
          role: 'First Party',
          name: input.submitterName,
          email: input.submitterEmail,
          external_id: input.externalId,
          metadata: input.metadata ?? {},
        },
      ],
    }),
  })
}

export async function getDocusealSubmission(id: number): Promise<DocusealSubmission> {
  return docusealFetch<DocusealSubmission>(`/submissions/${id}`, { method: 'GET' })
}

export function toDocusealSignatureData(submission: DocusealSubmission): DocusealSignatureData {
  const submitter = submission.submitters?.[0]
  if (!submitter?.id || !submitter.slug) {
    throw new Error('DocuSeal no devolvió un firmante válido')
  }

  const now = new Date().toISOString()
  const documentUrl = submission.documents?.[0]?.url ?? null
  const status = normalizeDocusealStatus(submitter.status ?? submission.status)

  return {
    submission_id: submission.id,
    submitter_id: submitter.id,
    submitter_slug: submitter.slug,
    embed_src: submitter.embed_src ?? `https://docuseal.com/s/${submitter.slug}`,
    status,
    document_url: documentUrl,
    audit_log_url: submission.audit_log_url ?? null,
    completed_at: submitter.completed_at ?? null,
    declined_at: submitter.declined_at ?? null,
    created_at: submission.created_at ?? now,
    updated_at: submission.updated_at ?? now,
  }
}

function normalizeDocusealStatus(status: string | undefined): DocusealSignatureData['status'] {
  if (status === 'completed' || status === 'declined' || status === 'expired') return status
  return 'pending'
}
