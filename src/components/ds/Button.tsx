import type { ButtonHTMLAttributes, CSSProperties } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
  borderRadius: 'var(--rl-radius-md)',
  fontWeight: 600,
  border: '1px solid transparent',
  transition: 'background .12s, border-color .12s, opacity .12s',
  whiteSpace: 'nowrap',
}

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: '7px 14px', fontSize: 13 },
  md: { padding: '10px 18px', fontSize: 14 },
}

const variants: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--rl-action)', color: '#fff', borderColor: 'var(--rl-action)' },
  secondary: {
    background: 'var(--rl-bg)',
    color: 'var(--rl-fg)',
    borderColor: 'var(--rl-border-strong)',
  },
  ghost: { background: 'transparent', color: 'var(--rl-fg-muted)' },
  danger: { background: 'var(--rl-error-600)', color: '#fff', borderColor: 'var(--rl-error-600)' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  style,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...base,
        ...sizes[size],
        ...variants[variant],
        ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
        ...style,
      }}
    />
  )
}
