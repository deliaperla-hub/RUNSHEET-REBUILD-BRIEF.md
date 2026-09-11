import { initials } from '../lib/seed.js'

export function Avatar({ person, size = 32, dim = false }) {
  const color = person?.color ?? '#6b7280'
  return (
    <span
      className="avatar"
      title={person?.name ?? 'Unassigned'}
      style={{
        width: size,
        height: size,
        background: person ? color : 'transparent',
        border: person ? 'none' : '1px dashed var(--line-strong)',
        color: person ? '#fff' : 'var(--muted)',
        fontSize: Math.max(10, Math.round(size * 0.38)),
        opacity: dim ? 0.45 : 1,
      }}
    >
      {person ? initials(person.name) : '?'}
    </span>
  )
}

export function PersonChip({ person }) {
  return (
    <span className="person-chip">
      <span className="dot" style={{ background: person?.color ?? 'var(--line-strong)' }} />
      {person?.name ?? 'Unassigned'}
    </span>
  )
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({ title, hint }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint ? <p className="empty-hint">{hint}</p> : null}
    </div>
  )
}

export function Field({ label, children, grow = false }) {
  return (
    <label className={`field${grow ? ' field-grow' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function PersonSelect({ value, onChange, people, allowUnassigned = true, id }) {
  return (
    <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowUnassigned ? <option value="">Unassigned</option> : null}
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
    </select>
  )
}

export function SectionHeader({ title, meta }) {
  return (
    <div className="section-header">
      <h3>{title}</h3>
      {meta ? <span className="section-meta">{meta}</span> : null}
    </div>
  )
}
