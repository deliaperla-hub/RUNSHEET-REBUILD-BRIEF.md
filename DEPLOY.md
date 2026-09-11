# Deploying Runsheet

Nothing here is required to *run* Runsheet. With no environment variables set
it builds as a complete local-only product — one device, no sign-in, no
backend, every feature including meds. Do this only when you want sync,
multiple household members, and billing.

## 1. Supabase

1. Create a project.
2. Run `supabase/schema.sql` in the SQL editor. It is re-runnable, so applying
   it again after a change is safe.
3. Enable email auth (magic link / OTP).
4. Add both the dev and prod URLs to the auth redirect allow-list —
   `http://localhost:5173` and your deployed origin. A missing redirect URL is
   the usual reason a sign-in link lands on an error page.
5. Confirm realtime is on for `public.items`. `schema.sql` adds it to the
   `supabase_realtime` publication; without it, edits sync on reload but not
   live.

Before going further, run the backend tests against a throwaway Postgres —
see `supabase/tests/README.md`. They check that a stranger sees nothing, that
a second person cannot take a seat in a free household, and that a member
cannot promote their own household to Pro.

## 2. Billing

1. Create the Pro product in Lemon Squeezy (or Stripe). Price it **per
   household**, not per seat.
2. Deploy the webhook:

   ```bash
   supabase functions deploy billing-webhook --no-verify-jwt
   supabase secrets set \
     LEMONSQUEEZY_WEBHOOK_SECRET=whsec_... \
     SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

   `--no-verify-jwt` is deliberate: the caller is the payment provider, not a
   signed-in user. The HMAC signature is what authenticates the request, and
   it is checked against the raw bytes before the body is parsed.

3. Point the provider's webhook at the function URL and subscribe to at least
   `order_created`, `order_refunded`, `subscription_created`,
   `subscription_updated` and `subscription_expired`.

4. The service role key must only ever exist as a function secret. If it
   reaches a `VITE_` variable it is in the browser bundle and the paywall is
   over.

## 3. The front end

Set these on the host **before the first build** — Vite bakes them into the
bundle at build time, so adding them afterwards does nothing until you
rebuild:

| Variable                  | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `VITE_SUPABASE_URL`       | Project URL                                      |
| `VITE_SUPABASE_ANON_KEY`  | Anon (public) key                                |
| `VITE_CHECKOUT_URL`       | Hosted checkout link for Pro                     |
| `VITE_BILLING_PORTAL_URL` | Subscription management / cancellation portal    |

Then:

```bash
npm ci
npm test
npm run build
```

Deploy `dist/` to Netlify, Vercel or Cloudflare Pages as a static site. There
is no server-side routing, so no rewrite rules are needed.

## Before charging real people

Two things flagged during the original build, neither of them technical:

- **Cancellation has to be as easy as sign-up.** US click-to-cancel / ROSCA
  rules apply regardless of who the merchant of record is. That is why
  `VITE_BILLING_PORTAL_URL` puts a cancel link directly in the account panel,
  and why it should stay there.
- **A merchant of record like Lemon Squeezy handles tax remittance, not your
  terms of service.** Get a professional to review the terms and the privacy
  policy before taking money.

And one product rule that is not negotiable: meds tracking is free on every
plan. It is a trust feature. Nothing in `MedsView` may ever sit behind a plan
check.
