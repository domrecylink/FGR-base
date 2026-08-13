import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useData } from '../store/DataContext'
import { buildSeries } from '../domain/fgr'
import { fgrColorVar, fgrTone } from '../domain/summary'
import type { FgrMode } from '../types'
import { formatFgr, formatNumber, formatPct } from '../utils/format'
import Card from '../components/ds/Card'
import Button from '../components/ds/Button'
import InfoTip, { type InfoTipContent } from '../components/ds/InfoTip'
import ProjectSelect from '../components/ProjectSelect'
import NoProjects from '../components/NoProjects'
import FgrChart, { ChartLegend } from '../components/FgrChart'
import RateChart from '../components/RateChart'
import WasteFilter, { type WasteFilterOption } from '../components/WasteFilter'
import { IconAlert } from '../components/icons'
import {
  evolucionHelp,
  fgrGlobalHelp,
  fgrNoValorizadoHelp,
  fgrValorizadoHelp,
  modeWord,
  pctValorizacionHelp,
  valorizacionPorM2Help,
  wasteTotalHelp,
} from './dashboardHelp'

export default function Dashboard() {
  const { projects, records, events, wasteTypes, selectedProjectId } = useData()
  const router = useRouter()
  const [mode, setMode] = useState<FgrMode>('cumulative')
  /**
   * Guardamos los tipos EXCLUIDOS, no los incluidos: así un tipo que aparezca después
   * (nueva carga masiva) entra al cálculo por defecto en vez de quedar fuera en silencio.
   */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())

  const project = projects.find((p) => p.id === selectedProjectId) ?? null
  const projRecords = useMemo(
    () => records.filter((r) => r.project_id === project?.id),
    [records, project?.id],
  )
  const projEvents = useMemo(
    () => events.filter((e) => e.project_id === project?.id),
    [events, project?.id],
  )

  // Tipos con m³ en esta sucursal, de mayor a menor volumen.
  const wasteOptions = useMemo<WasteFilterOption[]>(() => {
    const totals = new Map<string, number>()
    for (const r of projRecords) {
      for (const [typeId, split] of Object.entries(r.waste)) {
        const m3 = (Number(split?.val) || 0) + (Number(split?.noVal) || 0)
        totals.set(typeId, (totals.get(typeId) ?? 0) + m3)
      }
    }
    return [...totals.entries()]
      .map(([id, m3]) => ({
        id,
        name: wasteTypes.find((t) => t.id === id)?.name ?? 'Tipo eliminado',
        m3,
      }))
      .sort((a, b) => b.m3 - a.m3 || a.name.localeCompare(b.name, 'es'))
  }, [projRecords, wasteTypes])

  const selectedIds = useMemo(
    () => new Set(wasteOptions.filter((o) => !excluded.has(o.id)).map((o) => o.id)),
    [wasteOptions, excluded],
  )
  const filtered = selectedIds.size !== wasteOptions.length

  // Cambiar de sucursal reinicia el filtro (los tipos y sus volúmenes son otros).
  useEffect(() => setExcluded(new Set()), [selectedProjectId])

  const series = useMemo(
    () => (project ? buildSeries(projRecords, project, mode, filtered ? selectedIds : null) : []),
    [projRecords, project, mode, filtered, selectedIds],
  )
  const pendingMonths = useMemo(
    () => projRecords.filter((r) => r.progress_value === null).length,
    [projRecords],
  )

  if (projects.length === 0) return <NoProjects />
  if (!project) return null

  const last = series.at(-1) ?? null
  const target = project.max_fgr_target
  const tone = fgrTone(last?.global ?? null, target)
  const hasData = series.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="rl-eyebrow">Dashboard FGR</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <ProjectSelect />
            <span style={{ font: '400 14px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
              {formatNumber(project.total_m2)} m² · meta {formatFgr(target)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'var(--rl-gray-100)' }}>
          {(['monthly', 'cumulative'] as FgrMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                padding: '8px 18px',
                borderRadius: 999,
                font: '600 13.5px/1 var(--rl-font-body)',
                background: mode === m ? 'var(--rl-bg)' : 'transparent',
                color: mode === m ? 'var(--rl-fg)' : 'var(--rl-fg-subtle)',
                boxShadow: mode === m ? 'var(--rl-shadow-sm)' : 'none',
              }}
            >
              {m === 'monthly' ? 'FGR mensual' : 'FGR acumulado'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <Card>
          <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <strong style={{ font: '700 18px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              Sin datos para graficar todavía
            </strong>
            <span style={{ font: '400 14px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-muted)', maxWidth: 400 }}>
              Carga al menos un mes de avance y residuos para ver la evolución del FGR de esta sucursal.
            </span>
            <Button variant="primary" size="sm" onClick={() => router.push('/ingreso')}>Ir al ingreso mensual</Button>
          </div>
        </Card>
      ) : (
        <>
          {pendingMonths > 0 && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 20px', borderRadius: 10, border: '1px solid var(--rl-warning-300)', background: 'var(--rl-warning-50)' }}>
              <span style={{ color: 'var(--rl-warning-700)', display: 'flex', flex: 'none', paddingTop: 1 }}>
                <IconAlert />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <strong style={{ font: '700 15px/1.35 var(--rl-font-body)', color: 'var(--rl-warning-700)' }}>
                  {pendingMonths === 1 ? 'Hay 1 mes sin avance de obra' : `Hay ${pendingMonths} meses sin avance de obra`}
                </strong>
                <span style={{ font: '400 14px/1.55 var(--rl-font-body)', color: 'var(--rl-fg-body)' }}>
                  Se cargaron los residuos desde la planilla de trazabilidad, pero falta el avance.
                  Sin avance no hay m² para dividir, así que esos meses no tienen FGR.
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => router.push('/ingreso')}>Completar avance</Button>
            </div>
          )}

          {/* La alerta de meta compara contra el FGR completo: con filtro activo no aplica. */}
          {!filtered && last?.global != null && tone !== 'success' && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 20px', borderRadius: 10, border: `1px solid ${tone === 'error' ? 'var(--rl-error-200)' : 'var(--rl-warning-300)'}`, background: tone === 'error' ? 'var(--rl-error-50)' : 'var(--rl-warning-50)' }}>
              <span style={{ color: tone === 'error' ? 'var(--rl-error-600)' : 'var(--rl-warning-700)', display: 'flex', flex: 'none', paddingTop: 1 }}>
                <IconAlert />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                <strong style={{ font: '700 15px/1.35 var(--rl-font-body)', color: tone === 'error' ? 'var(--rl-error-700)' : 'var(--rl-warning-700)' }}>
                  {tone === 'error' ? 'Estás sobre tu meta de FGR' : 'Te estás acercando a tu meta'}
                </strong>
                <span style={{ font: '400 14px/1.55 var(--rl-font-body)', color: 'var(--rl-fg-body)' }}>
                  FGR acumulado {formatFgr(last?.global ?? null)} m³/m² frente a una meta de {formatFgr(target)}. Revisa los meses con más generación de residuo.
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => router.push('/ingreso')}>Revisar los meses</Button>
            </div>
          )}

          <WasteFilter
            options={wasteOptions}
            selected={selectedIds}
            onChange={(next) =>
              setExcluded(new Set(wasteOptions.filter((o) => !next.has(o.id)).map((o) => o.id)))
            }
          />

          {selectedIds.size === 0 && wasteOptions.length > 0 && (
            <span style={{ font: '400 13.5px/1.4 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
              No hay ningún tipo de residuo seleccionado: el FGR queda en 0. Elige al menos uno.
            </span>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            <Kpi
              label={mode === 'monthly' ? 'FGR global del mes' : 'FGR global acumulado'}
              value={formatFgr(last?.global ?? null)}
              color={filtered ? 'var(--rl-fg)' : fgrColorVar(last?.global ?? null, target)}
              sub={filtered ? 'parcial · no comparable con la meta' : `meta ${formatFgr(target)} m³/m²`}
              info={fgrGlobalHelp(mode)}
            />
            <Kpi
              label={`FGR valorizado ${modeWord(mode)}`}
              value={formatFgr(last?.valorizado ?? null)}
              color="var(--rl-success-700)"
              sub="m³ recuperados por m² construido"
              info={fgrValorizadoHelp(mode)}
            />
            <Kpi
              label={`FGR no valorizado ${modeWord(mode)}`}
              value={formatFgr(last?.noValorizado ?? null)}
              color="var(--rl-gray-700)"
              sub="m³ a disposición final por m² construido"
              info={fgrNoValorizadoHelp(mode)}
            />
            <Kpi
              label="Residuo total retirado"
              value={`${formatNumber(last?.wasteTotal ?? 0, 1)} m³`}
              color="var(--rl-fg)"
              sub={mode === 'monthly' ? 'en el último mes con registro' : 'acumulado a la fecha'}
              info={wasteTotalHelp(mode)}
            />
          </div>

          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ font: '700 19px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
                      Evolución del FGR ({mode === 'monthly' ? 'mensual' : 'acumulado'})
                    </h2>
                    <InfoTip {...evolucionHelp(mode)} />
                  </div>
                  <span style={{ font: '400 13.5px/1.4 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
                    {mode === 'monthly'
                      ? 'Cada punto es el mes aislado: m³ retirados ese mes ÷ m² construidos ese mes.'
                      : 'Cada punto acumula desde el primer mes: todos los m³ ÷ todos los m² construidos a esa fecha.'}
                    {filtered &&
                      ` Sólo ${selectedIds.size} de ${wasteOptions.length} tipos de residuo.`}
                  </span>
                </div>
                <ChartLegend />
              </div>
              <FgrChart series={series} events={projEvents} project={project} showTarget={!filtered} />
            </div>
          </Card>

          {/* Valorización: mismo período y mismo filtro de residuos que el gráfico de arriba. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 16 }}>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ChartHead
                  title={`% de valorización ${modeWord(mode)}`}
                  value={formatPct(last?.pctValorizado ?? null)}
                  sub={`m³ valorizados sobre el total ${modeWord(mode)}. No depende de los m² construidos.`}
                  info={pctValorizacionHelp(mode)}
                />
                <RateChart
                  series={series}
                  events={projEvents}
                  dataKey="pctValorizado"
                  name="% valorización"
                  color="var(--rl-success-500)"
                  format={formatPct}
                  yMax={100}
                />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <ChartHead
                  title={`Valorización por m² (${mode === 'monthly' ? 'mensual' : 'acumulada'})`}
                  value={`${formatFgr(last?.valorizado ?? null)} m³/m²`}
                  sub={
                    mode === 'monthly'
                      ? 'm³ valorizados del mes ÷ m² construidos ese mes. Los meses con avance pendiente quedan como hueco.'
                      : 'm³ valorizados acumulados ÷ m² acumulados. Los meses con avance pendiente quedan como hueco.'
                  }
                  info={valorizacionPorM2Help(mode)}
                />
                <RateChart
                  series={series}
                  events={projEvents}
                  dataKey="valorizado"
                  name="m³ val/m²"
                  color="var(--rl-primary-900)"
                  format={formatFgr}
                />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function ChartHead({ title, value, sub, info }: { title: string; value: string; sub: string; info?: InfoTipContent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ font: '700 17px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>{title}</h3>
          {info && <InfoTip {...info} />}
        </div>
        <span style={{ font: '400 13px/1.45 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>{sub}</span>
      </div>
      <strong style={{ font: '700 26px/1.1 var(--rl-font-body)', color: 'var(--rl-fg)', whiteSpace: 'nowrap' }}>
        {value}
      </strong>
    </div>
  )
}

function Kpi({ label, value, color, sub, info }: { label: string; value: string; color: string; sub: string; info?: InfoTipContent }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: '400 14px/1.2 var(--rl-font-body)', color: '#727272' }}>
          {label}
          {info && <InfoTip {...info} />}
        </span>
        <strong style={{ font: '700 32px/1.1 var(--rl-font-body)', color }}>{value}</strong>
        <span style={{ font: '400 13px/1.3 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>{sub}</span>
      </div>
    </Card>
  )
}
