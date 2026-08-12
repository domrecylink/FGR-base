import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode
  hint?: ReactNode
  wrapStyle?: CSSProperties
}

export const inputStyle: CSSProperties = {
  border: '1px solid var(--rl-border-strong)',
  borderRadius: 'var(--rl-radius-md)',
  padding: '10px 12px',
  fontSize: 14,
  color: 'var(--rl-fg)',
  background: 'var(--rl-bg)',
  width: '100%',
}

export const labelStyle: CSSProperties = {
  font: '600 12.5px/1 var(--rl-font-body)',
  color: 'var(--rl-gray-700)',
}

export default function Input({ label, hint, wrapStyle, style, ...rest }: Props) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7, ...wrapStyle }}>
      {label && <span style={labelStyle}>{label}</span>}
      <input {...rest} style={{ ...inputStyle, ...style }} />
      {hint && (
        <span style={{ font: '400 12px/1.3 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}
