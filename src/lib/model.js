// The whole app is one flat `items` table, differentiated by `kind`.
// Each row is { id, kind, data: {...fields}, updated_at }.
// The per-view lists below are just filtered views over that one table,
// which keeps sync and diffing simple once Supabase is layered in.

export const KINDS = ['person', 'chore', 'event', 'grocery', 'med', 'money']

// listName -> kind. UI code only ever talks in list names.
export const LIST_KIND = {
  people: 'person',
  chores: 'chore',
  events: 'event',
  groceries: 'grocery',
  meds: 'med',
  money: 'money',
}

export const LIST_NAMES = Object.keys(LIST_KIND)

export const KIND_LIST = Object.fromEntries(
  Object.entries(LIST_KIND).map(([list, kind]) => [kind, list])
)

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function nowStamp() {
  return new Date().toISOString()
}

// items -> { people: [{id, ...data}], chores: [...], ... }
// Rows are flattened for the UI so components never touch the envelope.
export function toLists(items) {
  const lists = Object.fromEntries(LIST_NAMES.map((name) => [name, []]))
  for (const item of items) {
    const list = KIND_LIST[item.kind]
    if (!list) continue
    lists[list].push({ id: item.id, ...item.data })
  }
  return lists
}

function sameData(a, b) {
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) continue
    if (av && bv && typeof av === 'object' && typeof bv === 'object') {
      if (JSON.stringify(av) !== JSON.stringify(bv)) return false
      continue
    }
    return false
  }
  return true
}

// Fold a replacement list back into the flat item table.
// `updated_at` is only bumped for rows whose data actually changed, so the
// sync layer's "push only what changed" diff stays honest.
export function applyList(items, listName, nextRows, stamp = nowStamp()) {
  const kind = LIST_KIND[listName]
  if (!kind) throw new Error(`Unknown list: ${listName}`)

  const previous = new Map(
    items.filter((item) => item.kind === kind).map((item) => [item.id, item])
  )

  const rebuilt = nextRows.map((row) => {
    const { id = newId(), ...data } = row
    const before = previous.get(id)
    if (before && sameData(before.data, data)) return before
    return { id, kind, data, updated_at: stamp }
  })

  const untouched = items.filter((item) => item.kind !== kind)
  const kept = new Set(rebuilt.map((item) => item.id))

  // Preserve the original table ordering for rows that survived, then append
  // anything newly created at the end.
  const order = new Map(items.map((item, index) => [item.id, index]))
  const merged = [...untouched, ...rebuilt].sort((a, b) => {
    const ai = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER
    const bi = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER
    return ai - bi
  })

  return { items: merged, removed: [...previous.keys()].filter((id) => !kept.has(id)) }
}
