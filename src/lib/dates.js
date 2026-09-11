// All dates are stored as local-calendar ISO days ('YYYY-MM-DD') and times as
// 'HH:MM'. Storing the local day rather than a UTC timestamp keeps "due today"
// meaning today in the house's timezone, not in UTC.

export function toDayKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function today() {
  return toDayKey(new Date())
}

export function addDays(dayKey, days) {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toDayKey(date)
}

export function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  return Math.round((to - from) / 86400000)
}

// The four due-date choices the add-chore form offers.
export const DUE_CHOICES = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'tomorrow', label: 'Tomorrow', days: 1 },
  { value: 'in3', label: 'In 3 days', days: 3 },
  { value: 'nextweek', label: 'Next week', days: 7 },
]

export function dueChoiceToDay(value, from = today()) {
  const choice = DUE_CHOICES.find((c) => c.value === value) ?? DUE_CHOICES[0]
  return addDays(from, choice.days)
}

export function formatDay(dayKey, from = today()) {
  const delta = daysBetween(from, dayKey)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const opts = { weekday: 'short', month: 'short', day: 'numeric' }
  if (Math.abs(delta) > 300) opts.year = 'numeric'
  return date.toLocaleDateString(undefined, opts)
}

export function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const date = new Date(2000, 0, 1, h, m)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const REPEATS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

// Step a repeating chore's due date forward by its cadence until it lands on
// or after `from` (normally today). A daily chore last due yesterday comes
// back today; a weekly one comes back a week after it was last due.
export function nextOccurrence(dayKey, repeat, from = today()) {
  if (!repeat || repeat === 'none') return null
  let next = dayKey
  let guard = 0
  do {
    if (repeat === 'daily') next = addDays(next, 1)
    else if (repeat === 'weekly') next = addDays(next, 7)
    else if (repeat === 'monthly') {
      const [y, m, d] = next.split('-').map(Number)
      const date = new Date(y, m - 1, d)
      date.setMonth(date.getMonth() + 1)
      next = toDayKey(date)
    } else return null
    guard += 1
  } while (daysBetween(from, next) < 0 && guard < 400)
  return next
}
