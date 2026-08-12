// Formateo en locale español (coma decimal). Entrada tolerante a coma o punto.

const LOCALE = 'es-CL'

export function formatFgr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}

/** Porcentaje 0-100 con un decimal: 74.6 -> "74,6 %" */
export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Convierte texto de input a número aceptando coma O punto decimal.
 * Devuelve NaN si no es parseable (el llamador decide qué hacer).
 */
export function parseDecimal(raw: string): number {
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return NaN
  return Number(cleaned)
}
