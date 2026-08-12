import { useMemo, useState } from 'react'
import { useData } from '../store/DataContext'
import { buildSeries, previousAccumulated, splitWaste, validateRecord } from '../domain/fgr'
import { fgrColorVar } from '../domain/summary'
import type { ProgressMode, Project, RecordRow, WasteSplit, WasteType } from '../types'
import { formatFgr, formatNumber, parseDecimal } from '../utils/format'
import { compareMonth, formatMonthHuman } from '../utils/dates'
import Card from '../components/ds/Card'
import Button from '../components/ds/Button'
import Input, { inputStyle, labelStyle } from '../components/ds/Input'
import ProjectSelect from '../components/ProjectSelect'
import NoProjects from '../components/NoProjects'
import MonthPicker from '../components/MonthPicker'
import { useToast } from '../components/ds/Toast'
import { IconClose, IconPen, IconTrash } from '../components/icons'

type Tab = 'planilla' | 'hitos' | 'tipos' | 'config'

export default function IngresoMensual() {
  const { projects, selectedProjectId } = useData()
  const [tab, setTab] = useState<Tab>('planilla')
  const project = projects.find((p) => p.id === selectedProjectId) ?? null

  if (projects.length === 0) return <NoProjects />
  if (!project) return null

  const tabs: [Tab, string][] = [
    ['planilla', 'Planilla mensual'],
    ['hitos', 'Hitos del proyecto'],
    ['tipos', 'Tipos de residuo'],
    ['config', 'Configuración'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="rl-eyebrow">Ingreso mensual</span>
        <ProjectSelect fontSize={18} />
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

      {tab === 'planilla' && <Planilla project={project} />}
      {tab === 'hitos' && <Hitos project={project} />}
      {tab === 'tipos' && <Tipos />}
      {tab === 'config' && <Config project={project} />}
    </div>
  )
}

/* ---------------- Planilla ---------------- */

interface Draft {
  month: string
  mode: ProgressMode
  /** vacío = avance pendiente */
  value: string
  /** por tipo de residuo: m³ valorizados y no valorizados */
  waste: Record<string, { val: string; noVal: string }>
}

function emptyDraft(): Draft {
  return { month: '', mode: 'percentage', value: '', waste: {} }
}

function num(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') return 0
  const n = parseDecimal(raw)
  return Number.isFinite(n) ? n : 0
}

function Planilla({ project }: { project: Project }) {
  const { records, wasteTypes, createRecord, updateRecord, deleteRecord } = useData()
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null) // 'new' | recordId
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [errors, setErrors] = useState<string[]>([])
  const [warn, setWarn] = useState<string | null>(null)
  const [acked, setAcked] = useState(false)

  const rows = useMemo(
    () => records.filter((r) => r.project_id === project.id).sort((a, b) => compareMonth(a.month, b.month)),
    [records, project.id],
  )
  const monthly = useMemo(() => buildSeries(rows, project, 'monthly'), [rows, project])
  const cumulative = useMemo(() => buildSeries(rows, project, 'cumulative'), [rows, project])
  const mMap = useMemo(() => new Map(monthly.map((p) => [p.month, p])), [monthly])
  const cMap = useMemo(() => new Map(cumulative.map((p) => [p.month, p])), [cumulative])

  function startNew() {
    setDraft(emptyDraft())
    setErrors([]); setWarn(null); setAcked(false)
    setEditing('new')
  }
  function startEdit(r: RecordRow) {
    setDraft({
      month: r.month,
      mode: r.progress_mode,
      value: r.progress_value === null ? '' : String(r.progress_value),
      waste: Object.fromEntries(
        wasteTypes.map((t) => {
          const s = r.waste[t.id]
          return [t.id, { val: s?.val ? String(s.val) : '', noVal: s?.noVal ? String(s.noVal) : '' }]
        }),
      ),
    })
    setErrors([]); setWarn(null); setAcked(false)
    setEditing(r.id)
  }
  function cancel() {
    setEditing(null); setErrors([]); setWarn(null); setAcked(false)
  }

  function save() {
    const wasteNum: Record<string, WasteSplit> = {}
    for (const t of wasteTypes) {
      const entry = draft.waste[t.id]
      const val = num(entry?.val)
      const noVal = num(entry?.noVal)
      if (val !== 0 || noVal !== 0) wasteNum[t.id] = { val, noVal }
    }
    const errs: string[] = []
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month)) errs.push('Selecciona un mes válido.')
    const dupId = editing && editing !== 'new' ? editing : undefined
    if (rows.some((r) => r.month === draft.month && r.id !== dupId)) errs.push('Ya existe un registro para ese mes.')
    // Campo vacío = avance pendiente (así llegan los meses de la carga de trazabilidad).
    const pending = draft.value.trim() === ''
    const val = pending ? null : parseDecimal(draft.value)
    if (!pending && !Number.isFinite(val as number)) errs.push('El avance no es un número válido.')
    if (errs.length) { setErrors(errs); setWarn(null); return }

    const prevAcc = previousAccumulated(rows, project, draft.month, dupId)
    const res = validateRecord({ progress_mode: draft.mode, progress_value: val, waste: wasteNum }, project, prevAcc)
    if (!res.ok) { setErrors(res.errors); setWarn(null); return }
    if (res.warnings.length && !acked) { setErrors([]); setWarn(res.warnings[0]); setAcked(true); return }

    const payload = { project_id: project.id, month: draft.month, progress_mode: draft.mode, progress_value: val, waste: wasteNum }
    if (editing === 'new') void createRecord(payload)
    else {
      // Conserva el CO2 importado: la captura manual no lo edita.
      const co2 = rows.find((r) => r.id === editing)?.co2_avoided_ton ?? 0
      void updateRecord({ ...payload, id: editing!, co2_avoided_ton: co2 })
    }
    toast(pending ? 'Mes guardado con avance pendiente' : 'Mes guardado')
    cancel()
  }

  const editor = (
    <RowEditor
      draft={draft}
      setDraft={setDraft}
      wasteTypes={wasteTypes}
      project={project}
      errors={errors}
      warn={warn}
      acked={acked}
      onSave={save}
      onCancel={cancel}
    />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="sm" onClick={startNew} disabled={editing === 'new'}>
          + Agregar mes
        </Button>
      </div>

      <Card pad={false}>
        <div className="table-scroll">
          <div style={{ minWidth: 1040 }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID_P, gap: 10, padding: '13px 22px', borderBottom: '1px solid var(--rl-border)', background: 'var(--rl-gray-50)', font: '600 12.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
              <span>Mes</span><span>Avance (%)</span><span>m² construidos</span><span>Valorizado m³</span><span>No valorizado m³</span><span>Total m³</span><span>FGR del mes</span><span>FGR acumulado</span><span />
            </div>

            {editing === 'new' && (
              <div style={{ borderBottom: '1px solid var(--rl-border-subtle)', padding: '10px 22px 22px' }}>{editor}</div>
            )}

            {rows.length === 0 && editing !== 'new' && <EmptyPlanilla onAdd={startNew} />}

            {rows.map((r) => {
              const mp = mMap.get(r.month)
              const cp = cMap.get(r.month)
              const w = splitWaste(r.waste)
              const pending = r.progress_value === null
              const flagged = mp ? mp.denomNonPositive || mp.negativeProgress : false
              const m2 = mp?.accumulatedM2 ?? r.accumulated_m2 ?? 0
              const pct = project.total_m2 > 0 ? (m2 / project.total_m2) * 100 : 0
              return (
                <div key={r.id} style={{ borderBottom: '1px solid var(--rl-border-subtle)', background: flagged ? 'var(--rl-error-50)' : pending ? 'var(--rl-warning-50)' : 'transparent' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID_P, gap: 10, padding: '14px 22px', alignItems: 'center', font: '400 14px/1.3 var(--rl-font-body)', color: 'var(--rl-fg-body)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--rl-fg)' }}>
                      {formatMonthHuman(r.month)}{flagged && <span title="m² del mes ≤ 0"> ⚠️</span>}
                    </span>
                    {pending ? (
                      <>
                        <PendingAvance onClick={() => startEdit(r)} />
                        <span style={{ color: 'var(--rl-fg-subtle)' }}>—</span>
                      </>
                    ) : (
                      <>
                        <AvColumn value={`${formatNumber(pct, 1)} %`} isInput={r.progress_mode === 'percentage'} />
                        <AvColumn value={`${formatNumber(m2)} m²`} isInput={r.progress_mode === 'm2'} />
                      </>
                    )}
                    <span style={{ color: 'var(--rl-success-700)', fontWeight: 600 }}>{formatNumber(w.val, 1)}</span>
                    <span style={{ color: 'var(--rl-gray-600)', fontWeight: 600 }}>{formatNumber(w.noVal, 1)}</span>
                    <span>{formatNumber(w.total, 1)}</span>
                    <span style={{ fontWeight: 700, color: fgrColorVar(mp?.global ?? null, project.max_fgr_target) }}>{formatFgr(mp?.global ?? null)}</span>
                    <span style={{ fontWeight: 700, color: fgrColorVar(cp?.global ?? null, project.max_fgr_target) }}>{formatFgr(cp?.global ?? null)}</span>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button type="button" onClick={() => startEdit(r)} title="Editar mes" style={iconBtn(editing === r.id ? 'var(--rl-primary-900)' : 'var(--rl-gray-500)')}><IconPen size={16} /></button>
                      <button type="button" onClick={() => { if (confirmDelete(r.month)) { void deleteRecord(r.id); toast('Mes eliminado') } }} title="Eliminar mes" style={iconBtn('var(--rl-gray-400)')}><IconTrash size={16} /></button>
                    </div>
                  </div>
                  {editing === r.id && <div style={{ padding: '0 22px 22px' }}>{editor}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </Card>
      <p style={{ font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
        Puedes editar o eliminar cualquier mes. El FGR se recalcula al guardar: m³ totales divididos por los m² construidos del período.
      </p>
    </div>
  )
}

const GRID_P = '1fr 1fr 1fr 1.1fr 1.2fr 0.9fr 1fr 1fr 0.7fr'

/** Celda de avance: si fue el input, valor resaltado + chip; si es calculado, atenuado con ≈. */
function AvColumn({ value, isInput }: { value: string; isInput: boolean }) {
  if (isInput) {
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ font: '700 14px/1.2 var(--rl-font-body)', color: 'var(--rl-fg)' }}>{value}</span>
        <span style={{ padding: '1px 6px', borderRadius: 999, font: '600 9.5px/1.5 var(--rl-font-body)', letterSpacing: '0.03em', textTransform: 'uppercase', background: 'var(--rl-primary-50)', color: 'var(--rl-primary-900)', alignSelf: 'flex-start' }}>
          ingresado
        </span>
      </span>
    )
  }
  return (
    <span style={{ font: '400 13.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>≈ {value}</span>
  )
}

/** Avance no capturado (mes importado desde trazabilidad): invita a completarlo. */
function PendingAvance({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Completar el avance de este mes"
      style={{
        all: 'unset',
        cursor: 'pointer',
        alignSelf: 'flex-start',
        padding: '3px 9px',
        borderRadius: 999,
        font: '600 11px/1.5 var(--rl-font-body)',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        background: 'var(--rl-warning-50)',
        color: 'var(--rl-warning-700)',
        border: '1px solid var(--rl-warning-300)',
      }}
    >
      Pendiente
    </button>
  )
}

function confirmDelete(month: string) {
  return window.confirm(`¿Eliminar el registro de ${formatMonthHuman(month)}? Esta acción no se puede deshacer.`)
}

function EmptyPlanilla({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <strong style={{ font: '700 17px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>Todavía no hay meses cargados</strong>
      <span style={{ font: '400 14px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-muted)', maxWidth: 380 }}>
        Carga el avance y los m³ del primer mes para empezar a ver tu FGR.
      </span>
      <Button variant="primary" size="sm" onClick={onAdd}>Agregar el primer mes</Button>
    </div>
  )
}

function RowEditor({
  draft, setDraft, wasteTypes, project, errors, warn, acked, onSave, onCancel,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  wasteTypes: WasteType[]
  project: Project
  errors: string[]
  warn: string | null
  acked: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const pending = draft.value.trim() === ''
  const val = parseDecimal(draft.value)
  const hasVal = Number.isFinite(val)
  // Cálculo cruzado: si captura %, estima m²; si captura m², estima %.
  const equivLabel = draft.mode === 'percentage' ? 'm² construidos estimados' : 'Avance estimado'
  const equivValue = pending
    ? 'Pendiente'
    : !hasVal
      ? '—'
      : draft.mode === 'percentage'
        ? `≈ ${formatNumber((val / 100) * project.total_m2)} m²`
        : `≈ ${formatNumber(project.total_m2 > 0 ? (val / project.total_m2) * 100 : 0, 1)} %`

  // Totales en vivo de residuo (valorizado / no valorizado).
  let liveVal = 0
  let liveNoVal = 0
  for (const t of wasteTypes) {
    liveVal += num(draft.waste[t.id]?.val)
    liveNoVal += num(draft.waste[t.id]?.noVal)
  }
  const liveTotal = liveVal + liveNoVal

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: 20,
        border: '1px solid var(--rl-border)',
        borderRadius: 'var(--rl-radius-lg)',
        background: 'var(--rl-gray-25)',
        boxShadow: 'var(--rl-shadow-xs)',
        animation: 'rlUp .2s cubic-bezier(.4,0,.2,1)',
      }}
    >
      {errors.map((e, i) => <div key={i} style={alertErr}>{e}</div>)}
      {warn && <div style={alertWarn}>{warn}</div>}

      {/* Sección: avance */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={sectionLabel}>Avance de la obra</span>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={labelStyle}>Mes</span>
            <MonthPicker value={draft.month} onChange={(m) => setDraft((d) => ({ ...d, month: m }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={labelStyle}>Registrar en</span>
            <div style={{ display: 'inline-flex', padding: 3, gap: 3, borderRadius: 999, background: 'var(--rl-gray-100)' }}>
              {(['percentage', 'm2'] as ProgressMode[]).map((u) => (
                <button key={u} type="button" onClick={() => setDraft((d) => ({ ...d, mode: u }))} style={segPill(draft.mode === u)}>
                  {u === 'percentage' ? '% avance' : 'm² construidos'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: 190 }}>
            <Input
              label={draft.mode === 'percentage' ? 'Avance acumulado (%)' : 'm² acumulados'}
              value={draft.value}
              onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
              inputMode="decimal"
              placeholder="Dejar vacío = pendiente"
            />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              padding: '8px 14px',
              borderRadius: 'var(--rl-radius-md)',
              background: 'var(--rl-primary-50)',
              minWidth: 150,
            }}
          >
            <span style={{ font: '600 11px/1 var(--rl-font-body)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rl-primary-700)' }}>
              {equivLabel}
            </span>
            <span style={{ font: '700 17px/1.1 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>
              {equivValue}
            </span>
          </div>
        </div>
        {pending && (
          <span style={{ font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-warning-700)' }}>
            Sin avance el mes se guarda igual y sus m³ quedan registrados, pero no tendrá FGR hasta
            que completes el dato.
          </span>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--rl-border)' }} />

      {/* Sección: residuos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={sectionLabel}>Residuos retirados en el mes (m³)</span>
          {liveTotal > 0 && (
            <span style={{ display: 'flex', gap: 14, font: '600 12.5px/1 var(--rl-font-body)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--rl-success-700)' }}>Valorizado {formatNumber(liveVal, 1)}</span>
              <span style={{ color: 'var(--rl-gray-600)' }}>No valorizado {formatNumber(liveNoVal, 1)}</span>
              <span style={{ color: 'var(--rl-fg)' }}>Total {formatNumber(liveTotal, 1)} m³</span>
            </span>
          )}
        </div>
        {wasteTypes.length === 0 ? (
          <span style={{ font: '400 13.5px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
            No hay tipos de residuo. Créalos en la pestaña “Tipos de residuo”.
          </span>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
            {wasteTypes.map((t) => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--rl-border)', borderRadius: 'var(--rl-radius-md)', background: 'var(--rl-bg)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '600 13px/1.2 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: t.valorizable ? 'var(--rl-success-500)' : 'var(--rl-gray-500)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                </span>
                <WasteInput
                  label="Valorizado"
                  color="var(--rl-success-700)"
                  value={draft.waste[t.id]?.val ?? ''}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      waste: { ...d.waste, [t.id]: { val: v, noVal: d.waste[t.id]?.noVal ?? '' } },
                    }))
                  }
                />
                <WasteInput
                  label="No valorizado"
                  color="var(--rl-gray-600)"
                  value={draft.waste[t.id]?.noVal ?? ''}
                  onChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      waste: { ...d.waste, [t.id]: { val: d.waste[t.id]?.val ?? '', noVal: v } },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={onSave}>{acked && warn ? 'Guardar de todos modos' : 'Guardar mes'}</Button>
      </div>
    </div>
  )
}

/** Input de m³ con etiqueta de valorización (la define el tratamiento del retiro). */
function WasteInput({
  label, color, value, onChange,
}: {
  label: string
  color: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ font: '600 10.5px/1 var(--rl-font-body)', color }}>{label}</span>
      <span style={{ position: 'relative', display: 'block' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          style={{ ...inputStyle, paddingRight: 34, textAlign: 'right' }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', font: '400 12px/1 var(--rl-font-body)', color: 'var(--rl-fg-subtle)', pointerEvents: 'none' }}>m³</span>
      </span>
    </label>
  )
}

const sectionLabel: React.CSSProperties = {
  font: '600 11.5px/1 var(--rl-font-body)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--rl-fg-subtle)',
}

function segPill(on: boolean): React.CSSProperties {
  return {
    all: 'unset',
    cursor: 'pointer',
    padding: '7px 14px',
    borderRadius: 999,
    font: '600 13px/1 var(--rl-font-body)',
    background: on ? 'var(--rl-bg)' : 'transparent',
    color: on ? 'var(--rl-primary-900)' : 'var(--rl-fg-subtle)',
    boxShadow: on ? 'var(--rl-shadow-sm)' : 'none',
  }
}

/* ---------------- Hitos ---------------- */

function Hitos({ project }: { project: Project }) {
  const { events, createEvent, updateEvent, deleteEvent } = useData()
  const toast = useToast()
  const [nombre, setNombre] = useState('')
  const [mes, setMes] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editMes, setEditMes] = useState('')

  function startEdit(id: string, name: string, month: string) {
    setEditId(id); setEditNombre(name); setEditMes(month)
  }
  function saveEdit() {
    const h = hitos.find((x) => x.id === editId)
    if (!h || !editNombre.trim() || !editMes) return
    void updateEvent({ ...h, name: editNombre.trim(), month: editMes })
    setEditId(null); toast('Hito actualizado')
  }

  const hitos = useMemo(
    () => events.filter((e) => e.project_id === project.id).sort((a, b) => compareMonth(a.month, b.month)),
    [events, project.id],
  )

  function add() {
    if (!nombre.trim() || !mes) return
    void createEvent({ project_id: project.id, name: nombre.trim(), month: mes })
    setNombre(''); setMes(''); toast('Hito agregado')
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Card style={{ flex: '1 1 440px', minWidth: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>Hitos del proyecto</h2>
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid var(--rl-primary-100)', paddingLeft: 18 }}>
            {hitos.length === 0 && (
              <span style={{ font: '400 14px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)', padding: '10px 0' }}>
                Aún no marcas hitos. Aparecen como líneas verticales en el gráfico.
              </span>
            )}
            {hitos.map((h) => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', position: 'relative', flexWrap: 'wrap' }}>
                <span style={{ position: 'absolute', left: -25, width: 11, height: 11, borderRadius: 999, background: 'var(--rl-primary-900)', border: '2px solid var(--rl-bg)' }} />
                {editId === h.id ? (
                  <>
                    <input
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      style={{ ...inputStyle, width: 150, padding: '7px 10px' }}
                      autoFocus
                    />
                    <MonthPicker value={editMes} onChange={setEditMes} />
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                      <Button size="sm" variant="secondary" onClick={() => setEditId(null)}>Cancelar</Button>
                      <Button size="sm" variant="primary" onClick={saveEdit} disabled={!editNombre.trim() || !editMes}>Guardar</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ font: '700 14.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg)' }}>{h.name}</span>
                    <span style={{ font: '400 13px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>{formatMonthHuman(h.month)}</span>
                    <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                      <button type="button" onClick={() => startEdit(h.id, h.name, h.month)} title="Editar hito" style={iconBtn('var(--rl-gray-500)')}><IconPen size={15} /></button>
                      <button type="button" onClick={() => { void deleteEvent(h.id); toast('Hito eliminado') }} title="Eliminar hito" style={iconBtn('var(--rl-gray-400)')}><IconClose size={15} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--rl-border)', flexWrap: 'wrap' }}>
            <Input wrapStyle={{ flex: 1, minWidth: 160 }} label="Nuevo hito" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Obra gruesa" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={labelStyle}>Mes</span>
              <MonthPicker value={mes} onChange={setMes} />
            </div>
            <Button variant="primary" onClick={add} disabled={!nombre.trim() || !mes}>Agregar</Button>
          </div>
        </div>
      </Card>
      <InfoCard title="Por qué registrar hitos">
        Los peaks de residuo casi siempre tienen una explicación de obra: excavación, fundaciones, desarme de moldajes. Con los hitos marcados en el gráfico puedes justificar cada alza frente a tu cliente o auditoría.
      </InfoCard>
    </div>
  )
}

/* ---------------- Tipos ---------------- */

function Tipos() {
  const { wasteTypes, createWasteType, updateWasteType, deleteWasteType, seedWasteTypes } = useData()
  const toast = useToast()
  const [ntName, setNtName] = useState('')
  const [ntVal, setNtVal] = useState(true)

  function add() {
    if (!ntName.trim()) return
    void createWasteType({ name: ntName.trim(), valorizable: ntVal })
    setNtName(''); setNtVal(true); toast('Tipo agregado')
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Card style={{ flex: '1 1 560px', minWidth: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>Tipos de residuo</h2>
            <span style={{ font: '400 13.5px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
              Define los residuos que separas en obra. La marca valorizable es sólo el valor por
              defecto de la captura manual: en la carga de trazabilidad la valorización la define el
              tratamiento de cada retiro.
            </span>
          </div>

          {wasteTypes.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 10, background: 'var(--rl-gray-50)', alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--rl-fg-muted)' }}>No hay tipos aún. Puedes partir con una lista sugerida.</span>
              <Button variant="secondary" size="sm" onClick={() => { void seedWasteTypes(); toast('Tipos sugeridos agregados') }}>Usar lista sugerida</Button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wasteTypes.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', border: '1px solid var(--rl-border)', borderRadius: 10, background: 'var(--rl-bg)' }}>
                <input
                  value={t.name}
                  onChange={(e) => updateWasteType({ ...t, name: e.target.value })}
                  style={{ flex: 1, minWidth: 0, border: '1px solid transparent', borderRadius: 6, padding: '5px 7px', marginLeft: -7, font: '600 14.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg)', background: 'transparent' }}
                />
                <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <button type="button" onClick={() => updateWasteType({ ...t, valorizable: true })} style={classPill(t.valorizable)}>Valorizable</button>
                  <button type="button" onClick={() => updateWasteType({ ...t, valorizable: false })} style={classPill(!t.valorizable)}>No valorizable</button>
                </div>
                <button type="button" onClick={() => { if (window.confirm(`¿Eliminar el tipo “${t.name}”? Se descuentan sus m³ de los meses ya cargados.`)) { void deleteWasteType(t.id); toast('Tipo eliminado') } }} title="Eliminar tipo" style={{ ...iconBtn('var(--rl-gray-400)'), flex: 'none' }}><IconTrash size={16} /></button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--rl-border)', flexWrap: 'wrap' }}>
            <Input wrapStyle={{ flex: 1, minWidth: 200 }} label="Nuevo tipo de residuo" value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="Ej: Áridos, poliestireno, chatarra" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={labelStyle}>Clasificación</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setNtVal(true)} style={classPill(ntVal)}>Valorizable</button>
                <button type="button" onClick={() => setNtVal(false)} style={classPill(!ntVal)}>No valorizable</button>
              </div>
            </div>
            <Button variant="primary" onClick={add} disabled={!ntName.trim()}>Agregar tipo</Button>
          </div>
        </div>
      </Card>
      <InfoCard title="Valorizado y no valorizado">
        Valorizado es todo lo que sale de la obra para reciclaje o reutilización; no valorizado es lo que termina en relleno sanitario. Esa clasificación define las dos líneas del gráfico y en cada mes se guarda por separado, porque un mismo residuo puede irse a distintos tratamientos. Los tipos son comunes a todas tus sucursales.
      </InfoCard>
    </div>
  )
}

/* ---------------- Config ---------------- */

function Config({ project }: { project: Project }) {
  const { updateProject } = useData()
  const toast = useToast()
  const [nombre, setNombre] = useState(project.branch_name)
  const [m2, setM2] = useState(String(project.total_m2))
  const [meta, setMeta] = useState(String(project.max_fgr_target))
  const [err, setErr] = useState<string | null>(null)

  function save() {
    const total = parseDecimal(m2)
    const target = parseDecimal(meta)
    if (!nombre.trim()) return setErr('El nombre es obligatorio.')
    if (!Number.isFinite(total) || total <= 0) return setErr('Los m² totales deben ser mayores a 0.')
    if (!Number.isFinite(target) || target <= 0) return setErr('La meta de FGR debe ser mayor a 0.')
    setErr(null)
    void updateProject({ ...project, branch_name: nombre.trim(), total_m2: total, max_fgr_target: target })
    toast('Configuración guardada')
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Card style={{ flex: '1 1 480px', minWidth: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>Configuración de la sucursal</h2>
          {err && <div style={alertErr}>{err}</div>}
          <Input label="Nombre del proyecto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <Input wrapStyle={{ flex: 1, minWidth: 160 }} label="m² totales a construir" value={m2} onChange={(e) => setM2(e.target.value)} inputMode="decimal" />
            <Input wrapStyle={{ flex: 1, minWidth: 160 }} label="Meta máxima de FGR (m³/m²)" value={meta} onChange={(e) => setMeta(e.target.value)} inputMode="decimal" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={save}>Guardar cambios</Button>
          </div>
        </div>
      </Card>
      <InfoCard title="Cambiar el total o la meta">
        Si editas los m² totales, el avance en % de todos los meses se recalcula sobre el nuevo total. La meta mueve la línea de referencia del gráfico.
      </InfoCard>
    </div>
  )
}

/* ---------------- shared bits ---------------- */

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12, padding: 20, borderRadius: 10, background: 'var(--rl-primary-50)' }}>
      <strong style={{ font: '700 14.5px/1.3 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>{title}</strong>
      <span style={{ font: '400 14px/1.6 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>{children}</span>
    </div>
  )
}

function classPill(on: boolean): React.CSSProperties {
  return {
    all: 'unset', cursor: 'pointer', padding: '7px 13px', borderRadius: 999,
    font: '600 12.5px/1 var(--rl-font-body)',
    background: on ? 'var(--rl-primary-50)' : 'var(--rl-bg)',
    color: on ? 'var(--rl-primary-900)' : 'var(--rl-fg-subtle)',
    border: `1px solid ${on ? 'var(--rl-primary-200)' : 'var(--rl-border-strong)'}`,
  }
}
function iconBtn(color: string): React.CSSProperties {
  return { all: 'unset', cursor: 'pointer', color, display: 'flex' }
}
const alertErr: React.CSSProperties = {
  borderRadius: 8, padding: '10px 14px', fontSize: 14,
  background: 'var(--rl-error-50)', color: 'var(--rl-error-700)', border: '1px solid var(--rl-error-200)',
}
const alertWarn: React.CSSProperties = {
  borderRadius: 8, padding: '10px 14px', fontSize: 14,
  background: 'var(--rl-warning-50)', color: 'var(--rl-warning-700)', border: '1px solid var(--rl-warning-300)',
}
