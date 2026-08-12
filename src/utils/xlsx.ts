// Lector mínimo de .xlsx: descomprime con fflate y parsea el XML de la primera hoja.
// Sólo soporta lo que necesita el export de Trazabilidad: valores, shared strings e inline strings.
// No interpreta formatos: las fechas llegan como serial de Excel (ver excelSerialToMonth en dates.ts).

import { strFromU8, unzipSync } from 'fflate'

/** Fila de la hoja: { 'A': '312483', 'C': 'HC Viña del Mar', ... }. Celdas vacías ausentes. */
export type SheetRow = Record<string, string>

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (full, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : full
    }
    return ENTITIES[code] ?? full
  })
}

/** Concatena todos los <t> de un fragmento (soporta rich text con varios <r>). */
function textOf(xml: string): string {
  let out = ''
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1]
  return unescapeXml(out)
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const out: string[] = []
  for (const m of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) out.push(textOf(m[1]))
  return out
}

/** Ruta de la primera hoja según workbook.xml + sus rels. Cae a xl/worksheets/sheet1.xml. */
function firstSheetPath(files: Record<string, Uint8Array>): string {
  const wb = files['xl/workbook.xml']
  const rels = files['xl/_rels/workbook.xml.rels']
  if (wb && rels) {
    const rid = strFromU8(wb).match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
    if (rid) {
      const relsXml = strFromU8(rels)
      for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
        const tag = m[0]
        if (tag.includes(`Id="${rid}"`)) {
          const target = tag.match(/Target="([^"]+)"/)?.[1]
          if (target) {
            const path = target.replace(/^\/?(xl\/)?/, 'xl/')
            if (files[path]) return path
          }
        }
      }
    }
  }
  if (files['xl/worksheets/sheet1.xml']) return 'xl/worksheets/sheet1.xml'
  const any = Object.keys(files).find((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k))
  if (!any) throw new Error('El archivo no parece ser un Excel válido (no se encontró ninguna hoja).')
  return any
}

function cellsOf(rowXml: string, shared: string[]): SheetRow {
  const row: SheetRow = {}
  for (const m of rowXml.matchAll(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1]
    const inner = m[3] ?? ''
    const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1]
    if (!ref) continue
    const type = attrs.match(/\bt="([^"]+)"/)?.[1]
    let value: string
    if (type === 'inlineStr') {
      value = textOf(inner)
    } else {
      const raw = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1]
      if (raw === undefined) continue
      value = type === 's' ? (shared[Number(raw)] ?? '') : unescapeXml(raw)
    }
    if (value !== '') row[ref] = value
  }
  return row
}

/**
 * Filas de la primera hoja, en orden. La fila 1 (encabezados) viene incluida.
 * Las filas totalmente vacías se omiten.
 */
export function readFirstSheet(data: ArrayBuffer | Uint8Array): SheetRow[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('No se pudo leer el archivo. Debe ser un .xlsx (no .xls ni CSV).')
  }
  const shared = parseSharedStrings(files['xl/sharedStrings.xml'] && strFromU8(files['xl/sharedStrings.xml']))
  const sheetXml = strFromU8(files[firstSheetPath(files)])

  const rows: SheetRow[] = []
  for (const m of sheetXml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const inner = m[2]
    if (!inner) continue
    const row = cellsOf(inner, shared)
    if (Object.keys(row).length > 0) rows.push(row)
  }
  return rows
}
