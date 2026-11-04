import type { Address } from 'viem'
import { ensureAccount, getAccount } from './accounts'
import { requireDb } from './auth'
import { hmacSha256, safeEqual, toHex } from './crypto'
import type { Env } from './env'
import { HttpError } from './http'
import type { PlanId } from './plans'

const stripeApi = 'https://api.stripe.com/v1'
const webhookToleranceSeconds = 300
const paidStatuses = new Set(['active', 'trialing', 'past_due'])

export function billingEnabled(env: Env) {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && (env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_BUSINESS))
}

function requireStripe(env: Env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HttpError(503, 'billing_unavailable', 'Online payments are not enabled yet. Please contact us to upgrade.')
  }
  return env.STRIPE_SECRET_KEY
}

function priceFor(env: Env, plan: PlanId) {
  const price = plan === 'pro' ? env.STRIPE_PRICE_PRO : plan === 'business' ? env.STRIPE_PRICE_BUSINESS : undefined
  if (!price) throw new HttpError(400, 'plan_unavailable', `The ${plan} plan cannot be purchased online.`)
  return price
}

export function planForPrice(env: Env, priceId: unknown): PlanId | null {
  if (typeof priceId !== 'string') return null
  if (priceId && priceId === env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return 'business'
  return null
}

async function stripe<T>(env: Env, path: string, params: Record<string, string>) {
  const response = await fetch(`${stripeApi}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireStripe(env)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) {
    console.error('Stripe error', response.status, body.error?.message)
    throw new HttpError(502, 'billing_error', 'The payment provider rejected the request. Please try again.')
  }
  return body
}

function appUrl(env: Env) {
  return (env.APP_URL || 'https://dao.sarl').replace(/\/$/, '')
}

export async function createCheckout(env: Env, address: Address, plan: PlanId) {
  requireStripe(env)
  if (plan === 'free') throw new HttpError(400, 'invalid_plan', 'Choose a paid plan to upgrade.')
  const db = requireDb(env)
  const account = await ensureAccount(db, address)

  // Existing subscribers change plans in the Stripe portal, which prorates.
  if (account.stripe_customer_id && account.stripe_subscription_id && paidStatuses.has(account.subscription_status || '')) {
    return createPortal(env, address)
  }

  const params: Record<string, string> = {
    mode: 'subscription',
    'line_items[0][price]': priceFor(env, plan),
    'line_items[0][quantity]': '1',
    success_url: `${appUrl(env)}/#/dashboard?checkout=success`,
    cancel_url: `${appUrl(env)}/#/pricing?checkout=cancelled`,
    client_reference_id: account.address,
    allow_promotion_codes: 'true',
    'metadata[address]': account.address,
    'metadata[plan]': plan,
    'subscription_data[metadata][address]': account.address,
    'subscription_data[metadata][plan]': plan,
  }
  if (account.stripe_customer_id) params.customer = account.stripe_customer_id

  const session = await stripe<{ url?: string }>(env, '/checkout/sessions', params)
  if (!session.url) throw new HttpError(502, 'billing_error', 'Checkout could not be started.')
  return { url: session.url }
}

export async function createPortal(env: Env, address: Address) {
  requireStripe(env)
  const account = await getAccount(requireDb(env), address)
  if (!account?.stripe_customer_id) {
    throw new HttpError(400, 'no_subscription', 'This account has no billing history yet.')
  }
  const session = await stripe<{ url?: string }>(env, '/billing_portal/sessions', {
    customer: account.stripe_customer_id,
    return_url: `${appUrl(env)}/#/dashboard`,
  })
  if (!session.url) throw new HttpError(502, 'billing_error', 'The billing portal could not be opened.')
  return { url: session.url }
}

export async function verifyStripeSignature(
  secret: string,
  payload: string,
  header: string | null,
  now = Math.floor(Date.now() / 1000),
) {
  if (!header) return false
  const parts = header.split(',').map((part) => part.trim().split('='))
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value || '')
  if (!Number.isFinite(timestamp) || !signatures.length) return false
  if (Math.abs(now - timestamp) > webhookToleranceSeconds) return false
  const expected = toHex(await hmacSha256(secret, `${timestamp}.${payload}`))
  return signatures.some((signature) => safeEqual(signature, expected))
}

interface StripeSubscription {
  id: string
  customer?: string
  status?: string
  current_period_end?: number
  metadata?: Record<string, string>
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> }
}

interface StripeCheckoutSession {
  client_reference_id?: string | null
  customer?: string | null
  subscription?: string | null
  metadata?: Record<string, string>
}

export async function handleStripeWebhook(env: Env, request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new HttpError(503, 'billing_unavailable', 'Webhooks are not configured.')
  const payload = await request.text()
  const valid = await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, payload, request.headers.get('Stripe-Signature'))
  if (!valid) throw new HttpError(400, 'invalid_signature', 'Invalid Stripe signature.')

  const event = JSON.parse(payload) as { type?: string; data?: { object?: unknown } }
  const db = requireDb(env)
  const now = Math.floor(Date.now() / 1000)

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object as StripeCheckoutSession
    const address = (session.metadata?.address || session.client_reference_id || '').toLowerCase()
    const plan = session.metadata?.plan
    if (/^0x[0-9a-f]{40}$/.test(address) && (plan === 'pro' || plan === 'business')) {
      await db
        .prepare('INSERT INTO accounts (address, plan, created_at) VALUES (?, ?, ?) ON CONFLICT(address) DO NOTHING')
        .bind(address, 'free', now)
        .run()
      await db
        .prepare(
          `UPDATE accounts SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ?,
             subscription_status = COALESCE(subscription_status, 'active')
           WHERE address = ?`,
        )
        .bind(plan, session.customer || null, session.subscription || null, address)
        .run()
    }
  } else if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const subscription = event.data?.object as StripeSubscription
    const item = subscription.items?.data?.[0]
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status || 'incomplete'
    const metadataPlan = subscription.metadata?.plan
    const pricedPlan =
      planForPrice(env, item?.price?.id) ?? (metadataPlan === 'pro' || metadataPlan === 'business' ? metadataPlan : null)
    const plan: PlanId = paidStatuses.has(status) && pricedPlan ? pricedPlan : 'free'
    const periodEnd = item?.current_period_end ?? subscription.current_period_end ?? null
    const address = (subscription.metadata?.address || '').toLowerCase()

    // Deletions only ever touch the account still pointing at that subscription,
    // so cancelling an old subscription cannot downgrade a newer one.
    if (event.type !== 'customer.subscription.deleted' && /^0x[0-9a-f]{40}$/.test(address)) {
      await db
        .prepare('INSERT INTO accounts (address, plan, created_at) VALUES (?, ?, ?) ON CONFLICT(address) DO NOTHING')
        .bind(address, 'free', now)
        .run()
      await db
        .prepare(
          `UPDATE accounts SET plan = ?, subscription_status = ?, current_period_end = ?,
             stripe_subscription_id = ?, stripe_customer_id = COALESCE(?, stripe_customer_id)
           WHERE address = ?`,
        )
        .bind(plan, status, periodEnd, subscription.id, subscription.customer || null, address)
        .run()
    } else {
      await db
        .prepare(
          'UPDATE accounts SET plan = ?, subscription_status = ?, current_period_end = ? WHERE stripe_subscription_id = ?',
        )
        .bind(plan, status, periodEnd, subscription.id)
        .run()
    }
  }

  return { received: true }
}
