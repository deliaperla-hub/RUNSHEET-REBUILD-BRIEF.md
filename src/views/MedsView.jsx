import { useState } from 'react'
import { formatTime, today } from '../lib/dates.js'
import { setMedTaken } from '../lib/actions.js'
import { newId } from '../lib/model.js'
import { Avatar, Badge, EmptyState, Field, PersonSelect, SectionHeader } from '../components/ui.jsx'

// Meds are deliberately free for every household on every plan. Nothing in
// this view may ever be gated behind a paywall check — people tracking a
// dose schedule are trusting the app with something that matters, and taking
// that hostage to a subscription would be the wrong trade.

function AddMedForm({ people, defaultPerson, onAdd }) {
  const [name, setName] = useState('')
  const [person, setPerson] = useState(defaultPerson ?? '')
  const [dose, setDose] = useState('')
  const [time, setTime] = useState('08:00')

  function submit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({
      id: newId(),
      name: trimmed,
      person: person || null,
      dose: dose.trim() || null,
      time: time || null,
      taken_on: null,
    })
    setName('')
    setDose('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <Field label="Medication" grow>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vitamin D"
          maxLength={120}
        />
      </Field>
      <Field label="Who">
        <PersonSelect value={person} onChange={(v) => setPerson(v ?? '')} people={people} />
      </Field>
      <Field label="Dose">
        <input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="1 tablet"
          maxLength={60}
        />
      </Field>
      <Field label="Time">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <button type="submit" className="primary">
        Add med
      </button>
    </form>
  )
}

export default function MedsView({ lists, patch, focus }) {
  const { meds, people } = lists
  const day = today()
  const visible = focus ? meds.filter((med) => med.person === focus) : meds

  const onAdd = (med) => patch('meds', (rows) => [...rows, med])
  const onRemove = (id) => patch('meds', (rows) => rows.filter((row) => row.id !== id))
  const onToggle = (med) =>
    patch('meds', (rows) => setMedTaken(rows, med.id, med.taken_on !== day, day))

  const groups = (focus ? people.filter((p) => p.id === focus) : people).map((person) => ({
    person,
    meds: visible.filter((med) => med.person === person.id),
  }))
  const unassigned = visible.filter(
    (med) => !med.person || !people.some((person) => person.id === med.person)
  )
  if (!focus && unassigned.length) groups.push({ person: null, meds: unassigned })

  const hasAny = groups.some((group) => group.meds.length > 0)

  return (
    <div className="view">
      <p className="note note-good">Meds tracking is free on every plan, always.</p>

      {!hasAny ? (
        <EmptyState
          title="No medications tracked"
          hint="Add a med with the time it's due and tick it off each day."
        />
      ) : null}

      {groups
        .filter((group) => group.meds.length > 0)
        .map((group) => {
          const due = group.meds.filter((med) => med.taken_on !== day).length
          return (
            <section className="card" key={group.person?.id ?? 'unassigned'}>
              <SectionHeader
                title={
                  <span className="group-title">
                    <Avatar person={group.person} size={28} />
                    {group.person?.name ?? 'Unassigned'}
                  </span>
                }
                meta={due === 0 ? 'all taken today' : `${due} due today`}
              />
              <ul className="rows">
                {group.meds
                  .slice()
                  .sort((a, b) => String(a.time ?? '99:99').localeCompare(String(b.time ?? '99:99')))
                  .map((med) => {
                    const taken = med.taken_on === day
                    return (
                      <li className={`row${taken ? ' row-done' : ''}`} key={med.id}>
                        <input
                          type="checkbox"
                          className="check"
                          checked={taken}
                          onChange={() => onToggle(med)}
                          aria-label={`Mark ${med.name} ${taken ? 'not taken' : 'taken'} today`}
                        />
                        <div className="row-main">
                          <span className="row-title">{med.name}</span>
                          <div className="row-meta">
                            {med.time ? <Badge tone="neutral">{formatTime(med.time)}</Badge> : null}
                            {med.dose ? <Badge tone="soft">{med.dose}</Badge> : null}
                            {taken ? <Badge tone="good">Taken today</Badge> : null}
                          </div>
                        </div>
                        <button
                          className="icon-btn"
                          onClick={() => onRemove(med.id)}
                          aria-label={`Delete ${med.name}`}
                        >
                          ×
                        </button>
                      </li>
                    )
                  })}
              </ul>
            </section>
          )
        })}

      <AddMedForm people={people} defaultPerson={focus ?? ''} onAdd={onAdd} />
    </div>
  )
}
