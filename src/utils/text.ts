/** Clave comparable: minúsculas, sin acentos, sin espacios repetidos. Para cruzar nombres de planillas. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
