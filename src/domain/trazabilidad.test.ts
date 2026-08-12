import { describe, expect, it } from 'vitest'
import type { SheetRow } from '../utils/xlsx'
import { analyzeTrazabilidad } from './trazabilidad'

const HEADER: SheetRow = {
  A: 'ID',
  B: 'Razón Social',
  C: 'Sucursal',
  E: 'Estado',
  H: 'Residuo',
  K: 'Volumen Solicitado (m³)',
  L: 'Volumen Calculado',
  M: 'Fecha de Operación',
  AB: 'Tipo de Tratamiento',
  AD: 'Tons. CO2eq. evitadas',
}

/** Fila de retiro. `fecha` acepta serial de Excel o texto. */
function row(p: {
  sucursal: string
  residuo: string
  m3: string
  fecha: string
  tratamiento?: string
  estado?: string
  co2?: string
}): SheetRow {
  return {
    C: p.sucursal,
    E: p.estado ?? 'Finalizada',
    H: p.residuo,
    L: p.m3,
    M: p.fecha,
    AB: p.tratamiento ?? 'Compostaje',
    AD: p.co2 ?? '0',
  }
}

const SUC = 'HC Viña del Mar'

describe('analyzeTrazabilidad', () => {
  it('deduce el mes desde la fecha de operación y agrupa por residuo', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '15.17', fecha: '46231.513291261574' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '4.83', fecha: '46215' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months).toHaveLength(1)
    expect(a.months[0].month).toBe('2026-07')
    expect(a.months[0].rowCount).toBe(2)
    expect(a.months[0].lines).toHaveLength(1)
    expect(a.months[0].lines[0].val).toBeCloseTo(20, 6)
  })

  it('separa meses distintos y los devuelve ordenados', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '5', fecha: '2026-07-10' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '3', fecha: '2026-05-02' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '2', fecha: '2026-06-30' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07'])
  })

  it('el tratamiento decide la valorización, no el residuo', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '10', fecha: '2026-07-01', tratamiento: 'Compostaje' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '4', fecha: '2026-07-02', tratamiento: 'Relleno sanitario' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    const line = a.months[0].lines[0]
    expect(line.residuo).toBe('Madera')
    expect(line.val).toBe(10)
    expect(line.noVal).toBe(4)
    expect(a.months[0].totalVal).toBe(10)
    expect(a.months[0].totalNoVal).toBe(4)
  })

  it('tratamiento desconocido -> no valorizado y se reporta', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '7', fecha: '2026-07-01', tratamiento: 'Tratamiento raro' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months[0].totalNoVal).toBe(7)
    expect(a.months[0].totalVal).toBe(0)
    expect(a.unknownTreatments).toEqual(['Tratamiento raro'])
  })

  it('sólo importa Estado = Finalizada', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '5', fecha: '2026-07-01' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '99', fecha: '2026-07-02', estado: 'En curso' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months[0].totalVal).toBe(5)
    expect(a.skipped.some((s) => s.reason.includes('En curso'))).toBe(true)
  })

  it('las otras sucursales quedan fuera y se listan', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '5', fecha: '2026-07-01' }),
      row({ sucursal: 'HC Concepción', residuo: 'Madera', m3: '8', fecha: '2026-07-01' }),
      row({ sucursal: 'HC Concepción', residuo: 'Metal', m3: '2', fecha: '2026-07-01' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months[0].totalVal).toBe(5)
    expect(a.otherBranches).toEqual([{ name: 'HC Concepción', rows: 2 }])
  })

  it('compara la sucursal sin acentos ni mayúsculas', () => {
    const rows = [HEADER, row({ sucursal: 'hc viña del mar', residuo: 'Madera', m3: '5', fecha: '2026-07-01' })]
    expect(analyzeTrazabilidad(rows, 'HC Viña del Mar').months).toHaveLength(1)
  })

  it('descarta filas sin fecha, sin residuo o sin volumen útil', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '5', fecha: '' }),
      row({ sucursal: SUC, residuo: '', m3: '5', fecha: '2026-07-01' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: '0', fecha: '2026-07-01' }),
      row({ sucursal: SUC, residuo: 'Madera', m3: 'x', fecha: '2026-07-01' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months).toHaveLength(0)
    expect(a.skipped.reduce((s, g) => s + g.rows, 0)).toBe(4)
  })

  it('suma el CO2 del mes', () => {
    const rows = [
      HEADER,
      row({ sucursal: SUC, residuo: 'Madera', m3: '5', fecha: '2026-07-01', co2: '1.5' }),
      row({ sucursal: SUC, residuo: 'Metal', m3: '5', fecha: '2026-07-02', co2: '2.25' }),
    ]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months[0].co2).toBeCloseTo(3.75, 6)
    expect(a.wasteNames).toEqual(['Madera', 'Metal'])
  })

  it('mapea por nombre de encabezado aunque cambien de columna', () => {
    const header: SheetRow = { A: 'Sucursal', B: 'Residuo', C: 'Volumen Calculado', D: 'Fecha de Operación', E: 'Tipo de Tratamiento' }
    const rows = [header, { A: SUC, B: 'Madera', C: '9', D: '2026-07-01', E: 'Compostaje' }]
    const a = analyzeTrazabilidad(rows, SUC)
    expect(a.months[0].totalVal).toBe(9)
  })

  it('encabezados irreconocibles -> error explícito', () => {
    expect(() => analyzeTrazabilidad([{ A: 'foo', B: 'bar' }], SUC)).toThrow(/encabezados/i)
  })
})
