// Todas las fechas son "naive"/locales: significan el día de calendario que el usuario tecleó.
// NUNCA usar Date.parse('YYYY-MM-DD') (interpreta UTC y desplaza un día en zonas negativas).

/** 'YYYY-MM' -> timestamp local del día 1 de ese mes */
export function monthStartLocal(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).getTime()
}

/** 'YYYY-MM-DD' -> timestamp local (mediodía para evitar bordes de DST) */
export function parseLocalDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).getTime()
}

/** timestamp -> 'YYYY-MM' */
export function formatMonthTick(t: number): string {
  const d = new Date(t)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}`
}

/** Compara dos 'YYYY-MM' lexicográficamente (equivale a orden cronológico) */
export function compareMonth(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const MESES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** 'YYYY-MM' -> 'Ene 2026' */
export function formatMonthHuman(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  return `${MESES_ABBR[m - 1]} ${y}`
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function isValidMonth(s: string): boolean {
  return MONTH_RE.test(s)
}

export function isValidDate(s: string): boolean {
  return DATE_RE.test(s)
}

// Serial de Excel: día 1 = 1900-01-01, con el bug del 1900 bisiesto (existe el 29-feb-1900 falso).
// Para serial >= 61 la base es 1899-12-30; antes de eso hay que compensar el día inexistente.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_DAY = 86400000
const EXCEL_MAX_SERIAL = 2958466 // 9999-12-31

/** Serial de Excel -> 'YYYY-MM-DD' (o null si está fuera de rango). */
export function excelSerialToYmd(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > EXCEL_MAX_SERIAL) return null
  let days = Math.floor(serial)
  if (days < 60) days += 1
  const d = new Date(EXCEL_EPOCH_UTC + days * MS_DAY)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/**
 * Celda de fecha de una planilla -> 'YYYY-MM'. Acepta serial de Excel (46231.51),
 * ISO ('2026-07-28') y formato chileno ('28-07-2026' o '28/07/2026'). null si no se puede.
 */
export function cellToMonth(raw: string): string | null {
  const s = raw.trim()
  if (s === '') return null

  if (/^\d+([.,]\d+)?$/.test(s)) {
    const ymd = excelSerialToYmd(Number(s.replace(',', '.')))
    return ymd ? ymd.slice(0, 7) : null
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const month = `${iso[1]}-${iso[2].padStart(2, '0')}`
    return isValidMonth(month) ? month : null
  }

  const cl = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (cl) {
    const month = `${cl[3]}-${cl[2].padStart(2, '0')}`
    return isValidMonth(month) ? month : null
  }

  return null
}
