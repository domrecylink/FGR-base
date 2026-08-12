// Lectura del export "Detalle Trazabilidad" (una fila por retiro) -> agregado por mes.
//
// Columnas que se usan (por nombre de encabezado, con letra fija como respaldo):
//   Sucursal (C) · Estado (E) · Residuo (H) · Volumen Calculado (L)
//   Fecha de Operación (M) · Tipo de Tratamiento (AB) · Tons. CO2eq. evitadas (AD)
//
// El avance de obra NO viene en la planilla: los meses se importan con avance pendiente.

import type { SheetRow } from '../utils/xlsx'
import { cellToMonth } from '../utils/dates'
import { parseDecimal } from '../utils/format'
import { normalizeText } from '../utils/text'
import { isValorizado } from './treatments'

/** Estado que se considera residuo efectivamente retirado y tratado. */
const ESTADO_VALIDO = 'finalizada'

type Field = 'sucursal' | 'estado' | 'residuo' | 'volumen' | 'fecha' | 'tratamiento' | 'co2'

/** Nombres aceptados por campo (el primero es el del export; se comparan normalizados). */
const COLUMN_SPECS: Record<Field, string[]> = {
  sucursal: ['Sucursal'],
  estado: ['Estado'],
  residuo: ['Residuo'],
  volumen: ['Volumen Calculado', 'Volumen Solicitado (m³)', 'Volumen'],
  fecha: ['Fecha de Operación'],
  tratamiento: ['Tipo de Tratamiento', 'Tratamiento'],
  co2: ['Tons. CO2eq. evitadas', 'Tons CO2eq evitadas', 'CO2eq evitadas'],
}

/** Clave de encabezado: sin acentos, sin puntuación ni espacios. "Tons. CO2eq. evitadas" -> tonsco2eqevitadas */
function headerKey(s: string): string {
  return normalizeText(s).replace(/[^a-z0-9]/g, '')
}

export interface WasteLine {
  /** Nombre del residuo tal como viene en la planilla */
  residuo: string
  val: number
  noVal: number
}

export interface TrazaMonth {
  /** YYYY-MM */
  month: string
  lines: WasteLine[]
  totalVal: number
  totalNoVal: number
  co2: number
  rowCount: number
}

export interface SkipGroup {
  reason: string
  rows: number
}

export interface TrazaAnalysis {
  /** Sucursal buscada (nombre del proyecto seleccionado) */
  branch: string
  months: TrazaMonth[]
  /** Sucursales del archivo que no son la buscada */
  otherBranches: { name: string; rows: number }[]
  skipped: SkipGroup[]
  /** Tratamientos sin clasificar en treatments.ts (se cuentan como NO valorizados) */
  unknownTreatments: string[]
  /** Residuos distintos encontrados para la sucursal buscada */
  wasteNames: string[]
  /** Filas de datos leídas (sin contar el encabezado) */
  totalRows: number
}

/** Columnas sin las que no se puede armar un registro. */
const REQUIRED: Field[] = ['sucursal', 'residuo', 'volumen', 'fecha']

/**
 * Ubica cada campo por el texto de su encabezado. Las columnas opcionales que falten quedan en
 * null (no se adivina por posición: leería la columna equivocada).
 */
function resolveColumns(header: SheetRow): Record<Field, string | null> {
  const byKey = new Map<string, string>()
  for (const [col, text] of Object.entries(header)) {
    const key = headerKey(text)
    if (key && !byKey.has(key)) byKey.set(key, col)
  }

  const cols = {} as Record<Field, string | null>
  for (const [field, names] of Object.entries(COLUMN_SPECS) as [Field, string[]][]) {
    const hit = names.map(headerKey).find((k) => byKey.has(k))
    cols[field] = hit ? byKey.get(hit)! : null
  }

  const missing = REQUIRED.filter((f) => cols[f] === null)
  if (missing.length === REQUIRED.length) {
    throw new Error(
      'No se reconocieron los encabezados. Sube el export "Detalle Trazabilidad" sin modificar la primera fila.',
    )
  }
  if (missing.length > 0) {
    throw new Error(
      'Faltan columnas en la planilla: ' + missing.map((f) => COLUMN_SPECS[f][0]).join(', ') + '.',
    )
  }
  return cols
}

class SkipCounter {
  private map = new Map<string, number>()
  add(reason: string) {
    this.map.set(reason, (this.map.get(reason) ?? 0) + 1)
  }
  list(): SkipGroup[] {
    return [...this.map.entries()]
      .map(([reason, rows]) => ({ reason, rows }))
      .sort((a, b) => b.rows - a.rows)
  }
}

/**
 * Agrega las filas del export por mes para una sola sucursal.
 * `rows` incluye el encabezado en la posición 0 (tal como lo devuelve readFirstSheet).
 */
export function analyzeTrazabilidad(rows: SheetRow[], branchName: string): TrazaAnalysis {
  if (rows.length === 0) throw new Error('La planilla está vacía.')

  const cols = resolveColumns(rows[0])
  const cell = (row: SheetRow, field: Field): string => {
    const col = cols[field]
    return col ? (row[col] ?? '') : ''
  }

  const target = normalizeText(branchName)
  const skipped = new SkipCounter()
  const otherBranches = new Map<string, { name: string; rows: number }>()
  const unknown = new Map<string, string>()
  // month -> residuo normalizado -> línea
  const byMonth = new Map<string, { lines: Map<string, WasteLine>; co2: number; rowCount: number }>()

  const data = rows.slice(1)
  for (const row of data) {
    const sucursal = cell(row, 'sucursal').trim()
    if (normalizeText(sucursal) !== target) {
      const key = normalizeText(sucursal) || '(sin sucursal)'
      const prev = otherBranches.get(key)
      if (prev) prev.rows++
      else otherBranches.set(key, { name: sucursal || '(sin sucursal)', rows: 1 })
      continue
    }

    const estado = cell(row, 'estado').trim()
    if (estado !== '' && normalizeText(estado) !== ESTADO_VALIDO) {
      skipped.add(`Estado "${estado}" (sólo se importa Finalizada)`)
      continue
    }

    const month = cellToMonth(cell(row, 'fecha'))
    if (!month) {
      skipped.add('Sin fecha de operación válida')
      continue
    }

    const residuo = cell(row, 'residuo').trim()
    if (residuo === '') {
      skipped.add('Sin residuo indicado')
      continue
    }

    const m3 = parseDecimal(cell(row, 'volumen'))
    if (!Number.isFinite(m3) || m3 <= 0) {
      skipped.add('Volumen vacío, 0 o no numérico')
      continue
    }

    const tratamiento = cell(row, 'tratamiento').trim()
    const valorizado = isValorizado(tratamiento)
    if (valorizado === null) {
      const key = normalizeText(tratamiento) || '(sin tratamiento)'
      if (!unknown.has(key)) unknown.set(key, tratamiento || '(sin tratamiento)')
    }

    const co2 = parseDecimal(cell(row, 'co2'))

    let bucket = byMonth.get(month)
    if (!bucket) {
      bucket = { lines: new Map(), co2: 0, rowCount: 0 }
      byMonth.set(month, bucket)
    }
    const rKey = normalizeText(residuo)
    let line = bucket.lines.get(rKey)
    if (!line) {
      line = { residuo, val: 0, noVal: 0 }
      bucket.lines.set(rKey, line)
    }
    if (valorizado === true) line.val += m3
    else line.noVal += m3
    bucket.co2 += Number.isFinite(co2) ? co2 : 0
    bucket.rowCount++
  }

  const months: TrazaMonth[] = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([month, b]) => {
      const lines = [...b.lines.values()].sort((x, y) => x.residuo.localeCompare(y.residuo, 'es'))
      return {
        month,
        lines,
        totalVal: lines.reduce((s, l) => s + l.val, 0),
        totalNoVal: lines.reduce((s, l) => s + l.noVal, 0),
        co2: b.co2,
        rowCount: b.rowCount,
      }
    })

  const wasteNames = [
    ...new Set(months.flatMap((m) => m.lines.map((l) => l.residuo))),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  return {
    branch: branchName,
    months,
    otherBranches: [...otherBranches.values()].sort((a, b) => b.rows - a.rows),
    skipped: skipped.list(),
    unknownTreatments: [...unknown.values()].sort((a, b) => a.localeCompare(b, 'es')),
    wasteNames,
    totalRows: data.length,
  }
}
