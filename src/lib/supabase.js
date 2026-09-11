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
