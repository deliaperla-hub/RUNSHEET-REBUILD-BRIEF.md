import { useState } from 'react'
import { formatDay, today } from '../lib/dates.js'
import { balances, formatMoney, parseAmount, pointsByPerson } from '../lib/money.js'
import { newId } from '../lib/model.js'
import { Avatar, Badge, EmptyState, Field, PersonSelect, SectionHeader } from '../components/ui.jsx'

function AddExpenseForm({ people, defaultPayer, onAdd }) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(defaultPayer ?? '')
  const [split, setSplit] = useState('shared')

  function submit(event) {
    event.preventDefault()
    const trimmed = label.trim()
    const value = parseAmount(amount)
    if (!trimmed || value <= 0) return
    onAdd({
      id: newId(),
      label: trimmed,
      amount: value,
      paid_by: paidBy || null,
      split,
      day: today(),
      settled: false,
    })
    setLabel('')
    setAmount('')
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <Field label="What" grow>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Groceries"
          maxLength={120}
        />
      </Field>
      <Field label="Amount">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          className="narrow"
        />
      </Field>
      <Field label="Paid by">
        <PersonSelect value={paidBy} onChange={(v) => setPaidBy(v ?? '')} people={people} />
      </Field>
      <Field label="Split">
        <select value={split} onChange={(e) => setSplit(e.target.value)}>
          <option value="shared">Shared</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} owes it
            </option>
          ))}
        </select>
      </Field>
      <button type="submit" className="primary">
        Add expense
      </button>
    </form>
  )
}

export default function MoneyView({ lists, patch, focus }) {
  const { money, people, chores } = lists

  const expenses = [...money].sort((a, b) => String(b.day ?? '').localeCompare(String(a.day ?? '')))
  const visible = focus
    ? expenses.filter((item) => item.paid_by === focus || item.split === focus)
    : expenses

  const net = balances(money, people)
  const points = pointsByPerson(chores, people)
  const outstanding = money
    .filter((item) => !item.settled)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const personOf = (id) => people.find((person) => person.id === id) ?? null
  const onAdd = (expense) => patch('money', (rows) => [...rows, expense])
  const onRemove = (id) => patch('money', (rows) => rows.filter((row) => row.id !== id))
  const onSettle = (id) =>
    patch('money', (rows) =>
      rows.map((row) => (row.id === id ? { ...row, settled: !row.settled } : row))
    )

  const focused = people.find((person) => person.id === focus) ?? null

  return (
    <div className="view">
      {focused ? (
        <p className="note">
          Expenses below are filtered to {focused.name}. Standings stay on the whole
          household — a balance only means something next to everyone else&apos;s.
        </p>
      ) : null}

      <section className="card">
        <SectionHeader title="Where everyone stands" meta={`${formatMoney(outstanding)} unsettled`} />
        {people.length === 0 ? (
          <EmptyState title="Add someone to the household first" />
        ) : (
          <ul className="rows">
            {people.map((person) => {
              const value = net[person.id] ?? 0
              const tone = value > 0.004 ? 'good' : value < -0.004 ? 'alert' : 'soft'
              const text =
                value > 0.004
                  ? `owed ${formatMoney(value)}`
                  : value < -0.004
                    ? `owes ${formatMoney(-value)}`
                    : 'square'
              return (
                <li className="row" key={person.id}>
                  <Avatar person={person} size={28} />
                  <div className="row-main">
                    <span className="row-title">{person.name}</span>
                    <div className="row-meta">
                      <Badge tone="points">{points[person.id] ?? 0} chore pts</Badge>
                    </div>
                  </div>
                  <Badge tone={tone}>{text}</Badge>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <SectionHeader
          title="Expenses"
          meta={`${visible.length} entr${visible.length === 1 ? 'y' : 'ies'}`}
        />
        {visible.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            hint="Log what the house spends and who fronted it."
          />
        ) : (
          <ul className="rows">
            {visible.map((item) => (
              <li className={`row${item.settled ? ' row-done' : ''}`} key={item.id}>
                <Avatar person={personOf(item.paid_by)} size={26} dim={item.settled} />
                <div className="row-main">
                  <span className="row-title">{item.label}</span>
                  <div className="row-meta">
                    <Badge tone="soft">
                      {item.split === 'shared'
                        ? 'shared'
                        : `${personOf(item.split)?.name ?? 'someone'} owes`}
                    </Badge>
                    {item.day ? <span className="dim">{formatDay(item.day)}</span> : null}
                  </div>
                </div>
                <span className="row-amount">{formatMoney(item.amount)}</span>
                <button className="link-btn" onClick={() => onSettle(item.id)}>
                  {item.settled ? 'Reopen' : 'Settle'}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Delete ${item.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddExpenseForm people={people} defaultPayer={focus ?? ''} onAdd={onAdd} />
    </div>
  )
}
