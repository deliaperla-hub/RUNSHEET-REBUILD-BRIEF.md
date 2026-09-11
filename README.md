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

No backend is required. With no environment variables set, the app is a
complete local-only product: fully offline, signed out, one device.

To turn on multi-device sync, copy `.env.example` to `.env`, fill in a
Supabase project's URL and anon key, and run `supabase/schema.sql` against it.
Vite bakes these in at **build** time, so set them before the first build.

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
  lib/load.js       what each person is currently carrying
  lib/sync.js       three-way merge and push diff (pure, no network)
  lib/supabase.js   client, or null when the build has no backend configured
  components/       roster/load strip and small shared UI pieces
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
- [x] 2. Roster/load strip and focus filtering
- [x] 3. Supabase auth + sync behind the existing `patch()` call sites
- [ ] 4. Paywall (schema trigger + Account panel with invite/join)
- [ ] 5. Billing webhook and hosted checkout link
- [ ] 6. Polish, build, deploy

## The roster strip

The strip across the top shows every household member with their current load
— open chores plus events in the next week — as a number and a bar sized
against the busiest person. Imbalance in who is doing the work is the thing
the other family apps don't surface, so it gets the top of the screen.

Tapping someone focuses every view on them. Two views say so rather than
pretending: the grocery list is shared by the whole house, and the Money
standings stay on everyone because a balance only means something next to the
others.

## Sync

`useHousehold` writes to localStorage unconditionally. When someone signs in
(Supabase email OTP), the same rows are mirrored to the `items` table for
their household.

Sync is a three-way merge against `synced` — what the device last believed the
server held. That ancestor is what lets two people edit different things
without clobbering each other, and what lets a delete on one device stay
deleted instead of being resurrected by the other. Pushes send only rows whose
`updated_at` changed, plus the ids that disappeared. Postgres realtime on
`items` nudges a re-pull when another device writes.

First sign-in unions the device's existing list with the household's, so it
feels like keeping your data rather than losing it.

None of this reaches the views: they still only call `patch()`.

## Backend

`supabase/schema.sql` is re-runnable and sets up `households`, `members` and
`items` with row-level security via an `is_member(household_id)`
security-definer helper — a household's data is invisible to anyone not in
`members` for it. `create_household(name)` and `join_household(invite_code)`
are the only two ways rows appear in `households`/`members`, both security
definer, so a household can never exist without an owner. `members` has no
insert policy at all: nothing can forge a membership by talking to the table
directly.

## House rules

Meds tracking is free on every plan, always. It is a trust feature — nothing
in `MedsView` may ever sit behind a plan check.
