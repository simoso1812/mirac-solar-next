import { NextResponse, type NextRequest } from 'next/server'
import { decidirAcceso } from '@/lib/auth-gate'

// Runs on every request (no matcher): the public allowlist lives in
// src/lib/auth-gate.ts, including /_next and the public/ folders.
export function proxy(request: NextRequest) {
  const decision = decidirAcceso({
    pathname: request.nextUrl.pathname,
    method: request.method,
    authorization: request.headers.get('authorization'),
    password: process.env.APP_PASSWORD,
    produccion: process.env.NODE_ENV === 'production',
  })

  if (decision === 'pasar') return NextResponse.next()

  if (decision === 'sin_configurar') {
    return new NextResponse('Falta configurar APP_PASSWORD.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse('Se requiere contraseña.', {
    status: 401,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': 'Basic realm="Mirac", charset="UTF-8"',
    },
  })
}
