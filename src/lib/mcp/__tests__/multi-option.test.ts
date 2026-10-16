import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory stand-in for Upstash: just the calls the link tools make.
const store = new Map<string, unknown>()
vi.mock('@upstash/redis', () => ({
  Redis: class {
    async get(k: string) {
      return store.has(k) ? structuredClone(store.get(k)) : null
    }
    async set(k: string, v: unknown, opts?: { xx?: boolean }) {
      if (opts?.xx && !store.has(k)) return null
      store.set(k, structuredClone(v))
      return 'OK'
    }
  },
}))

import { multiLinkInputSchema, runCreateMultiQuotationLink, linkInputSchema, runCreateQuotationLink } from '../create-link'
import {
  addOptionInputSchema,
  runAddOptionToQuotation,
  runGetQuotation,
  runUpdateQuotation,
  updateQuotationInputSchema,
} from '../manage-link'
import { shareDataSchema } from '@/lib/share-schema'

beforeEach(() => {
  store.clear()
  process.env.UPSTASH_REDIS_REST_URL = 'http://test'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test'
})

const base = { consumo_mensual_kwh: 800, ciudad: 'MEDELLIN' as const }

describe('create_quotation_link_multi', () => {
  it('stores one link with a version per option, valid for /api/share', async () => {
    const args = multiLinkInputSchema.parse({
      cliente_nombre: 'Cliente Prueba',
      opciones: [
        { label: '5 kWp', ...base, numero_paneles: 8 },
        { label: '8 kWp', ...base, numero_paneles: 13 },
      ],
    })
    const res = await runCreateMultiQuotationLink(args)
    const stored = store.get(`share:${res.structured.share_id}`) as { versions: { label: string }[] }
    expect(stored.versions.map((v) => v.label)).toEqual(['5 kWp', '8 kWp'])
    expect(shareDataSchema.safeParse(stored).success).toBe(true)
    expect(res.structured.opciones).toHaveLength(2)
    expect(res.structured.url).toContain(`/s/${res.structured.share_id}`)
  })

  it('rejects duplicate labels', async () => {
    const args = multiLinkInputSchema.parse({
      cliente_nombre: 'X',
      opciones: [{ label: 'A', ...base }, { label: 'a', ...base }],
    })
    await expect(runCreateMultiQuotationLink(args)).rejects.toThrow(/repetido/)
  })
})

describe('add_option_to_quotation', () => {
  it('turns a single link into tabs and keeps the client', async () => {
    const created = await runCreateQuotationLink(linkInputSchema.parse({ cliente_nombre: 'Uno', ...base }))
    const id = created.structured.share_id as string
    await runAddOptionToQuotation(addOptionInputSchema.parse({ share_id: id, label: 'Con bateria', ...base, bateria_capacidad_kwh: 10 }))
    const got = await runGetQuotation({ share_id: id })
    expect(got.structured.versiones).toBe(2)
    expect((got.structured.opciones as { label: string }[]).map((o) => o.label)).toEqual(['Opcion 1', 'Con bateria'])
    expect(got.structured.cliente_nombre).toBe('Uno')
  })
})

describe('update_quotation on multi links', () => {
  it('requires opcion_index and updates only that tab', async () => {
    const res = await runCreateMultiQuotationLink(multiLinkInputSchema.parse({
      cliente_nombre: 'Multi',
      opciones: [{ label: 'A', ...base }, { label: 'B', ...base }],
    }))
    const id = res.structured.share_id as string
    await expect(runUpdateQuotation(updateQuotationInputSchema.parse({ share_id: id, ...base }))).rejects.toThrow(/opcion_index/)

    const before = structuredClone(store.get(`share:${id}`)) as { versions: { payload: { t: unknown } }[] }
    await runUpdateQuotation(updateQuotationInputSchema.parse({ share_id: id, opcion_index: 1, ...base, consumo_mensual_kwh: 2000, cliente_email: 'a@b.co' }))
    const after = store.get(`share:${id}`) as { versions: { payload: { t: unknown; c: { e: string } } }[] }
    expect(after.versions[0].payload.t).toEqual(before.versions[0].payload.t)
    expect(after.versions[1].payload.t).not.toEqual(before.versions[1].payload.t)
    // client change propagates to every tab
    expect(after.versions.map((v) => v.payload.c.e)).toEqual(['a@b.co', 'a@b.co'])
  })
})

describe('update_quotation keeps the offer deadline', () => {
  type Stored = { p: { f: string } }
  async function linkEmitted(fecha: string) {
    const created = await runCreateQuotationLink(linkInputSchema.parse({ cliente_nombre: 'Plazo', ...base }))
    const id = created.structured.share_id as string
    const stored = store.get(`share:${id}`) as Stored
    stored.p.f = fecha
    return id
  }

  it('a link sent with 30 days does not drop to 15 when updated', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 10))
    try {
      const id = await linkEmitted('2026-10-10') // valid until 9-nov; today + 15 = 4-nov
      await runUpdateQuotation(updateQuotationInputSchema.parse({ share_id: id, ...base, consumo_mensual_kwh: 900 }))
      expect((store.get(`share:${id}`) as Stored).p.f).toBe('2026-10-10')
    } finally {
      vi.useRealTimers()
    }
  })

  it('an update re-issues an older offer from today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 20, 10))
    try {
      const id = await linkEmitted('2026-09-01') // expired 1-oct
      await runUpdateQuotation(updateQuotationInputSchema.parse({ share_id: id, ...base, consumo_mensual_kwh: 900 }))
      expect((store.get(`share:${id}`) as Stored).p.f).toBe('2026-10-20')
    } finally {
      vi.useRealTimers()
    }
  })
})
