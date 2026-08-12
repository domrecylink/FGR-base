import { describe, expect, it } from 'vitest'
import type { Project, RecordRow, WasteSplit } from '../types'
import {
  buildSeries,
  computeAccumulatedM2,
  previousAccumulated,
  splitWaste,
  validateRecord,
} from './fgr'

const project: Project = {
  id: 'p1',
  branch_name: 'Sucursal Centro',
  total_m2: 1000,
  max_fgr_target: 0.05,
}

/** Atajo: 'madera:6' -> { madera: { val: 6, noVal: 0 } } */
function val(m3: number): WasteSplit {
  return { val: m3, noVal: 0 }
}
function noVal(m3: number): WasteSplit {
  return { val: 0, noVal: m3 }
}

function rec(p: Partial<RecordRow>): RecordRow {
  return {
    id: p.id ?? 'r',
    project_id: 'p1',
    month: p.month ?? '2026-01',
    progress_mode: p.progress_mode ?? 'm2',
    progress_value: p.progress_value ?? 0,
    accumulated_m2: 0,
    waste: p.waste ?? {},
    co2_avoided_ton: p.co2_avoided_ton ?? 0,
    ...p,
  }
}

describe('computeAccumulatedM2', () => {
  it('percentage -> fracción del total', () => {
    expect(computeAccumulatedM2('percentage', 25, 1000)).toBe(250)
  })
  it('m2 -> valor directo', () => {
    expect(computeAccumulatedM2('m2', 300, 1000)).toBe(300)
  })
  it('avance pendiente -> null', () => {
    expect(computeAccumulatedM2('m2', null, 1000)).toBeNull()
  })
})

describe('splitWaste', () => {
  it('suma val y noVal de cada tipo', () => {
    const r = splitWaste({
      madera: { val: 4, noVal: 1 },
      metal: val(2),
      escombro: noVal(9),
    })
    expect(r.val).toBe(6)
    expect(r.noVal).toBe(10)
    expect(r.total).toBe(16)
  })
  it('el mismo residuo puede estar en las dos clases', () => {
    const r = splitWaste({ madera: { val: 3, noVal: 7 } })
    expect(r.val).toBe(3)
    expect(r.noVal).toBe(7)
  })
  it('typeIds limita la suma a esos tipos', () => {
    const waste = { madera: val(4), escombro: noVal(9), metal: { val: 1, noVal: 2 } }
    const r = splitWaste(waste, new Set(['madera', 'metal']))
    expect(r.val).toBe(5)
    expect(r.noVal).toBe(2)
    expect(r.total).toBe(7)
  })
  it('typeIds vacío deja todo en cero; null/undefined = sin filtro', () => {
    const waste = { madera: val(4), escombro: noVal(9) }
    expect(splitWaste(waste, new Set()).total).toBe(0)
    expect(splitWaste(waste, null).total).toBe(13)
  })
})

describe('pctValorizado', () => {
  it('es m³ valorizados sobre el total del período, sin m² de por medio', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(15), escombro: noVal(5) } }),
    ]
    expect(buildSeries(records, project, 'monthly')[0].pctValorizado).toBeCloseTo(75)
  })
  it('sigue el modo: mensual usa el mes, acumulado el acumulado', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(10) } }),
      rec({ id: 'b', month: '2026-02', progress_value: 400, waste: { escombro: noVal(10) } }),
    ]
    expect(buildSeries(records, project, 'monthly')[1].pctValorizado).toBe(0)
    expect(buildSeries(records, project, 'cumulative')[1].pctValorizado).toBeCloseTo(50)
  })
  it('hay % aunque el avance esté pendiente (no necesita denominador)', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: null, waste: { madera: val(3), escombro: noVal(1) } }),
    ]
    const p = buildSeries(records, project, 'monthly')[0]
    expect(p.global).toBeNull()
    expect(p.pctValorizado).toBeCloseTo(75)
  })
  it('sin residuo en el período queda null, no 0', () => {
    const records = [rec({ id: 'a', month: '2026-01', progress_value: 200, waste: {} })]
    expect(buildSeries(records, project, 'monthly')[0].pctValorizado).toBeNull()
  })
  it('respeta el filtro de tipos', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(5), escombro: noVal(15) } }),
    ]
    expect(buildSeries(records, project, 'monthly', new Set(['madera']))[0].pctValorizado).toBe(100)
  })
})

describe('buildSeries con filtro de tipos', () => {
  it('el filtro cambia el numerador pero no los m²', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(6), escombro: noVal(4) } }),
      rec({ id: 'b', month: '2026-02', progress_value: 500, waste: { madera: val(9), escombro: noVal(6) } }),
    ]
    const s = buildSeries(records, project, 'cumulative', new Set(['madera']))
    expect(s[1].accumulatedM2).toBe(500)
    expect(s[1].wasteTotal).toBe(15)
    expect(s[1].wasteNoVal).toBe(0)
    expect(s[1].global).toBeCloseTo(15 / 500)
    // Sin filtro el mismo mes suma también el escombro.
    expect(buildSeries(records, project, 'cumulative')[1].wasteTotal).toBe(25)
  })
})

describe('buildSeries monthly', () => {
  it('m² del mes = delta; FGR usa residuo del mes', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(6), escombro: noVal(4) } }),
      rec({ id: 'b', month: '2026-02', progress_value: 500, waste: { madera: val(9), escombro: noVal(6) } }),
    ]
    const s = buildSeries(records, project, 'monthly')
    expect(s[1].monthlyM2).toBe(300)
    expect(s[1].global).toBeCloseTo(15 / 300, 9)
    expect(s[1].valorizado).toBeCloseTo(9 / 300, 9)
    expect(s[1].noValorizado).toBeCloseTo(6 / 300, 9)
  })

  it('mes sin avance -> denom 0 -> hueco', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(2) } }),
      rec({ id: 'b', month: '2026-02', progress_value: 200, waste: { madera: val(5) } }),
    ]
    const s = buildSeries(records, project, 'monthly')
    expect(s[1].global).toBeNull()
    expect(s[1].denomNonPositive).toBe(true)
  })

  it('retroceso -> negativeProgress + hueco', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 500 }),
      rec({ id: 'b', month: '2026-02', progress_value: 300, waste: { madera: val(5) } }),
    ]
    const s = buildSeries(records, project, 'monthly')
    expect(s[1].negativeProgress).toBe(true)
    expect(s[1].global).toBeNull()
  })
})

describe('buildSeries cumulative', () => {
  it('usa residuo y m² acumulados', () => {
    const records = [
      rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(6), escombro: noVal(4) } }),
      rec({ id: 'b', month: '2026-02', progress_value: 500, waste: { madera: val(9), escombro: noVal(6) } }),
    ]
    const s = buildSeries(records, project, 'cumulative')
    expect(s[1].accumulatedM2).toBe(500)
    expect(s[1].global).toBeCloseTo((6 + 4 + 9 + 6) / 500, 9)
    expect(s[1].valorizado).toBeCloseTo((6 + 9) / 500, 9)
  })
})

describe('buildSeries con avance pendiente', () => {
  const records = [
    rec({ id: 'a', month: '2026-01', progress_value: 200, waste: { madera: val(6) } }),
    rec({ id: 'b', month: '2026-02', progress_value: null, waste: { madera: val(10) } }),
    rec({ id: 'c', month: '2026-03', progress_value: 500, waste: { madera: val(4) } }),
  ]

  it('el mes pendiente no tiene FGR y arrastra el acumulado anterior', () => {
    const s = buildSeries(records, project, 'monthly')
    expect(s[1].pendingProgress).toBe(true)
    expect(s[1].global).toBeNull()
    expect(s[1].monthlyM2).toBe(0)
    expect(s[1].accumulatedM2).toBe(200)
    expect(s[1].denomNonPositive).toBe(false)
    expect(s[1].negativeProgress).toBe(false)
  })

  it('no corta la cadena: el mes siguiente mide contra el último avance conocido', () => {
    const s = buildSeries(records, project, 'monthly')
    expect(s[2].monthlyM2).toBe(300)
    expect(s[2].global).toBeCloseTo(4 / 300, 9)
  })

  it('los m³ del mes pendiente sí entran al acumulado', () => {
    const s = buildSeries(records, project, 'cumulative')
    expect(s[2].wasteTotal).toBe(20)
    expect(s[2].global).toBeCloseTo(20 / 500, 9)
  })
})

describe('previousAccumulated', () => {
  const records = [
    rec({ id: 'a', month: '2026-01', progress_value: 200 }),
    rec({ id: 'c', month: '2026-03', progress_value: 700 }),
  ]
  it('salta meses faltantes', () => {
    expect(previousAccumulated(records, project, '2026-03')).toBe(200)
  })
  it('null si no hay anterior', () => {
    expect(previousAccumulated(records, project, '2026-01')).toBeNull()
  })
  it('excluye el propio id al editar', () => {
    expect(previousAccumulated(records, project, '2026-03', 'c')).toBe(200)
  })
  it('ignora los meses con avance pendiente', () => {
    const withPending = [...records, rec({ id: 'b', month: '2026-02', progress_value: null })]
    expect(previousAccumulated(withPending, project, '2026-03')).toBe(200)
  })
})

describe('validateRecord', () => {
  it('rechaza % fuera de rango', () => {
    const r = validateRecord(
      { progress_mode: 'percentage', progress_value: 120, waste: {} },
      project,
      null,
    )
    expect(r.ok).toBe(false)
  })
  it('rechaza m² > total', () => {
    const r = validateRecord({ progress_mode: 'm2', progress_value: 1200, waste: {} }, project, null)
    expect(r.ok).toBe(false)
  })
  it('rechaza m³ negativo', () => {
    const r = validateRecord(
      { progress_mode: 'm2', progress_value: 100, waste: { madera: { val: -1, noVal: 0 } } },
      project,
      null,
    )
    expect(r.ok).toBe(false)
  })
  it('advierte retroceso', () => {
    const r = validateRecord(
      { progress_mode: 'm2', progress_value: 100, waste: {} },
      project,
      300,
    )
    expect(r.ok).toBe(true)
    expect(r.warnings.length).toBe(1)
  })
  it('avance pendiente: válido con aviso, sin validar el avance', () => {
    const r = validateRecord(
      { progress_mode: 'm2', progress_value: null, waste: { madera: val(3) } },
      project,
      300,
    )
    expect(r.ok).toBe(true)
    expect(r.warnings.length).toBe(1)
  })
  it('avance pendiente: sigue rechazando m³ negativos', () => {
    const r = validateRecord(
      { progress_mode: 'm2', progress_value: null, waste: { madera: noVal(-2) } },
      project,
      null,
    )
    expect(r.ok).toBe(false)
  })
})
