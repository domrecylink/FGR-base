import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import type { ProgressMode, Project, WasteSplit, WasteType } from '../types'
import { analyzeTrazabilidad, type TrazaAnalysis } from '../domain/trazabilidad'
import { readFirstSheet } from '../utils/xlsx'
import { parseDecimal, formatNumber } from '../utils/format'
import { formatMonthHuman } from '../utils/dates'
import { normalizeText } from '../utils/text'
import Card from '../components/ds/Card'
import Button from '../components/ds/Button'
import ProjectSelect from '../components/ProjectSelect'
import NoProjects from '../components/NoProjects'
import { useToast } from '../components/ds/Toast'

type Tab = 'traza' | 'csv'

export default function CargaMasiva() {
  const { projects, selectedProjectId } = useData()
  const [tab, setTab] = useState<Tab>('traza')

  const project = projects.find((p) => p.id === selectedProjectId) ?? null
  if (projects.length === 0) return <NoProjects />
  if (!project) return null

  const tabs: [Tab, string][] = [
    ['traza', 'Trazabilidad (Excel)'],
    ['csv', 'CSV de avance'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="rl-eyebrow">Carga masiva</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ProjectSelect fontSize={18} />
          <span style={{ font: '400 13.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
            Carga varios meses de una vez desde una planilla.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--rl-border)' }}>
        {tabs.map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '10px 14px',
              font: '600 14px/1 var(--rl-font-body)',
              color: tab === t ? 'var(--rl-primary-900)' : 'var(--rl-fg-subtle)',
              borderBottom: `2.5px solid ${tab === t ? 'var(--rl-primary-900)' : 'transparent'}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'traza' ? <Trazabilidad project={project} /> : <CsvAvance project={project} />}
    </div>
  )
}

/* ---------------- Trazabilidad (Excel) ---------------- */

type Decision = 'replace' | 'skip'

function Trazabilidad({ project }: { project: Project }) {
  const { records, wasteTypes, createWasteTypesBulk, importTrazabilidad } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<TrazaAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [importing, setImporting] = useState(false)

  const existingMonths = useMemo(
    () => new Set(records.filter((r) => r.project_id === project.id).map((r) => r.month)),
    [records, project.id],
  )

  /** Residuos del archivo que todavía no existen como tipo. */
  const newTypes = useMemo(() => {
    if (!analysis) return []
    const known = new Set(wasteTypes.map((t) => normalizeText(t.name)))
    return analysis.wasteNames.filter((n) => !known.has(normalizeText(n)))
  }, [analysis, wasteTypes])

  async function onFile(file: File) {
    setError(null)
    setAnalysis(null)
    setFileName(file.name)
    try {
      const rows = readFirstSheet(await file.arrayBuffer())
      const result = analyzeTrazabilidad(rows, project.branch_name)
      setAnalysis(result)
      setDecisions(Object.fromEntries(result.months.map((m) => [m.month, 'replace' as Decision])))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const selected = analysis?.months.filter((m) => decisions[m.month] !== 'skip') ?? []

  async function importar() {
    if (!analysis || selected.length === 0) return
    setImporting(true)
    try {
      // 1) Crear los tipos de residuo que falten. El flag valorizable queda según cómo llegó el
      //    residuo en el archivo (sólo es el default de la captura manual).
      let types: WasteType[] = wasteTypes
      if (newTypes.length > 0) {
        const created = await createWasteTypesBulk(
          newTypes.map((name) => ({ name, valorizable: mostlyValorizado(analysis, name) })),
        )
        types = [...types, ...created]
      }
      const idByName = new Map(types.map((t) => [normalizeText(t.name), t.id]))

      // 2) Traducir los residuos del archivo a ids de tipo.
      const items = selected.map((m) => {
        const waste: Record<string, WasteSplit> = {}
        for (const line of m.lines) {
          const id = idByName.get(normalizeText(line.residuo))
          if (!id) continue
          const prev = waste[id] ?? { val: 0, noVal: 0 }
          waste[id] = { val: prev.val + line.val, noVal: prev.noVal + line.noVal }
        }
        return { month: m.month, waste, co2_avoided_ton: m.co2 }
      })

      const { created, updated } = await importTrazabilidad(project.id, items)
      toast(
        `${created + updated} ${created + updated === 1 ? 'mes importado' : 'meses importados'}` +
          (updated > 0 ? ` (${updated} reemplazado${updated === 1 ? '' : 's'})` : ''),
      )
      navigate('/ingreso')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 560px', minWidth: 320 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              Subir el Detalle de Trazabilidad
            </h2>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '34px 20px',
                border: '1.5px dashed var(--rl-border-strong)',
                borderRadius: 'var(--rl-radius-lg)',
                background: 'var(--rl-gray-25)',
                textAlign: 'center',
              }}
            >
              <strong style={{ font: '700 15px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
                {fileName ?? 'Elegir archivo .xlsx'}
              </strong>
              <span style={{ font: '400 13.5px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
                El export de la plataforma, sin modificar la primera fila.
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            {error && (
              <div style={{ borderRadius: 8, padding: '10px 14px', fontSize: 14, background: 'var(--rl-error-50)', color: 'var(--rl-error-700)', border: '1px solid var(--rl-error-200)' }}>
                {error}
              </div>
            )}
          </div>
        </Card>

        <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, padding: 20, borderRadius: 10, background: 'var(--rl-primary-50)' }}>
          <strong style={{ font: '700 14.5px/1.3 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>
            Qué lee la app
          </strong>
          <span style={{ font: '400 14px/1.6 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>
            <strong>Sucursal</strong>, <strong>Residuo</strong>, <strong>Volumen Calculado</strong> (m³),
            <strong> Fecha de Operación</strong> (define el mes), <strong>Tipo de Tratamiento</strong>
            {' '}(define si es valorizado) y <strong>Tons. CO2eq. evitadas</strong>. Sólo se importan las
            filas <strong>Finalizada</strong> de la sucursal seleccionada.
          </span>
          <span style={{ font: '400 13px/1.6 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>
            La planilla no trae avance de obra: cada mes se crea con el avance pendiente y lo completas
            en Ingreso mensual.
          </span>
        </div>
      </div>

      {analysis && (
        <>
          {analysis.months.length === 0 ? (
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '28px 8px', textAlign: 'center', alignItems: 'center' }}>
                <strong style={{ font: '700 16px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
                  No hay filas para “{project.branch_name}”
                </strong>
                <span style={{ font: '400 14px/1.55 var(--rl-font-body)', color: 'var(--rl-fg-muted)', maxWidth: 520 }}>
                  Se leyeron {analysis.totalRows} filas. El nombre de la sucursal en la app debe coincidir
                  con la columna Sucursal del archivo.
                </span>
              </div>
            </Card>
          ) : null}

          <Notices analysis={analysis} newTypes={newTypes} />

          {analysis.months.length > 0 && (
            <Card pad={false}>
              <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--rl-border)', background: 'var(--rl-gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ font: '600 14px/1 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
                  {analysis.months.length} {analysis.months.length === 1 ? 'mes detectado' : 'meses detectados'} · {selected.length} a importar
                </span>
                <Button variant="primary" size="sm" onClick={() => void importar()} disabled={selected.length === 0 || importing}>
                  {importing ? 'Importando…' : `Importar ${selected.length} ${selected.length === 1 ? 'mes' : 'meses'}`}
                </Button>
              </div>
              <div className="table-scroll">
                <div style={{ minWidth: 860 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID_T, gap: 10, padding: '13px 22px', borderBottom: '1px solid var(--rl-border)', font: '600 12.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
                    <span>Mes</span><span>Retiros</span><span>Valorizado m³</span><span>No valorizado m³</span><span>CO₂eq (t)</span><span>Avance</span><span>Estado</span>
                  </div>
                  {analysis.months.map((m) => {
                    const exists = existingMonths.has(m.month)
                    const skip = decisions[m.month] === 'skip'
                    return (
                      <div key={m.month} style={{ display: 'grid', gridTemplateColumns: GRID_T, gap: 10, padding: '13px 22px', borderBottom: '1px solid var(--rl-border-subtle)', alignItems: 'center', font: '400 14px/1.3 var(--rl-font-body)', opacity: skip ? 0.5 : 1, background: exists && !skip ? 'var(--rl-warning-50)' : 'transparent' }}>
                        <span style={{ fontWeight: 700, color: 'var(--rl-fg)' }}>{formatMonthHuman(m.month)}</span>
                        <span>{m.rowCount}</span>
                        <span style={{ color: 'var(--rl-success-700)', fontWeight: 600 }}>{formatNumber(m.totalVal, 1)}</span>
                        <span style={{ color: 'var(--rl-gray-600)', fontWeight: 600 }}>{formatNumber(m.totalNoVal, 1)}</span>
                        <span>{formatNumber(m.co2, 2)}</span>
                        <span style={{ font: '600 12.5px/1.3 var(--rl-font-body)', color: 'var(--rl-warning-700)' }}>Pendiente</span>
                        {exists ? (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ font: '400 12.5px/1.3 var(--rl-font-body)', color: 'var(--rl-warning-700)' }}>Ya existe</span>
                            <button type="button" onClick={() => setDecisions((d) => ({ ...d, [m.month]: 'replace' }))} style={pill(!skip)}>Reemplazar</button>
                            <button type="button" onClick={() => setDecisions((d) => ({ ...d, [m.month]: 'skip' }))} style={pill(skip)}>Omitir</button>
                          </div>
                        ) : (
                          <span style={{ font: '400 13px/1.3 var(--rl-font-body)', color: 'var(--rl-success-700)' }}>Nuevo</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              <p style={{ padding: '14px 22px', margin: 0, font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
                Reemplazar sobrescribe los m³ y el CO₂ del mes, y conserva el avance que ya tengas capturado.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

const GRID_T = '1.1fr 0.7fr 1.1fr 1.2fr 0.9fr 0.9fr 1.7fr'

function pill(on: boolean): React.CSSProperties {
  return {
    all: 'unset',
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 999,
    font: '600 12px/1 var(--rl-font-body)',
    background: on ? 'var(--rl-primary-50)' : 'var(--rl-bg)',
    color: on ? 'var(--rl-primary-900)' : 'var(--rl-fg-subtle)',
    border: `1px solid ${on ? 'var(--rl-primary-200)' : 'var(--rl-border-strong)'}`,
  }
}

/** ¿El residuo llegó mayoritariamente valorizado en el archivo? Default del tipo nuevo. */
function mostlyValorizado(analysis: TrazaAnalysis, residuo: string): boolean {
  const key = normalizeText(residuo)
  let val = 0
  let noVal = 0
  for (const m of analysis.months) {
    for (const l of m.lines) {
      if (normalizeText(l.residuo) !== key) continue
      val += l.val
      noVal += l.noVal
    }
  }
  return val > noVal
}

function Notices({ analysis, newTypes }: { analysis: TrazaAnalysis; newTypes: string[] }) {
  const items: { tone: 'info' | 'warn'; title: string; body: string }[] = []

  if (newTypes.length > 0) {
    items.push({
      tone: 'info',
      title: `Se crearán ${newTypes.length} ${newTypes.length === 1 ? 'tipo de residuo' : 'tipos de residuo'}`,
      body: newTypes.join(' · '),
    })
  }
  if (analysis.unknownTreatments.length > 0) {
    items.push({
      tone: 'warn',
      title: 'Tratamientos sin clasificar (se cuentan como NO valorizados)',
      body: analysis.unknownTreatments.join(' · '),
    })
  }
  if (analysis.otherBranches.length > 0) {
    const total = analysis.otherBranches.reduce((s, b) => s + b.rows, 0)
    items.push({
      tone: 'info',
      title: `${total} filas de otras sucursales quedaron fuera`,
      body: analysis.otherBranches.map((b) => `${b.name} (${b.rows})`).join(' · '),
    })
  }
  if (analysis.skipped.length > 0) {
    const total = analysis.skipped.reduce((s, g) => s + g.rows, 0)
    items.push({
      tone: 'warn',
      title: `${total} filas de esta sucursal se descartaron`,
      body: analysis.skipped.map((g) => `${g.reason} (${g.rows})`).join(' · '),
    })
  }

  if (items.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((n, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            padding: '12px 16px',
            borderRadius: 10,
            border: `1px solid ${n.tone === 'warn' ? 'var(--rl-warning-300)' : 'var(--rl-border)'}`,
            background: n.tone === 'warn' ? 'var(--rl-warning-50)' : 'var(--rl-gray-50)',
          }}
        >
          <strong style={{ font: '700 13.5px/1.3 var(--rl-font-body)', color: n.tone === 'warn' ? 'var(--rl-warning-700)' : 'var(--rl-fg)' }}>
            {n.title}
          </strong>
          <span style={{ font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>{n.body}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------------- CSV de avance (formato propio) ---------------- */

interface ParsedRow {
  month: string
  mode: ProgressMode
  value: number
  waste: Record<string, WasteSplit>
  error?: string
}

function CsvAvance({ project }: { project: Project }) {
  const { records, wasteTypes, createRecordsBulk } = useData()
  const navigate = useNavigate()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[] | null>(null)

  const existingMonths = useMemo(
    () => new Set(records.filter((r) => r.project_id === project.id).map((r) => r.month)),
    [records, project.id],
  )

  function analizar() {
    setRows(parseCsv(text, wasteTypes, existingMonths))
  }

  async function importar() {
    if (!rows) return
    const ok = rows.filter((r) => !r.error)
    await createRecordsBulk(
      ok.map((r) => ({
        project_id: project.id,
        month: r.month,
        progress_mode: r.mode,
        progress_value: r.value,
        waste: r.waste,
      })),
    )
    toast(`${ok.length} ${ok.length === 1 ? 'mes importado' : 'meses importados'}`)
    navigate('/ingreso')
  }

  const okCount = rows?.filter((r) => !r.error).length ?? 0
  const errCount = rows?.filter((r) => r.error).length ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Card style={{ flex: '1 1 560px', minWidth: 320 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>Pegar o subir CSV</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" onClick={() => downloadTemplate(wasteTypes)}>Descargar plantilla</Button>
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Subir archivo</Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const t = await f.text()
                    setText(t)
                    setRows(parseCsv(t, wasteTypes, existingMonths))
                  }}
                />
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder(wasteTypes)}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 200,
                resize: 'vertical',
                border: '1px solid var(--rl-border-strong)',
                borderRadius: 8,
                padding: 12,
                font: '400 13px/1.5 var(--rl-font-mono)',
                color: 'var(--rl-fg)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={analizar} disabled={!text.trim()}>Analizar</Button>
            </div>
          </div>
        </Card>

        <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, padding: 20, borderRadius: 10, background: 'var(--rl-primary-50)' }}>
          <strong style={{ font: '700 14.5px/1.3 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>Formato de la planilla</strong>
          <span style={{ font: '400 14px/1.6 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>
            Delimitador <strong>punto y coma (;)</strong>. Columnas: <code>mes</code> (AAAA-MM), <code>modo</code> (% o m2), <code>avance</code>, y una columna por cada tipo de residuo (m³). Los decimales van con coma.
          </span>
          <span style={{ font: '400 13px/1.6 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>
            Los m³ se clasifican con la marca valorizable de cada tipo. Si necesitas la valorización real
            por tratamiento, usa la pestaña Trazabilidad.
          </span>
        </div>
      </div>

      {rows && (
        <Card pad={false}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--rl-border)', background: 'var(--rl-gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ font: '600 14px/1 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              {okCount} válidos{errCount > 0 && <span style={{ color: 'var(--rl-error-700)' }}> · {errCount} con error</span>}
            </span>
            <Button variant="primary" size="sm" onClick={() => void importar()} disabled={okCount === 0}>
              Importar {okCount} {okCount === 1 ? 'mes' : 'meses'}
            </Button>
          </div>
          <div className="table-scroll">
            <div style={{ minWidth: 640 }}>
              {rows.map((r, i) => {
                const total = Object.values(r.waste).reduce((a, b) => a + b.val + b.noVal, 0)
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 2fr', gap: 10, padding: '12px 22px', borderBottom: '1px solid var(--rl-border-subtle)', alignItems: 'center', font: '400 14px/1.3 var(--rl-font-body)', background: r.error ? 'var(--rl-error-50)' : 'transparent' }}>
                    <span style={{ fontWeight: 700, color: 'var(--rl-fg)' }}>{r.month ? formatMonthHuman(r.month) : '—'}</span>
                    <span>{r.mode === 'percentage' ? `${formatNumber(r.value)}%` : `${formatNumber(r.value)} m²`}</span>
                    <span>{formatNumber(total, 1)} m³</span>
                    <span style={{ color: r.error ? 'var(--rl-error-700)' : 'var(--rl-success-700)', font: '400 13px/1.3 var(--rl-font-body)' }}>
                      {r.error ?? 'OK'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function placeholder(types: WasteType[]): string {
  const cols = ['mes', 'modo', 'avance', ...types.map((t) => t.name)]
  return cols.join(';') + '\n2026-01;%;8;' + types.map(() => '0').join(';')
}

function downloadTemplate(types: WasteType[]) {
  const header = ['mes', 'modo', 'avance', ...types.map((t) => t.name)].join(';')
  const example = ['2026-01', '%', '8', ...types.map(() => '0')].join(';')
  const csv = '﻿' + header + '\n' + example + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla-fgr.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function parseCsv(
  text: string,
  types: WasteType[],
  existingMonths: Set<string>,
): ParsedRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const delim = lines[0].includes(';') ? ';' : ','
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase())
  const idxMes = header.indexOf('mes')
  const idxModo = header.indexOf('modo')
  const idxAvance = header.indexOf('avance')

  // Mapea columnas de residuo por nombre de tipo (case-insensitive).
  const wasteCols: { col: number; type: WasteType }[] = []
  header.forEach((h, col) => {
    const t = types.find((x) => x.name.trim().toLowerCase() === h)
    if (t) wasteCols.push({ col, type: t })
  })

  const seen = new Set<string>()
  return lines.slice(1).map((line): ParsedRow => {
    const cells = line.split(delim).map((c) => c.trim())
    const month = idxMes >= 0 ? cells[idxMes] ?? '' : ''
    const modoRaw = (idxModo >= 0 ? cells[idxModo] ?? '' : '').toLowerCase()
    const mode: ProgressMode = modoRaw === 'm2' || modoRaw === 'm²' ? 'm2' : 'percentage'
    const value = idxAvance >= 0 ? parseDecimal(cells[idxAvance] ?? '') : NaN
    const waste: Record<string, WasteSplit> = {}
    for (const wc of wasteCols) {
      const n = parseDecimal(cells[wc.col] ?? '')
      if (Number.isFinite(n) && n !== 0) {
        // El CSV propio no trae tratamiento: se usa la marca del tipo.
        waste[wc.type.id] = wc.type.valorizable ? { val: n, noVal: 0 } : { val: 0, noVal: n }
      }
    }

    let error: string | undefined
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error = 'Mes inválido (usa AAAA-MM)'
    else if (!Number.isFinite(value)) error = 'Avance inválido'
    else if (existingMonths.has(month) || seen.has(month)) error = 'Mes duplicado'
    seen.add(month)

    return { month, mode, value, waste, error }
  })
}
