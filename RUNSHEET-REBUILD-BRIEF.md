# Runsheet — rebuild brief

Runsheet is a family household operations app. This is a from-scratch rebuild:
the original project's source files are no longer accessible, so this brief
is the full spec to reconstruct it. Give this file to Claude Code as the
starting prompt/context for the project.

## What it is

A single-page app, "everything the house has to do today, in order, with a
name on it." Six views, tab-based:

1. **Today** — merged feed across all categories (chores, events, meds due
   today), sorted by time, with an "overdue" tag for anything past due.
2. **Chores** — grouped by person, each with a title, assignee, due date
   (today / tomorrow / in 3 days / next week), point value, repeat cadence,
   and a completion checkbox. Add-chore form inline at the bottom of the list.
3. **Calendar** — upcoming events (next 7 days) grouped by day, each with
   title, assignee, time, location. Add-event form with day/time/location.
4. **Groceries** — a shared shopping list.
5. **Meds** — medication tracker, per person, explicitly kept free/unpaywalled
   regardless of billing tier (this is a trust feature — never gate it).
6. **Money** — shared household expense/chore-point tracking.

A **roster/load strip** across the top shows each household member with a
colored avatar and how much they're currently carrying (open chores/events),
so imbalance in who's doing the work is visible at a glance — this was
identified as the core differentiator vs. Cozi/Skylight/Maple/Apple Family
Sharing (which don't surface fairness).

Filtering: clicking a person in the roster filters every view to just them
("focus" state).

## Data model

One `items` table/store holds everything, differentiated by `kind`:
`person | chore | event | grocery | med | money`. Each row is
`{ id, kind, data: {...fields}, updated_at }`. The UI's per-view lists
(`chores`, `events`, `groceries`, `meds`, `money`, `people`) are just filtered
views over this one table — this keeps sync and diffing simple.

People are **data, not a hardcoded constant** — households can rename members
(a paying household must not be stuck as a placeholder family name baked into
the code).

## Backend (Supabase) — rebuild if going multi-device/paid

- **Auth**: Supabase email OTP (magic link) sign-in.
- **`households`** table: `id, name, plan ('free'|'pro'), billing_ref,
  renews_at, invite_code, created_at`.
- **`members`** table: `household_id, user_id, role ('owner'|'member'),
  joined_at` — join table between households and `auth.users`.
- **`items`** table: `household_id, id, kind, data jsonb, updated_at`.
- **Row-level security** on all three tables via an `is_member(household_id)`
  security-definer helper function — a household's data is invisible to
  anyone not in `members` for that household.
- **The paywall is a database trigger, not a UI check.** A free household
  allows exactly one member row; a `before insert on members` trigger
  (`enforce_seat_limit`) raises an exception if a second member tries to join
  a household whose `plan <> 'pro'`. This means the gate cannot be bypassed
  by editing client-side JavaScript.
- **`create_household(name)`** and **`join_household(invite_code)`** are the
  only two ways rows get created in `households`/`members` — both
  security-definer RPC functions, so a household can never exist without an
  owner.
- **Realtime**: `items` table added to the `supabase_realtime` publication so
  one device's edit shows up live on another.

## Client sync layer

A single hook (e.g. `useHousehold`) that:
- Persists to `localStorage` always (works fully offline / signed-out, single
  device).
- When signed in, mirrors to Supabase: loads the household's `items`, diffs
  local state against last-synced state, and pushes only the changed rows
  (upsert changed, delete removed) — so two people editing different things
  don't clobber each other.
- Subscribes to Postgres realtime changes on `items` and re-syncs local state
  when they arrive.
- On first sign-in, **migrates the device's existing local list up into the
  new household** rather than starting the user empty — first sign-in should
  feel like keeping your data, not losing it.
- Exposes `patch(listName, updateFn)` as the single mutation API so UI
  components don't need to know whether they're local-only or synced.

## Billing

- Pricing is **per household, not per seat** (a 5-person family shouldn't feel
  nickel-and-dimed per kid).
- Free tier: unlimited devices for **one** signed-in person, full feature set
  including meds.
- Pro tier: invite code lets additional household members join.
- A signed webhook (Lemon Squeezy or Stripe) is the **only** thing allowed to
  set `households.plan = 'pro'`, using a service-role key that never reaches
  the browser. Verify webhook signatures with a timing-safe comparison.
- Pass `household_id` through checkout as custom/metadata so the webhook
  knows which household to flip.

## Design/brand notes (if recreating brand assets)

- Mark: live area inset 18% x 17%, roof 1.25 row-heights at 3:1 pitch, three
  equal rows, 22.4% corner radius (squircle).
- Color cuts: magenta, cyan, knockout (white), single-color, plus a
  small-size cut with thicker strokes for anything under ~58px. Never combine
  both accent colors in one mark.

## Deployment (if standing up the real backend)

1. Create a Supabase project, run the schema SQL, enable email auth, add the
   dev + prod URLs to the auth redirect allow-list.
2. Create the Pro product in Lemon Squeezy (or Stripe), deploy the webhook
   function with its signing secret and the Supabase service role key as
   secrets, and point the payment provider's webhook at it.
3. `npm run build`, deploy `dist/` to Netlify/Vercel/Cloudflare Pages — set
   the `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_CHECKOUT_URL`
   env vars on the host **before** the first build (Vite bakes them in at
   build time).

Two non-technical flags from the original build worth keeping in mind:
subscription cancellation must be as easy as sign-up (US click-to-cancel/ROSCA
rules apply regardless of who's the merchant of record), and a merchant of
record like Lemon Squeezy handles tax remittance but not your terms of
service — get a professional to review both before charging real users.

## Suggested build order for a fresh session

1. Scaffold the Vite + React app, static/local-only first (no backend) — get
   all six views working against localStorage with the item model above.
2. Add the roster/load strip and focus-filtering.
3. Layer in Supabase auth + sync (`useHousehold` hook) without breaking the
   existing `patch()` call sites.
4. Add the paywall (schema trigger + Account panel with invite/join flow).
5. Add the billing webhook and hosted checkout link.
6. Polish, build, deploy.
