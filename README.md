# Runsheet

Everything the house has to do today, in order, with a name on it.

Rebuilt from [`RUNSHEET-REBUILD-BRIEF.md`](./RUNSHEET-REBUILD-BRIEF.md), which
is the full spec and the source of truth for what this should become.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

No backend is required. The app works fully offline on a single device.

## Where things live

```
src/
  lib/model.js      one flat `items` table: { id, kind, data, updated_at }
  lib/storage.js    localStorage read/write, defensive about bad blobs
  lib/dates.js      local-calendar day keys, due choices, repeat cadences
  lib/actions.js    shared list updaters (tick a chore, take a med, roll repeats)
  lib/money.js      currency formatting, net balances, banked chore points
  hooks/useHousehold.js   state + the single `patch(listName, updateFn)` API
  views/            Today, Chores, Calendar, Groceries, Meds, Money
  components/       roster bar and small shared UI pieces
```

## The data model

Everything is one table, differentiated by `kind`
(`person | chore | event | grocery | med | money`). Each row is
`{ id, kind, data: {...fields}, updated_at }`. The per-view lists are just
filtered views over it, which keeps sync and diffing simple once Supabase is
layered in.

`useHousehold()` exposes those lists plus `patch(listName, updateFn)` — the
single mutation API. `updateFn` gets the current rows of one list (flattened
to `{ id, ...fields }`) and returns what they should become. `updated_at` is
only bumped on rows whose data actually changed, so the sync layer's
"push only what changed" diff stays honest.

People are **data, not a hardcoded constant** — a household renames or
removes them freely and nothing in the code depends on a particular name.

## Build order

Tracking the order in the brief:

- [x] 1. Vite + React, local-only, all six views against localStorage
- [ ] 2. Roster/load strip and focus filtering
- [ ] 3. Supabase auth + sync behind the existing `patch()` call sites
- [ ] 4. Paywall (schema trigger + Account panel with invite/join)
- [ ] 5. Billing webhook and hosted checkout link
- [ ] 6. Polish, build, deploy

## House rules

Meds tracking is free on every plan, always. It is a trust feature — nothing
in `MedsView` may ever sit behind a plan check.
