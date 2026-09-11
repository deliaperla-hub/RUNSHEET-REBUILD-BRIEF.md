import { useState } from 'react'
import { DUE_CHOICES, REPEATS, dueChoiceToDay, formatDay, today } from '../lib/dates.js'
import { toggleChore } from '../lib/actions.js'
import { newId } from '../lib/model.js'
import { Avatar, Badge, EmptyState, Field, PersonSelect, SectionHeader } from '../components/ui.jsx'

function ChoreRow({ chore, person, onToggle, onRemove }) {
  const day = today()
  const overdue = !chore.done && chore.due && chore.due < day
  return (
    <li className={`row${chore.done ? ' row-done' : ''}`}>
      <input
        type="checkbox"
        className="check"
        checked={!!chore.done}
        onChange={() => onToggle(chore.id)}
        aria-label={`Mark ${chore.title} ${chore.done ? 'not done' : 'done'}`}
      />
      <div className="row-main">
        <span className="row-title">{chore.title}</span>
        <div className="row-meta">
          {chore.due ? (
            <Badge tone={overdue ? 'alert' : 'neutral'}>
              {overdue ? 'Overdue · ' : ''}
              {formatDay(chore.due)}
            </Badge>
          ) : null}
          {Number(chore.points) > 0 ? <Badge tone="points">{chore.points} pts</Badge> : null}
          {chore.repeat && chore.repeat !== 'none' ? (
            <Badge tone="soft">{REPEATS.find((r) => r.value === chore.repeat)?.label}</Badge>
          ) : null}
        </div>
      </div>
      <Avatar person={person} size={26} dim={chore.done} />
      <button className="icon-btn" onClick={() => onRemove(chore.id)} aria-label={`Delete ${chore.title}`}>
        ×
      </button>
    </li>
  )
}

function AddChoreForm({ people, defaultAssignee, onAdd }) {
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(defaultAssignee ?? '')
  const [due, setDue] = useState('today')
  const [points, setPoints] = useState(1)
  const [repeat, setRepeat] = useState('none')

  function submit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onAdd({
      id: newId(),
      title: trimmed,
      assignee: assignee || null,
      due: dueChoiceToDay(due),
      points: Number(points) || 0,
      repeat,
      done: false,
      completed_on: null,
      banked: 0,
    })
    setTitle('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <Field label="Chore" grow>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Take the bins out"
          maxLength={120}
        />
      </Field>
      <Field label="Who">
        <PersonSelect value={assignee} onChange={(v) => setAssignee(v ?? '')} people={people} />
      </Field>
      <Field label="Due">
        <select value={due} onChange={(e) => setDue(e.target.value)}>
          {DUE_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Points">
        <input
          type="number"
          min="0"
          max="99"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          className="narrow"
        />
      </Field>
      <Field label="Repeat">
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
          {REPEATS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="primary">
        Add chore
      </button>
    </form>
  )
}

export default function ChoresView({ lists, patch, focus }) {
  const { chores, people } = lists
  const visible = focus ? chores.filter((chore) => chore.assignee === focus) : chores

  const onToggle = (id) => patch('chores', (rows) => toggleChore(rows, id))
  const onRemove = (id) => patch('chores', (rows) => rows.filter((row) => row.id !== id))
  const onAdd = (chore) => patch('chores', (rows) => [...rows, chore])

  const groups = (focus ? people.filter((p) => p.id === focus) : people).map((person) => ({
    person,
    chores: visible.filter((chore) => chore.assignee === person.id),
  }))
  const unassigned = visible.filter(
    (chore) => !chore.assignee || !people.some((person) => person.id === chore.assignee)
  )
  if (!focus && unassigned.length) groups.push({ person: null, chores: unassigned })

  const sortChores = (rows) =>
    [...rows].sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1
      return String(a.due ?? '').localeCompare(String(b.due ?? ''))
    })

  const hasAny = groups.some((group) => group.chores.length > 0)

  return (
    <div className="view">
      {!hasAny ? (
        <EmptyState
          title="No chores yet"
          hint="Add the first one below — give it a name, a person, and a due date."
        />
      ) : null}

      {groups
        .filter((group) => group.chores.length > 0)
        .map((group) => {
          const open = group.chores.filter((chore) => !chore.done).length
          return (
            <section className="card" key={group.person?.id ?? 'unassigned'}>
              <SectionHeader
                title={
                  <span className="group-title">
                    <Avatar person={group.person} size={28} />
                    {group.person?.name ?? 'Unassigned'}
                  </span>
                }
                meta={`${open} open · ${group.chores.length - open} done`}
              />
              <ul className="rows">
                {sortChores(group.chores).map((chore) => (
                  <ChoreRow
                    key={chore.id}
                    chore={chore}
                    person={group.person}
                    onToggle={onToggle}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </section>
          )
        })}

      <AddChoreForm people={people} defaultAssignee={focus ?? ''} onAdd={onAdd} />
    </div>
  )
}
