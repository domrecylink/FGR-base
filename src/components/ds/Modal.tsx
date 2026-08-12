import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: number
}

export default function Modal({ title, subtitle, onClose, children, maxWidth = 560 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16,24,40,0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          background: 'var(--rl-bg)',
          borderRadius: 'var(--rl-radius-xl)',
          boxShadow: 'var(--rl-shadow-xl)',
          padding: '28px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          animation: 'rlUp .2s cubic-bezier(.4,0,.2,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ font: '700 21px/1.25 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
              {title}
            </h2>
            {subtitle && (
              <span style={{ font: '400 13.5px/1.4 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
                {subtitle}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ all: 'unset', cursor: 'pointer', color: 'var(--rl-gray-400)', display: 'flex' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
