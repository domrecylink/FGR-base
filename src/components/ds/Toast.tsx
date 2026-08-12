import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastCtx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 2600)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 32,
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '13px 20px',
            borderRadius: 'var(--rl-radius-lg)',
            background: 'var(--rl-gray-900)',
            color: '#fff',
            boxShadow: 'var(--rl-shadow-xl)',
            animation: 'rlUp .2s cubic-bezier(.4,0,.2,1)',
          }}
        >
          <span style={{ display: 'flex', color: 'var(--rl-success-400)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span style={{ font: '600 14px/1.3 var(--rl-font-body)' }}>{msg}</span>
        </div>
      )}
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
