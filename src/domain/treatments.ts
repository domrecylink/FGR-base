// Mapa tratamiento -> ¿el residuo se considera VALORIZADO?
//
// El export de trazabilidad trae el tratamiento en la columna "Tipo de Tratamiento" (AB). La
// valorización la define el tratamiento, no el residuo: la misma madera puede ir a Compostaje
// (valorizado) o a Relleno sanitario (no valorizado).
//
// PENDIENTE: lista provisional a la espera del listado oficial. Los tratamientos que no estén acá
// se importan como NO valorizados y la vista previa los muestra para completar este mapa.

import { normalizeText } from '../utils/text'

const RAW: Record<string, boolean> = {
  // Valorizados
  Compostaje: true,
  Reciclaje: true,
  'Reciclaje mecánico': true,
  Reutilización: true,
  Coprocesamiento: true,
  'Valorización energética': true,
  'Recuperación energética': true,
  Biodigestión: true,
  Lombricultura: true,

  // No valorizados
  'Relleno sanitario': false,
  'Relleno de seguridad': false,
  'Disposición final': false,
  Incineración: false,
  'Tratamiento físico-químico': false,
}

const MAP = new Map(Object.entries(RAW).map(([k, v]) => [normalizeText(k), v]))

/** true = valorizado, false = no valorizado, null = tratamiento desconocido (aún sin clasificar). */
export function isValorizado(tratamiento: string): boolean | null {
  const key = normalizeText(tratamiento)
  if (key === '') return null
  return MAP.get(key) ?? null
}

/** Nombres tal como se escriben en el mapa (para la UI de ayuda). */
export function knownTreatments(): string[] {
  return Object.keys(RAW)
}
