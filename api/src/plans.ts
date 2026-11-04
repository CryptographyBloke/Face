export type PlanId = 'free' | 'pro' | 'business'

export interface Plan {
  id: PlanId
  name: string
  /** Monthly price in USD. */
  priceUsd: number
  /** Keyed requests included per calendar month (UTC). */
  monthlyRequests: number
  /** Maximum addresses per batch request. */
  batchSize: number
  features: string[]
}

export const plans: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsd: 0,
    monthlyRequests: 10_000,
    batchSize: 25,
    features: ['Avatar JSON + image endpoints', 'Batch lookups up to 25', 'Community support'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsd: 19,
    monthlyRequests: 1_000_000,
    batchSize: 100,
    features: ['1M requests / month', 'Batch lookups up to 100', 'Email support'],
  },
  business: {
    id: 'business',
    name: 'Business',
    priceUsd: 99,
    monthlyRequests: 10_000_000,
    batchSize: 500,
    features: [
      '10M requests / month',
      'Batch lookups up to 500',
      'Priority support',
      'White-label deployment help',
    ],
  },
}

/** Anonymous callers (no API key) are limited per IP by the rate limiter. */
export const anonymousLimits = {
  batchSize: 0,
}

export function isPlanId(value: unknown): value is PlanId {
  return value === 'free' || value === 'pro' || value === 'business'
}

export function currentPeriod(now = new Date()) {
  return now.toISOString().slice(0, 7)
}
