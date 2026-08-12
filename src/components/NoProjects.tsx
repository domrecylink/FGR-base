import { useNavigate } from 'react-router-dom'
import Card from './ds/Card'
import Button from './ds/Button'

export default function NoProjects() {
  const navigate = useNavigate()
  return (
    <Card>
      <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
        <strong style={{ font: '700 17px/1.3 var(--rl-font-body)', color: 'var(--rl-fg)' }}>
          Primero crea una sucursal
        </strong>
        <span style={{ color: 'var(--rl-fg-muted)' }}>Necesitas al menos un proyecto para trabajar aquí.</span>
        <Button variant="primary" size="sm" onClick={() => navigate('/sucursales')}>
          Ir a Sucursales
        </Button>
      </div>
    </Card>
  )
}
