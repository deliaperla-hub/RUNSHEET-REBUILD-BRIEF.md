import { formatTime, nowTime, today } from '../lib/dates.js'
import { setMedTaken, toggleChore } from '../lib/actions.js'
import { Avatar, Badge, EmptyState, SectionHeader } from '../components/ui.jsx'

// One merged feed across every category, sorted by time, with an "overdue"
// tag on anything past due. Untimed work (chores) sorts after the timed
// items for the same day unless it is already overdue.
export function buildFeed(lists, { day = today(), now = nowTime() } = {}) {
  const entries = []

  for (const chore of lists.chores) {
    // Chores due today or earlier, plus anything already ticked off today —
    // finished work stays on the feed so the day reads as progress and a
    // mistaken tick can be undone.
    const doneToday = chore.done && chore.completed_on === day
    if (chore.done && !doneToday) continue
    if (!doneToday && (!chore.due || chore.due > day)) continue
    entries.push({
      key: `chore:${chore.id}`,
      kind: 'chore',
      id: chore.id,
      title: chore.title,
      person: chore.assignee,
      time: null,
      overdue: !chore.done && !!chore.due && chore.due < day,
      points: Number(chore.points) || 0,
      checkable: true,
      done: !!chore.done,
    })
  }

  for (const event of lists.events) {
    if (event.day !== day) continue
    entries.push({
      key: `event:${event.id}`,
      kind: 'event',
      id: event.id,
      title: event.title,
      person: event.assignee,
      time: event.time ?? null,
      detail: event.location ?? null,
      past: !!event.time && event.time < now,
      overdue: false,
      checkable: false,
    })
  }

  for (const med of lists.meds) {
    const taken = med.taken_on === day
    entries.push({
      key: `med:${med.id}`,
      kind: 'med',
      id: med.id,
      title: med.name,
      person: med.person,
      time: med.time ?? null,
      detail: med.dose ?? null,
      overdue: !taken && !!med.time && med.time < now,
      checkable: true,
      done: taken,
    })
  }

  const KIND_ORDER = { chore: 1, event: 0, med: 0 }
  return entries.sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    const at = a.time ?? '99:99'
    const bt = b.time ?? '99:99'
    if (at !== bt) return at.localeCompare(bt)
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    return a.title.localeCompare(b.title)
  })
}

const KIND_LABEL = { chore: 'Chore', event: 'Event', med: 'Med' }

export default function TodayView({ lists, patch, focus }) {
  const day = today()
  const feed = buildFeed(lists).filter((entry) => (focus ? entry.person === focus : true))
  const personOf = (id) => lists.people.find((person) => person.id === id) ?? null

  const remaining = feed.filter((entry) => !entry.done).length
  const overdue = feed.filter((entry) => entry.overdue).length

  function onCheck(entry) {
    if (entry.kind === 'chore') patch('chores', (rows) => toggleChore(rows, entry.id, day))
    if (entry.kind === 'med') patch('meds', (rows) => setMedTaken(rows, entry.id, !entry.done, day))
  }

  return (
    <div className="view">
      <section className="card">
        <SectionHeader
          title="Today"
          meta={
            overdue > 0
              ? `${remaining} to go · ${overdue} overdue`
              : `${remaining} to go`
          }
        />
        {feed.length === 0 ? (
          <EmptyState
            title="Nothing on the runsheet today"
            hint="Chores due today, today's events, and today's meds all land here."
          />
        ) : (
          <ul className="rows">
            {feed.map((entry) => (
              <li
                className={`row${entry.done ? ' row-done' : ''}${entry.past ? ' row-past' : ''}`}
                key={entry.key}
              >
                {entry.checkable ? (
                  <input
                    type="checkbox"
                    className="check"
                    checked={!!entry.done}
                    onChange={() => onCheck(entry)}
                    aria-label={`Mark ${entry.title} ${entry.done ? 'not done' : 'done'}`}
                  />
                ) : (
                  <span className="check-spacer" aria-hidden="true" />
                )}
                <span className="row-time">{entry.time ? formatTime(entry.time) : 'Any time'}</span>
                <div className="row-main">
                  <span className="row-title">{entry.title}</span>
                  <div className="row-meta">
                    <Badge tone="soft">{KIND_LABEL[entry.kind]}</Badge>
                    {entry.overdue ? <Badge tone="alert">Overdue</Badge> : null}
                    {entry.detail ? <span className="dim">{entry.detail}</span> : null}
                    {entry.points ? <Badge tone="points">{entry.points} pts</Badge> : null}
                  </div>
                </div>
                <Avatar person={personOf(entry.person)} size={26} dim={entry.done} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
