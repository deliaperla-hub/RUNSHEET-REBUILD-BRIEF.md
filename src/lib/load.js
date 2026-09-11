import { addDays, today } from './dates.js'

export const EVENT_WINDOW_DAYS = 7

// What each person is currently carrying: open chores plus events in the next
// week, with the chore points at stake alongside. This is the whole point of
// the roster strip — Cozi, Skylight, Maple and Apple Family Sharing will all
// show you the household's list, but none of them show you that one person is
// carrying two thirds of it.
export function loadByPerson(lists, day = today()) {
  const horizon = addDays(day, EVENT_WINDOW_DAYS - 1)
  const blank = () => ({ chores: 0, events: 0, points: 0, overdue: 0, total: 0 })

  const loads = new Map(lists.people.map((person) => [person.id, blank()]))
  const unassigned = blank()
  const bucket = (id) => (id && loads.has(id) ? loads.get(id) : unassigned)

  for (const chore of lists.chores) {
    if (chore.done) continue
    const entry = bucket(chore.assignee)
    entry.chores += 1
    entry.points += Number(chore.points) || 0
    if (chore.due && chore.due < day) entry.overdue += 1
  }

  for (const event of lists.events) {
    if (!event.day || event.day < day || event.day > horizon) continue
    bucket(event.assignee).events += 1
  }

  for (const entry of [...loads.values(), unassigned]) {
    entry.total = entry.chores + entry.events
  }

  const max = Math.max(1, ...[...loads.values()].map((entry) => entry.total))
  for (const entry of loads.values()) entry.share = entry.total / max

  return { loads, unassigned, max }
}
