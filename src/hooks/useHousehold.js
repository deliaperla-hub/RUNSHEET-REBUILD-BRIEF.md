import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyList, toLists } from '../lib/model.js'
import { STORAGE_KEY, loadItems, saveItems } from '../lib/storage.js'
import { seedItems } from '../lib/seed.js'

// The single source of truth for household data.
//
// Today this is localStorage-only: the app works fully offline and
// signed-out on one device. The Supabase sync layer slots in behind this
// same surface later, so UI components never need to know whether they are
// local-only or synced — they only ever call patch().
export function useHousehold() {
  const [items, setItems] = useState(() => loadItems() ?? seedItems())
  const skipNextWrite = useRef(false)

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false
      return
    }
    saveItems(items)
  }, [items])

  // Another tab of the same app edited the list: adopt it rather than
  // racing it back to our own stale copy.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY) return
      const incoming = loadItems()
      if (!incoming) return
      skipNextWrite.current = true
      setItems(incoming)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const lists = useMemo(() => toLists(items), [items])

  // The single mutation API. updateFn receives the current rows of one list
  // ({ id, ...fields }) and returns the rows it should become.
  const patch = useCallback((listName, updateFn) => {
    setItems((current) => {
      const rows = toLists(current)[listName]
      if (!rows) throw new Error(`Unknown list: ${listName}`)
      const next = updateFn(rows)
      if (!Array.isArray(next)) throw new Error(`patch('${listName}') must return an array`)
      return applyList(current, listName, next).items
    })
  }, [])

  return { items, lists, patch }
}
