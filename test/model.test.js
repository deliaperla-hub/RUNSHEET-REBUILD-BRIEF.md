import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { applyList, toLists } from '../src/lib/model.js'

test('rows round-trip through the flat item table', () => {
  const { items } = applyList([], 'chores', [{ title: 'Dishes', assignee: 'p1' }])
  assert.equal(items.length, 1)
  assert.equal(items[0].kind, 'chore')
  assert.deepEqual(items[0].data, { title: 'Dishes', assignee: 'p1' })
  assert.ok(items[0].id && items[0].updated_at)
  assert.deepEqual(toLists(items).chores, [{ id: items[0].id, title: 'Dishes', assignee: 'p1' }])
})

test('unchanged rows keep their updated_at so the sync diff stays honest', () => {
  const { items } = applyList([], 'chores', [{ title: 'Dishes' }])
  const stamp = items[0].updated_at
  const again = applyList(items, 'chores', toLists(items).chores, '2030-01-01T00:00:00.000Z')
  assert.equal(again.items[0].updated_at, stamp)
})

test('a changed row gets a new updated_at', () => {
  const { items } = applyList([], 'chores', [{ title: 'Dishes' }])
  const rows = toLists(items).chores.map((row) => ({ ...row, title: 'Washing up' }))
  const again = applyList(items, 'chores', rows, '2030-01-01T00:00:00.000Z')
  assert.equal(again.items[0].updated_at, '2030-01-01T00:00:00.000Z')
})

test('removed rows are reported so they can be deleted remotely', () => {
  const { items } = applyList([], 'chores', [{ title: 'Dishes' }, { title: 'Bins' }])
  const kept = toLists(items).chores.filter((row) => row.title === 'Bins')
  const { removed } = applyList(items, 'chores', kept)
  assert.equal(removed.length, 1)
})

test('patching one list leaves the others untouched', () => {
  let { items } = applyList([], 'people', [{ name: 'Delia' }])
  ;({ items } = applyList(items, 'chores', [{ title: 'Dishes' }]))
  const before = items.find((item) => item.kind === 'person')
  ;({ items } = applyList(items, 'chores', []))
  assert.deepEqual(items.find((item) => item.kind === 'person'), before)
})

test('unknown list names are refused rather than silently dropped', () => {
  assert.throws(() => applyList([], 'nonsense', []), /Unknown list/)
})
