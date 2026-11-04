/**
 * Minimal structural types for the Cloudflare bindings this worker uses.
 * Declaring them here (instead of relying on global workers-types) keeps the
 * code testable in plain Node with in-memory stand-ins.
 */

export interface D1Result<T = unknown> {
  results: T[]
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<unknown>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export interface Env {
  DB?: D1Database
  RATE_LIMITER?: RateLimiter

  APP_URL?: string
  SNAPSHOT_HUB_URL?: string
  ETH_RPC_URL?: string
  IPFS_GATEWAYS?: string
  ARWEAVE_GATEWAY?: string

  SESSION_SECRET?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRICE_PRO?: string
  STRIPE_PRICE_BUSINESS?: string
}
