import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** false = sin padding interno (para tablas a sangre) */
  pad?: boolean
  style?: CSSProperties
}

export default function Card({ children, pad = true, style }: Props) {
  return (
    <div
      style={{
        background: 'var(--rl-surface)',
        border: '1px solid var(--rl-border)',
        borderRadius: 'var(--rl-radius-lg)',
        boxShadow: 'var(--rl-shadow-lg)',
        padding: pad ? 24 : 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
