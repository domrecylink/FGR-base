// IDs generados en el frontend (necesario para UI optimista: la fila entra al estado
// antes de que responda el Web App). GAS solo los almacena.

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback muy improbable (navegadores viejos / contextos no seguros)
  return 'id-' + Math.abs(hashString(String(performance.now()))).toString(36)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return h
}
