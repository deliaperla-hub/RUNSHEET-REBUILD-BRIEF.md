# Backend tests

## Webhook

Pure, no network, no database:

```bash
npm run test:webhook
```

Covers signature verification (tampered bodies, wrong secret, truncated and
non-hex headers, empty secret) and the event → plan mapping, including the
payloads that must never move a plan.

## Schema, RLS and the paywall

These run against a throwaway Postgres rather than a live Supabase project.
`local-shim.sql` supplies the pieces of a Supabase project that `schema.sql`
leans on — the `auth` schema, `auth.uid()` reading a session GUC, the
`authenticated` / `anon` / `service_role` roles, and the `supabase_realtime`
publication — so the schema can be exercised exactly as written.

```bash
export PGROOT=/var/tmp/runsheet-pg
rm -rf "$PGROOT" && mkdir -p "$PGROOT" && chown postgres:postgres "$PGROOT" && chmod 700 "$PGROOT"
su postgres -c "initdb -D $PGROOT/data -U postgres --auth=trust"
su postgres -c "pg_ctl -D $PGROOT/data -o '-p 5439 -k $PGROOT' -l $PGROOT/log start"

psql -h "$PGROOT" -p 5439 -U postgres -v ON_ERROR_STOP=1 \
  -f supabase/tests/local-shim.sql -f supabase/schema.sql
psql -h "$PGROOT" -p 5439 -U postgres -f supabase/tests/rls.sql
psql -h "$PGROOT" -p 5439 -U postgres -f supabase/tests/paywall.sql
```

Both scripts print their expectations inline; the `ERROR:` lines in the output
are the point — they are the refusals being demonstrated. What to look for:

**rls.sql** — a stranger sees 0 households, 0 items and 0 members, and is
refused inserts into both `items` and `members`.

**paywall.sql** — a second person joining a free household is refused and
takes no seat; lowercase and padded invite codes reach the same refusal rather
than a lookup miss; a member cannot set `plan`, `billing_ref` or
`invite_code`, but can rename the house; the service role flips the plan; two
more people then join a Pro household; leaving removes only your own row.
