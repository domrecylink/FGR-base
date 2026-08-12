'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import Logo from './Logo'
import { IconChart, IconLayers, IconPen, IconUpload } from './icons'

const items: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/sucursales', label: 'Sucursales', icon: <IconLayers /> },
  { to: '/dashboard', label: 'Dashboard FGR', icon: <IconChart /> },
  { to: '/ingreso', label: 'Ingreso mensual', icon: <IconPen /> },
  { to: '/masiva', label: 'Carga masiva', icon: <IconUpload /> },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <aside
      style={{
        width: 246,
        flex: 'none',
        background: 'var(--rl-bg)',
        borderRight: '1px solid var(--rl-border)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}
    >
      <div style={{ marginLeft: 8 }}>
        <Logo height={26} />
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => {
          const isActive = pathname === it.to
          return (
            <Link
              key={it.to}
              href={it.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--rl-radius-md)',
                font: '600 14.5px/1.1 var(--rl-font-body)',
                textDecoration: 'none',
                background: isActive ? 'var(--rl-primary-50)' : 'transparent',
                color: isActive ? 'var(--rl-primary-900)' : 'var(--rl-fg-muted)',
                boxShadow: isActive ? 'inset 0 0 0 1px var(--rl-primary-100)' : 'none',
              }}
            >
              {it.icon}
              {it.label}
            </Link>
          )
        })}
      </nav>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 16,
          borderRadius: 'var(--rl-radius-lg)',
          background: 'var(--rl-primary-50)',
        }}
      >
        <strong style={{ font: '700 13.5px/1.3 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>
          ¿Qué es el FGR?
        </strong>
        <span style={{ font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-primary-700)' }}>
          m³ de residuo por cada m² construido. Mientras más bajo, mejor.
        </span>
        <button
          type="button"
          onClick={() => router.push('/onboarding')}
          style={{
            all: 'unset',
            cursor: 'pointer',
            font: '600 13px/1 var(--rl-font-body)',
            color: 'var(--rl-primary-900)',
            textDecoration: 'underline',
          }}
        >
          Ver la introducción
        </button>
      </div>
    </aside>
  )
}
