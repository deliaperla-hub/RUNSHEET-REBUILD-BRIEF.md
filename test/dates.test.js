import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { addDays, daysBetween, dueChoiceToDay, formatDay, nextOccurrence } from '../src/lib/dates.js'

test('day arithmetic crosses month and leap boundaries', () => {
  assert.equal(addDays('2026-02-27', 3), '2026-03-02')
  assert.equal(addDays('2024-02-27', 3), '2024-03-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(daysBetween('2026-09-11', '2026-09-14'), 3)
  assert.equal(daysBetween('2026-09-14', '2026-09-11'), -3)
})

test('due choices land on the right day', () => {
  assert.equal(dueChoiceToDay('today', '2026-09-11'), '2026-09-11')
  assert.equal(dueChoiceToDay('tomorrow', '2026-09-11'), '2026-09-12')
  assert.equal(dueChoiceToDay('in3', '2026-09-11'), '2026-09-14')
  assert.equal(dueChoiceToDay('nextweek', '2026-09-11'), '2026-09-18')
  assert.equal(dueChoiceToDay('nonsense', '2026-09-11'), '2026-09-11')
})

test('formatDay is relative near today', () => {
  assert.equal(formatDay('2026-09-11', '2026-09-11'), 'Today')
  assert.equal(formatDay('2026-09-12', '2026-09-11'), 'Tomorrow')
  assert.equal(formatDay('2026-09-10', '2026-09-11'), 'Yesterday')
})

test('a repeat lands on the first occurrence that is not in the past', () => {
  // A daily chore last due yesterday is due again today, not tomorrow.
  assert.equal(nextOccurrence('2026-09-10', 'daily', '2026-09-11'), '2026-09-11')
  // ...and one neglected for a week does not come back five days overdue.
  assert.equal(nextOccurrence('2026-09-06', 'daily', '2026-09-11'), '2026-09-11')
  assert.equal(nextOccurrence('2026-09-10', 'weekly', '2026-09-11'), '2026-09-17')
  assert.equal(nextOccurrence('2026-06-15', 'monthly', '2026-09-11'), '2026-09-15')
  assert.equal(nextOccurrence('2026-09-11', 'none', '2026-09-11'), null)
})
