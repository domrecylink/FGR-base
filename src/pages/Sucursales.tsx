import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../store/DataContext'
import { projectSummary, fgrColorVar } from '../domain/summary'
import { formatFgr, formatNumber, parseDecimal } from '../utils/format'
import type { Project } from '../types'
import Card from '../components/ds/Card'
import Button from '../components/ds/Button'
import Input from '../components/ds/Input'
import StatusChip from '../components/ds/StatusChip'
import Modal from '../components/ds/Modal'
import { useToast } from '../components/ds/Toast'
import { IconTrash } from '../components/icons'

const GRID = '2.2fr 1fr 1.1fr 1.1fr 1fr 1.1fr 1.2fr'

export default function Sucursales() {
  const { projects, records, loading, setSelectedProjectId, createProject, deleteProject } =
    useData()
  const navigate = useNavigate()
  const toast = useToast()
  const [crear, setCrear] = useState(false)
  const [del, setDel] = useState<Project | null>(null)

  function open(id: string, to: string) {
    setSelectedProjectId(id)
    navigate(to)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="rl-eyebrow">Mis proyectos</span>
          <h1 style={{ font: '700 30px/1.2 var(--rl-font-body)', letterSpacing: '-0.02em' }}>Sucursales</h1>
        </div>
        <Button variant="primary" onClick={() => setCrear(true)}>
          Nueva sucursal
        </Button>
      </div>

      {loading && projects.length === 0 ? (
        <Card><div style={{ padding: 24, color: 'var(--rl-fg-muted)' }}>Cargando…</div></Card>
      ) : projects.length === 0 ? (
        <Card>
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <strong style={{ font: '700 17px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              Aún no tienes sucursales
            </strong>
            <span style={{ color: 'var(--rl-fg-muted)' }}>Crea tu primera sucursal para empezar a medir el FGR.</span>
            <Button variant="primary" size="sm" onClick={() => setCrear(true)}>Nueva sucursal</Button>
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <div className="table-scroll">
            <div style={{ minWidth: 1020 }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--rl-border)', background: 'var(--rl-gray-50)', font: '600 12.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
                <span>Sucursal</span><span>m² totales</span><span>Avance</span><span>FGR acumulado</span><span>Meta máxima</span><span>Estado</span><span />
              </div>
              {projects.map((p) => {
                const s = projectSummary(p, records.filter((r) => r.project_id === p.id))
                const avanceW = Math.max(0, Math.min(100, s.avancePct))
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '16px 24px', borderBottom: '1px solid var(--rl-border-subtle)', alignItems: 'center', font: '400 14px/1.35 var(--rl-font-body)', color: 'var(--rl-fg-body)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <button type="button" onClick={() => open(p.id, '/dashboard')} style={{ all: 'unset', cursor: 'pointer', font: '700 15px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)', textAlign: 'left' }}>
                        {p.branch_name}
                      </button>
                      <span style={{ font: '400 12.5px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
                        {s.monthsCount} {s.monthsCount === 1 ? 'mes cargado' : 'meses cargados'}
                        {s.pendingCount > 0 && (
                          <span style={{ color: 'var(--rl-warning-700)' }}>
                            {' '}· {s.pendingCount} sin avance
                          </span>
                        )}
                      </span>
                    </div>
                    <span>{formatNumber(p.total_m2)}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span style={{ fontWeight: 600 }}>{formatNumber(s.avancePct, 0)}%</span>
                      <span style={{ height: 5, borderRadius: 999, background: 'var(--rl-gray-200)', overflow: 'hidden', display: 'block' }}>
                        <span style={{ display: 'block', height: '100%', borderRadius: 999, background: 'var(--rl-primary-900)', width: `${avanceW}%` }} />
                      </span>
                    </div>
                    <span style={{ fontWeight: 700, color: fgrColorVar(s.fgrAcum, p.max_fgr_target) }}>{formatFgr(s.fgrAcum)}</span>
                    <span>{formatFgr(p.max_fgr_target)}</span>
                    <span><StatusChip tone={s.estadoTone}>{s.estadoLabel}</StatusChip></span>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => open(p.id, '/dashboard')} style={linkBtn}>Ver</button>
                      <button type="button" onClick={() => open(p.id, '/ingreso')} style={linkBtn}>Configurar</button>
                      <button type="button" onClick={() => setDel(p)} title="Eliminar sucursal" style={{ all: 'unset', cursor: 'pointer', color: 'var(--rl-gray-400)', display: 'flex' }}>
                        <IconTrash size={17} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}
      <p style={{ font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
        Eliminar una sucursal borra también sus meses y hitos. Te pedimos confirmar el nombre antes de hacerlo.
      </p>

      {crear && (
        <CrearModal
          onClose={() => setCrear(false)}
          onCreate={async (data) => {
            await createProject(data)
            setCrear(false)
            toast('Sucursal creada')
            navigate('/ingreso')
          }}
        />
      )}
      {del && (
        <DeleteModal
          project={del}
          onClose={() => setDel(null)}
          onConfirm={async () => {
            await deleteProject(del.id)
            setDel(null)
            toast('Sucursal eliminada')
          }}
        />
      )}
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  font: '600 13px/1 var(--rl-font-body)',
  color: 'var(--rl-primary-900)',
}

function CrearModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Omit<Project, 'id'>) => void }) {
  const [nombre, setNombre] = useState('')
  const [m2, setM2] = useState('')
  const [meta, setMeta] = useState('')
  const [err, setErr] = useState<string | null>(null)

  function submit() {
    const total = parseDecimal(m2)
    const target = parseDecimal(meta)
    if (!nombre.trim()) return setErr('El nombre es obligatorio.')
    if (!Number.isFinite(total) || total <= 0) return setErr('Los m² totales deben ser mayores a 0.')
    if (!Number.isFinite(target) || target <= 0) return setErr('La meta de FGR debe ser mayor a 0.')
    onCreate({ branch_name: nombre.trim(), total_m2: total, max_fgr_target: target })
  }

  return (
    <Modal title="Nueva sucursal" subtitle="Con estos tres datos ya puedes empezar a medir." onClose={onClose}>
      {err && <div style={alertErr}>{err}</div>}
      <Input label="Nombre del proyecto" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Torre Apoquindo 4200" autoFocus />
      <div style={{ display: 'flex', gap: 14 }}>
        <Input wrapStyle={{ flex: 1 }} label="m² totales a construir" value={m2} onChange={(e) => setM2(e.target.value)} placeholder="8.900" inputMode="decimal" />
        <Input wrapStyle={{ flex: 1 }} label="Meta máxima de FGR (m³/m²)" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="0,070" inputMode="decimal" />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit}>Crear sucursal</Button>
      </div>
    </Modal>
  )
}

function DeleteModal({ project, onClose, onConfirm }: { project: Project; onClose: () => void; onConfirm: () => void }) {
  const [txt, setTxt] = useState('')
  const disabled = txt.trim() !== project.branch_name
  return (
    <Modal title="¿Eliminar esta sucursal?" onClose={onClose} maxWidth={500}>
      <span style={{ font: '400 14px/1.6 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>
        Se eliminará <strong>{project.branch_name}</strong> junto con todos sus meses e hitos. Esta acción no se puede deshacer.
      </span>
      <Input label="Escribe el nombre para confirmar" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={project.branch_name} autoFocus />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" disabled={disabled} onClick={onConfirm}>Eliminar definitivamente</Button>
      </div>
    </Modal>
  )
}

const alertErr: React.CSSProperties = {
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  background: 'var(--rl-error-50)',
  color: 'var(--rl-error-700)',
  border: '1px solid var(--rl-error-200)',
}
