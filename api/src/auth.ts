import { createPublicClient, getAddress, http, isAddress, verifyMessage, type Address, type Hex } from 'viem'
import { mainnet } from 'viem/chains'
import { base64url, fromBase64url, hmacSha256, randomToken, safeEqual } from './crypto'
import type { D1Database, Env } from './env'
import { HttpError, bearerToken } from './http'

const nonceTtlSeconds = 10 * 60
const sessionTtlSeconds = 7 * 24 * 60 * 60

export function requireDb(env: Env): D1Database {
  if (!env.DB) throw new HttpError(503, 'storage_unavailable', 'Account storage is not configured.')
  return env.DB
}

function requireSecret(env: Env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) {
    throw new HttpError(503, 'auth_unavailable', 'Wallet sign-in is not configured on this server.')
  }
  return env.SESSION_SECRET
}

export function parseAddress(value: unknown): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new HttpError(400, 'invalid_address', 'A valid 0x wallet address is required.')
  }
  return getAddress(value)
}

export function signInMessage(env: Env, address: Address, nonce: string, issuedAt: number) {
  const appUrl = env.APP_URL || 'https://dao.sarl'
  const domain = new URL(appUrl).host
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to the Wallet Face developer dashboard. This does not send a transaction or cost gas.',
    '',
    `URI: ${appUrl}`,
    'Version: 1',
    'Chain ID: 1',
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt * 1000).toISOString()}`,
  ].join('\n')
}

export async function createChallenge(env: Env, rawAddress: unknown, now = Math.floor(Date.now() / 1000)) {
  requireSecret(env)
  const db = requireDb(env)
  const address = parseAddress(rawAddress)
  const nonce = randomToken(16)
  await db.batch([
    db.prepare('DELETE FROM nonces WHERE expires_at < ?').bind(now),
    db
      .prepare('INSERT INTO nonces (nonce, address, expires_at) VALUES (?, ?, ?)')
      .bind(nonce, address.toLowerCase(), now + nonceTtlSeconds),
  ])
  return { address, nonce, message: signInMessage(env, address, nonce, now) }
}

async function signatureMatches(env: Env, address: Address, message: string, signature: Hex) {
  try {
    if (await verifyMessage({ address, message, signature })) return true
  } catch {
    // Not an ECDSA signature; may be a smart-contract wallet.
  }
  if (!env.ETH_RPC_URL) return false
  try {
    const client = createPublicClient({ chain: mainnet, transport: http(env.ETH_RPC_URL, { timeout: 8000 }) })
    return await client.verifyMessage({ address, message, signature })
  } catch {
    return false
  }
}

export async function verifyChallenge(
  env: Env,
  input: { address?: unknown; nonce?: unknown; signature?: unknown },
  now = Math.floor(Date.now() / 1000),
) {
  const secret = requireSecret(env)
  const db = requireDb(env)
  const address = parseAddress(input.address)
  if (typeof input.nonce !== 'string' || typeof input.signature !== 'string' || !/^0x[0-9a-f]+$/i.test(input.signature)) {
    throw new HttpError(400, 'invalid_request', 'nonce and signature are required.')
  }

  const row = await db
    .prepare('SELECT address, expires_at FROM nonces WHERE nonce = ?')
    .bind(input.nonce)
    .first<{ address: string; expires_at: number }>()
  // Nonces are single use, whether or not the signature turns out valid.
  await db.prepare('DELETE FROM nonces WHERE nonce = ?').bind(input.nonce).run()

  if (!row || row.address !== address.toLowerCase() || row.expires_at < now) {
    throw new HttpError(401, 'challenge_expired', 'This sign-in request expired. Please try again.')
  }

  const message = signInMessage(env, address, input.nonce, row.expires_at - nonceTtlSeconds)
  if (!(await signatureMatches(env, address, message, input.signature as Hex))) {
    throw new HttpError(401, 'invalid_signature', 'The signature does not match this wallet.')
  }

  const expiresAt = now + sessionTtlSeconds
  const token = await createSessionToken(secret, address, expiresAt)
  return { token, address, expiresAt }
}

export async function createSessionToken(secret: string, address: Address, expiresAt: number) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ sub: address, exp: expiresAt })))
  const signature = base64url(await hmacSha256(secret, `session.${payload}`))
  return `${payload}.${signature}`
}

export async function requireSession(env: Env, request: Request, now = Math.floor(Date.now() / 1000)) {
  const secret = requireSecret(env)
  const token = bearerToken(request)
  const [payload, signature] = token?.split('.') || []
  if (!payload || !signature) {
    throw new HttpError(401, 'unauthorized', 'Sign in with your wallet to continue.')
  }
  const expected = base64url(await hmacSha256(secret, `session.${payload}`))
  if (!safeEqual(signature, expected)) {
    throw new HttpError(401, 'unauthorized', 'Your session is invalid. Please sign in again.')
  }
  let claims: { sub?: string; exp?: number }
  try {
    claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload)))
  } catch {
    throw new HttpError(401, 'unauthorized', 'Your session is invalid. Please sign in again.')
  }
  if (!claims.exp || claims.exp < now || !claims.sub) {
    throw new HttpError(401, 'session_expired', 'Your session expired. Please sign in again.')
  }
  return parseAddress(claims.sub)
}
