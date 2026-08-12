import { IconCheck } from './icons'

export interface WasteFilterOption {
  id: string
  name: string
  /** m³ del tipo en todo el proyecto (para ordenar y mostrar el peso relativo) */
  m3: number
}

/**
 * Chips para elegir qué tipos de residuo entran al FGR. `selected` siempre lista explícita:
 * vacía = ninguno (el gráfico queda en 0), todos = sin filtro.
 */
export default function WasteFilter({
  options,
  selected,
  onChange,
}: {
  options: WasteFilterOption[]
  selected: ReadonlySet<string>
  onChange: (next: Set<string>) => void
}) {
  if (options.length === 0) return null

  const allOn = options.every((o) => selected.has(o.id))

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ font: '600 13px/1.2 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
        Residuos considerados
      </span>

      <button
        type="button"
        onClick={() => onChange(new Set(allOn ? [] : options.map((o) => o.id)))}
        style={{
          all: 'unset',
          cursor: 'pointer',
          padding: '5px 12px',
          borderRadius: 'var(--rl-radius-pill)',
          font: '600 12.5px/1 var(--rl-font-body)',
          color: 'var(--rl-primary-900)',
          background: 'var(--rl-primary-50)',
        }}
      >
        {allOn ? 'Ninguno' : 'Todos'}
      </button>

      {options.map((o) => {
        const on = selected.has(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => toggle(o.id)}
            aria-pressed={on}
            title={`${o.name} · ${o.m3.toLocaleString('es-CL', { maximumFractionDigits: 1 })} m³ en el proyecto`}
            style={{
              all: 'unset',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 'var(--rl-radius-pill)',
              font: '600 12.5px/1 var(--rl-font-body)',
              border: `1px solid ${on ? 'var(--rl-primary-300)' : 'var(--rl-gray-200)'}`,
              background: on ? 'var(--rl-primary-50)' : 'transparent',
              color: on ? 'var(--rl-primary-900)' : 'var(--rl-fg-subtle)',
            }}
          >
            {on && (
              <span style={{ display: 'flex', flex: 'none' }}>
                <IconCheck />
              </span>
            )}
            {o.name}
          </button>
        )
      })}
    </div>
  )
}
