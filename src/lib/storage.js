import { KINDS, nowStamp } from './model.js'

export const STORAGE_KEY = 'runsheet.items.v1'

// Only shapes we recognise survive a load — a corrupted or hand-edited
// localStorage blob should degrade to "fewer rows", never to a white screen.
function sanitize(raw) {
  if (!Array.isArray(raw)) return null
  return raw
    .filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        KINDS.includes(item.kind) &&
        item.data &&
        typeof item.data === 'object' &&
        !Array.isArray(item.data)
    )
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      data: item.data,
      updated_at: typeof item.updated_at === 'string' ? item.updated_at : nowStamp(),
    }))
}

export function loadItems() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return sanitize(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveItems(items) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Quota or private-mode failure: the in-memory session still works.
  }
}
