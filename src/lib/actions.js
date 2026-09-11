import { nextOccurrence, today } from './dates.js'

// Shared list updaters, so the Today feed and the per-category views can
// never drift apart on what "check this off" means.

export function toggleChore(chores, id, day = today()) {
  return chores.map((chore) => {
    if (chore.id !== id) return chore
    const points = Number(chore.points) || 0
    if (chore.done) {
      return {
        ...chore,
        done: false,
        completed_on: null,
        banked: Math.max(0, (Number(chore.banked) || 0) - points),
      }
    }
    return {
      ...chore,
      done: true,
      completed_on: day,
      banked: (Number(chore.banked) || 0) + points,
    }
  })
}

// A repeating chore completed on an earlier day comes back due on its next
// occurrence. Banked points stay banked — the work was still done.
export function rollRepeats(chores, day = today()) {
  let changed = false
  const rolled = chores.map((chore) => {
    if (!chore.done || !chore.repeat || chore.repeat === 'none') return chore
    if (!chore.completed_on || chore.completed_on >= day) return chore
    const next = nextOccurrence(chore.due || chore.completed_on, chore.repeat, day)
    if (!next) return chore
    changed = true
    return { ...chore, done: false, completed_on: null, due: next }
  })
  return changed ? rolled : chores
}

export function setMedTaken(meds, id, taken, day = today()) {
  return meds.map((med) =>
    med.id === id ? { ...med, taken_on: taken ? day : null } : med
  )
}

export function isMedDueToday(med, day = today()) {
  return med.taken_on !== day
}
