import type { FgrMode, FgrPoint, Project, ProgressMode, RecordRow, WasteSplit } from '../types'
import { compareMonth, monthStartLocal } from '../utils/dates'

const EPS = 1e-9

/**
 * m² acumulados a partir de los valores crudos.
 * - percentage: (value / 100) * total_m2
 * - m2:         value (ya es el acumulado construido)
 * - null:       avance pendiente (todavía no se capturó)
 */
export function computeAccumulatedM2(
  mode: ProgressMode,
  value: number | null,
  totalM2: number,
): number | null {
  if (value === null) return null
  return mode === 'percentage' ? (value / 100) * totalM2 : value
}

/**
 * Suma los m³ de un mes separando valorizado / no valorizado.
 * La valorización ya viene resuelta en el dato (la define el tratamiento de cada retiro),
 * no el flag del tipo de residuo.
 *
 * `typeIds` limita el cálculo a esos tipos de residuo (null/undefined = todos). Sólo afecta al
 * numerador: los m² del proyecto no cambian al filtrar.
 */
export function splitWaste(
  waste: Record<string, WasteSplit>,
  typeIds?: ReadonlySet<string> | null,
): {
  total: number
  val: number
  noVal: number
} {
  let val = 0
  let noVal = 0
  for (const [typeId, split] of Object.entries(waste)) {
    if (typeIds && !typeIds.has(typeId)) continue
    val += Number(split?.val) || 0
    noVal += Number(split?.noVal) || 0
  }
  return { total: val + noVal, val, noVal }
}

/**
 * Serie para el gráfico. Registros ordenados por mes; "mes anterior" = último
 * registro existente con mes menor (meses saltados = huecos, no se rellenan).
 *
 * Meses con avance pendiente: no aportan denominador (FGR en null) y no cortan la cadena de
 * m² acumulados, pero sus m³ sí entran al acumulado de residuo.
 *
 * `typeIds` (null = todos) filtra qué tipos de residuo entran al numerador.
 */
export function buildSeries(
  records: RecordRow[],
  project: Project,
  mode: FgrMode,
  typeIds?: ReadonlySet<string> | null,
): FgrPoint[] {
  const sorted = [...records].sort((a, b) => compareMonth(a.month, b.month))

  let prevAcc = 0
  let cumTotal = 0
  let cumVal = 0
  let cumNoVal = 0

  return sorted.map((r) => {
    const acc = computeAccumulatedM2(r.progress_mode, r.progress_value, project.total_m2)
    const pendingProgress = acc === null
    const monthlyM2 = pendingProgress ? 0 : acc - prevAcc
    if (!pendingProgress) prevAcc = acc

    const { total, val, noVal } = splitWaste(r.waste, typeIds)
    cumTotal += total
    cumVal += val
    cumNoVal += noVal

    const wTotal = mode === 'monthly' ? total : cumTotal
    const wVal = mode === 'monthly' ? val : cumVal
    const wNoVal = mode === 'monthly' ? noVal : cumNoVal
    const denom = pendingProgress ? 0 : mode === 'monthly' ? monthlyM2 : (acc as number)

    const denomNonPositive = !pendingProgress && denom <= EPS
    const negativeProgress = !pendingProgress && monthlyM2 < -EPS
    const noFgr = pendingProgress || denomNonPositive

    return {
      month: r.month,
      t: monthStartLocal(r.month),
      monthlyM2,
      accumulatedM2: pendingProgress ? prevAcc : (acc as number),
      pendingProgress,
      global: noFgr ? null : wTotal / denom,
      valorizado: noFgr ? null : wVal / denom,
      noValorizado: noFgr ? null : wNoVal / denom,
      wasteTotal: wTotal,
      wasteVal: wVal,
      wasteNoVal: wNoVal,
      // Sólo depende de los m³: los meses con avance pendiente sí tienen % de valorización.
      pctValorizado: wTotal > EPS ? (wVal / wTotal) * 100 : null,
      denomNonPositive,
      negativeProgress,
    }
  })
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface RecordInput {
  progress_mode: ProgressMode
  /** null = pendiente: no se valida el avance */
  progress_value: number | null
  waste: Record<string, WasteSplit>
}

/**
 * Reglas (Q7):
 * - Rechaza imposibles: m³ negativos, % <0 o >100, m² <0 o > total.
 * - Advierte (pero permite guardar) si el avance retrocede vs. el mes anterior.
 * - Con avance pendiente sólo valida los m³.
 */
export function validateRecord(
  input: RecordInput,
  project: Project,
  prevAccumulatedM2: number | null,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  for (const split of Object.values(input.waste)) {
    if ((Number(split?.val) || 0) < 0 || (Number(split?.noVal) || 0) < 0) {
      errors.push('Los m³ de residuo no pueden ser negativos.')
      break
    }
  }

  if (input.progress_value === null) {
    warnings.push('El avance queda pendiente: el FGR de este mes se calculará al completarlo.')
    return { ok: errors.length === 0, errors, warnings }
  }

  if (!Number.isFinite(input.progress_value)) {
    errors.push('El avance no es un número válido.')
    return { ok: false, errors, warnings }
  }

  if (input.progress_mode === 'percentage') {
    if (input.progress_value < 0 || input.progress_value > 100)
      errors.push('El porcentaje de avance debe estar entre 0 y 100.')
  } else {
    if (input.progress_value < 0) errors.push('Los m² construidos no pueden ser negativos.')
    if (input.progress_value > project.total_m2 + EPS)
      errors.push('Los m² construidos no pueden superar el total del proyecto.')
  }

  const acc = computeAccumulatedM2(input.progress_mode, input.progress_value, project.total_m2)
  if (errors.length === 0 && acc !== null && prevAccumulatedM2 !== null && acc < prevAccumulatedM2 - EPS) {
    warnings.push(
      'El avance acumulado es menor que el del mes anterior (m² del mes negativo). Se guardará, pero revisa la captura.',
    )
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Acumulado del último registro con mes < month y avance capturado (o null).
 * Los meses pendientes se saltan: no aportan acumulado.
 */
export function previousAccumulated(
  records: RecordRow[],
  project: Project,
  month: string,
  excludeId?: string,
): number | null {
  const earlier = records
    .filter((r) => r.id !== excludeId && r.progress_value !== null && compareMonth(r.month, month) < 0)
    .sort((a, b) => compareMonth(a.month, b.month))
  const last = earlier.at(-1)
  return last
    ? computeAccumulatedM2(last.progress_mode, last.progress_value, project.total_m2)
    : null
}
