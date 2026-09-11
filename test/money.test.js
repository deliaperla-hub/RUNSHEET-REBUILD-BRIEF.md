import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { balances, parseAmount, pointsByPerson } from '../src/lib/money.js'

const people = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('a shared expense splits evenly and nets to zero', () => {
  const net = balances([{ amount: 60, paid_by: 'a', split: 'shared' }], people)
  assert.equal(net.a, 40)
  assert.equal(net.b, -20)
  assert.equal(net.c, -20)
  assert.equal(Object.values(net).reduce((sum, value) => sum + value, 0), 0)
})

test('an expense pinned to one person is owed in full', () => {
  const net = balances([{ amount: 30, paid_by: 'a', split: 'b' }], people)
  assert.equal(net.a, 30)
  assert.equal(net.b, -30)
  assert.equal(net.c, 0)
})

test('settled expenses drop out of the balance', () => {
  const net = balances([{ amount: 60, paid_by: 'a', split: 'shared', settled: true }], people)
  assert.deepEqual(net, { a: 0, b: 0, c: 0 })
})

test('an expense paid by someone no longer in the household still splits', () => {
  const net = balances([{ amount: 30, paid_by: 'gone', split: 'shared' }], people)
  assert.deepEqual(Object.values(net), [-10, -10, -10])
})

test('points come from the banked total, so a repeat rolling forward keeps them', () => {
  const chores = [
    { assignee: 'a', points: 3, banked: 3, done: false },
    { assignee: 'a', points: 2, banked: 0, done: true },
    { assignee: 'gone', points: 9, banked: 9 },
  ]
  assert.equal(pointsByPerson(chores, people).a, 3)
  assert.equal(pointsByPerson(chores, people).b, 0)
})

test('amounts are parsed forgivingly and rounded to cents', () => {
  assert.equal(parseAmount('$12.345'), 12.35)
  assert.equal(parseAmount('12'), 12)
  assert.equal(parseAmount('nonsense'), 0)
})
