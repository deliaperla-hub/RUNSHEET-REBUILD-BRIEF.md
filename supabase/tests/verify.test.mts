import { planFromEvent, timingSafeEqual, verifySignature } from
  '../functions/billing-webhook/verify.ts'

const SECRET = 'whsec_test_secret'
const HH = '037f342a-76f8-48b3-92b9-b01eccff380b'

async function sign(body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
  return [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
}

let failures = 0
function check(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failures += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`)
}

// --- signature verification ------------------------------------------------
const body = JSON.stringify({ meta: { event_name: 'order_created' } })
const good = await sign(body)

check('valid signature accepted', await verifySignature(body, good, SECRET), true)
check('tampered body rejected', await verifySignature(body + ' ', good, SECRET), false)
check('wrong secret rejected', await verifySignature(body, await sign(body, 'other'), SECRET), false)
check('missing header rejected', await verifySignature(body, null, SECRET), false)
check('empty header rejected', await verifySignature(body, '', SECRET), false)
check('non-hex header rejected', await verifySignature(body, 'not-a-signature', SECRET), false)
check('odd-length hex rejected', await verifySignature(body, good.slice(0, -1), SECRET), false)
check('truncated signature rejected', await verifySignature(body, good.slice(0, 32), SECRET), false)
check('uppercase hex accepted', await verifySignature(body, good.toUpperCase(), SECRET), true)
check('empty secret rejected', await verifySignature(body, good, ''), false)
check('flipped bit rejected', await verifySignature(body,
  good.slice(0, -1) + (good.at(-1) === 'a' ? 'b' : 'a'), SECRET), false)

check('timingSafeEqual same', timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true)
check('timingSafeEqual diff', timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false)
check('timingSafeEqual length', timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false)

// --- event interpretation --------------------------------------------------
const ev = (event_name: string, attributes: Record<string, unknown> = {}, custom: unknown = { household_id: HH }, id = '99') => ({
  meta: { event_name, custom_data: custom },
  data: { id, attributes },
})

check('order_created -> pro',
  planFromEvent(ev('order_created', { renews_at: '2026-10-11T00:00:00Z' }))?.plan, 'pro')
check('order_created carries billing ref',
  planFromEvent(ev('order_created'))?.billingRef, '99')
check('refunded order -> free',
  planFromEvent(ev('order_created', { refunded: true }))?.plan, 'free')
check('order_refunded -> free', planFromEvent(ev('order_refunded'))?.plan, 'free')
check('subscription active -> pro',
  planFromEvent(ev('subscription_created', { status: 'active' }))?.plan, 'pro')
check('on_trial -> pro',
  planFromEvent(ev('subscription_updated', { status: 'on_trial' }))?.plan, 'pro')
check('cancelled but not yet ended -> still pro',
  planFromEvent(ev('subscription_updated', { status: 'cancelled', ends_at: '2026-10-11T00:00:00Z' }))?.plan, 'pro')
check('expired -> free',
  planFromEvent(ev('subscription_expired', { status: 'expired' }))?.plan, 'free')
check('unpaid -> free',
  planFromEvent(ev('subscription_updated', { status: 'unpaid' }))?.plan, 'free')
check('downgrade clears renews_at',
  planFromEvent(ev('subscription_expired', { status: 'expired', ends_at: '2026-10-11T00:00:00Z' }))?.renewsAt, null)
check('payment events ignored',
  planFromEvent(ev('subscription_payment_success', { status: 'paid' })), null)

// --- payloads that must never move a plan ----------------------------------
check('missing household_id ignored', planFromEvent(ev('order_created', {}, {})), null)
check('non-uuid household_id ignored',
  planFromEvent(ev('order_created', {}, { household_id: 'all' })), null)
check('sql-ish household_id ignored',
  planFromEvent(ev('order_created', {}, { household_id: "' or '1'='1" })), null)
check('unknown event ignored', planFromEvent(ev('license_key_created')), null)
check('no event name ignored', planFromEvent({ data: {} }), null)
check('subscription without status ignored',
  planFromEvent(ev('subscription_updated', {})), null)
check('garbage ignored', planFromEvent('nope'), null)
check('null ignored', planFromEvent(null), null)

console.log(failures === 0 ? '\nall webhook checks passed' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
