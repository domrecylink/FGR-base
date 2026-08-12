import type { ReactNode } from 'react'

export type ChipTone = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const tones: Record<ChipTone, { bg: string; fg: string }> = {
  success: { bg: 'var(--rl-success-50)', fg: 'var(--rl-success-700)' },
  warning: { bg: 'var(--rl-warning-100)', fg: 'var(--rl-warning-700)' },
  error: { bg: 'var(--rl-error-50)', fg: 'var(--rl-error-700)' },
  neutral: { bg: 'var(--rl-gray-100)', fg: 'var(--rl-gray-700)' },
  info: { bg: 'var(--rl-primary-50)', fg: 'var(--rl-primary-900)' },
}

export default function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  const c = tones[tone]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 11px',
        borderRadius: 'var(--rl-radius-pill)',
        font: '600 12px/1 var(--rl-font-body)',
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
