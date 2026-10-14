import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// In-memory stand-in for Upstash: just the calls POST/GET make. rateLimit()
// fails open when `multi` is missing, so it never blocks here.
const store = new Map<string, unknown>()
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async get(k: string) {
      return store.has(k) ? structuredClone(store.get(k)) : null
    }
    async set(k: string, v: unknown) {
      store.set(k, structuredClone(v))
      return 'OK'
    }
  },
}))

import { GET, POST } from '@/app/api/share/route'
import { COGS_KEYS } from '@/lib/defaults'

const payload = (a: Record<string, unknown>) => ({
  c: { n: 'Cliente', d: '', e: '', t: '', a: '' },
  p: { ci: 'MEDELLIN', f: '2026-10-14', la: null, lo: null, h: null },
  t: { co: 800, pw: 615, fs: 1.1, tc: 'teja', cl: 'templado', op: null },
  a,
})

const conCostos = { costo_kwh: 850, cogs_modulos_cop: 8_000_000, cogs_inversor_cop: 6_000_000, cogs_bos_cop: 1, cogs_instalacion_cop: 2 }

async function post(data: unknown): Promise<string> {
  const res = await POST(
    new NextRequest('http://localhost/api/share', { method: 'POST', body: JSON.stringify({ data }) }),
  )
  expect(res.status).toBe(200)
  return ((await res.json()) as { id: string }).id
}

beforeEach(() => {
  store.clear()
  process.env.UPSTASH_REDIS_REST_URL = 'http://test'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test'
})

describe('/api/share strips internal COGS', () => {
  it('POST stores a single payload without the COGS keys', async () => {
    const id = await post(payload(conCostos))
    const stored = store.get(`share:${id}`) as { a: Record<string, unknown> }
    for (const key of COGS_KEYS) expect(stored.a).not.toHaveProperty(key)
    expect(stored.a.costo_kwh).toBe(850)
  })

  it('POST strips every version of a multi-option payload', async () => {
    const id = await post({ versions: [{ label: 'A', payload: payload(conCostos) }, { label: 'B', payload: payload(conCostos) }] })
    const stored = store.get(`share:${id}`) as { versions: { payload: { a: Record<string, unknown> } }[] }
    for (const v of stored.versions) {
      for (const key of COGS_KEYS) expect(v.payload.a).not.toHaveProperty(key)
    }
  })

  it('GET never returns COGS even if the stored payload has them', async () => {
    store.set('share:legacy01', payload(conCostos))
    const res = await GET(new NextRequest('http://localhost/api/share?id=legacy01&no_track=1'))
    expect(res.status).toBe(200)
    const { data } = (await res.json()) as { data: { a: Record<string, unknown> } }
    for (const key of COGS_KEYS) expect(data.a).not.toHaveProperty(key)
    expect(data.a.costo_kwh).toBe(850)
  })
})
