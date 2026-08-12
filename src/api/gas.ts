import type { EventRow, Project, RecordRow, WasteSplit, WasteType } from '../types'

const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined

export type Entity = 'project' | 'record' | 'event' | 'wasteType'
export type WriteAction = 'create' | 'update' | 'delete'

export interface AllData {
  projects: Project[]
  records: RecordRow[]
  events: EventRow[]
  wasteTypes: WasteType[]
}

function ensureUrl(): string {
  if (!GAS_URL) {
    throw new Error(
      'Falta VITE_GAS_URL. Copia .env.example a .env y pega la URL del Web App de Apps Script.',
    )
  }
  return GAS_URL
}

/** Lee todo de una vez (Q14). */
export async function fetchAll(): Promise<AllData> {
  const res = await fetch(ensureUrl(), { method: 'GET' })
  if (!res.ok) throw new Error(`Error al leer datos (HTTP ${res.status})`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  // Los tipos van primero: hacen falta para migrar el waste_json antiguo (número suelto por tipo).
  const wasteTypes: WasteType[] = (json.wasteTypes ?? []).map(normalizeWasteType)
  return {
    projects: (json.projects ?? []).map(normalizeProject),
    records: (json.records ?? []).map((r: Record<string, unknown>) => normalizeRecord(r, wasteTypes)),
    events: (json.events ?? []).map(normalizeEvent),
    wasteTypes,
  }
}

/** Escritura: POST text/plain para evitar el preflight CORS (Q10). */
export async function writeOp(entity: Entity, action: WriteAction, data: unknown): Promise<void> {
  const res = await fetch(ensureUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ entity, action, data }),
  })
  if (!res.ok) throw new Error(`Error al guardar (HTTP ${res.status})`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Error desconocido al guardar')
}

function normalizeProject(p: Record<string, unknown>): Project {
  return {
    id: String(p.id),
    branch_name: String(p.branch_name ?? ''),
    total_m2: Number(p.total_m2) || 0,
    max_fgr_target: Number(p.max_fgr_target) || 0,
  }
}

/** Celda vacía en la hoja = dato ausente (avance pendiente), no cero. */
function optionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * waste_json actual: { [typeId]: { val, noVal } }.
 * Formato antiguo: { [typeId]: m3 } -> se reparte con el flag valorizable del tipo.
 */
function normalizeWaste(
  raw: unknown,
  wasteTypes: WasteType[],
): Record<string, WasteSplit> {
  const out: Record<string, WasteSplit> = {}
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return out
    }
  }
  if (!parsed || typeof parsed !== 'object') return out

  const valSet = new Set(wasteTypes.filter((t) => t.valorizable).map((t) => t.id))
  for (const [typeId, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v && typeof v === 'object') {
      const split = v as Record<string, unknown>
      out[typeId] = { val: Number(split.val) || 0, noVal: Number(split.noVal) || 0 }
    } else {
      const m3 = Number(v) || 0
      out[typeId] = valSet.has(typeId) ? { val: m3, noVal: 0 } : { val: 0, noVal: m3 }
    }
  }
  return out
}

function normalizeRecord(r: Record<string, unknown>, wasteTypes: WasteType[]): RecordRow {
  const mode = r.progress_mode === 'm2' ? 'm2' : 'percentage'
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    month: String(r.month),
    progress_mode: mode,
    progress_value: optionalNumber(r.progress_value),
    accumulated_m2: optionalNumber(r.accumulated_m2),
    waste: normalizeWaste(r.waste_json, wasteTypes),
    co2_avoided_ton: Number(r.co2_avoided_ton) || 0,
  }
}

function normalizeEvent(e: Record<string, unknown>): EventRow {
  return {
    id: String(e.id),
    project_id: String(e.project_id),
    name: String(e.name ?? ''),
    month: String(e.month ?? ''),
  }
}

function normalizeWasteType(t: Record<string, unknown>): WasteType {
  const v = t.valorizable
  const valorizable = v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1'
  return {
    id: String(t.id),
    name: String(t.name ?? ''),
    valorizable,
  }
}
