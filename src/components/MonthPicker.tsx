import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MONTHS_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const POP_W = 280
const POP_H = 240

interface Props {
  /** 'YYYY-MM' o '' */
  value: string
  onChange: (value: string) => void
}

interface Coords {
  left: number
  top: number
}

/** Selector de mes: botón + popover (en portal) con stepper de año y grilla de 12 meses. */
export default function MonthPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<Coords>({ left: 0, top: 0 })

  const [yStr, mStr] = value.split('-')
  const selYear = yStr ? Number(yStr) : null
  const selMonth = mStr ? Number(mStr) : null // 1-12
  const [viewYear, setViewYear] = useState<number>(selYear ?? new Date().getFullYear())

  const reposition = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < POP_H + 12 && r.top > POP_H + 12
    const top = openUp ? r.top - POP_H - 6 : r.bottom + 6
    let left = r.left
    left = Math.min(left, window.innerWidth - POP_W - 8)
    left = Math.max(8, left)
    setCoords({ left, top })
  }, [])

  useEffect(() => {
    if (!open) return
    setViewYear(selYear ?? new Date().getFullYear())
    reposition()
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
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
  }, [open, selYear, reposition])

  function pick(monthIdx: number) {
    const mm = String(monthIdx + 1).padStart(2, '0')
    onChange(`${viewYear}-${mm}`)
    setOpen(false)
  }

  const label = selYear && selMonth ? `${MONTHS_FULL[selMonth - 1]} ${selYear}` : 'Seleccionar mes'

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          all: 'unset',
          boxSizing: 'border-box',
          cursor: 'pointer',
          width: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 12px',
          border: `1px solid ${open ? 'var(--rl-primary-900)' : 'var(--rl-border-strong)'}`,
          borderRadius: 'var(--rl-radius-md)',
          background: 'var(--rl-bg)',
          font: '400 14px/1 var(--rl-font-body)',
          color: value ? 'var(--rl-fg)' : 'var(--rl-fg-subtle)',
          boxShadow: open ? 'var(--rl-shadow-focus)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon />
          {label}
        </span>
        <Chevron open={open} />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            style={{
              position: 'fixed',
              left: coords.left,
              top: coords.top,
              zIndex: 1000,
              width: POP_W,
              background: 'var(--rl-bg)',
              border: '1px solid var(--rl-border)',
              borderRadius: 'var(--rl-radius-lg)',
              boxShadow: 'var(--rl-shadow-xl)',
              padding: 14,
              animation: 'rlUp .14s cubic-bezier(.4,0,.2,1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <StepBtn label="Año anterior" onClick={() => setViewYear((y) => y - 1)}>
                <Chevron dir="left" />
              </StepBtn>
              <strong style={{ font: '700 16px/1 var(--rl-font-body)', color: 'var(--rl-fg)' }}>{viewYear}</strong>
              <StepBtn label="Año siguiente" onClick={() => setViewYear((y) => y + 1)}>
                <Chevron dir="right" />
              </StepBtn>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {MONTHS_ABBR.map((name, i) => {
                const isSel = selYear === viewYear && selMonth === i + 1
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => pick(i)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      textAlign: 'center',
                      padding: '9px 0',
                      borderRadius: 'var(--rl-radius-md)',
                      font: `${isSel ? 700 : 500} 13.5px/1 var(--rl-font-body)`,
                      background: isSel ? 'var(--rl-primary-900)' : 'transparent',
                      color: isSel ? '#fff' : 'var(--rl-fg-body)',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) e.currentTarget.style.background = 'var(--rl-primary-50)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function StepBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 'var(--rl-radius-md)',
        color: 'var(--rl-fg-muted)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--rl-gray-100)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  )
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--rl-fg-subtle)' }}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function Chevron({ open, dir }: { open?: boolean; dir?: 'left' | 'right' }) {
  const points = dir === 'left' ? '15 18 9 12 15 6' : dir === 'right' ? '9 18 15 12 9 6' : '6 9 12 15 18 9'
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s', color: 'var(--rl-fg-subtle)' }}
    >
      <polyline points={points} />
    </svg>
  )
}
