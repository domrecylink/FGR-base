'use client'

import type { ReactNode } from 'react'
import Sidebar from '../../src/components/Sidebar'
import { useData } from '../../src/store/DataContext'

function ErrorBanner() {
  const { error, clearError } = useData()
  if (!error) return null
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderRadius: 'var(--rl-radius-md)',
        background: 'var(--rl-error-50)',
        color: 'var(--rl-error-700)',
        border: '1px solid var(--rl-error-200)',
        marginBottom: 16,
      }}
    >
      <span>⚠️ {error}</span>
      <button
        onClick={clearError}
        style={{ all: 'unset', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}
      >
        Cerrar
      </button>
    </div>
  )
}

/** Layout con barra lateral. El onboarding queda fuera a propósito (pantalla completa). */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '32px 40px 64px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <ErrorBanner />
        {children}
      </main>
    </div>
  )
}
