// Pure sync arithmetic, kept out of the hook so it can be reasoned about (and
// tested) on its own.
//
// `synced` is the common ancestor: what we last believed the server held. With
// it, local and remote can be merged three ways, which is what lets two people
// edit different things without clobbering each other — and lets a delete on
// one device survive a refresh on the other instead of being resurrected.

export function toSyncedMap(items) {
  return new Map(items.map((item) => [item.id, item.updated_at]))
}

export function rowsToItems(rows) {
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    data: row.data ?? {},
    updated_at: row.updated_at,
  }))
}

export function itemsToRows(items, householdId) {
  return items.map((item) => ({
    household_id: householdId,
    id: item.id,
    kind: item.kind,
    data: item.data,
    updated_at: item.updated_at,
  }))
}

// What has to go up: rows we changed, and rows we removed.
export function diffForPush(items, synced) {
  const upserts = items.filter((item) => synced.get(item.id) !== item.updated_at)
  const present = new Set(items.map((item) => item.id))
  const deletes = [...synced.keys()].filter((id) => !present.has(id))
  return { upserts, deletes }
}

export function mergeRemote(local, remote, synced) {
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const merged = []

  for (const [id, item] of localById) {
    const theirs = remoteById.get(id)
    if (theirs) {
      // Both sides have it: the later edit wins.
      merged.push(theirs.updated_at > item.updated_at ? theirs : item)
      continue
    }
    // Gone remotely. If we had synced it before, someone deleted it; if we
    // never had, it is ours and has not gone up yet.
    if (!synced.has(id)) merged.push(item)
  }

  for (const [id, item] of remoteById) {
    if (localById.has(id)) continue
    // New to us, unless we are the ones who deleted it.
    if (!synced.has(id)) merged.push(item)
  }

  return merged
}

export function sameItems(a, b) {
  if (a.length !== b.length) return false
  const byId = new Map(a.map((item) => [item.id, item.updated_at]))
  return b.every((item) => byId.get(item.id) === item.updated_at)
}
