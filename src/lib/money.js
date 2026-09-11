export const CURRENCY = 'USD'

export function formatMoney(amount) {
  const value = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY }).format(value)
}

export function parseAmount(input) {
  const value = Number.parseFloat(String(input).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

// Net position per person across unsettled expenses.
// A shared expense splits evenly across everyone in the household; an expense
// pinned to one person is owed in full by that person to whoever paid.
// Positive balance = the household owes them, negative = they owe the household.
export function balances(expenses, people) {
  const net = Object.fromEntries(people.map((p) => [p.id, 0]))
  for (const expense of expenses) {
    if (expense.settled) continue
    const amount = Number(expense.amount) || 0
    if (!amount) continue
    if (expense.paid_by && expense.paid_by in net) net[expense.paid_by] += amount

    if (expense.split && expense.split !== 'shared') {
      if (expense.split in net) net[expense.split] -= amount
      continue
    }
    if (people.length === 0) continue
    const share = amount / people.length
    for (const person of people) net[person.id] -= share
  }
  for (const id of Object.keys(net)) net[id] = Math.round(net[id] * 100) / 100
  return net
}

// Chore points banked per person. Reads the banked total rather than the
// current `done` flag: a repeating chore rolls forward and un-checks itself,
// but the points it earned on the way through stay earned.
export function pointsByPerson(chores, people) {
  const totals = Object.fromEntries(people.map((p) => [p.id, 0]))
  for (const chore of chores) {
    if (!chore.assignee || !(chore.assignee in totals)) continue
    totals[chore.assignee] += Number(chore.banked) || 0
  }
  return totals
}
