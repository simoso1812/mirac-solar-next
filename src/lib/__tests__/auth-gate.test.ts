import { describe, expect, it } from 'vitest'
import { credencialesValidas, decidirAcceso, esRutaPublica } from '../auth-gate'

const basic = (usuario: string, clave: string) =>
  `Basic ${Buffer.from(`${usuario}:${clave}`, 'utf8').toString('base64')}`

describe('esRutaPublica', () => {
  it.each([
    '/s/abc123',
    '/s/abc123/extra',
    '/propuestas/shared',
    '/_next/static/chunks/app.js',
    '/_next/image',
    '/favicon.ico',
    '/icon.png',
    '/apple-icon.png',
    '/assets/LogoBlanco.png',
    '/assets/fonts/Roboto-Regular.ttf',
    '/virtual/hero-default.webp',
    '/api/docuseal/submission',
    '/api/docuseal/webhook',
    '/api/mcp',
  ])('%s es pública', (ruta) => {
    expect(esRutaPublica(ruta, 'GET')).toBe(true)
    expect(esRutaPublica(ruta, 'POST')).toBe(true)
  })

  it('en /api/share solo lectura y patch del cliente son públicos', () => {
    expect(esRutaPublica('/api/share', 'GET')).toBe(true)
    expect(esRutaPublica('/api/share', 'HEAD')).toBe(true)
    expect(esRutaPublica('/api/share', 'PATCH')).toBe(true)
    expect(esRutaPublica('/api/share', 'POST')).toBe(false)
    expect(esRutaPublica('/api/share', 'DELETE')).toBe(false)
  })

  it.each([
    '/',
    '/cotizacion',
    '/propuestas',
    '/propuestas/abc',
    '/propuestas/abc/virtual',
    '/propuestas/sharedx',
    '/clientes',
    '/cargadores',
    '/api/pvgis',
    '/api/eter/capacidad',
    '/api/eter/trafo/123',
    '/api/share/x',
    '/api/docuseal/submission/interna',
    '/sx',
    '/assetsx/a.png',
  ])('%s requiere contraseña', (ruta) => {
    expect(esRutaPublica(ruta, 'GET')).toBe(false)
    expect(esRutaPublica(ruta, 'POST')).toBe(false)
  })
})

describe('credencialesValidas', () => {
  it('acepta la contraseña correcta con cualquier usuario', () => {
    expect(credencialesValidas(basic('simon', 'clave-secreta'), 'clave-secreta')).toBe(true)
    expect(credencialesValidas(basic('', 'clave-secreta'), 'clave-secreta')).toBe(true)
  })

  it('acepta contraseñas con dos puntos y tildes', () => {
    expect(credencialesValidas(basic('u', 'a:b:ñ'), 'a:b:ñ')).toBe(true)
  })

  it('rechaza una contraseña incorrecta', () => {
    expect(credencialesValidas(basic('simon', 'otra'), 'clave-secreta')).toBe(false)
    expect(credencialesValidas(basic('simon', 'clave-secret'), 'clave-secreta')).toBe(false)
    expect(credencialesValidas(basic('simon', 'clave-secretaa'), 'clave-secreta')).toBe(false)
  })

  it('rechaza encabezados malformados', () => {
    expect(credencialesValidas('Bearer abc', 'x')).toBe(false)
    expect(credencialesValidas('Basic', 'x')).toBe(false)
    expect(credencialesValidas('Basic %%%', 'x')).toBe(false)
    expect(credencialesValidas(`Basic ${Buffer.from('sin-separador').toString('base64')}`, 'sin-separador')).toBe(false)
  })

  it('rechaza null y contraseña vacía', () => {
    expect(credencialesValidas(null, 'x')).toBe(false)
    expect(credencialesValidas(basic('u', ''), '')).toBe(false)
  })
})

describe('decidirAcceso', () => {
  const base = { pathname: '/cotizacion', method: 'GET', authorization: null }

  it('deja pasar rutas públicas sin credenciales', () => {
    expect(decidirAcceso({ ...base, pathname: '/s/abc', password: 'x', produccion: true })).toBe('pasar')
  })

  it('pide credenciales cuando hay contraseña', () => {
    expect(decidirAcceso({ ...base, password: 'x', produccion: true })).toBe('no_autorizado')
    expect(decidirAcceso({ ...base, authorization: basic('u', 'x'), password: 'x', produccion: true })).toBe('pasar')
  })

  it('sin APP_PASSWORD cierra en producción y abre en desarrollo', () => {
    expect(decidirAcceso({ ...base, password: undefined, produccion: true })).toBe('sin_configurar')
    expect(decidirAcceso({ ...base, password: '', produccion: true })).toBe('sin_configurar')
    expect(decidirAcceso({ ...base, password: undefined, produccion: false })).toBe('pasar')
  })
})
