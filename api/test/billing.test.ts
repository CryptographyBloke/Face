import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken } from '../src/auth'
import { verifyStripeSignature } from '../src/billing'
import { hmacSha256, toHex } from '../src/crypto'
import { call, createEnv, mockFetch } from './helpers'

const wallet = privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123')
const address = wallet.address.toLowerCase()
const webhookSecret = 'whsec_test_secret'

const stripeEnv = () =>
  createEnv({
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_PRICE_PRO: 'price_pro',
    STRIPE_PRICE_BUSINESS: 'price_business',
  })

afterEach(() => vi.unstubAllGlobals())

async function signedEvent(event: unknown, timestamp = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(event)
  const signature = toHex(await hmacSha256(webhookSecret, `${timestamp}.${payload}`))
  return { method: 'POST', body: payload, headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` } }
}

function planOf(env: ReturnType<typeof createEnv>) {
  return env.DB.raw.prepare('SELECT plan, subscription_status FROM accounts WHERE address = ?').get(address) as
    | { plan: string; subscription_status: string | null }
    | undefined
}

describe('Stripe webhook', () => {
  it('verifies signatures and rejects stale or forged ones', async () => {
    const payload = '{"id":"evt"}'
    const t = 1_900_000_000
    const good = toHex(await hmacSha256(webhookSecret, `${t}.${payload}`))
    expect(await verifyStripeSignature(webhookSecret, payload, `t=${t},v1=${good}`, t + 10)).toBe(true)
    expect(await verifyStripeSignature(webhookSecret, payload, `t=${t},v1=${good}`, t + 1000)).toBe(false)
    expect(await verifyStripeSignature(webhookSecret, payload + ' ', `t=${t},v1=${good}`, t)).toBe(false)
    expect(await verifyStripeSignature(webhookSecret, payload, null, t)).toBe(false)

    const response = await call(stripeEnv(), '/v1/billing/webhook', {
      method: 'POST',
      body: payload,
      headers: { 'Stripe-Signature': `t=${t},v1=${good}` },
    })
    expect(response.status).toBe(400)
  })

  it('upgrades on checkout and follows subscription lifecycle', async () => {
    const env = stripeEnv()
    await call(
      env,
      '/v1/billing/webhook',
      await signedEvent({
        type: 'checkout.session.completed',
        data: { object: { client_reference_id: address, customer: 'cus_1', subscription: 'sub_1', metadata: { address, plan: 'pro' } } },
      }),
    )
    expect(planOf(env)).toEqual({ plan: 'pro', subscription_status: 'active' })

    const subscription = (id: string, price: string, status: string) => ({
      id,
      customer: 'cus_1',
      status,
      metadata: { address, plan: 'pro' },
      items: { data: [{ price: { id: price }, current_period_end: 2_000_000_000 }] },
    })

    await call(env, '/v1/billing/webhook', await signedEvent({ type: 'customer.subscription.updated', data: { object: subscription('sub_1', 'price_business', 'active') } }))
    expect(planOf(env)?.plan).toBe('business')

    await call(env, '/v1/billing/webhook', await signedEvent({ type: 'customer.subscription.updated', data: { object: subscription('sub_1', 'price_business', 'unpaid') } }))
    expect(planOf(env)).toEqual({ plan: 'free', subscription_status: 'unpaid' })

    // A new subscription replaces the old one; deleting the old one must not downgrade.
    await call(env, '/v1/billing/webhook', await signedEvent({ type: 'customer.subscription.created', data: { object: subscription('sub_2', 'price_pro', 'active') } }))
    await call(env, '/v1/billing/webhook', await signedEvent({ type: 'customer.subscription.deleted', data: { object: subscription('sub_1', 'price_business', 'canceled') } }))
    expect(planOf(env)?.plan).toBe('pro')

    await call(env, '/v1/billing/webhook', await signedEvent({ type: 'customer.subscription.deleted', data: { object: subscription('sub_2', 'price_pro', 'canceled') } }))
    expect(planOf(env)).toEqual({ plan: 'free', subscription_status: 'canceled' })
  })
})

describe('checkout', () => {
  it('creates a subscription checkout session tied to the wallet', async () => {
    const calls = mockFetch((request) =>
      request.url === 'https://api.stripe.com/v1/checkout/sessions'
        ? Response.json({ url: 'https://checkout.stripe.test/s/1' })
        : undefined,
    )
    const env = stripeEnv()
    const token = await createSessionToken(env.SESSION_SECRET!, wallet.address, Math.floor(Date.now() / 1000) + 60)
    const response = await call(env, '/v1/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: 'pro' }),
    })
    expect(await response.json()).toEqual({ url: 'https://checkout.stripe.test/s/1' })

    const params = new URLSearchParams(await calls[0].text())
    expect(calls[0].headers.get('Authorization')).toBe('Bearer sk_test_123')
    expect(params.get('mode')).toBe('subscription')
    expect(params.get('line_items[0][price]')).toBe('price_pro')
    expect(params.get('client_reference_id')).toBe(address)
    expect(params.get('subscription_data[metadata][address]')).toBe(address)
    expect(params.get('success_url')).toBe('https://app.example.com/#/dashboard?checkout=success')
  })

  it('explains that payments are off when Stripe is not configured', async () => {
    const env = createEnv()
    const token = await createSessionToken(env.SESSION_SECRET!, wallet.address, Math.floor(Date.now() / 1000) + 60)
    const response = await call(env, '/v1/billing/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan: 'pro' }),
    })
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('billing_unavailable')
  })
})
