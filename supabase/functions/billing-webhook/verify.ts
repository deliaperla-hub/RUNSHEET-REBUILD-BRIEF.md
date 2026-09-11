// Signature verification and event interpretation for the billing webhook.
//
// Deliberately dependency-free and side-effect-free: this is the security
// boundary of the whole paywall, so it runs the same under Deno on the edge
// and under Node in a test, with nothing to mock.

export interface PlanChange {
  householdId: string
  plan: 'free' | 'pro'
  billingRef: string | null
  renewsAt: string | null
  eventName: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.trim().toLowerCase()
  if (clean.length === 0 || clean.length % 2 !== 0 || /[^0-9a-f]/.test(clean)) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

// Constant time over the compared bytes. Length is compared first and does
// leak, which is fine: the digest length is a published constant.
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!secret) return false
  const provided = signatureHeader ? hexToBytes(signatureHeader) : null
  if (!provided) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  )
  return timingSafeEqual(digest, provided)
}

// Lemon Squeezy statuses that still entitle the household to Pro.
//
// `cancelled` is in the list on purpose: in Lemon Squeezy it means "will not
// renew", not "access revoked". Someone who cancels keeps what they paid for
// until the period actually ends, which arrives separately as
// subscription_expired.
const ENTITLED = new Set(['active', 'on_trial', 'cancelled'])

/**
 * Read a Lemon Squeezy webhook payload and decide what the household's plan
 * should now be. Returns null for events that say nothing about entitlement.
 */
export function planFromEvent(payload: unknown): PlanChange | null {
  if (!payload || typeof payload !== 'object') return null
  const body = payload as Record<string, any>

  const eventName: string = body.meta?.event_name ?? ''
  if (!eventName) return null

  // The household rides through checkout as custom data, so the webhook never
  // has to guess which household a payment belongs to.
  const householdId: string = String(body.meta?.custom_data?.household_id ?? '')
  if (!UUID_RE.test(householdId)) return null

  const attributes = body.data?.attributes ?? {}
  const billingRef = body.data?.id != null ? String(body.data.id) : null
  const renewsAt: string | null = attributes.renews_at ?? attributes.ends_at ?? null

  if (eventName === 'order_created') {
    // A refunded order is not a sale.
    if (attributes.refunded === true) {
      return { householdId, plan: 'free', billingRef, renewsAt: null, eventName }
    }
    return { householdId, plan: 'pro', billingRef, renewsAt, eventName }
  }

  if (eventName === 'order_refunded') {
    return { householdId, plan: 'free', billingRef, renewsAt: null, eventName }
  }

  if (eventName.startsWith('subscription_payment_')) {
    // Payment-level events carry their own ids; entitlement is driven by the
    // subscription events instead, so these are acknowledged and ignored.
    return null
  }

  if (eventName.startsWith('subscription_')) {
    const status: string = String(attributes.status ?? '')
    if (!status) return null
    return {
      householdId,
      plan: ENTITLED.has(status) ? 'pro' : 'free',
      billingRef,
      renewsAt: ENTITLED.has(status) ? renewsAt : null,
      eventName,
    }
  }

  return null
}
