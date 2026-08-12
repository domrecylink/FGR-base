import { useData } from '../store/DataContext'

export default function ProjectSelect({ fontSize = 20 }: { fontSize?: number }) {
  const { projects, selectedProjectId, setSelectedProjectId } = useData()
  return (
    <select
      value={selectedProjectId ?? ''}
      onChange={(e) => setSelectedProjectId(e.target.value)}
      style={{
        border: '1px solid var(--rl-border-strong)',
        borderRadius: 'var(--rl-radius-md)',
        padding: '9px 12px',
        font: `700 ${fontSize}px/1.2 var(--rl-font-body)`,
        color: 'var(--rl-fg)',
        background: 'var(--rl-bg)',
        maxWidth: 420,
      }}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.branch_name}
        </option>
      ))}
    </select>
  )
}
