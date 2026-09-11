import { useState } from 'react'
import { Field } from './ui.jsx'

const STATUS_LABEL = {
  local: 'On this device',
  loading: 'Loading…',
  'signed-out': 'On this device',
  'no-household': 'Signed in',
  synced: 'Synced',
  error: 'Sync problem',
}

function SignIn({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  async function submit(event) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setProblem(null)
    try {
      await onSignIn(address)
      setSent(true)
    } catch (signInError) {
      setProblem(signInError.message ?? String(signInError))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p className="note note-good">
        Check {email} for a sign-in link. Open it on this device and your current list comes
        with you.
      </p>
    )
  }

  return (
    <form className="account-form" onSubmit={submit}>
      <Field label="Email" grow>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </Field>
      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Sending…' : 'Email me a link'}
      </button>
      <p className="note">
        Signing in syncs this household across your devices. Everything already on this
        device comes with you.
      </p>
      {problem ? <p className="note note-bad">{problem}</p> : null}
    </form>
  )
}

function ChooseHousehold({ onCreate, onJoin }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState(null)

  async function run(action) {
    setBusy(true)
    setProblem(null)
    try {
      await action()
    } catch (actionError) {
      setProblem(actionError.message ?? String(actionError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-choice">
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => onCreate(name.trim() || 'Our house'))
        }}
      >
        <Field label="Start a household" grow>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Our house"
            maxLength={60}
          />
        </Field>
        <button type="submit" className="primary" disabled={busy}>
          Create
        </button>
      </form>

      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => onJoin(code.trim()))
        }}
      >
        <Field label="Or join one" grow>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="INVITE CODE"
            maxLength={16}
            spellCheck={false}
          />
        </Field>
        <button type="submit" className="primary" disabled={busy || !code.trim()}>
          Join
        </button>
      </form>

      {problem ? <p className="note note-bad">{problem}</p> : null}
    </div>
  )
}

export default function AccountPanel({ account, open, onToggle }) {
  const { configured, session, household, status, error } = account

  if (!configured) {
    return (
      <p className="account-strip dim">
        This build has no backend configured — everything is saved on this device.
      </p>
    )
  }

  return (
    <div className="account">
      <button className="account-strip" onClick={onToggle} aria-expanded={open}>
        <span className={`sync-dot sync-${status}`} aria-hidden="true" />
        <span>{household ? household.name : STATUS_LABEL[status] ?? status}</span>
        <span className="dim">{household ? STATUS_LABEL[status] ?? status : ''}</span>
        <span className="dim account-caret">{open ? 'Close' : 'Account'}</span>
      </button>

      {open ? (
        <div className="account-body">
          {!session ? <SignIn onSignIn={account.signIn} /> : null}

          {session && status === 'no-household' ? (
            <ChooseHousehold onCreate={account.createHousehold} onJoin={account.joinHousehold} />
          ) : null}

          {session && household ? (
            <div className="account-rows">
              <div className="account-row">
                <span className="dim">Signed in as</span>
                <span>{session.user?.email}</span>
              </div>
              <div className="account-row">
                <span className="dim">Household</span>
                <span>{household.name}</span>
              </div>
              <div className="account-row">
                <span className="dim">Plan</span>
                <span>{household.plan === 'pro' ? 'Pro' : 'Free'}</span>
              </div>
            </div>
          ) : null}

          {session ? (
            <button className="link-btn" onClick={account.signOut}>
              Sign out — this device keeps its copy
            </button>
          ) : null}

          {error ? <p className="note note-bad">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
