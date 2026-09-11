import { useState } from 'react'
import { PERSON_COLORS, pickColor } from '../lib/seed.js'
import { newId } from '../lib/model.js'
import { Avatar } from './ui.jsx'

// People are rows in the same items table as everything else, so a household
// renames or removes them freely. Nothing in the code assumes a given name.
export default function PeopleBar({ people, patch }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const rename = (id, name) =>
    patch('people', (rows) => rows.map((row) => (row.id === id ? { ...row, name } : row)))
  const recolor = (id, color) =>
    patch('people', (rows) => rows.map((row) => (row.id === id ? { ...row, color } : row)))
  const remove = (id) => patch('people', (rows) => rows.filter((row) => row.id !== id))

  function addPerson(event) {
    event.preventDefault()
    const name = draft.trim()
    if (!name) return
    patch('people', (rows) => [
      ...rows,
      { id: newId(), name, color: pickColor(rows) },
    ])
    setDraft('')
  }

  return (
    <div className="people-bar">
      <div className="people-row">
        {people.map((person) => (
          <span className="person-pill" key={person.id}>
            <Avatar person={person} size={26} />
            <span>{person.name}</span>
          </span>
        ))}
        {people.length === 0 ? <span className="dim">No one in the household yet</span> : null}
        <button className="link-btn" onClick={() => setEditing((value) => !value)}>
          {editing ? 'Done' : 'Manage people'}
        </button>
      </div>

      {editing ? (
        <div className="people-editor">
          {people.map((person) => (
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
