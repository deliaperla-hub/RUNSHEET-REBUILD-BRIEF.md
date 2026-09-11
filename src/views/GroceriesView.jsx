import { useState } from 'react'
import { newId } from '../lib/model.js'
import { EmptyState, Field, SectionHeader } from '../components/ui.jsx'

export default function GroceriesView({ lists, patch }) {
  const { groceries } = lists
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('')

  const open = groceries.filter((item) => !item.got)
  const got = groceries.filter((item) => item.got)

  function submit(event) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    patch('groceries', (rows) => [
      ...rows,
      { id: newId(), title: trimmed, qty: qty.trim() || null, got: false },
    ])
    setTitle('')
    setQty('')
  }

  const toggle = (id) =>
    patch('groceries', (rows) =>
      rows.map((row) => (row.id === id ? { ...row, got: !row.got } : row))
    )
  const remove = (id) => patch('groceries', (rows) => rows.filter((row) => row.id !== id))
  const clearGot = () => patch('groceries', (rows) => rows.filter((row) => !row.got))

  function renderList(items) {
    return (
      <ul className="rows">
        {items.map((item) => (
          <li className={`row${item.got ? ' row-done' : ''}`} key={item.id}>
            <input
              type="checkbox"
              className="check"
              checked={!!item.got}
              onChange={() => toggle(item.id)}
              aria-label={`Mark ${item.title} ${item.got ? 'not bought' : 'bought'}`}
            />
            <div className="row-main">
              <span className="row-title">{item.title}</span>
              {item.qty ? <div className="row-meta">{item.qty}</div> : null}
            </div>
            <button
              className="icon-btn"
              onClick={() => remove(item.id)}
              aria-label={`Delete ${item.title}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="view">
      {groceries.length === 0 ? (
        <EmptyState title="The list is empty" hint="Everyone in the house shares this one list." />
      ) : null}

      {open.length > 0 ? (
        <section className="card">
          <SectionHeader title="To buy" meta={`${open.length} item${open.length === 1 ? '' : 's'}`} />
          {renderList(open)}
        </section>
      ) : null}

      {got.length > 0 ? (
        <section className="card">
          <SectionHeader
            title="In the basket"
            meta={
              <button className="link-btn" onClick={clearGot}>
                Clear {got.length}
              </button>
            }
          />
          {renderList(got)}
        </section>
      ) : null}

      <form className="add-form" onSubmit={submit}>
        <Field label="Item" grow>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Milk"
            maxLength={120}
          />
        </Field>
        <Field label="How much">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="2 litres"
            maxLength={40}
          />
        </Field>
        <button type="submit" className="primary">
          Add
        </button>
      </form>
    </div>
  )
}
