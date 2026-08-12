import { describe, expect, it } from 'vitest'
import { cellToMonth, excelSerialToYmd } from './dates'

describe('excelSerialToYmd', () => {
  it('serial con hora -> día calendario', () => {
    // 46231.513291261574 es el valor real del export de trazabilidad (28-07-2026).
    expect(excelSerialToYmd(46231.513291261574)).toBe('2026-07-28')
  })
  it('inicios de año conocidos', () => {
    expect(excelSerialToYmd(45292)).toBe('2024-01-01')
    expect(excelSerialToYmd(46023)).toBe('2026-01-01')
  })
  it('compensa el bug del 1900 bisiesto', () => {
    expect(excelSerialToYmd(1)).toBe('1900-01-01')
    expect(excelSerialToYmd(59)).toBe('1900-02-28')
    expect(excelSerialToYmd(61)).toBe('1900-03-01')
  })
  it('fuera de rango -> null', () => {
    expect(excelSerialToYmd(0)).toBeNull()
    expect(excelSerialToYmd(-5)).toBeNull()
    expect(excelSerialToYmd(NaN)).toBeNull()
  })
})

describe('cellToMonth', () => {
  it('serial de Excel', () => {
    expect(cellToMonth('46231.513291261574')).toBe('2026-07')
  })
  it('texto ISO', () => {
    expect(cellToMonth('2026-07-28')).toBe('2026-07')
    expect(cellToMonth('2026-7-8')).toBe('2026-07')
  })
  it('formato chileno', () => {
    expect(cellToMonth('28-07-2026')).toBe('2026-07')
    expect(cellToMonth('8/7/2026')).toBe('2026-07')
  })
  it('vacío o basura -> null', () => {
    expect(cellToMonth('')).toBeNull()
    expect(cellToMonth('   ')).toBeNull()
    expect(cellToMonth('pendiente')).toBeNull()
    expect(cellToMonth('2026-13-01')).toBeNull()
  })
})
