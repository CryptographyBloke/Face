import type { Address } from 'viem'
import { API_URL } from './config'
import type { AppWalletClient } from './wallet'

export type PlanId = 'free' | 'pro' | 'business'

export interface AvatarRecord {
  address: Address
  ens: string | null
  avatar: { uri: string; url: string; gateways: string[]; source: 'snapshot' | 'ens' } | null
}

export interface Plan {
  id: PlanId
  name: string
  priceUsd: number
  monthlyRequests: number
  batchSize: number
  features: string[]
}

export interface AccountSummary {
  address: string
  plan: PlanId
  limits: { monthlyRequests: number; batchSize: number }
  usage: { period: string; requests: number }
  apiKey: { prefix: string; createdAt: number } | null
  subscription: { status: string | null; currentPeriodEnd: number | null } | null
  history: Array<{ period: string; count: number }>
  billing: boolean
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Mirrors api/src/plans.ts so pricing renders even if the API is down. */
export const fallbackPlans: Plan[] = [
  { id: 'free', name: 'Free', priceUsd: 0, monthlyRequests: 10_000, batchSize: 25, features: [] },
  { id: 'pro', name: 'Pro', priceUsd: 19, monthlyRequests: 1_000_000, batchSize: 100, features: [] },
  { id: 'business', name: 'Business', priceUsd: 99, monthlyRequests: 10_000_000, batchSize: 500, features: [] },
]

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'network_error', 'The Wallet Face API could not be reached.')
  }
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  if (!response.ok) {
    throw new ApiError(response.status, body.error?.code || 'http_error', body.error?.message || `HTTP ${response.status}`)
  }
  return body as T
}

export const api = {
  avatar: (id: string) => request<AvatarRecord>(`/v1/avatar/${encodeURIComponent(id)}`),
  plans: () => request<{ plans: Plan[]; billing: boolean }>('/v1/plans'),
  account: (token: string) => request<AccountSummary>('/v1/account', {}, token),
  createKey: (token: string) =>
    request<{ key: string; prefix: string; createdAt: number }>('/v1/account/keys', { method: 'POST' }, token),
  checkout: (token: string, plan: PlanId) =>
    request<{ url: string }>('/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) }, token),
  portal: (token: string) => request<{ url: string }>('/v1/billing/portal', { method: 'POST' }, token),
}

export interface Session {
  token: string
  address: string
  expiresAt: number
}

const sessionKey = 'wallet-face-session'

export function loadSession(address?: string): Session | null {
  try {
    const session = JSON.parse(window.localStorage.getItem(sessionKey) || 'null') as Session | null
    if (!session || session.expiresAt * 1000 < Date.now()) return null
    if (address && session.address.toLowerCase() !== address.toLowerCase()) return null
    return session
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(sessionKey)
  } catch {
    // Nothing to clear.
  }
}

export async function signIn(walletClient: AppWalletClient, address: Address): Promise<Session> {
  const challenge = await request<{ nonce: string; message: string }>(
    `/v1/auth/nonce?address=${encodeURIComponent(address)}`,
  )
  const signature = await walletClient.signMessage({ account: address, message: challenge.message })
  const session = await request<Session>('/v1/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address, nonce: challenge.nonce, signature }),
  })
  try {
    window.localStorage.setItem(sessionKey, JSON.stringify(session))
  } catch {
    // The session still works for this page view.
  }
  return session
}
