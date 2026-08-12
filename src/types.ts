// Modelo de dominio. Fuente de verdad = valores crudos; el frontend calcula FGR.

export type ProgressMode = 'percentage' | 'm2'

export interface Project {
  id: string
  branch_name: string
  total_m2: number
  max_fgr_target: number
}

/**
 * Tipo de residuo, común a todas las sucursales.
 * `valorizable` es el default de la captura manual; la valorización real se guarda por registro
 * en WasteSplit, porque un mismo residuo puede ir a tratamientos valorizados y no valorizados.
 */
export interface WasteType {
  id: string
  name: string
  valorizable: boolean
}

/** m³ de un tipo de residuo partidos por valorización (la define el tratamiento). */
export interface WasteSplit {
  val: number
  noVal: number
}

export interface RecordRow {
  id: string
  project_id: string
  /** YYYY-MM */
  month: string
  progress_mode: ProgressMode
  /** % del total (0-100) o m² construidos acumulados, según progress_mode. null = avance pendiente */
  progress_value: number | null
  /** Espejo derivado (se recalcula en frontend). null si el avance está pendiente */
  accumulated_m2: number | null
  /** m³ retirados por tipo de residuo: { [wasteTypeId]: { val, noVal } } */
  waste: Record<string, WasteSplit>
  /** Tons. CO2eq. evitadas del mes (viene del export de trazabilidad) */
  co2_avoided_ton: number
}

/** Hito del proyecto (línea vertical en el gráfico), anclado a un mes. */
export interface EventRow {
  id: string
  project_id: string
  name: string
  /** YYYY-MM */
  month: string
}

export type FgrMode = 'monthly' | 'cumulative'

export interface FgrPoint {
  /** YYYY-MM */
  month: string
  /** timestamp local del inicio de mes (eje X tiempo) */
  t: number
  monthlyM2: number
  accumulatedM2: number
  /** true si el registro no tiene avance capturado todavía (no hay denominador) */
  pendingProgress: boolean
  /** null = hueco (denominador no positivo) */
  global: number | null
  valorizado: number | null
  noValorizado: number | null
  /** m³ del período (según modo) */
  wasteTotal: number
  wasteVal: number
  wasteNoVal: number
  /** % del volumen que fue valorizado (0-100). null si no hubo residuo en el período */
  pctValorizado: number | null
  denomNonPositive: boolean
  negativeProgress: boolean
}
