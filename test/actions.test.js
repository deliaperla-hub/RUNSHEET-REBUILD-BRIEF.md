import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { rollRepeats, setMedTaken, toggleChore } from '../src/lib/actions.js'

const chore = (over = {}) => ({
  id: 'c1', title: 'Dishes', points: 3, repeat: 'none', done: false,
  completed_on: null, banked: 0, due: '2026-09-11', ...over,
})

test('ticking a chore banks its points; un-ticking gives them back', () => {
  const done = toggleChore([chore()], 'c1', '2026-09-11')[0]
  assert.equal(done.done, true)
  assert.equal(done.completed_on, '2026-09-11')
  assert.equal(done.banked, 3)
  assert.equal(toggleChore([done], 'c1', '2026-09-11')[0].banked, 0)
})

test('banked points never go negative', () => {
  const odd = chore({ done: true, banked: 0 })
  assert.equal(toggleChore([odd], 'c1')[0].banked, 0)
})

test('a repeating chore completed earlier comes back, keeping its points', () => {
  const yesterday = chore({ repeat: 'daily', done: true, completed_on: '2026-09-10', due: '2026-09-10', banked: 3 })
  const rolled = rollRepeats([yesterday], '2026-09-11')[0]
  assert.equal(rolled.done, false)
  assert.equal(rolled.due, '2026-09-11')
  assert.equal(rolled.banked, 3, 'the work was still done')
})

test('a chore completed today stays completed', () => {
  const todayDone = chore({ repeat: 'daily', done: true, completed_on: '2026-09-11', banked: 3 })
  assert.deepEqual(rollRepeats([todayDone], '2026-09-11')[0], todayDone)
})

test('rollRepeats returns the same array when nothing moved', () => {
  const rows = [chore()]
  assert.equal(rollRepeats(rows, '2026-09-11'), rows)
})

test('meds are taken per day', () => {
  const meds = [{ id: 'm1', name: 'Vitamin D', taken_on: null }]
  assert.equal(setMedTaken(meds, 'm1', true, '2026-09-11')[0].taken_on, '2026-09-11')
  assert.equal(setMedTaken(meds, 'm1', false, '2026-09-11')[0].taken_on, null)
})
