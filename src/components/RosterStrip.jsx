import { useState } from 'react'
import { newId } from '../lib/model.js'
import { PERSON_COLORS, pickColor } from '../lib/seed.js'
import { loadByPerson } from '../lib/load.js'
import { Avatar } from './ui.jsx'

function loadSummary(load) {
  const parts = []
  if (load.chores) parts.push(`${load.chores} chore${load.chores === 1 ? '' : 's'}`)
  if (load.events) parts.push(`${load.events} event${load.events === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'clear'
  return parts.join(' · ')
}

export default function RosterStrip({ lists, patch, focus, onFocus }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const { loads, unassigned } = loadByPerson(lists)

  const rename = (id, name) =>
    patch('people', (rows) => rows.map((row) => (row.id === id ? { ...row, name } : row)))
  const recolor = (id, color) =>
    patch('people', (rows) => rows.map((row) => (row.id === id ? { ...row, color } : row)))

  function remove(id) {
    patch('people', (rows) => rows.filter((row) => row.id !== id))
    if (focus === id) onFocus(null)
  }

  function addPerson(event) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    patch('people', (rows) => [...rows, { id: newId(), name, color: pickColor(rows) }])
    setDraft('')
  }

  return (
    <div className="roster">
      <div className="roster-row">
        {lists.people.map((person) => {
          const load = loads.get(person.id)
          const active = focus === person.id
          return (
            <button
              key={person.id}
              className={`roster-card${active ? ' roster-card-active' : ''}`}
              onClick={() => onFocus(active ? null : person.id)}
              aria-pressed={active}
              title={`${person.name}: ${loadSummary(load)}`}
            >
              <Avatar person={person} size={34} />
              <span className="roster-name">{person.name}</span>
              <span className="roster-count">
                {load.total}
                {load.overdue > 0 ? <span className="roster-overdue">{load.overdue} late</span> : null}
              </span>
              <span className="roster-bar" aria-hidden="true">
                <span
                  className="roster-bar-fill"
                  style={{ width: `${Math.round(load.share * 100)}%`, background: person.color }}
                />
              </span>
              <span className="roster-detail">{loadSummary(load)}</span>
            </button>
          )
        })}

        {unassigned.total > 0 ? (
          <div className="roster-card roster-card-quiet" title="Work with nobody's name on it">
            <Avatar person={null} size={34} />
            <span className="roster-name">Unassigned</span>
            <span className="roster-count">{unassigned.total}</span>
            <span className="roster-bar" aria-hidden="true" />
            <span className="roster-detail">{loadSummary(unassigned)}</span>
          </div>
        ) : null}

        {lists.people.length === 0 ? (
          <p className="empty-hint roster-empty">
            Add the people who live here — the strip shows who is carrying what.
          </p>
        ) : null}
      </div>

      <div className="roster-actions">
        {focus ? (
          <button className="link-btn" onClick={() => onFocus(null)}>
            Showing only {lists.people.find((p) => p.id === focus)?.name} — show everyone
          </button>
        ) : (
          <span className="dim">Tap someone to filter every view to them.</span>
        )}
        <button className="link-btn" onClick={() => setEditing((value) => !value)}>
          {editing ? 'Done' : 'Manage people'}
        </button>
      </div>

      {editing ? (
        <div className="people-editor">
          {lists.people.map((person) => (
            <div className="person-edit" key={person.id}>
              <input
                value={person.name}
                onChange={(e) => rename(person.id, e.target.value)}
                aria-label="Name"
                maxLength={40}
              />
              <select
                value={person.color}
                onChange={(e) => recolor(person.id, e.target.value)}
                aria-label="Colour"
                style={{ color: person.color }}
              >
                {PERSON_COLORS.map((color) => (
                  <option key={color} value={color} style={{ color }}>
                    ●
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                onClick={() => remove(person.id)}
                aria-label={`Remove ${person.name}`}
              >
                ×
              </button>
            </div>
          ))}
          <form className="person-edit" onSubmit={addPerson}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add someone"
              maxLength={40}
            />
            <button type="submit" className="primary small">
              Add
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
