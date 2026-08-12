import type { ChipTone } from '../components/ds/StatusChip'
import type { FgrPoint, Project, RecordRow } from '../types'
import { buildSeries } from './fgr'

export interface ProjectSummary {
  monthsCount: number
  /** Meses cargados sin avance capturado (típicamente vienen de la carga de trazabilidad) */
  pendingCount: number
  avancePct: number
  accumulatedM2: number
  /** FGR global acumulado al último mes con datos (null si no hay) */
  fgrAcum: number | null
  estadoLabel: string
  estadoTone: ChipTone
  lastPoint: FgrPoint | null
}

/** Tono según FGR vs meta: verde en meta, ámbar cerca (>90%), rojo sobre meta. */
export function fgrTone(value: number | null, target: number): ChipTone {
  if (value === null) return 'neutral'
  if (value > target) return 'error'
  if (value > target * 0.9) return 'warning'
  return 'success'
}

export function fgrColorVar(value: number | null, target: number): string {
  const t = fgrTone(value, target)
  return t === 'error'
    ? 'var(--rl-error-600)'
    : t === 'warning'
      ? 'var(--rl-warning-700)'
      : t === 'success'
        ? 'var(--rl-success-700)'
        : 'var(--rl-fg)'
}

export function projectSummary(project: Project, records: RecordRow[]): ProjectSummary {
  const series = buildSeries(records, project, 'cumulative')
  const last = series.at(-1) ?? null
  const accumulatedM2 = last?.accumulatedM2 ?? 0
  const avancePct = project.total_m2 > 0 ? (accumulatedM2 / project.total_m2) * 100 : 0
  const fgrAcum = last?.global ?? null

  let estadoLabel = 'Sin datos'
  let estadoTone: ChipTone = 'neutral'
  if (fgrAcum !== null) {
    const tone = fgrTone(fgrAcum, project.max_fgr_target)
    estadoTone = tone
    estadoLabel = tone === 'error' ? 'Sobre meta' : tone === 'warning' ? 'Cerca de meta' : 'En meta'
  }

  return {
    monthsCount: records.length,
    pendingCount: records.filter((r) => r.progress_value === null).length,
    avancePct,
    accumulatedM2,
    fgrAcum,
    estadoLabel,
    estadoTone,
    lastPoint: last,
  }
}
