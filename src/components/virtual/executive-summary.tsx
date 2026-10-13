'use client'

import type React from 'react'

import { Zap, Sun, DollarSign, Clock, TreePine } from 'lucide-react'
import { formatCOP, formatNumber } from '@/lib/formatting'
import type { CalculationResults, TechnicalData } from '@/lib/types'
import { paybackSimpleAnios, textoBeneficios, textoModoConexion, type ModoConexion } from '@/lib/proposal-disclosure'

interface ExecutiveSummaryProps {
  results: CalculationResults
  technical?: TechnicalData
  modoConexion: ModoConexion
  precioExcedentes: number
  incluirDeduccionRenta: boolean
  incluirDepreciacionAcelerada: boolean
}

function Tile({
  icon,
  label,
  value,
  unit,
  sub,
  accent,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  sub?: string
  accent?: boolean
  className?: string
}) {
  return (
    <div className={`min-w-0 rounded-md border border-[#2A2A2A] bg-[#161616] p-4 sm:p-5 ${className}`}>
      <p className="mirac-ey flex items-center gap-1.5 text-[10px]">
        <span className="text-[#C6F500]">{icon}</span>
        {label}
      </p>
      <p
        className={`mt-3 break-words font-['DM_Sans',Arial,sans-serif] text-2xl font-extrabold leading-none tracking-[-0.02em] tabular-nums lg:text-[1.6rem] ${accent ? 'text-[#C6F500]' : 'text-white'}`}
      >
        {value}
        {unit && <small className="ml-1 text-sm font-medium tracking-normal text-[#9AA3A7]">{unit}</small>}
      </p>
      {sub && <p className="mt-2 text-xs leading-snug text-[#C6CFD2]">{sub}</p>}
    </div>
  )
}

export function ExecutiveSummary({
  results: r,
  technical,
  modoConexion,
  precioExcedentes,
  incluirDeduccionRenta,
  incluirDepreciacionAcelerada,
}: ExecutiveSummaryProps) {
  const simple = paybackSimpleAnios(r.costo_total_cop, r.ahorro_anual_cop)
  const nota = textoBeneficios(incluirDeduccionRenta, incluirDepreciacionAcelerada)
  const generacionMensual = Math.round(r.generacion_anual_kwh / 12)
  const consumo = technical?.consumo_mensual_kwh ?? 0
  const cobertura = consumo > 0 ? Math.round((generacionMensual / consumo) * 100) : 0

  return (
    <section>
      <h2 className="mb-8">Resumen Ejecutivo</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile
          className="col-span-2 lg:col-span-1"
          icon={<Zap className="size-3.5" />}
          label="Potencia instalada"
          value={r.kwp.toLocaleString('es-CO', { maximumFractionDigits: 1 })}
          unit="kWp"
          sub={`${r.numero_paneles} módulos de ${r.potencia_panel_w} W`}
          accent
        />
        <Tile
          icon={<Sun className="size-3.5" />}
          label="Generación mensual"
          value={formatNumber(generacionMensual)}
          unit="kWh"
          sub={cobertura > 0 ? `Cubre ${cobertura}% del consumo` : undefined}
        />
        <Tile
          icon={<DollarSign className="size-3.5" />}
          label="Ahorro anual"
          value={formatCOP(r.ahorro_anual_cop)}
          sub={`${formatCOP(r.ahorro_mensual_cop)}/mes`}
        />
        <Tile
          icon={<Clock className="size-3.5" />}
          label="Retorno de inversión"
          value={r.payback_anios.toFixed(1)}
          unit="años"
          sub={`TIR: ${r.tir.toFixed(1)}%`}
        />
        <Tile
          icon={<TreePine className="size-3.5" />}
          label="CO₂ evitado"
          value={r.carbon.annual_co2_avoided_tons.toFixed(1)}
          unit="t/año"
          sub={`≈ ${Math.round(r.carbon.trees_saved_per_year)} árboles`}
        />
      </div>
      <p className="mt-4 text-xs text-[#9AA3A7]">
        {textoModoConexion(modoConexion, precioExcedentes)}
        {' '}
        Payback simple: {simple === null ? 'n/d' : `${simple.toFixed(1)} años`}.
      </p>
      {nota && <p className="mt-1 text-xs text-[#9AA3A7]">{nota}</p>}
    </section>
  )
}
