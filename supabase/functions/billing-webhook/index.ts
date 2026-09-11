// Lemon Squeezy billing webhook.
//
// This function is the ONLY thing allowed to set households.plan = 'pro'. It
// runs on the service-role key, which never reaches the browser, and the
// guard_household_billing trigger in schema.sql refuses the write to anyone
// else. Deploy it with:
//
//   supabase functions deploy billing-webhook --no-verify-jwt
//   supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=... \
//     SUPABASE_SERVICE_ROLE_KEY=...
//
// --no-verify-jwt is required: the caller is Lemon Squeezy, not a signed-in
// user. The HMAC signature below is what authenticates the request, so it is
// checked before anything else happens.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { planFromEvent, verifySignature } from './verify.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const signingSecret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET') ?? ''

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  if (!signingSecret || !serviceRoleKey || !supabaseUrl) {
    console.error('billing-webhook is missing its secrets; refusing to run')
    return new Response('Not configured', { status: 500 })
  }

  // The signature covers the exact bytes sent, so verify before parsing.
  const rawBody = await request.text()
  const signature = request.headers.get('x-signature')
  if (!(await verifySignature(rawBody, signature, signingSecret))) {
    return new Response('Bad signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad payload', { status: 400 })
  }

  const change = planFromEvent(payload)
  if (!change) {
    // Acknowledge events that say nothing about entitlement, so Lemon Squeezy
    // does not retry them forever.
    return new Response('Ignored', { status: 200 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error } = await supabase
    .from('households')
    .update({
      plan: change.plan,
      billing_ref: change.billingRef,
      renews_at: change.renewsAt,
    })
    .eq('id', change.householdId)

  if (error) {
    // A non-2xx makes Lemon Squeezy retry, which is what we want for a
    // transient database problem.
    console.error('plan update failed', change.eventName, error.message)
    return new Response('Update failed', { status: 500 })
  }

  console.log(`${change.eventName}: household ${change.householdId} -> ${change.plan}`)
  return new Response('OK', { status: 200 })
})
