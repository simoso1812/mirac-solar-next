import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// In-memory stand-in for Upstash. rateLimit() fails open when `multi` is
// missing, so it never blocks here.
const store = new Map<string, unknown>()
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async get(k: string) {
      return store.has(k) ? structuredClone(store.get(k)) : null
    }
    async set(k: string, v: unknown) {
      if (!store.has(k)) return null
      store.set(k, structuredClone(v))
      return 'OK'
    }
  },
}))

const docuseal = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
}))
vi.mock('@/lib/docuseal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/docuseal')>()),
  createDocusealDocxSubmission: docuseal.create,
  getDocusealSubmission: docuseal.get,
}))

import { POST as submissionPOST } from '@/app/api/docuseal/submission/route'
import { PATCH as sharePATCH } from '@/app/api/share/route'

const payload = (precioManual: number | null = null) => ({
  c: { n: 'Cliente Real', d: 'Calle 1', e: 'cliente@example.com', t: '', a: '123' },
  p: { ci: 'MEDELLIN', f: '2026-10-14', la: null, lo: null, h: null },
  t: { co: 800, pw: 615, fs: 1.1, tc: 'teja', cl: 'templado', op: null },
  a: { precio_manual: precioManual },
})

const submission = (externalId: string) => ({
  id: 42,
  status: 'pending',
  submitters: [{ id: 7, slug: 'slug-abc123', embed_src: 'https://docuseal.com/s/slug-abc123', status: 'pending', external_id: externalId }],
})

const post = (body: unknown) =>
  submissionPOST(new NextRequest('http://localhost/api/docuseal/submission', { method: 'POST', body: JSON.stringify(body) }))

const patch = (body: unknown) =>
  sharePATCH(new NextRequest('http://localhost/api/share', { method: 'PATCH', body: JSON.stringify(body) }))

beforeEach(() => {
  store.clear()
  docuseal.create.mockReset()
  docuseal.get.mockReset()
  docuseal.create.mockResolvedValue(submission('s:abc12345'))
  process.env.UPSTASH_REDIS_REST_URL = 'http://test'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test'
})

describe('POST /api/docuseal/submission builds the contract from the stored share', () => {
  it('signs the stored proposal with external_id s:<id>', async () => {
    store.set('share:abc12345', payload())
    const res = await post({ shareId: 'abc12345' })
    expect(res.status).toBe(200)
    expect(docuseal.create).toHaveBeenCalledTimes(1)
    const arg = docuseal.create.mock.calls[0][0]
    expect(arg.externalId).toBe('s:abc12345')
    expect(arg.submitterEmail).toBe('cliente@example.com')
    expect(arg.submitterName).toBe('Cliente Real')
  })

  it('rejects a body that carries proposal data', async () => {
    store.set('share:abc12345', payload())
    const forged = { client: { nombre: 'X', email: 'x@example.com' }, advanced: { precio_manual: 1 } }
    for (const body of [{ proposal: forged }, { shareId: 'abc12345', proposal: forged }, { shareId: 'abc12345', precio_manual: 1 }]) {
      const res = await post(body)
      expect(res.status).toBe(400)
    }
    expect(docuseal.create).not.toHaveBeenCalled()
  })

  it('uses the stored price, not anything the caller could send', async () => {
    store.set('share:abc12345', payload(50_000_000))
    await post({ shareId: 'abc12345' })
    expect(docuseal.create.mock.calls[0][0].metadata.totalCop).toBe(50_000_000)
  })

  it('404s for an unknown share and for a missing option', async () => {
    expect((await post({ shareId: 'nope1234' })).status).toBe(404)
    store.set('share:multi123', { versions: [{ label: 'A', payload: payload(10_000_000) }, { label: 'B', payload: payload(20_000_000) }] })
    expect((await post({ shareId: 'multi123' })).status).toBe(404)
    expect((await post({ shareId: 'multi123', optionIndex: 5 })).status).toBe(404)
    expect((await post({ shareId: 'abc12345', optionIndex: 1 })).status).toBe(404)
    expect(docuseal.create).not.toHaveBeenCalled()
  })

  it('signs the requested option of a multi-option link', async () => {
    store.set('share:multi123', { versions: [{ label: 'A', payload: payload(10_000_000) }, { label: 'B', payload: payload(20_000_000) }] })
    expect((await post({ shareId: 'multi123', optionIndex: 1 })).status).toBe(200)
    expect(docuseal.create.mock.calls[0][0].metadata.totalCop).toBe(20_000_000)
    expect(docuseal.create.mock.calls[0][0].externalId).toBe('s:multi123')
  })

  it('400s when the stored client has no email', async () => {
    store.set('share:abc12345', { ...payload(), c: { ...payload().c, e: '' } })
    const res = await post({ shareId: 'abc12345' })
    expect(res.status).toBe(400)
    expect(docuseal.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/share verifies the submission belongs to the link', () => {
  const docusealPatch = { submission_id: 42, submitter_slug: 'slug-abc123' }

  it('stores the state when external_id is s:<id>', async () => {
    store.set('share:abc12345', payload())
    docuseal.get.mockResolvedValue(submission('s:abc12345'))
    const res = await patch({ id: 'abc12345', docusealPatch })
    expect(res.status).toBe(200)
    expect((store.get('share:abc12345') as { d?: { submission_id: number } }).d?.submission_id).toBe(42)
  })

  it('403s when the submission belongs to another link', async () => {
    store.set('share:abc12345', payload())
    docuseal.get.mockResolvedValue(submission('s:otro9999'))
    const res = await patch({ id: 'abc12345', docusealPatch })
    expect(res.status).toBe(403)
    expect((store.get('share:abc12345') as { d?: unknown }).d).toBeUndefined()
  })

  it('403s when the submission has no external_id', async () => {
    store.set('share:abc12345', payload())
    docuseal.get.mockResolvedValue({ ...submission(''), submitters: [{ id: 7, slug: 'slug-abc123' }] })
    expect((await patch({ id: 'abc12345', docusealPatch })).status).toBe(403)
  })
})
