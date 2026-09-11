import { useState } from 'react'
import { addDays, daysBetween, formatDay, formatTime, today } from '../lib/dates.js'
import { newId } from '../lib/model.js'
import { Avatar, EmptyState, Field, PersonSelect, SectionHeader } from '../components/ui.jsx'

const WINDOW_DAYS = 7

function AddEventForm({ people, defaultAssignee, onAdd }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(defaultAssignee ?? '')
  const [day, setDay] = useState(today())
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')

  function submit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !day) return
    onAdd({
      id: newId(),
      title: trimmed,
      assignee: assignee || null,
      day,
      time: time || null,
      location: location.trim() || null,
    })
    setTitle('')
    setTime('')
    setLocation('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <Field label="Event" grow>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dentist"
          maxLength={120}
        />
      </Field>
      <Field label="Who">
        <PersonSelect value={assignee} onChange={(v) => setAssignee(v ?? '')} people={people} />
      </Field>
      <Field label="Day">
        <input type="date" value={day} min={today()} onChange={(e) => setDay(e.target.value)} />
      </Field>
      <Field label="Time">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Where">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional"
          maxLength={120}
        />
      </Field>
      <button type="submit" className="primary">
        Add event
      </button>
    </form>
  )
}

export default function CalendarView({ lists, patch, focus }) {
  const { events, people } = lists
  const day = today()
  const horizon = addDays(day, WINDOW_DAYS - 1)

  const visible = (focus ? events.filter((event) => event.assignee === focus) : events).filter(
    (event) => event.day
  )
  const upcoming = visible.filter((event) => event.day >= day && event.day <= horizon)
  const later = visible.filter((event) => event.day > horizon)

  const byDay = new Map()
  for (const event of upcoming) {
    if (!byDay.has(event.day)) byDay.set(event.day, [])
    byDay.get(event.day).push(event)
  }
  const days = [...byDay.keys()].sort()

  const personOf = (id) => people.find((person) => person.id === id) ?? null
  const onAdd = (event) => patch('events', (rows) => [...rows, event])
  const onRemove = (id) => patch('events', (rows) => rows.filter((row) => row.id !== id))

  return (
    <div className="view">
      {days.length === 0 ? (
        <EmptyState
          title="Nothing scheduled in the next 7 days"
          hint={
            later.length
              ? `${later.length} event${later.length === 1 ? '' : 's'} further out.`
              : 'Add an appointment, a practice, a pickup — anything with a time on it.'
          }
        />
      ) : null}

      {days.map((dayKey) => {
        const delta = daysBetween(day, dayKey)
        return (
          <section className="card" key={dayKey}>
            <SectionHeader
              title={formatDay(dayKey)}
              meta={delta === 0 ? 'today' : `in ${delta} day${delta === 1 ? '' : 's'}`}
            />
            <ul className="rows">
              {byDay
                .get(dayKey)
                .sort((a, b) => String(a.time ?? '99:99').localeCompare(String(b.time ?? '99:99')))
                .map((event) => (
                  <li className="row" key={event.id}>
                    <span className="row-time">{event.time ? formatTime(event.time) : 'All day'}</span>
                    <div className="row-main">
                      <span className="row-title">{event.title}</span>
                      {event.location ? <div className="row-meta">{event.location}</div> : null}
                    </div>
                    <Avatar person={personOf(event.assignee)} size={26} />
                    <button
                      className="icon-btn"
                      onClick={() => onRemove(event.id)}
                      aria-label={`Delete ${event.title}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )
      })}

      {later.length && days.length ? (
        <p className="note">
          {later.length} more event{later.length === 1 ? '' : 's'} beyond the next 7 days.
        </p>
      ) : null}

      <AddEventForm people={people} defaultAssignee={focus ?? ''} onAdd={onAdd} />
    </div>
  )
}
