import { createClient } from '@supabase/supabase-js'

// Vite bakes these in at build time, so they must be set on the host before
// the first build. Both are public values; the service-role key never comes
// anywhere near the browser.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// Null when unconfigured: the app is a complete local-only product without a
// backend, and nothing in the UI may assume otherwise.
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const checkoutUrl = import.meta.env.VITE_CHECKOUT_URL || ''

// Cancelling has to be as easy as signing up (US click-to-cancel / ROSCA
// rules apply whoever the merchant of record is), so the portal link is a
// first-class part of the account panel, not something to email support for.
export const billingPortalUrl = import.meta.env.VITE_BILLING_PORTAL_URL || ''

// The webhook needs to know which household a payment belongs to, so it rides
// through checkout as custom data rather than being inferred afterwards.
export function checkoutLinkFor(household, email) {
  if (!checkoutUrl || !household?.id) return ''
  const url = new URL(checkoutUrl)
  url.searchParams.set('checkout[custom][household_id]', household.id)
  if (email) url.searchParams.set('checkout[email]', email)
  return url.toString()
}
