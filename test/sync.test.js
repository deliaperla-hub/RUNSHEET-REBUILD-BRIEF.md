import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { diffForPush, mergeRemote, sameItems, toSyncedMap } from '../src/lib/sync.js'

const it = (id, stamp) => ({ id, kind: 'chore', data: { title: id }, updated_at: stamp })

test('first sign-in keeps the device list and picks up the household list', () => {
  const merged = mergeRemote([it('a', '1')], [it('b', '1')], new Map())
  assert.deepEqual(merged.map((row) => row.id).sort(), ['a', 'b'])
})

test('the later edit wins on a row both sides changed', () => {
  assert.equal(mergeRemote([it('a', '1')], [it('a', '2')], toSyncedMap([it('a', '1')]))[0].updated_at, '2')
  assert.equal(mergeRemote([it('a', '3')], [it('a', '2')], toSyncedMap([it('a', '2')]))[0].updated_at, '3')
})

test('two devices editing different rows do not clobber each other', () => {
  const merged = mergeRemote(
    [it('a', '2'), it('b', '1')],
    [it('a', '1'), it('b', '2')],
    toSyncedMap([it('a', '1'), it('b', '1')])
  )
  assert.deepEqual(
    merged.map((row) => `${row.id}:${row.updated_at}`).sort(),
    ['a:2', 'b:2']
  )
})

test('a delete on either side sticks instead of being resurrected', () => {
  assert.equal(mergeRemote([it('a', '1')], [], toSyncedMap([it('a', '1')])).length, 0)
  assert.equal(mergeRemote([], [it('a', '1')], toSyncedMap([it('a', '1')])).length, 0)
})

test('a row never synced is kept, not mistaken for a remote delete', () => {
  assert.equal(mergeRemote([it('a', '1')], [], new Map()).length, 1)
})

test('the push diff carries only what moved', () => {
  const { upserts, deletes } = diffForPush(
    [it('a', '2'), it('c', '1')],
    toSyncedMap([it('a', '1'), it('b', '1')])
  )
  assert.deepEqual(upserts.map((row) => row.id), ['a', 'c'])
  assert.deepEqual(deletes, ['b'])
})

test('an idle device pushes nothing', () => {
  const rows = [it('a', '1'), it('b', '1')]
  const { upserts, deletes } = diffForPush(rows, toSyncedMap(rows))
  assert.equal(upserts.length, 0)
  assert.equal(deletes.length, 0)
})

test('sameItems compares identity and version, not order', () => {
  assert.ok(sameItems([it('a', '1'), it('b', '1')], [it('b', '1'), it('a', '1')]))
  assert.ok(!sameItems([it('a', '1')], [it('a', '2')]))
  assert.ok(!sameItems([it('a', '1')], [it('a', '1'), it('b', '1')]))
})
