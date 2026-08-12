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
import type { EventRow, FgrPoint, Project } from '../types'
import { formatFgr } from '../utils/format'
import { formatMonthTick, monthStartLocal } from '../utils/dates'

const COLORS = {
  global: 'var(--rl-primary-900)',
  valorizado: 'var(--rl-success-500)',
  noValorizado: 'var(--rl-gray-500)',
  meta: 'var(--rl-error-500)',
  evento: 'var(--rl-primary-300)',
}

const LEGEND = [
  ['FGR global', '#0069a6'],
  ['Valorizado', '#12b76a'],
  ['No valorizado', '#667085'],
] as const

interface TooltipEntry {
  color?: string
  name?: string
  value?: number | null
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean
  label?: number
  payload?: TooltipEntry[]
}) {
  if (!active || !payload?.length) return null
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
      {payload.map((p, i) => (
        <div key={i} style={{ font: '400 13px/1.5 var(--rl-font-body)', color: p.color }}>
          {p.name}: <strong>{formatFgr(p.value ?? null)}</strong>
        </div>
      ))}
    </div>
  )
}

export function ChartLegend() {
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
      {LEGEND.map(([label, color]) => (
        <span
          key={label}
          style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 13px/1 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}
        >
          <span style={{ width: 22, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
          {label}
        </span>
      ))}
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 13px/1 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
        <span style={{ width: 22, height: 0, borderTop: '2.5px dashed #f04438', display: 'inline-block' }} />
        Meta máxima
      </span>
    </div>
  )
}

interface Props {
  series: FgrPoint[]
  events: EventRow[]
  project: Project
  /** false cuando la serie está filtrada por tipo de residuo: la meta es del total, no comparable. */
  showTarget?: boolean
}

export default function FgrChart({ series, events, project, showTarget = true }: Props) {
  if (series.length === 0) return null

  const eventTs = events.filter((e) => e.month).map((e) => monthStartLocal(e.month))
  const monthTs = series.map((p) => p.t)
  const allTs = [...monthTs, ...eventTs]
  const min = Math.min(...allTs)
  const max = Math.max(...allTs)

  // Dominio Y debe incluir la meta para que la línea horizontal siempre sea visible.
  const vals: number[] = []
  for (const p of series) {
    if (p.global != null) vals.push(p.global)
    if (p.valorizado != null) vals.push(p.valorizado)
    if (p.noValorizado != null) vals.push(p.noValorizado)
  }
  if (showTarget) vals.push(project.max_fgr_target)
  const dataMax = vals.length ? Math.max(...vals) : project.max_fgr_target
  const yMax = dataMax > 0 ? dataMax * 1.15 : 1

  return (
    <div style={{ width: '100%', height: 340 }}>
      <ResponsiveContainer>
        <LineChart data={series} margin={{ top: 20, right: 24, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--rl-border-subtle)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min, max]}
            ticks={monthTs}
            tickFormatter={formatMonthTick}
            tick={{ fontSize: 12, fill: '#919599' }}
            stroke="var(--rl-gray-300)"
          />
          <YAxis
            type="number"
            domain={[0, yMax]}
            allowDataOverflow={false}
            tick={{ fontSize: 12, fill: '#919599' }}
            tickFormatter={(v) => formatFgr(v)}
            width={64}
            stroke="var(--rl-gray-300)"
          />
          <Tooltip content={<ChartTooltip />} />

          {showTarget && (
            <ReferenceLine
              y={project.max_fgr_target}
              stroke={COLORS.meta}
              strokeDasharray="7 5"
              strokeWidth={2}
              label={{
                value: `Meta ${formatFgr(project.max_fgr_target)}`,
                position: 'insideTopRight',
                fill: '#b42318',
                fontSize: 11,
              }}
            />
          )}

          {events
            .filter((e) => e.month)
            .map((e) => (
              <ReferenceLine
                key={e.id}
                x={monthStartLocal(e.month)}
                stroke={COLORS.evento}
                strokeDasharray="4 4"
                label={{ value: e.name, position: 'top', fill: '#00528b', fontSize: 11 }}
              />
            ))}

          <Line type="monotone" dataKey="noValorizado" name="No valorizado" stroke={COLORS.noValorizado} strokeWidth={2.2} connectNulls={false} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="valorizado" name="Valorizado" stroke={COLORS.valorizado} strokeWidth={2.2} connectNulls={false} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="global" name="FGR global" stroke={COLORS.global} strokeWidth={3.2} connectNulls={false} dot={{ r: 3.5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
