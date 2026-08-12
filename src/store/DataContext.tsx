import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchAll, writeOp } from '../api/gas'
import { computeAccumulatedM2 } from '../domain/fgr'
import type { EventRow, Project, RecordRow, WasteSplit, WasteType } from '../types'
import { newId } from '../utils/id'

/** co2_avoided_ton es opcional: sólo lo trae la carga de trazabilidad. */
type NewRecord = Omit<RecordRow, 'id' | 'accumulated_m2' | 'co2_avoided_ton'> & {
  co2_avoided_ton?: number
}
type EditRecord = Omit<RecordRow, 'accumulated_m2' | 'co2_avoided_ton'> & {
  co2_avoided_ton?: number
}

/** Un mes agregado desde el export de trazabilidad (sin avance: queda pendiente). */
export interface TrazaImportItem {
  month: string
  waste: Record<string, WasteSplit>
  co2_avoided_ton: number
}

interface DataState {
  projects: Project[]
  records: RecordRow[]
  events: EventRow[]
  wasteTypes: WasteType[]
  loading: boolean
  error: string | null
  selectedProjectId: string | null
  setSelectedProjectId: (id: string) => void
  reload: () => Promise<void>
  clearError: () => void

  createProject: (input: Omit<Project, 'id'>) => Promise<string>
  updateProject: (project: Project) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  createRecord: (input: NewRecord) => Promise<void>
  createRecordsBulk: (inputs: NewRecord[]) => Promise<void>
  /** Crea los meses nuevos y actualiza los existentes conservando su avance. */
  importTrazabilidad: (
    projectId: string,
    items: TrazaImportItem[],
  ) => Promise<{ created: number; updated: number }>
  updateRecord: (record: EditRecord) => Promise<void>
  deleteRecord: (id: string) => Promise<void>

  createEvent: (input: Omit<EventRow, 'id'>) => Promise<void>
  updateEvent: (event: EventRow) => Promise<void>
  deleteEvent: (id: string) => Promise<void>

  createWasteType: (input: Omit<WasteType, 'id'>) => Promise<void>
  /** Crea varios tipos de una vez y devuelve los creados (con id) para usarlos al importar. */
  createWasteTypesBulk: (inputs: Omit<WasteType, 'id'>[]) => Promise<WasteType[]>
  updateWasteType: (t: WasteType) => Promise<void>
  deleteWasteType: (id: string) => Promise<void>
  seedWasteTypes: () => Promise<void>
}

const Ctx = createContext<DataState | null>(null)

const SEED_TIPOS: Omit<WasteType, 'id'>[] = [
  { name: 'Escombro / hormigón', valorizable: false },
  { name: 'Madera', valorizable: true },
  { name: 'Metal', valorizable: true },
  { name: 'Cartón', valorizable: true },
  { name: 'Plástico', valorizable: true },
  { name: 'Yeso / volcanita', valorizable: false },
]

export function DataProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [records, setRecords] = useState<RecordRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  const projectsRef = useRef<Project[]>([])
  projectsRef.current = projects

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAll()
      setProjects(data.projects)
      setRecords(data.records)
      setEvents(data.events)
      setWasteTypes(data.wasteTypes)
      setSelectedProjectId((prev) =>
        prev && data.projects.some((p) => p.id === prev) ? prev : (data.projects[0]?.id ?? null),
      )
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const optimistic = useCallback(
    async (apply: () => void, write: () => Promise<void>) => {
      apply()
      try {
        await write()
      } catch (e) {
        setError(errMsg(e))
        await reload()
      }
    },
    [reload],
  )

  const accFor = useCallback(
    (projectId: string, mode: RecordRow['progress_mode'], value: number | null) => {
      const p = projectsRef.current.find((x) => x.id === projectId)
      return computeAccumulatedM2(mode, value, p?.total_m2 ?? 0)
    },
    [],
  )

  const buildRecord = useCallback(
    (input: NewRecord, id?: string): RecordRow => ({
      ...input,
      id: id ?? newId(),
      co2_avoided_ton: input.co2_avoided_ton ?? 0,
      accumulated_m2: accFor(input.project_id, input.progress_mode, input.progress_value),
    }),
    [accFor],
  )

  // ---- Projects ----
  const createProject: DataState['createProject'] = (input) => {
    const project: Project = { ...input, id: newId() }
    setSelectedProjectId(project.id)
    return optimistic(
      () => setProjects((prev) => [...prev, project]),
      () => writeOp('project', 'create', project),
    ).then(() => project.id)
  }
  const updateProject: DataState['updateProject'] = (project) =>
    optimistic(
      () => setProjects((prev) => prev.map((p) => (p.id === project.id ? project : p))),
      () => writeOp('project', 'update', project),
    )
  const deleteProject: DataState['deleteProject'] = (id) =>
    optimistic(
      () => {
        setProjects((prev) => prev.filter((p) => p.id !== id))
        setRecords((prev) => prev.filter((r) => r.project_id !== id))
        setEvents((prev) => prev.filter((e) => e.project_id !== id))
      },
      () => writeOp('project', 'delete', { id }),
    )

  // ---- Records ----
  const createRecord: DataState['createRecord'] = (input) => {
    const record = buildRecord(input)
    return optimistic(
      () => setRecords((prev) => [...prev, record]),
      () => writeOp('record', 'create', record),
    )
  }
  const createRecordsBulk: DataState['createRecordsBulk'] = async (inputs) => {
    const built = inputs.map((i) => buildRecord(i))
    setRecords((prev) => [...prev, ...built])
    try {
      for (const r of built) await writeOp('record', 'create', r)
    } catch (e) {
      setError(errMsg(e))
      await reload()
    }
  }
  const importTrazabilidad: DataState['importTrazabilidad'] = async (projectId, items) => {
    const existing = new Map(
      records.filter((r) => r.project_id === projectId).map((r) => [r.month, r]),
    )
    const toCreate: RecordRow[] = []
    const toUpdate: RecordRow[] = []
    for (const item of items) {
      const prev = existing.get(item.month)
      if (prev) {
        // El avance ya capturado no se toca: sólo se reemplazan residuos y CO2.
        toUpdate.push({ ...prev, waste: item.waste, co2_avoided_ton: item.co2_avoided_ton })
      } else {
        toCreate.push(
          buildRecord({
            project_id: projectId,
            month: item.month,
            progress_mode: 'percentage',
            progress_value: null, // avance pendiente: la planilla de trazabilidad no lo trae
            waste: item.waste,
            co2_avoided_ton: item.co2_avoided_ton,
          }),
        )
      }
    }

    const updById = new Map(toUpdate.map((r) => [r.id, r]))
    setRecords((prev) => [...prev.map((r) => updById.get(r.id) ?? r), ...toCreate])
    try {
      for (const r of toCreate) await writeOp('record', 'create', r)
      for (const r of toUpdate) await writeOp('record', 'update', r)
    } catch (e) {
      setError(errMsg(e))
      await reload()
    }
    return { created: toCreate.length, updated: toUpdate.length }
  }
  const updateRecord: DataState['updateRecord'] = (input) => {
    const record = buildRecord(input, input.id)
    return optimistic(
      () => setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r))),
      () => writeOp('record', 'update', record),
    )
  }
  const deleteRecord: DataState['deleteRecord'] = (id) =>
    optimistic(
      () => setRecords((prev) => prev.filter((r) => r.id !== id)),
      () => writeOp('record', 'delete', { id }),
    )

  // ---- Events (hitos) ----
  const createEvent: DataState['createEvent'] = (input) => {
    const event: EventRow = { ...input, id: newId() }
    return optimistic(
      () => setEvents((prev) => [...prev, event]),
      () => writeOp('event', 'create', event),
    )
  }
  const updateEvent: DataState['updateEvent'] = (event) =>
    optimistic(
      () => setEvents((prev) => prev.map((e) => (e.id === event.id ? event : e))),
      () => writeOp('event', 'update', event),
    )
  const deleteEvent: DataState['deleteEvent'] = (id) =>
    optimistic(
      () => setEvents((prev) => prev.filter((e) => e.id !== id)),
      () => writeOp('event', 'delete', { id }),
    )

  // ---- Waste types ----
  const createWasteType: DataState['createWasteType'] = (input) => {
    const t: WasteType = { ...input, id: newId() }
    return optimistic(
      () => setWasteTypes((prev) => [...prev, t]),
      () => writeOp('wasteType', 'create', t),
    )
  }
  const createWasteTypesBulk: DataState['createWasteTypesBulk'] = async (inputs) => {
    const built: WasteType[] = inputs.map((t) => ({ ...t, id: newId() }))
    setWasteTypes((prev) => [...prev, ...built])
    try {
      for (const t of built) await writeOp('wasteType', 'create', t)
    } catch (e) {
      setError(errMsg(e))
      await reload()
    }
    return built
  }
  const updateWasteType: DataState['updateWasteType'] = (t) =>
    optimistic(
      () => setWasteTypes((prev) => prev.map((x) => (x.id === t.id ? t : x))),
      () => writeOp('wasteType', 'update', t),
    )
  const deleteWasteType: DataState['deleteWasteType'] = (id) =>
    optimistic(
      () => setWasteTypes((prev) => prev.filter((x) => x.id !== id)),
      () => writeOp('wasteType', 'delete', { id }),
    )
  const seedWasteTypes: DataState['seedWasteTypes'] = async () => {
    const built = SEED_TIPOS.map((t) => ({ ...t, id: newId() }))
    setWasteTypes((prev) => [...prev, ...built])
    try {
      for (const t of built) await writeOp('wasteType', 'create', t)
    } catch (e) {
      setError(errMsg(e))
      await reload()
    }
  }

  const value = useMemo<DataState>(
    () => ({
      projects,
      records,
      events,
      wasteTypes,
      loading,
      error,
      selectedProjectId,
      setSelectedProjectId,
      reload,
      clearError: () => setError(null),
      createProject,
      updateProject,
      deleteProject,
      createRecord,
      createRecordsBulk,
      importTrazabilidad,
      updateRecord,
      deleteRecord,
      createEvent,
      updateEvent,
      deleteEvent,
      createWasteType,
      createWasteTypesBulk,
      updateWasteType,
      deleteWasteType,
      seedWasteTypes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, records, events, wasteTypes, loading, error, selectedProjectId, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>')
  return ctx
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
