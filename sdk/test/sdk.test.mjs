import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WalletFaceError, avatarImageUrl, createClient } from '../index.js'

const address = '0x52908400098527886E0F7030069857D2E4169EE7'

test('builds image URLs without leaking an API key', () => {
  assert.equal(avatarImageUrl(address), `https://api.dao.sarl/v1/avatar/${address}/image`)
  assert.equal(
    avatarImageUrl('vitalik.eth', { size: 64, fallback: '404', baseUrl: 'https://x.test/' }),
    'https://x.test/v1/avatar/vitalik.eth/image?s=64&fallback=404',
  )
  const client = createClient({ apiKey: 'wf_live_secret', baseUrl: 'https://x.test' })
  assert.ok(!client.imageUrl(address).includes('secret'))
})

test('sends the API key and parses batch results', async () => {
  const seen = []
  const client = createClient({
    apiKey: 'wf_live_k',
    baseUrl: 'https://x.test',
    fetch: async (url, init) => {
      seen.push({ url, init })
      return Response.json({ results: [{ address, ens: null, avatar: null }] })
    },
  })
  const results = await client.getAvatars([address])
  assert.equal(results.length, 1)
  assert.equal(seen[0].url, 'https://x.test/v1/avatars')
  assert.equal(seen[0].init.headers['X-API-Key'], 'wf_live_k')
  assert.deepEqual(JSON.parse(seen[0].init.body), { ids: [address] })
})

test('turns API errors into WalletFaceError', async () => {
  const client = createClient({
    fetch: async () =>
      Response.json({ error: { code: 'quota_exceeded', message: 'Upgrade' } }, { status: 429 }),
  })
  await assert.rejects(client.getAvatar(address), (error) => {
    assert.ok(error instanceof WalletFaceError)
    assert.equal(error.status, 429)
    assert.equal(error.code, 'quota_exceeded')
    return true
  })
})
