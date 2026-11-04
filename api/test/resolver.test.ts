import { afterEach, describe, expect, it, vi } from 'vitest'
import { identiconSvg } from '../src/identicon'
import { gatewayUrls, parseIdentifier } from '../src/resolve'
import { call, createEnv, mockFetch, pngBytes, snapshotHub } from './helpers'

const alice = '0x52908400098527886E0F7030069857D2E4169EE7'
const bob = '0x8617E340B3D01FA5F11F306F4090FD50E238070D'

afterEach(() => vi.unstubAllGlobals())

describe('identifiers and URIs', () => {
  it('checksums addresses and normalizes ENS names', () => {
    expect(parseIdentifier(alice.toLowerCase())).toEqual({ address: alice })
    expect(parseIdentifier('Vitalik.ETH')).toEqual({ name: 'vitalik.eth' })
    expect(() => parseIdentifier('not-an-address')).toThrow(/0x address or an ENS name/)
  })

  it('expands ipfs:// and ar:// URIs across gateways and rejects others', () => {
    const env = createEnv()
    expect(gatewayUrls('ipfs://bafyabc', env)).toEqual(['https://gw1.test/ipfs/bafyabc', 'https://gw2.test/ipfs/bafyabc'])
    expect(gatewayUrls('ipfs://ipfs/bafyabc/a.png', env)[0]).toBe('https://gw1.test/ipfs/bafyabc/a.png')
    expect(gatewayUrls('ar://abc_DEF-1', env)).toEqual(['https://arweave.net/abc_DEF-1'])
    expect(gatewayUrls('javascript:alert(1)', env)).toEqual([])
    expect(gatewayUrls('http://insecure.test/a.png', env)).toEqual([])
  })

  it('draws a deterministic, script-free identicon', () => {
    const svg = identiconSvg(alice)
    expect(svg).toBe(identiconSvg(alice.toLowerCase()))
    expect(svg).not.toBe(identiconSvg(bob))
    expect(svg).toMatch(/^<svg [^>]*width="256"/)
    expect(svg).not.toMatch(/script|href/i)
  })
})

describe('GET /v1/avatar/:id', () => {
  it('returns the Snapshot avatar with gateway URLs', async () => {
    mockFetch(snapshotHub({ [alice.toLowerCase()]: 'ipfs://bafyalice' }))
    const response = await call(createEnv(), `/v1/avatar/${alice.toLowerCase()}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await response.json()).toEqual({
      address: alice,
      ens: null,
      avatar: {
        uri: 'ipfs://bafyalice',
        url: 'https://gw1.test/ipfs/bafyalice',
        gateways: ['https://gw1.test/ipfs/bafyalice', 'https://gw2.test/ipfs/bafyalice'],
        source: 'snapshot',
      },
    })
  })

  it('falls back to the ENS avatar when there is no Snapshot profile', async () => {
    mockFetch(snapshotHub({}))
    const ens = {
      addressForName: vi.fn(async () => alice as `0x${string}`),
      nameForAddress: vi.fn(async () => 'alice.eth'),
      avatarForName: vi.fn(async () => 'https://img.test/alice.png'),
    }
    const response = await call(createEnv(), '/v1/avatar/alice.eth', {}, { ens })
    const body = await response.json()
    expect(body).toMatchObject({ address: alice, ens: 'alice.eth', avatar: { source: 'ens', url: 'https://img.test/alice.png' } })
    expect(ens.nameForAddress).not.toHaveBeenCalled()
  })

  it('returns avatar: null for wallets without a profile and 400 for junk', async () => {
    mockFetch(snapshotHub({}))
    expect(await (await call(createEnv(), `/v1/avatar/${bob}`)).json()).toEqual({ address: bob, ens: null, avatar: null })
    const bad = await call(createEnv(), '/v1/avatar/hello')
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('invalid_identifier')
  })

  it('applies the anonymous per-IP rate limit', async () => {
    mockFetch(snapshotHub({}))
    const env = createEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } })
    const response = await call(env, `/v1/avatar/${bob}`)
    expect(response.status).toBe(429)
  })
})

describe('GET /v1/avatar/:id/image', () => {
  it('skips a failing gateway and serves the image from the next one', async () => {
    mockFetch(
      snapshotHub({ [alice.toLowerCase()]: 'ipfs://bafyalice' }),
      (request) => (request.url.startsWith('https://gw1.test/') ? new Response('down', { status: 504 }) : undefined),
      (request) =>
        request.url === 'https://gw2.test/ipfs/bafyalice'
          ? new Response(pngBytes, { headers: { 'Content-Type': 'application/octet-stream' } })
          : undefined,
    )
    const response = await call(createEnv(), `/v1/avatar/${alice}/image`)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('X-Avatar-Source')).toBe('snapshot')
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes)
  })

  it('serves an identicon, or 404 on request, when there is no avatar', async () => {
    mockFetch(snapshotHub({}))
    const identicon = await call(createEnv(), `/v1/avatar/${bob}/image?s=64`)
    expect(identicon.headers.get('Content-Type')).toBe('image/svg+xml')
    expect(await identicon.text()).toContain('width="64"')

    const missing = await call(createEnv(), `/v1/avatar/${bob}/image?fallback=404`)
    expect(missing.status).toBe(404)
  })

  it('does not proxy non-image responses', async () => {
    mockFetch(snapshotHub({ [alice.toLowerCase()]: 'ipfs://bafyalice' }), () =>
      new Response('<html>hi</html>', { headers: { 'Content-Type': 'text/html' } }),
    )
    const response = await call(createEnv(), `/v1/avatar/${alice}/image`)
    expect(response.headers.get('X-Avatar-Source')).toBe('identicon')
  })
})

describe('service routes', () => {
  it('lists plans and reports billing as disabled without Stripe config', async () => {
    const body = await (await call(createEnv(), '/v1/plans')).json()
    expect(body.billing).toBe(false)
    expect(body.plans.map((plan: { id: string }) => plan.id)).toEqual(['free', 'pro', 'business'])
  })

  it('answers CORS preflight and unknown routes', async () => {
    expect((await call(createEnv(), '/v1/avatars', { method: 'OPTIONS' })).status).toBe(204)
    expect((await call(createEnv(), '/nope')).status).toBe(404)
  })
})
