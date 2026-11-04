import type { Address } from 'viem'
import { randomToken, sha256Hex } from './crypto'
import type { D1Database } from './env'
import { currentPeriod, isPlanId, plans, type PlanId } from './plans'

export interface Account {
  address: string
  plan: PlanId
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  current_period_end: number | null
  created_at: number
}

export interface ApiKeyOwner {
  address: string
  plan: PlanId
  prefix: string
}

export const apiKeyPattern = /^wf_live_[0-9A-Za-z]{32}$/

export async function ensureAccount(db: D1Database, address: Address, now = Math.floor(Date.now() / 1000)) {
  const id = address.toLowerCase()
  await db
    .prepare('INSERT INTO accounts (address, plan, created_at) VALUES (?, ?, ?) ON CONFLICT(address) DO NOTHING')
    .bind(id, 'free', now)
    .run()
  return (await getAccount(db, id))!
}

export async function getAccount(db: D1Database, address: string) {
  const row = await db.prepare('SELECT * FROM accounts WHERE address = ?').bind(address.toLowerCase()).first<Account>()
  if (row && !isPlanId(row.plan)) row.plan = 'free'
  return row
}

export async function activeKeyPrefix(db: D1Database, address: string) {
  const row = await db
    .prepare('SELECT prefix, created_at FROM api_keys WHERE address = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1')
    .bind(address.toLowerCase())
    .first<{ prefix: string; created_at: number }>()
  return row ? { prefix: row.prefix, createdAt: row.created_at } : null
}

/** Revoke any existing key and issue a new one. The plaintext key is returned once. */
export async function rotateApiKey(db: D1Database, address: Address, now = Math.floor(Date.now() / 1000)) {
  const id = address.toLowerCase()
  const key = `wf_live_${randomToken(32)}`
  const prefix = `${key.slice(0, 12)}…${key.slice(-4)}`
  await db.batch([
    db.prepare('UPDATE api_keys SET revoked_at = ? WHERE address = ? AND revoked_at IS NULL').bind(now, id),
    db
      .prepare('INSERT INTO api_keys (key_hash, address, prefix, created_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(key), id, prefix, now),
  ])
  return { key, prefix, createdAt: now }
}

export async function findApiKey(db: D1Database, key: string): Promise<ApiKeyOwner | null> {
  if (!apiKeyPattern.test(key)) return null
  const row = await db
    .prepare(
      `SELECT k.address AS address, k.prefix AS prefix, a.plan AS plan
       FROM api_keys k JOIN accounts a ON a.address = k.address
       WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
    )
    .bind(await sha256Hex(key))
    .first<ApiKeyOwner>()
  if (!row) return null
  return { ...row, plan: isPlanId(row.plan) ? row.plan : 'free' }
}

export async function getUsage(db: D1Database, address: string, period = currentPeriod()) {
  const row = await db
    .prepare('SELECT count FROM usage WHERE address = ? AND period = ?')
    .bind(address.toLowerCase(), period)
    .first<{ count: number }>()
  return row?.count ?? 0
}

export async function addUsage(db: D1Database, address: string, amount: number, period = currentPeriod()) {
  await db
    .prepare(
      `INSERT INTO usage (address, period, count) VALUES (?, ?, ?)
       ON CONFLICT(address, period) DO UPDATE SET count = count + excluded.count`,
    )
    .bind(address.toLowerCase(), period, amount)
    .run()
}

export async function usageHistory(db: D1Database, address: string, months = 6) {
  const { results } = await db
    .prepare('SELECT period, count FROM usage WHERE address = ? ORDER BY period DESC LIMIT ?')
    .bind(address.toLowerCase(), months)
    .all<{ period: string; count: number }>()
  return results
}

export function accountSummary(account: Account, usage: number, key: { prefix: string; createdAt: number } | null) {
  const plan = plans[account.plan]
  return {
    address: account.address,
    plan: plan.id,
    limits: { monthlyRequests: plan.monthlyRequests, batchSize: plan.batchSize },
    usage: { period: currentPeriod(), requests: usage },
    apiKey: key,
    subscription: account.stripe_subscription_id
      ? { status: account.subscription_status, currentPeriodEnd: account.current_period_end }
      : null,
    createdAt: account.created_at,
  }
}
