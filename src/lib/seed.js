import { newId, nowStamp } from './model.js'

// Avatar colours are assigned round-robin as people are added. People are
// data, never a hardcoded roster: a household renames and removes these
// freely, and nothing in the code depends on a particular name existing.
export const PERSON_COLORS = [
  '#e0457b',
  '#2f8fd8',
  '#3fa87b',
  '#d1741f',
  '#8358d4',
  '#1f9e9e',
  '#c2453f',
  '#5f7ba8',
]

export function pickColor(existingPeople = []) {
  const used = new Set(existingPeople.map((p) => p.color))
  return PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[existingPeople.length % PERSON_COLORS.length]
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// First run gets exactly one person so the assignee pickers aren't empty.
// Everything else starts blank; the views carry their own empty states.
export function seedItems() {
  const stamp = nowStamp()
  return [
    { id: newId(), kind: 'person', data: { name: 'Me', color: PERSON_COLORS[0] }, updated_at: stamp },
  ]
}
