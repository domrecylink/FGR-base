import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EventRow, FgrPoint } from '../types'
import { formatMonthTick, monthStartLocal } from '../utils/dates'

interface TooltipEntry {
  name?: string
  value?: number | null
}

/** Recharts inyecta active/label/payload al clonar el elemento pasado en `content`. */
function RateTooltip({
  active,
  label,
  payload,
  color,
  format,
}: {
  active?: boolean
  label?: number
  payload?: TooltipEntry[]
  color: string
  format: (v: number | null) => string
}) {
  if (!active || !payload?.length) return null
  const [first] = payload
  return (
    <div
      style={{
        background: 'var(--rl-bg)',
        border: '1px solid var(--rl-border)',
        borderRadius: 8,
        boxShadow: 'var(--rl-shadow-md)',
        padding: 10,
      }}
    >
      <div style={{ font: '600 12px/1 var(--rl-font-body)', color: 'var(--rl-fg-subtle)', marginBottom: 6 }}>
        {label != null ? formatMonthTick(label) : ''}
      </div>
      <div style={{ font: '400 13px/1.5 var(--rl-font-body)', color }}>
        {first?.name}: <strong>{format(first?.value ?? null)}</strong>
      </div>
    </div>
  )
}

/**
 * Gráfico de una sola métrica de la serie FGR (sin meta ni hitos): sirve para el %
 * de valorización y para los m³ valorizados por m².
 */
export default function RateChart({
  series,
  events = [],
  dataKey,
  name,
  color,
  format,
  yMax,
}: {
  series: FgrPoint[]
  /** Hitos del proyecto: líneas verticales punteadas, igual que en el gráfico principal */
  events?: EventRow[]
  dataKey: 'pctValorizado' | 'valorizado'
  name: string
  color: string
  format: (v: number | null) => string
  /** Tope fijo del eje Y (100 para porcentajes); si no, se calcula de los datos */
  yMax?: number
}) {
  if (series.length === 0) return null

  const monthTs = series.map((p) => p.t)
  const withMonth = events.filter((e) => e.month)
  // El dominio X debe incluir los hitos: uno fuera del rango de meses quedaría invisible.
  const allTs = [...monthTs, ...withMonth.map((e) => monthStartLocal(e.month))]
  const vals = series.map((p) => p[dataKey]).filter((v): v is number => v != null)
  const top = yMax ?? (vals.length ? Math.max(...vals) * 1.15 : 1)

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        {/* top holgado: los nombres de hito se dibujan sobre el área de trazado */}
        <LineChart data={series} margin={{ top: 20, right: 18, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--rl-border-subtle)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[Math.min(...allTs), Math.max(...allTs)]}
            ticks={monthTs}
            tickFormatter={formatMonthTick}
            tick={{ fontSize: 12, fill: '#919599' }}
            stroke="var(--rl-gray-300)"
          />
          <YAxis
            type="number"
            domain={[0, top > 0 ? top : 1]}
            tick={{ fontSize: 12, fill: '#919599' }}
            tickFormatter={(v) => format(v)}
            width={64}
            stroke="var(--rl-gray-300)"
          />
          <Tooltip content={<RateTooltip color={color} format={format} />} />

          {withMonth.map((e) => (
            <ReferenceLine
              key={e.id}
              x={monthStartLocal(e.month)}
              stroke="var(--rl-primary-300)"
              strokeDasharray="4 4"
              label={{ value: e.name, position: 'top', fill: '#00528b', fontSize: 10 }}
            />
          ))}

          <Line
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2.6}
            connectNulls={false}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
