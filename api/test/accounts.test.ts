import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionToken } from '../src/auth'
import { currentPeriod } from '../src/plans'
import { call, createEnv, mockFetch, snapshotHub } from './helpers'

const wallet = privateKeyToAccount('0x0123456789012345678901234567890123456789012345678901234567890123')
const other = privateKeyToAccount('0x1111111111111111111111111111111111111111111111111111111111111111')

afterEach(() => vi.unstubAllGlobals())

async function signIn(env: ReturnType<typeof createEnv>, signer = wallet) {
  const challenge = await (await call(env, `/v1/auth/nonce?address=${wallet.address}`)).json()
  expect(challenge.message).toContain('app.example.com wants you to sign in')
  expect(challenge.message).toContain(`Nonce: ${challenge.nonce}`)
  const signature = await signer.signMessage({ message: challenge.message })
  return call(env, '/v1/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ address: wallet.address, nonce: challenge.nonce, signature }),
  })
}

describe('wallet sign-in', () => {
  it('issues a session for a valid signature and rejects reuse of the nonce', async () => {
    const env = createEnv()
    const challenge = await (await call(env, `/v1/auth/nonce?address=${wallet.address}`)).json()
    const signature = await wallet.signMessage({ message: challenge.message })
    const body = JSON.stringify({ address: wallet.address, nonce: challenge.nonce, signature })

    const first = await call(env, '/v1/auth/verify', { method: 'POST', body })
    expect(first.status).toBe(200)
    expect((await first.json()).token).toMatch(/^[\w-]+\.[\w-]+$/)

    const replay = await call(env, '/v1/auth/verify', { method: 'POST', body })
    expect(replay.status).toBe(401)
  })

  it('rejects a signature from another wallet', async () => {
    const response = await signIn(createEnv(), other)
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe('invalid_signature')
  })

  it('rejects tampered and expired sessions', async () => {
    const env = createEnv()
    const expired = await createSessionToken(env.SESSION_SECRET!, wallet.address, 1)
    const forged = await createSessionToken('another-secret-value-0000', wallet.address, 4_000_000_000)
    for (const token of [expired, forged, 'garbage']) {
      const response = await call(env, '/v1/account', { headers: { Authorization: `Bearer ${token}` } })
      expect(response.status).toBe(401)
    }
  })

  it('reports sign-in as unavailable without a session secret', async () => {
    const response = await call(createEnv({ SESSION_SECRET: undefined }), `/v1/auth/nonce?address=${wallet.address}`)
    expect(response.status).toBe(503)
  })
})

describe('API keys, quotas and batch lookups', () => {
  it('creates a key, meters usage, enforces quota and plan batch limits', async () => {
    mockFetch(snapshotHub({ [wallet.address.toLowerCase()]: 'ipfs://bafyme' }))
    const env = createEnv()
    const { token } = await (await signIn(env)).json()
    const auth = { Authorization: `Bearer ${token}` }

    const account = await (await call(env, '/v1/account', { headers: auth })).json()
    expect(account).toMatchObject({ plan: 'free', apiKey: null, usage: { requests: 0 } })

    const created = await call(env, '/v1/account/keys', { method: 'POST', headers: auth })
    expect(created.status).toBe(201)
    const { key, prefix } = await created.json()
    expect(key).toMatch(/^wf_live_[0-9A-Za-z]{32}$/)
    expect(prefix).not.toContain(key.slice(12, -4))

    // The plaintext key is never stored.
    const stored = env.DB.raw.prepare('SELECT key_hash FROM api_keys').all() as Array<{ key_hash: string }>
    expect(stored.every((row) => row.key_hash !== key)).toBe(true)

    const lookup = await call(env, `/v1/avatar/${wallet.address}`, { headers: { 'X-API-Key': key } })
    expect(lookup.status).toBe(200)
    expect(lookup.headers.get('X-RateLimit-Limit')).toBe('10000')
    expect(lookup.headers.get('X-RateLimit-Remaining')).toBe('9999')

    const batch = await call(env, '/v1/avatars', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ids: [wallet.address, other.address] }),
    })
    const { results } = await batch.json()
    expect(results.map((r: { avatar: { uri: string } | null }) => r.avatar?.uri ?? null)).toEqual(['ipfs://bafyme', null])

    const usage = await (await call(env, '/v1/account', { headers: auth })).json()
    expect(usage.usage.requests).toBe(3)
    expect(usage.apiKey.prefix).toBe(prefix)

    const tooBig = await call(env, '/v1/avatars', {
      method: 'POST',
      headers: { 'X-API-Key': key },
      body: JSON.stringify({ ids: Array.from({ length: 26 }, () => wallet.address) }),
    })
    expect((await tooBig.json()).error.code).toBe('batch_too_large')

    env.DB.raw
      .prepare('UPDATE usage SET count = 10000 WHERE address = ? AND period = ?')
      .run(wallet.address.toLowerCase(), currentPeriod())
    const overQuota = await call(env, `/v1/avatar/${wallet.address}`, { headers: { 'X-API-Key': key } })
    expect(overQuota.status).toBe(429)
    expect((await overQuota.json()).error.code).toBe('quota_exceeded')
  })

  it('revokes the previous key on rotation and requires a key for batch', async () => {
    mockFetch(snapshotHub({}))
    const env = createEnv()
    const { token } = await (await signIn(env)).json()
    const auth = { Authorization: `Bearer ${token}` }
    const first = (await (await call(env, '/v1/account/keys', { method: 'POST', headers: auth })).json()).key
    await call(env, '/v1/account/keys', { method: 'POST', headers: auth })

    const revoked = await call(env, `/v1/avatar/${wallet.address}`, { headers: { 'X-API-Key': first } })
    expect(revoked.status).toBe(401)

    const anonymousBatch = await call(env, '/v1/avatars', { method: 'POST', body: '{"ids":["0x0"]}' })
    expect(anonymousBatch.status).toBe(401)
  })
})
