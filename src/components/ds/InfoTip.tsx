import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const POP_W = 330

export interface InfoTipContent {
  /** Encabezado del popover (normalmente el nombre de la métrica). */
  title: string
  /** Fórmula en monoespaciado. Una línea por elemento. */
  formula?: string[]
  /** Detalles: qué entra, qué queda fuera, casos borde. */
  lines: string[]
}

/**
 * Botón "i" con popover explicativo. Va en portal con `position: fixed` porque las Card
 * tienen `overflow: hidden` y recortarían un popover absoluto (mismo motivo que MonthPicker).
 *
 * Hover/foco lo muestra; el click lo fija (necesario en táctil, donde no hay hover, y para
 * poder seleccionar el texto). Esc o click afuera lo cierra.
 */
export default function InfoTip({ title, formula, lines }: InfoTipContent) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  /** El popover se mide después del primer render; hasta entonces va oculto para no parpadear. */
  const [ready, setReady] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const popId = useId()

  const reposition = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const h = popRef.current?.offsetHeight ?? 200
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < h + 12 && r.top > h + 12
    const top = openUp ? r.top - h - 8 : r.bottom + 8
    let left = r.left + r.width / 2 - POP_W / 2
    left = Math.min(left, window.innerWidth - POP_W - 8)
    left = Math.max(8, left)
    setCoords({ left, top })
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    setPinned(false)
    setReady(false)
  }, [])

  useEffect(() => {
    if (!open) return
    reposition()
    setReady(true)
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition, close])

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Cómo se calcula: ${title}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popId : undefined}
        onClick={() => {
          if (pinned) close()
          else {
            setPinned(true)
            setOpen(true)
          }
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !pinned && close()}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && close()}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: 'help',
          flex: 'none',
          width: 16,
          height: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          border: `1px solid ${open ? 'var(--rl-primary-900)' : 'var(--rl-border-strong)'}`,
          background: open ? 'var(--rl-primary-900)' : 'transparent',
          color: open ? 'var(--rl-fg-on-brand)' : 'var(--rl-fg-subtle)',
          font: '700 10px/1 var(--rl-font-body)',
        }}
      >
        i
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label={`Cómo se calcula: ${title}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => !pinned && close()}
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              visibility: ready ? 'visible' : 'hidden',
              zIndex: 30,
              width: POP_W,
              maxWidth: 'calc(100vw - 16px)',
              background: 'var(--rl-bg)',
              border: '1px solid var(--rl-border)',
              borderRadius: 'var(--rl-radius-lg)',
              boxShadow: 'var(--rl-shadow-xl)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <strong style={{ font: '700 14px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              {title}
            </strong>

            {formula && formula.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  padding: '10px 12px',
                  borderRadius: 'var(--rl-radius-md)',
                  background: 'var(--rl-bg-subtle)',
                  border: '1px solid var(--rl-border-subtle)',
                  font: '400 12px/1.45 var(--rl-font-mono)',
                  color: 'var(--rl-fg-body)',
                  overflowX: 'auto',
                }}
              >
                {formula.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            )}

            <ul
              style={{
                margin: 0,
                paddingLeft: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                font: '400 12.5px/1.5 var(--rl-font-body)',
                color: 'var(--rl-fg-body)',
              }}
            >
              {lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
