import { useEffect, useState } from 'react'
import { useHousehold } from './hooks/useHousehold.js'
import { rollRepeats } from './lib/actions.js'
import { today } from './lib/dates.js'
import RosterStrip from './components/RosterStrip.jsx'
import AccountPanel from './components/AccountPanel.jsx'
import TodayView from './views/TodayView.jsx'
import ChoresView from './views/ChoresView.jsx'
import CalendarView from './views/CalendarView.jsx'
import GroceriesView from './views/GroceriesView.jsx'
import MedsView from './views/MedsView.jsx'
import MoneyView from './views/MoneyView.jsx'

const TABS = [
  { id: 'today', label: 'Today', View: TodayView },
  { id: 'chores', label: 'Chores', View: ChoresView },
  { id: 'calendar', label: 'Calendar', View: CalendarView },
  { id: 'groceries', label: 'Groceries', View: GroceriesView },
  { id: 'meds', label: 'Meds', View: MedsView },
  { id: 'money', label: 'Money', View: MoneyView },
]

export default function App() {
  const { lists, patch, account } = useHousehold()
  const [tab, setTab] = useState('today')
  const [focus, setFocus] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [day, setDay] = useState(today())

  // Roll completed repeating chores forward, now and whenever the date flips
  // under a device that was left open overnight.
  useEffect(() => {
    patch('chores', (rows) => rollRepeats(rows, day))
  }, [patch, day])

  useEffect(() => {
    const timer = setInterval(() => {
      const current = today()
      setDay((previous) => (previous === current ? previous : current))
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const focusedPerson = lists.people.find((person) => person.id === focus) ?? null
  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]
  const View = active.View

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          {/* The header mark sits under 58px, so it takes the small-size
              cut with its thicker strokes. */}
          <img className="brand-mark" src="/brand/mark-small.svg" alt="" width="34" height="34" />
          <div>
            <h1>Runsheet</h1>
            <p className="tagline">Everything the house has to do today, in order, with a name on it.</p>
          </div>
        </div>
        <AccountPanel
          account={account}
          open={accountOpen}
          onToggle={() => setAccountOpen((value) => !value)}
        />
        <RosterStrip lists={lists} patch={patch} focus={focus} onFocus={setFocus} />
      </header>

      <nav className="tabs" aria-label="Views">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            className={`tab${entry.id === tab ? ' tab-active' : ''}`}
            onClick={() => setTab(entry.id)}
            aria-current={entry.id === tab ? 'page' : undefined}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <View lists={lists} patch={patch} focus={focusedPerson ? focus : null} />
      </main>

      <footer className="app-footer">
        <span>
          {account.household
            ? `Saved on this device and synced to ${account.household.name}.`
            : 'Saved on this device.'}
        </span>
      </footer>
    </div>
  )
}
