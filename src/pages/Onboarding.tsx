import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/ds/Card'
import Button from '../components/ds/Button'
import Logo from '../components/Logo'

const steps = ['1 · Qué es el FGR', '2 · Qué logras', '3 · Qué necesitas']

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const finish = () => navigate('/sucursales')

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        padding: '48px 24px',
        background: 'var(--rl-bg-canvas)',
      }}
    >
      <Logo height={32} />
      <div style={{ width: '100%', maxWidth: 880 }}>
        <Card style={{ padding: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {steps.map((s, i) => (
                <span
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '5px 13px',
                    borderRadius: 999,
                    font: '600 12.5px/1 var(--rl-font-body)',
                    background: i === step ? 'var(--rl-primary-900)' : 'var(--rl-gray-100)',
                    color: i === step ? '#fff' : 'var(--rl-fg-subtle)',
                  }}
                >
                  {s}
                </span>
              ))}
            </div>

            {step === 0 && <Step1 />}
            {step === 1 && <Step2 />}
            {step === 2 && <Step3 />}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                paddingTop: 6,
                borderTop: '1px solid var(--rl-border)',
              }}
            >
              <Button variant="ghost" size="sm" onClick={finish}>
                Saltar introducción
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                {step > 0 && (
                  <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                    Atrás
                  </Button>
                )}
                <Button variant="primary" onClick={() => (step < 2 ? setStep((s) => s + 1) : finish())}>
                  {step < 2 ? 'Siguiente' : 'Empezar'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Step1() {
  return (
    <div style={{ display: 'flex', gap: 36, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ font: '700 34px/1.15 var(--rl-font-body)', letterSpacing: '-0.02em', color: 'var(--rl-fg)', maxWidth: 460 }}>
          El FGR mide cuánto residuo genera cada m² que construyes
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderRadius: 10, background: 'var(--rl-primary-50)' }}>
          <span style={{ font: '700 17px/1.2 var(--rl-font-body)', color: 'var(--rl-primary-900)' }}>
            FGR = m³ de residuo ÷ m² construidos
          </span>
        </div>
        <p style={{ font: '400 15px/1.6 var(--rl-font-body)', color: 'var(--rl-fg-muted)', maxWidth: 480 }}>
          Ejemplo: 320 m³ de residuo sobre 4.000 m² construidos son{' '}
          <strong style={{ color: 'var(--rl-fg)' }}>0,08 m³/m²</strong>. Mientras más bajo, mejor: tú
          defines tu meta máxima y la herramienta te avisa cuando la pasas.
        </p>
      </div>
      <div style={{ width: 300, flex: 'none', padding: 20, borderRadius: 10, border: '1px solid var(--rl-border)', background: 'var(--rl-bg)' }}>
        <svg viewBox="0 0 260 150" style={{ width: '100%', height: 'auto' }}>
          <line x1="30" y1="120" x2="248" y2="120" stroke="var(--rl-gray-300)" strokeWidth="1" />
          <line x1="30" y1="14" x2="30" y2="120" stroke="var(--rl-gray-300)" strokeWidth="1" />
          <line x1="30" y1="52" x2="248" y2="52" stroke="var(--rl-error-500)" strokeWidth="2" strokeDasharray="6 5" />
          <text x="186" y="46" fontSize="10" fontWeight="600" fill="var(--rl-error-700)">Tu meta</text>
          <polyline points="40,30 92,42 144,62 196,76 240,86" fill="none" stroke="var(--rl-primary-900)" strokeWidth="3" strokeLinecap="round" />
          <g fill="var(--rl-primary-900)">
            <circle cx="40" cy="30" r="4" /><circle cx="92" cy="42" r="4" /><circle cx="144" cy="62" r="4" /><circle cx="196" cy="76" r="4" /><circle cx="240" cy="86" r="4" />
          </g>
        </svg>
        <p style={{ margin: '10px 0 0', font: '400 13px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-subtle)' }}>
          Una obra eficiente baja su FGR a medida que avanza.
        </p>
      </div>
    </div>
  )
}

function Step2() {
  const cards = [
    ['Ver la tendencia', 'Un gráfico con tu FGR global, valorizado y no valorizado mes a mes.'],
    ['Saber si vas bien', 'Tu meta máxima siempre visible como línea de referencia, con alerta cuando la pasas.'],
    ['Comparar tus obras', 'Cada sucursal con su propia meta, avance y estado en una sola lista.'],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ font: '700 30px/1.2 var(--rl-font-body)', letterSpacing: '-0.02em', color: 'var(--rl-fg)' }}>
        Con la herramienta vas a lograr esto
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
        {cards.map(([t, d]) => (
          <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20, borderRadius: 10, background: 'var(--rl-gray-50)' }}>
            <strong style={{ font: '700 16px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>{t}</strong>
            <span style={{ font: '400 14px/1.55 var(--rl-font-body)', color: 'var(--rl-fg-muted)' }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Step3() {
  const items = [
    'Los m² totales a construir del proyecto.',
    'Tu meta máxima de FGR en m³/m². Si aún no la tienes, la puedes definir después.',
    'El avance de la obra al mes que vas a cargar, en % o en m².',
    'Los m³ retirados del mes, separados por tipo de residuo.',
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ font: '700 30px/1.2 var(--rl-font-body)', letterSpacing: '-0.02em', color: 'var(--rl-fg)' }}>
        Ten esto a mano antes de partir
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ flex: 'none', width: 24, height: 24, borderRadius: 999, background: 'var(--rl-primary-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 12px/1 var(--rl-font-body)' }}>
              {i + 1}
            </span>
            <span style={{ font: '400 15px/1.5 var(--rl-font-body)', color: 'var(--rl-fg-body)' }}>{it}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
