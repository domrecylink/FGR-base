import { useState } from 'react'

/** Logo Recylink. Coloca el PNG en public/logo-recylink.png; si no existe, cae a wordmark de texto. */
export default function Logo({ height = 28 }: { height?: number }) {
  const [failed, setFailed] = useState(false)
  const src = `${import.meta.env.BASE_URL}logo-recylink.png`

  if (failed) {
    return (
      <span
        style={{
          font: '800 20px/1 var(--rl-font-display)',
          letterSpacing: '-0.02em',
          display: 'inline-flex',
        }}
      >
        <span style={{ color: 'var(--rl-success-600)' }}>Recy</span>
        <span style={{ color: 'var(--rl-primary-900)' }}>link</span>
      </span>
    )
  }
  return (
    <img
      src={src}
      alt="Recylink"
      style={{ height, width: 'auto' }}
      onError={() => setFailed(true)}
    />
  )
}
