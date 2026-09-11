import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { loadByPerson } from '../src/lib/load.js'

const lists = {
  people: [{ id: 'a', name: 'Delia' }, { id: 'b', name: 'Jordan' }],
  chores: [
    { assignee: 'a', points: 3, done: false, due: '2026-09-11' },
    { assignee: 'a', points: 2, done: false, due: '2026-09-09' },
    { assignee: 'a', points: 5, done: true, due: '2026-09-11' },
    { assignee: 'b', points: 1, done: false, due: '2026-09-18' },
    { assignee: null, points: 1, done: false, due: '2026-09-11' },
  ],
  events: [
    { assignee: 'b', day: '2026-09-12' },
    { assignee: 'b', day: '2026-10-30' },
    { assignee: 'a', day: '2026-09-01' },
  ],
}

test('load counts open chores and events inside the week', () => {
  const { loads } = loadByPerson(lists, '2026-09-11')
  assert.equal(loads.get('a').chores, 2, 'completed chores are not a burden')
  assert.equal(loads.get('a').events, 0, 'last week is not a burden either')
  assert.equal(loads.get('a').overdue, 1)
  assert.equal(loads.get('a').points, 5)
  assert.equal(loads.get('b').total, 2, 'the October event is beyond the horizon')
})

test('work with nobody on it is visible rather than hidden', () => {
  const { unassigned } = loadByPerson(lists, '2026-09-11')
  assert.equal(unassigned.total, 1)
})

test('bars are sized against the busiest person', () => {
  const { loads } = loadByPerson(lists, '2026-09-11')
  assert.equal(loads.get('a').share, 1)
  assert.equal(loads.get('b').share, 1)
})

test('an empty household does not divide by zero', () => {
  const { loads, max } = loadByPerson({ people: [], chores: [], events: [] }, '2026-09-11')
  assert.equal(loads.size, 0)
  assert.equal(max, 1)
})
