import { NextRequest, NextResponse } from 'next/server'
import { agregarClienteANotion } from '@/lib/integrations/notion'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { nombre, documento, direccion, proyecto, fecha, estado } = body

    if (!nombre) {
      return NextResponse.json({ success: false, message: 'nombre is required' }, { status: 400 })
    }

    const result = await agregarClienteANotion({
      nombre,
      documento: documento ?? '',
      direccion: direccion ?? '',
      proyecto: proyecto ?? '',
      fecha: fecha ?? new Date().toISOString().split('T')[0],
      estado,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Server error: ${error}` },
      { status: 500 }
    )
  }
}
